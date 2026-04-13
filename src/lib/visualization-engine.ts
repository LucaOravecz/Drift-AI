/**
 * Visualization Engine
 *
 * Generates data visualizations, charts, and diagrams for financial advisor insights.
 * Uses Claude API to intelligently create visualizations based on financial data.
 */

import { callClaude } from './services/ai.service'

export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'gauge'
export type DiagramType = 'flowchart' | 'timeline' | 'hierarchy' | 'network'

export interface DataVisualizationRequest {
  title: string
  data: Record<string, unknown>
  chartType: ChartType
  description?: string
  color?: string
}

export interface DiagramRequest {
  title: string
  content: string
  type: DiagramType
  description?: string
}

/**
 * Generate an SVG chart from financial data using Claude
 * Useful for dynamic portfolio visualizations, market analysis, etc.
 */
export async function generateChart(request: DataVisualizationRequest): Promise<string> {
  const systemPrompt = `You are a data visualization expert. Generate SVG charts that are:
1. Clean and professional for financial advisors
2. Mobile-responsive with appropriate scaling
3. Using accessible color schemes
4. Labeled clearly with values and percentages

Return ONLY valid SVG code, nothing else.`

  const userMessage = `Create a ${request.chartType} chart with this data:
Title: ${request.title}
${request.description ? `Description: ${request.description}` : ''}
Data: ${JSON.stringify(request.data)}
${request.color ? `Primary Color: ${request.color}` : ''}

Generate the SVG chart code.`

  return callClaude(systemPrompt, userMessage, { maxTokens: 2048, organizationId: 'system' })
}

/**
 * Generate a text-based diagram (ASCII or Mermaid) for conceptual visualization
 * Useful for investment strategies, trust hierarchies, etc.
 */
export async function generateDiagram(request: DiagramRequest): Promise<string> {
  const systemPrompt = `You are a diagram expert. Generate ${request.type} diagrams that are:
1. Clear and easy to understand
2. Using Mermaid diagram syntax for maximum compatibility
3. Professional and suitable for financial advisor presentations
4. Including proper labels and relationships

Return ONLY valid Mermaid diagram code, nothing else.`

  const userMessage = `Create a ${request.type} diagram:
Title: ${request.title}
${request.description ? `Description: ${request.description}` : ''}

Content to visualize:
${request.content}

Generate the Mermaid diagram code.`

  return callClaude(systemPrompt, userMessage, { maxTokens: 2048, organizationId: 'system' })
}

/**
 * Generate performance analytics dashboard visualization
 */
export async function generatePerformanceDashboard(
  clientName: string,
  performanceData: {
    ytdReturn: number
    benchmarkReturn: number
    volatility: number
    sharpeRatio: number
  }
): Promise<string> {
  const systemPrompt = `You are creating a financial performance dashboard for advisors.
Generate an SVG dashboard showing key metrics with gauges and mini-charts.
Use professional colors (blues, greens for positive, oranges for caution).
Include percentage comparisons to benchmarks.`

  const userMessage = `Create a performance dashboard SVG for ${clientName}:
- YTD Return: ${performanceData.ytdReturn}%
- Benchmark Return: ${performanceData.benchmarkReturn}%
- Volatility (Std Dev): ${performanceData.volatility}%
- Sharpe Ratio: ${performanceData.sharpeRatio.toFixed(2)}

Show return comparison gauge, volatility meter, and Sharpe ratio indicator.`

  return callClaude(systemPrompt, userMessage, { maxTokens: 2048, organizationId: 'system' })
}

/**
 * Generate a portfolio allocation visualization
 */
export async function generateAllocationChart(
  holdings: Record<string, number>
): Promise<string> {
  const systemPrompt = `You are a portfolio visualization expert.
Generate a professional pie chart showing asset allocation.
Use complementary colors that are accessible.
Include percentage labels for each allocation.`

  const userMessage = `Create a portfolio allocation pie chart:
${Object.entries(holdings)
  .map(([asset, pct]) => `${asset}: ${pct}%`)
  .join('\n')}

Generate clean SVG pie chart with legend.`

  return callClaude(systemPrompt, userMessage, { maxTokens: 2048, organizationId: 'system' })
}

/**
 * Generate a financial timeline (e.g., retirement planning, tax events)
 */
export async function generateFinancialTimeline(
  events: Array<{
    date: string
    event: string
    type: 'milestone' | 'payment' | 'review' | 'tax'
  }>
): Promise<string> {
  const systemPrompt = `You are creating a financial timeline for planning purposes.
Use Mermaid timeline syntax.
Color-code events by type: milestones (blue), payments (green), reviews (orange), tax (red).
Make it clear and easy to understand at a glance.`

  const userMessage = `Create a financial timeline with these events:
${events.map((e) => `${e.date}: ${e.event} (${e.type})`).join('\n')}

Generate Mermaid timeline diagram.`

  return callClaude(systemPrompt, userMessage, { maxTokens: 2048, organizationId: 'system' })
}

/**
 * Generate a risk profile visualization
 */
export async function generateRiskProfile(
  riskMetrics: {
    marketRisk: number
    concentrationRisk: number
    liquidityRisk: number
    inflationRisk: number
  }
): Promise<string> {
  const systemPrompt = `You are creating a risk profile dashboard for financial advisors.
Generate a radar/spider chart showing multiple risk dimensions.
Use color gradients from green (low risk) to red (high risk).
Include benchmark lines if applicable.`

  const userMessage = `Create a risk profile radar chart:
- Market Risk: ${riskMetrics.marketRisk}/10
- Concentration Risk: ${riskMetrics.concentrationRisk}/10
- Liquidity Risk: ${riskMetrics.liquidityRisk}/10
- Inflation Risk: ${riskMetrics.inflationRisk}/10

Generate SVG radar chart visualization.`

  return callClaude(systemPrompt, userMessage, { maxTokens: 2048, organizationId: 'system' })
}

/**
 * Intelligence Engine diagram showing reasoning domains and data flow
 */
export async function generateIntelligenceEngineDiagram(): Promise<string> {
  const systemPrompt = `You are creating an architecture diagram for a financial AI system.
Generate a Mermaid diagram showing:
1. 8 reasoning domains (Market Analysis, Tax Planning, Portfolio Optimization, Risk Management, Compliance, Relationship Intelligence, Wealth Transfer, Performance Analytics)
2. Data inputs flowing in
3. Output to advisors and clients
Make it professional and clear.`

  const userMessage = `Create an architecture diagram for Drift Intelligence Engine showing:
- Input: Client data, market data, portfolio data
- Processing: 8 reasoning domains analyzing the data
- Output: Insights, recommendations, alerts for financial advisors

Use Mermaid flowchart syntax.`

  return callClaude(systemPrompt, userMessage, { maxTokens: 3072, organizationId: 'system' })
}
