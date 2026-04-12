'use client'

import { useVisualization, VisualizationRenderer } from '@/lib/hooks/useVisualization'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface AgentWorkloadVisualizationProps {
  workload: {
    totalAgents: number
    running: number
    idle: number
    paused: number
    errors: number
    reviewNeeded: number
    totalOutputsToday: number
    totalPendingReviews: number
    totalQueueItems: number
  }
}

/**
 * Visualizes agent workload distribution with a stacked bar chart
 * Shows: Running, Idle, Paused, Error, Review Needed states
 */
export function AgentWorkloadVisualization({ workload }: AgentWorkloadVisualizationProps) {
  const chartData = {
    chartType: 'bar',
    data: [
      {
        category: 'Agent Status',
        Running: workload.running,
        Idle: workload.idle,
        Paused: workload.paused,
        Error: workload.errors,
        'Review Needed': workload.reviewNeeded,
      },
    ],
  }

  const { visualization, loading, error } = useVisualization({
    type: 'chart',
    data: chartData,
    title: 'Agent Workload Distribution',
    description: 'Current status of all 9 agents across the workforce',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Workload Distribution</CardTitle>
        <CardDescription>Agent status breakdown across workforce</CardDescription>
      </CardHeader>
      <CardContent>
        <VisualizationRenderer
          visualization={visualization}
          loading={loading}
          error={error}
          fallback={
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Running: {workload.running}</span>
                <span>Idle: {workload.idle}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Paused: {workload.paused}</span>
                <span>Errors: {workload.errors}</span>
              </div>
              <div className="text-xs">Review Needed: {workload.reviewNeeded}</div>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}

/**
 * Quick metrics cards showing today's productivity
 */
export function AgentProductivityMetrics({ workload }: AgentWorkloadVisualizationProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <CardContent className="pt-4">
          <p className="text-[10px] font-mono uppercase text-zinc-500">Outputs Today</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{workload.totalOutputsToday}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-[10px] font-mono uppercase text-zinc-500">Pending Reviews</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">{workload.totalPendingReviews}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-[10px] font-mono uppercase text-zinc-500">Queue Items</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">{workload.totalQueueItems}</p>
        </CardContent>
      </Card>
    </div>
  )
}
