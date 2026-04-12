'use client'

import { ClientPortfolioAllocation, PerformanceComparison } from './client-portfolio-visualization'
import { ClientRiskProfile, RiskReturnPlot } from './client-risk-profile'
import { FinancialTimeline, UpcomingEvents, TimelineEvent } from './financial-timeline'

interface ClientDashboardAnalyticsProps {
  clientId: string
  clientName: string
  aum: number
  holdings: Record<string, number>
  ytdReturn: number
  benchmarkReturn: number
  riskMetrics: {
    marketRisk: number
    concentrationRisk: number
    liquidityRisk: number
    inflationRisk: number
  }
  riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive'
  expectedReturn: number
  volatility: number
  upcomingEvents: TimelineEvent[]
}

/**
 * Comprehensive client dashboard with all visualizations
 */
export function ClientDashboardAnalytics({
  clientId,
  clientName,
  aum,
  holdings,
  ytdReturn,
  benchmarkReturn,
  riskMetrics,
  riskTolerance,
  expectedReturn,
  volatility,
  upcomingEvents,
}: ClientDashboardAnalyticsProps) {
  return (
    <div className="space-y-6">
      {/* Portfolio Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Portfolio Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ClientPortfolioAllocation
            clientName={clientName}
            holdings={holdings}
            aum={aum}
            ytdReturn={ytdReturn}
            benchmarkReturn={benchmarkReturn}
          />
          <PerformanceComparison
            clientName={clientName}
            ytdReturn={ytdReturn}
            benchmarkReturn={benchmarkReturn}
          />
        </div>
      </div>

      {/* Risk Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Risk Assessment</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ClientRiskProfile
            clientName={clientName}
            riskMetrics={riskMetrics}
            riskTolerance={riskTolerance}
          />
          <RiskReturnPlot
            expectedReturn={expectedReturn}
            volatility={volatility}
          />
        </div>
      </div>

      {/* Timeline Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Financial Planning</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <FinancialTimeline
              clientName={clientName}
              events={upcomingEvents}
              title="Financial Timeline"
            />
          </div>
          <div>
            <div className="bg-card rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Upcoming Events</h3>
              <UpcomingEvents events={upcomingEvents} limit={5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
