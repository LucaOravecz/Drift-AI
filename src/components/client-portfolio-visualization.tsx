'use client'

import { useVisualization, VisualizationRenderer } from '@/lib/hooks/useVisualization'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, PieChart as PieChartIcon } from 'lucide-react'

interface ClientPortfolioVisualizationProps {
  clientId: string
  clientName: string
  aum: number
  holdings: Record<string, number>
  ytdReturn: number
  benchmarkReturn: number
}

/**
 * Portfolio allocation visualization with allocation breakdown
 */
export function ClientPortfolioAllocation({
  clientName,
  holdings,
  aum,
  ytdReturn,
  benchmarkReturn
}: Omit<ClientPortfolioVisualizationProps, 'clientId'>) {
  const { visualization, loading, error } = useVisualization({
    type: 'allocation',
    data: holdings,
    clientName,
    title: 'Portfolio Allocation',
  })

  const totalAllocated = Object.values(holdings).reduce((a, b) => a + b, 0)
  const performanceGap = ytdReturn - benchmarkReturn

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-cyan-400" /> Portfolio Allocation
            </CardTitle>
            <CardDescription>Asset class distribution across ${(aum / 1000000).toFixed(1)}M AUM</CardDescription>
          </div>
          <Badge variant="outline" className={performanceGap >= 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}>
            {performanceGap >= 0 ? '+' : ''}{performanceGap.toFixed(2)}% vs Benchmark
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <VisualizationRenderer
          visualization={visualization}
          loading={loading}
          error={error}
          fallback={
            <div className="space-y-2">
              {Object.entries(holdings).map(([asset, pct]) => (
                <div key={asset} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{asset}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500/60 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-cyan-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}

/**
 * Performance comparison with benchmark
 */
export function PerformanceComparison({
  clientName,
  ytdReturn,
  benchmarkReturn,
}: Pick<ClientPortfolioVisualizationProps, 'clientName' | 'ytdReturn' | 'benchmarkReturn'>) {
  const performanceData = {
    chartType: 'bar',
    data: [
      {
        category: 'YTD Performance',
        [clientName]: ytdReturn,
        'Benchmark': benchmarkReturn,
      }
    ]
  }

  const { visualization, loading } = useVisualization({
    type: 'chart',
    data: performanceData,
    title: 'Performance vs Benchmark',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" /> Performance Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <VisualizationRenderer
          visualization={visualization}
          loading={loading}
          error={null}
          fallback={
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Client Return</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{ytdReturn}%</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Benchmark</p>
                <p className="text-2xl font-bold text-zinc-400 mt-1">{benchmarkReturn}%</p>
              </div>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}
