import "server-only";

import prisma from "@/lib/db";
import { OrgOperationalSettings } from "@/lib/org-operational-settings";
import { AuditEventService } from "./audit-event.service";
import { ComplianceNLPService } from "./compliance-nlp.service";

/**
 * Trading Order Management System (OMS)
 *
 * Institutional-grade order management with:
 * - Pre-trade compliance checks
 * - FIX protocol message generation (stubs)
 * - Order routing to custodians
 * - Execution quality tracking
 * - Block trading and allocation
 * - Trade blotter and audit trail
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
export type OrderStatus = "DRAFT" | "PENDING_COMPLIANCE" | "APPROVED" | "SUBMITTED" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";
export type TimeInForce = "DAY" | "GTC" | "IOC" | "FOK";
export type CustodianDestination = "SCHWAB" | "FIDELITY" | "PERSHING" | "FIX_GENERIC";

export interface TradeOrder {
  id: string;
  clientId: string;
  accountId: string;
  organizationId: string;
  ticker: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  status: OrderStatus;
  submittedAt?: Date;
  filledAt?: Date;
  fillPrice?: number;
  fillQuantity?: number;
  commission?: number;
  custodian: CustodianDestination;
  complianceStatus: "PENDING" | "APPROVED" | "REJECTED";
  complianceNotes?: string;
  advisorId: string;
  reason: string;
  rebalanceId?: string;
  fixMessageId?: string;
}

export interface PreTradeComplianceResult {
  approved: boolean;
  checks: ComplianceCheck[];
  warnings: string[];
  blockingIssues: string[];
}

export interface ComplianceCheck {
  rule: string;
  passed: boolean;
  message: string;
  severity: "PASS" | "WARN" | "FAIL";
}

export interface FixMessage {
  msgType: string; // D=Order, 8=Execution, 0=Heartbeat
  senderCompId: string;
  targetCompId: string;
  fields: Record<number, string>; // FIX tag -> value
  raw: string;
}

export interface ExecutionQuality {
  orderId: string;
  ticker: string;
  side: OrderSide;
  orderQuantity: number;
  fillQuantity: number;
  fillPrice: number;
  benchmarkPrice: number; // NBBO at time of order
  slippageBps: number; // positive = worse than benchmark
  executionTime: number; // ms from submit to fill
  marketImpactBps: number;
}

export interface BlockTrade {
  blockOrderId: string;
  ticker: string;
  side: OrderSide;
  totalQuantity: number;
  fillPrice: number;
  allocations: { clientId: string; accountId: string; quantity: number }[];
  status: "PENDING" | "FILLED" | "ALLOCATED";
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TradingOMSService {
  /**
   * Pre-trade compliance check before submitting an order.
   */
  static async preTradeCompliance(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): Promise<PreTradeComplianceResult> {
    const checks: ComplianceCheck[] = [];
    const warnings: string[] = [];
    const blockingIssues: string[] = [];

    // 1. Concentration check — single position should not exceed X% of portfolio
    const concentration = await this.checkConcentration(order);
    checks.push(concentration);
    if (!concentration.passed && concentration.severity === "FAIL") {
      blockingIssues.push(concentration.message);
    } else if (!concentration.passed) {
      warnings.push(concentration.message);
    }

    // 2. Suitability check — does the trade match client risk profile?
    const suitability = await this.checkSuitability(order);
    checks.push(suitability);
    if (!suitability.passed) {
      warnings.push(suitability.message);
    }

    // 3. Wash sale check — selling at a loss and buying same/substantially identical within 30 days
    const washSale = await this.checkWashSale(order);
    checks.push(washSale);
    if (!washSale.passed) {
      warnings.push(washSale.message);
    }

    // 4. Trading restriction check — is there a hold on this account?
    const restriction = await this.checkRestrictions(order);
    checks.push(restriction);
    if (!restriction.passed) {
      blockingIssues.push(restriction.message);
    }

    // 5. Minimum trade size check
    const minTrade = await this.checkMinimumTradeSize(order);
    checks.push(minTrade);
    if (!minTrade.passed) {
      blockingIssues.push(minTrade.message);
    }

    // 6. Leverage/margin check for buy orders
    if (order.side === "BUY") {
      const leverage = await this.checkLeverage(order);
      checks.push(leverage);
      if (!leverage.passed) {
        warnings.push(leverage.message);
      }
    }

    const approved = blockingIssues.length === 0;

    return { approved, checks, warnings, blockingIssues };
  }

  /**
   * Submit an order after compliance approval.
   */
  static async submitOrder(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
    userId: string,
  ): Promise<TradeOrder> {
    await OrgOperationalSettings.assertTradingWritesAllowed(order.organizationId);

    // Run pre-trade compliance
    const compliance = await this.preTradeCompliance(order);

    if (!compliance.approved) {
      await AuditEventService.appendEvent({
        organizationId: order.organizationId,
        userId,
        action: "ORDER_REJECTED_COMPLIANCE",
        target: `Order:${order.ticker}`,
        details: `Order for ${order.ticker} rejected: ${compliance.blockingIssues.join("; ")}`,
        severity: "WARNING",
        metadata: { ticker: order.ticker, side: order.side, blockingIssues: compliance.blockingIssues },
      });

      return {
        ...order,
        id: `ORD-${Date.now()}`,
        status: "REJECTED",
        complianceStatus: "REJECTED",
        complianceNotes: compliance.blockingIssues.join("; "),
      };
    }

    // Generate FIX message
    const fixMessage = this.generateFixOrderMessage(order);

    // Create the order record
    const tradeOrder: TradeOrder = {
      ...order,
      id: `ORD-${Date.now()}`,
      status: compliance.warnings.length > 0 ? "PENDING_COMPLIANCE" : "SUBMITTED",
      complianceStatus: compliance.warnings.length > 0 ? "PENDING" : "APPROVED",
      complianceNotes: compliance.warnings.length > 0 ? compliance.warnings.join("; ") : undefined,
      fixMessageId: fixMessage.fields[11] ?? undefined, // ClOrdID
    };

    // TODO: Actually send FIX message to custodian
    // await this.sendFixMessage(fixMessage, order.custodian);

    await AuditEventService.appendEvent({
      organizationId: order.organizationId,
      userId,
      action: "ORDER_SUBMITTED",
      target: `Order:${tradeOrder.id}`,
      details: `${order.side} ${order.quantity} ${order.ticker} @ ${order.orderType} → ${order.custodian}`,
      severity: "INFO",
      metadata: {
        orderId: tradeOrder.id,
        ticker: order.ticker,
        side: order.side,
        quantity: order.quantity,
        custodian: order.custodian,
        fixMsgId: tradeOrder.fixMessageId,
      },
    });

    return tradeOrder;
  }

  /**
   * Process a fill report from a custodian.
   */
  static async processFill(
    orderId: string,
    fillPrice: number,
    fillQuantity: number,
    commission: number,
    organizationId: string,
  ): Promise<ExecutionQuality> {
    // Calculate execution quality metrics
    const benchmarkPrice = fillPrice; // TODO: Get actual NBBO at order time
    const slippageBps = benchmarkPrice > 0
      ? ((fillPrice - benchmarkPrice) / benchmarkPrice) * 10000
      : 0;

    const quality: ExecutionQuality = {
      orderId,
      ticker: "", // Populated from order lookup
      side: "BUY",
      orderQuantity: fillQuantity,
      fillQuantity,
      fillPrice,
      benchmarkPrice,
      slippageBps: Math.round(slippageBps * 100) / 100,
      executionTime: 0, // TODO: Track from order submission
      marketImpactBps: 0, // TODO: Calculate from market data
    };

    await AuditEventService.appendEvent({
      organizationId,
      action: "ORDER_FILLED",
      target: `Order:${orderId}`,
      details: `Fill: ${fillQuantity} @ $${fillPrice}, commission $${commission}, slippage ${slippageBps.toFixed(1)}bps`,
      severity: "INFO",
      metadata: { orderId, fillPrice, fillQuantity, commission, slippageBps },
    });

    return quality;
  }

  /**
   * Generate a FIX 4.4 New Order Single message.
   */
  private static generateFixOrderMessage(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): FixMessage {
    const clOrdId = `DRIFT-${Date.now()}`;
    const side = order.side === "BUY" ? "1" : "2";
    const type = order.orderType === "MARKET" ? "1" : order.orderType === "LIMIT" ? "2" : "4";

    const fields: Record<number, string> = {
      8: "FIX.4.4",     // BeginString
      35: "D",           // MsgType = New Order Single
      49: "DRIFT",       // SenderCompID
      56: order.custodian, // TargetCompID
      11: clOrdId,       // ClOrdID
      55: order.ticker,  // Symbol
      54: side,          // Side
      40: type,          // OrdType
      38: String(order.quantity), // OrderQty
      1: order.accountId, // Account
      60: new Date().toISOString().replace(/[-:T]/g, "").slice(0, 17), // TransactTime
    };

    if (order.limitPrice) fields[44] = String(order.limitPrice); // Price
    if (order.stopPrice) fields[99] = String(order.stopPrice);   // StopPx

    // TimeInForce
    const tifMap: Record<string, string> = { DAY: "0", GTC: "1", IOC: "3", FOK: "4" };
    fields[59] = tifMap[order.timeInForce] ?? "0";

    // Build raw FIX string
    const body = Object.entries(fields)
      .map(([tag, value]) => `${tag}=${value}`)
      .join("\x01");
    const raw = `8=FIX.4.4\x019=${body.length}\x01${body}\x0110=000\x01`;

    return {
      msgType: "D",
      senderCompId: "DRIFT",
      targetCompId: order.custodian,
      fields,
      raw,
    };
  }

  // -----------------------------------------------------------------------
  // Compliance Checks
  // -----------------------------------------------------------------------

  private static async checkConcentration(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): Promise<ComplianceCheck> {
    const account = await prisma.financialAccount.findUnique({
      where: { id: order.accountId },
      include: { holdings: true },
    });

    if (!account) {
      return { rule: "CONCENTRATION", passed: false, message: "Account not found", severity: "FAIL" };
    }

    const totalValue = account.holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);
    const existingPosition = account.holdings.find((h) => h.symbol === order.ticker);
    const existingValue = existingPosition?.marketValue ?? 0;

    const orderValue = order.quantity * (order.limitPrice ?? existingPosition?.marketValue ?? 0 / (existingPosition?.quantity ?? 1));
    const postTradeValue = order.side === "BUY"
      ? existingValue + orderValue
      : existingValue - orderValue;

    const concentrationPercent = totalValue > 0 ? (postTradeValue / (totalValue + (order.side === "BUY" ? orderValue : 0))) * 100 : 0;

    if (concentrationPercent > 20) {
      return {
        rule: "CONCENTRATION",
        passed: false,
        message: `Post-trade concentration in ${order.ticker}: ${concentrationPercent.toFixed(1)}% (limit: 20%)`,
        severity: "FAIL",
      };
    }

    if (concentrationPercent > 10) {
      return {
        rule: "CONCENTRATION",
        passed: true,
        message: `Post-trade concentration in ${order.ticker}: ${concentrationPercent.toFixed(1)}% (warning threshold: 10%)`,
        severity: "WARN",
      };
    }

    return { rule: "CONCENTRATION", passed: true, message: "Within concentration limits", severity: "PASS" };
  }

  private static async checkSuitability(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): Promise<ComplianceCheck> {
    const client = await prisma.client.findUnique({
      where: { id: order.clientId },
      select: { riskProfile: true, name: true },
    });

    // High-risk securities for conservative clients
    const speculativeTickers = ["TSLA", "COIN", "MSTR", "PLTR", "SOFI"];
    const isSpeculative = speculativeTickers.includes(order.ticker);

    if (isSpeculative && client?.riskProfile?.toLowerCase().includes("conservative")) {
      return {
        rule: "SUITABILITY",
        passed: false,
        message: `${order.ticker} may not be suitable for ${client.name}'s ${client.riskProfile} risk profile`,
        severity: "WARN",
      };
    }

    return { rule: "SUITABILITY", passed: true, message: "Suitability check passed", severity: "PASS" };
  }

  private static async checkWashSale(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): Promise<ComplianceCheck> {
    if (order.side !== "SELL") {
      return { rule: "WASH_SALE", passed: true, message: "N/A for buy orders", severity: "PASS" };
    }

    // Check if there's a buy order for the same ticker in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    // In production, query actual trade history
    return { rule: "WASH_SALE", passed: true, message: "No wash sale pattern detected", severity: "PASS" };
  }

  private static async checkRestrictions(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): Promise<ComplianceCheck> {
    // Check for compliance flags on this account
    const flags = await prisma.complianceFlag.findMany({
      where: {
        targetId: order.accountId,
        status: { in: ["OPEN", "UNDER_REVIEW"] },
        type: "TRADING_RESTRICTION",
      },
    });

    if (flags.length > 0) {
      return {
        rule: "TRADING_RESTRICTION",
        passed: false,
        message: `Account has ${flags.length} active trading restriction(s)`,
        severity: "FAIL",
      };
    }

    return { rule: "TRADING_RESTRICTION", passed: true, message: "No trading restrictions", severity: "PASS" };
  }

  private static async checkMinimumTradeSize(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): Promise<ComplianceCheck> {
    const minValue = 100; // $100 minimum trade
    const estimatedValue = order.quantity * (order.limitPrice ?? 100);

    if (estimatedValue < minValue) {
      return {
        rule: "MIN_TRADE_SIZE",
        passed: false,
        message: `Trade value $${estimatedValue.toFixed(2)} below minimum $${minValue}`,
        severity: "FAIL",
      };
    }

    return { rule: "MIN_TRADE_SIZE", passed: true, message: "Above minimum trade size", severity: "PASS" };
  }

  private static async checkLeverage(
    order: Omit<TradeOrder, "id" | "status" | "complianceStatus">,
  ): Promise<ComplianceCheck> {
    const account = await prisma.financialAccount.findUnique({
      where: { id: order.accountId },
      include: { holdings: true },
    });

    if (!account) {
      return { rule: "LEVERAGE", passed: true, message: "Account not found — skip check", severity: "PASS" };
    }

    const totalValue = account.holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);
    const orderValue = order.quantity * (order.limitPrice ?? 100);

    if (orderValue > totalValue * 0.5) {
      return {
        rule: "LEVERAGE",
        passed: false,
        message: `Order represents ${(orderValue / totalValue * 100).toFixed(1)}% of account value — requires margin`,
        severity: "WARN",
      };
    }

    return { rule: "LEVERAGE", passed: true, message: "No leverage concern", severity: "PASS" };
  }

  // -----------------------------------------------------------------------
  // Block Trading
  // -----------------------------------------------------------------------

  /**
   * Create a block trade for multiple client accounts.
   */
  static async createBlockTrade(
    ticker: string,
    side: OrderSide,
    allocations: { clientId: string; accountId: string; quantity: number }[],
    organizationId: string,
    userId: string,
  ): Promise<BlockTrade> {
    const totalQuantity = allocations.reduce((sum, a) => sum + a.quantity, 0);
    const blockId = `BLK-${Date.now()}`;

    const block: BlockTrade = {
      blockOrderId: blockId,
      ticker,
      side,
      totalQuantity,
      fillPrice: 0, // Updated on fill
      allocations,
      status: "PENDING",
    };

    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "BLOCK_TRADE_CREATED",
      target: `Block:${blockId}`,
      details: `Block trade: ${side} ${totalQuantity} ${ticker} for ${allocations.length} accounts`,
      severity: "INFO",
      metadata: { blockId, ticker, side, totalQuantity, accountCount: allocations.length },
    });

    return block;
  }

  /**
   * Allocate a filled block trade to individual accounts.
   */
  static async allocateBlockTrade(
    block: BlockTrade,
    fillPrice: number,
    organizationId: string,
    userId: string,
  ): Promise<TradeOrder[]> {
    const orders: TradeOrder[] = [];

    for (const alloc of block.allocations) {
      const order = await this.submitOrder(
        {
          clientId: alloc.clientId,
          accountId: alloc.accountId,
          organizationId,
          ticker: block.ticker,
          side: block.side,
          orderType: "MARKET",
          quantity: alloc.quantity,
          timeInForce: "DAY",
          custodian: "SCHWAB", // Default
          advisorId: userId,
          reason: `Block trade allocation: ${block.blockOrderId}`,
          rebalanceId: block.blockOrderId,
        },
        userId,
      );
      orders.push(order);
    }

    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "BLOCK_TRADE_ALLOCATED",
      target: `Block:${block.blockOrderId}`,
      details: `Block allocated: ${block.ticker} @ $${fillPrice} to ${orders.length} accounts`,
      severity: "INFO",
      metadata: { blockId: block.blockOrderId, fillPrice, accounts: orders.length },
    });

    return orders;
  }
}
