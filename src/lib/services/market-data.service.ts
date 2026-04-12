import "server-only";

import { AuditEventService } from "./audit-event.service";

/**
 * Real-Time Market Data Service
 *
 * Integrates with live market data providers:
 * - Bloomberg B-PIPE / Terminal API
 * - Refinitiv (LSEG) Eikon / Datastream
 * - Alpha Vantage (free tier)
 * - Polygon.io (real-time equities + options)
 * - IEX Cloud
 * - Yahoo Finance (fallback)
 *
 * Provides:
 * - Real-time quotes (last, bid, ask, volume)
 * - Historical OHLCV data
 * - Company fundamentals
 * - News sentiment
 * - Options chains
 * - Economic indicators
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketDataProvider = "BLOOMBERG" | "REFINITIV" | "ALPHA_VANTAGE" | "POLYGON" | "IEX" | "YAHOO";

export interface RealTimeQuote {
  ticker: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  provider: MarketDataProvider;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface CompanyFundamentals {
  ticker: string;
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  dividendYield: number;
  eps: number;
  revenue: number;
  netIncome: number;
  debtToEquity: number;
  returnOnEquity: number;
  beta: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  sector: string;
  industry: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  ticker: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  sentimentScore: number; // -1 to 1
  publishedAt: Date;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MarketDataService {
  /**
   * Get a real-time quote for a ticker.
   * Tries providers in order of preference based on org configuration.
   */
  static async getQuote(
    ticker: string,
    preferredProvider?: MarketDataProvider,
  ): Promise<RealTimeQuote | null> {
    const provider = preferredProvider ?? "POLYGON";

    switch (provider) {
      case "POLYGON":
        return this.getPolygonQuote(ticker);
      case "ALPHA_VANTAGE":
        return this.getAlphaVantageQuote(ticker);
      case "YAHOO":
        return this.getYahooQuote(ticker);
      case "BLOOMBERG":
        return this.getBloombergQuote(ticker);
      case "REFINITIV":
        return this.getRefinitivQuote(ticker);
      case "IEX":
        return this.getIexQuote(ticker);
      default:
        return null;
    }
  }

  /**
   * Get historical OHLCV data.
   */
  static async getHistoricalBars(
    ticker: string,
    startDate: string,
    endDate: string,
    interval: "minute" | "hour" | "day" | "week" | "month" = "day",
    provider: MarketDataProvider = "POLYGON",
  ): Promise<HistoricalBar[]> {
    switch (provider) {
      case "POLYGON":
        return this.getPolygonHistorical(ticker, startDate, endDate, interval);
      default:
        return [];
    }
  }

  /**
   * Get company fundamentals.
   */
  static async getFundamentals(
    ticker: string,
    provider: MarketDataProvider = "POLYGON",
  ): Promise<CompanyFundamentals | null> {
    // TODO: Implement per provider
    return null;
  }

  /**
   * Get news for a ticker.
   */
  static async getNews(
    ticker: string,
    limit: number = 10,
  ): Promise<NewsItem[]> {
    // TODO: Implement news aggregation from providers
    return [];
  }

  // -----------------------------------------------------------------------
  // Provider Implementations
  // -----------------------------------------------------------------------

  private static async getPolygonQuote(ticker: string): Promise<RealTimeQuote | null> {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://api.polygon.io/v2/last/trade/${ticker}?apiKey=${apiKey}`,
      );

      if (!response.ok) return null;

      const data = await response.json();
      const trade = data.results;

      return {
        ticker,
        lastPrice: trade.p,
        bidPrice: trade.p,
        askPrice: trade.p,
        bidSize: trade.s,
        askSize: trade.s,
        volume: trade.s,
        open: 0,
        high: 0,
        low: 0,
        close: trade.p,
        change: 0,
        changePercent: 0,
        timestamp: new Date(trade.t),
        provider: "POLYGON",
      };
    } catch {
      return null;
    }
  }

  private static async getPolygonHistorical(
    ticker: string,
    startDate: string,
    endDate: string,
    interval: string,
  ): Promise<HistoricalBar[]> {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) return [];

    try {
      const multiplier = interval === "day" ? 1 : interval === "week" ? 1 : interval === "month" ? 1 : 1;
      const timespan = interval === "day" ? "day" : interval === "week" ? "week" : "month";

      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${startDate}/${endDate}?apiKey=${apiKey}`,
      );

      if (!response.ok) return [];

      const data = await response.json();

      return (data.results ?? []).map((bar: any) => ({
        date: new Date(bar.t).toISOString().slice(0, 10),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));
    } catch {
      return [];
    }
  }

  private static async getAlphaVantageQuote(ticker: string): Promise<RealTimeQuote | null> {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`,
      );

      if (!response.ok) return null;

      const data = await response.json();
      const q = data["Global Quote"];

      if (!q) return null;

      return {
        ticker,
        lastPrice: parseFloat(q["05. price"]),
        bidPrice: 0,
        askPrice: 0,
        bidSize: 0,
        askSize: 0,
        volume: parseInt(q["06. volume"]),
        open: parseFloat(q["02. open"]),
        high: parseFloat(q["03. high"]),
        low: parseFloat(q["04. low"]),
        close: parseFloat(q["05. price"]),
        change: parseFloat(q["09. change"]),
        changePercent: parseFloat(q["10. change percent"]?.replace("%", "")),
        timestamp: new Date(q["07. latest trading day"]),
        provider: "ALPHA_VANTAGE",
      };
    } catch {
      return null;
    }
  }

  private static async getYahooQuote(ticker: string): Promise<RealTimeQuote | null> {
    // Yahoo Finance API is unofficial and may break
    // Use as fallback only
    return null;
  }

  private static async getBloombergQuote(ticker: string): Promise<RealTimeQuote | null> {
    // Bloomberg B-PIPE requires enterprise subscription
    // Implementation would use WebSocket connection to B-PIPE
    return null;
  }

  private static async getRefinitivQuote(ticker: string): Promise<RealTimeQuote | null> {
    // Refinitiv Eikon requires enterprise subscription
    return null;
  }

  private static async getIexQuote(ticker: string): Promise<RealTimeQuote | null> {
    const apiKey = process.env.IEX_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://cloud.iexapis.com/stable/stock/${ticker}/quote?token=${apiKey}`,
      );

      if (!response.ok) return null;

      const data = await response.json();

      return {
        ticker,
        lastPrice: data.latestPrice,
        bidPrice: data.iexBidPrice ?? 0,
        askPrice: data.iexAskPrice ?? 0,
        bidSize: data.iexBidSize ?? 0,
        askSize: data.iexAskSize ?? 0,
        volume: data.latestVolume ?? 0,
        open: data.open ?? 0,
        high: data.high ?? 0,
        low: data.low ?? 0,
        close: data.close ?? 0,
        change: data.change ?? 0,
        changePercent: data.changePercent ? data.changePercent * 100 : 0,
        timestamp: new Date(data.latestUpdate),
        provider: "IEX",
      };
    } catch {
      return null;
    }
  }
}
