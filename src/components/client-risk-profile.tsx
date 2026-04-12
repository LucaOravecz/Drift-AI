'use client'

import { useVisualization, VisualizationRenderer } from '@/lib/hooks/useVisualization'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, AlertTriangle } from 'lucide-react'

interface RiskMetrics {
  marketRisk: number // 0-10 scale
  concentrationRisk: number
  liquidityRisk: number
  inflationRisk: number
}

interface ClientRiskProfileProps {
  clientName: string
  riskMetrics: RiskMetrics
  riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive'
}

/**
 * Risk profile radar chart visualization
 */
export function ClientRiskProfile({
  clientName,
  riskMetrics,
  riskTolerance,
}: ClientRiskProfileProps) {
  const { visualization, loading, error } = useVisualization({
    type: 'risk_profile',
    data: riskMetrics,
    clientName,
    title: 'Risk Profile Assessment',
  })

  const riskColor = riskTolerance === 'Conservative' ? 'text-blue-400'
    : riskTolerance === 'Moderate' ? 'text-amber-400'
    : 'text-red-400'

  const riskBg = riskTolerance === 'Conservative' ? 'bg-blue-500/10 border-blue-500/30'
    : riskTolerance === 'Moderate' ? 'bg-amber-500/10 border-amber-500/30'
    : 'bg-red-500/10 border-red-500/30'

  const maxRisk = Math.max(
    riskMetrics.marketRisk,
    riskMetrics.concentrationRisk,
    riskMetrics.liquidityRisk,
    riskMetrics.inflationRisk
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-400" /> Risk Profile
            </CardTitle>
            <CardDescription>Multi-dimensional risk assessment</CardDescription>
          </div>
          <Badge className={`border ${riskBg}`}>
            {riskTolerance} Profile
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <VisualizationRenderer
          visualization={visualization}
          loading={loading}
          error={error}
          fallback={
            <div className="space-y-3">
              {(Object.entries(riskMetrics) as [keyof RiskMetrics, number][]).map(([metric, score]) => {
                const metricLabel = metric
                  .replace('Risk', '')
                  .replace(/([A-Z])/g, ' $1')
                  .trim()

                const color = score <= 3 ? 'bg-emerald-500/60'
                  : score <= 6 ? 'bg-amber-500/60'
                  : 'bg-red-500/60'

                return (
                  <div key={metric}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{metricLabel}</span>
                      <span className="text-zinc-500">{score}/10</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full`}
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              {maxRisk > 6 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-300">Elevated Risk Areas</p>
                    <p className="text-[10px] text-amber-200 mt-0.5">
                      Consider portfolio rebalancing to align with risk tolerance
                    </p>
                  </div>
                </div>
              )}
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}

/**
 * Risk vs Return scatter showing portfolio positioning
 */
export function RiskReturnPlot({
  expectedReturn: expectedReturn,
  volatility,
}: {
  expectedReturn: number
  volatility: number
}) {
  const chartData = {
    chartType: 'scatter',
    data: [
      {
        risk: volatility,
        return: expectedReturn,
        name: 'Current Portfolio',
      }
    ]
  }

  const { visualization, loading } = useVisualization({
    type: 'chart',
    data: chartData,
    title: 'Risk vs Expected Return',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Risk-Return Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <VisualizationRenderer
          visualization={visualization}
          loading={loading}
          error={null}
          fallback={
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-zinc-500">Expected Return:</span>
                <span className="ml-2 font-semibold text-emerald-400">{expectedReturn}%</span>
              </div>
              <div>
                <span className="text-zinc-500">Volatility (σ):</span>
                <span className="ml-2 font-semibold text-amber-400">{volatility}%</span>
              </div>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}
