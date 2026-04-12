'use client'

import { useVisualization, VisualizationRenderer } from '@/lib/hooks/useVisualization'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calendar, Landmark, DollarSign, AlertCircle } from 'lucide-react'

export interface TimelineEvent {
  date: string
  event: string
  type: 'milestone' | 'payment' | 'review' | 'tax'
  description?: string
}

interface FinancialTimelineProps {
  clientName: string
  events: TimelineEvent[]
  title?: string
}

/**
 * Financial timeline showing key dates and events (Mermaid diagram)
 */
export function FinancialTimeline({
  clientName,
  events,
  title = 'Financial Timeline',
}: FinancialTimelineProps) {
  const { visualization, loading, error } = useVisualization({
    type: 'timeline',
    data: events,
    clientName,
    title,
  })

  const getIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'milestone':
        return <Landmark className="h-3 w-3" />
      case 'payment':
        return <DollarSign className="h-3 w-3" />
      case 'tax':
        return <AlertCircle className="h-3 w-3" />
      case 'review':
        return <Calendar className="h-3 w-3" />
    }
  }

  const getColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'milestone':
        return 'text-blue-400'
      case 'payment':
        return 'text-emerald-400'
      case 'tax':
        return 'text-orange-400'
      case 'review':
        return 'text-purple-400'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" /> {title}
        </CardTitle>
        <CardDescription>{events.length} upcoming events for {clientName}</CardDescription>
      </CardHeader>
      <CardContent>
        <VisualizationRenderer
          visualization={visualization}
          loading={loading}
          error={error}
          fallback={
            <div className="relative space-y-4">
              {events.map((event, idx) => (
                <div key={idx} className="flex gap-3">
                  {/* Timeline dot and connector */}
                  <div className="flex flex-col items-center">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      event.type === 'milestone' ? 'border-blue-500 bg-blue-500/20'
                      : event.type === 'payment' ? 'border-emerald-500 bg-emerald-500/20'
                      : event.type === 'tax' ? 'border-orange-500 bg-orange-500/20'
                      : 'border-purple-500 bg-purple-500/20'
                    }`}>
                      <span className={getColor(event.type)}>
                        {getIcon(event.type)}
                      </span>
                    </div>
                    {idx < events.length - 1 && (
                      <div className="w-0.5 h-8 bg-gradient-to-b from-white/10 to-transparent mt-1" />
                    )}
                  </div>

                  {/* Event content */}
                  <div className="pt-0.5 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{event.event}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{event.date}</p>
                      </div>
                      <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded ${
                        event.type === 'milestone' ? 'bg-blue-500/15 text-blue-400'
                        : event.type === 'payment' ? 'bg-emerald-500/15 text-emerald-400'
                        : event.type === 'tax' ? 'bg-orange-500/15 text-orange-400'
                        : 'bg-purple-500/15 text-purple-400'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-zinc-400 mt-2">{event.description}</p>
                    )}
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
 * Quick upcoming events list
 */
export function UpcomingEvents({
  events,
  limit = 5,
}: {
  events: TimelineEvent[]
  limit?: number
}) {
  const upcoming = events.slice(0, limit)

  return (
    <div className="space-y-2">
      {upcoming.map((event, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
        >
          <div className={`h-2 w-2 rounded-full ${
            event.type === 'milestone' ? 'bg-blue-400'
            : event.type === 'payment' ? 'bg-emerald-400'
            : event.type === 'tax' ? 'bg-orange-400'
            : 'bg-purple-400'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/90 truncate">{event.event}</p>
            <p className="text-[10px] text-zinc-600">{event.date}</p>
          </div>
        </div>
      ))}
      {events.length > limit && (
        <p className="text-xs text-zinc-600 pt-2">+{events.length - limit} more events</p>
      )}
    </div>
  )
}
