'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { stripScriptTagsFromHtml } from '@/lib/sanitize-client-html'

export type VisualizationType = 'allocation' | 'performance' | 'timeline' | 'risk_profile' | 'chart'

interface UseVisualizationOptions {
  type: VisualizationType
  data: Record<string, unknown> | unknown[]
  title?: string
  clientName?: string
}

interface UseVisualizationReturn {
  visualization: string | null
  loading: boolean
  error: string | null
}

/**
 * Hook for generating visualizations via API
 * Calls /api/visualizations with the specified type and data
 */
export function useVisualization(
  options: UseVisualizationOptions
): UseVisualizationReturn {
  const [visualization, setVisualization] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVisualization = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/visualizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = (await response.json()) as { visualization: string; error?: string }

      if (data.error) {
        setError(data.error)
        setVisualization(null)
      } else {
        setVisualization(data.visualization)
        setError(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setVisualization(null)
    } finally {
      setLoading(false)
    }
  }, [options])

  // Fetch visualization on mount
  useEffect(() => {
    fetchVisualization()
  }, [fetchVisualization])

  return { visualization, loading, error }
}

/**
 * Renderer component that displays visualization or falls back
 * Handles loading, error, and SVG/HTML rendering states
 */
export function VisualizationRenderer({
  visualization,
  loading,
  error,
  fallback,
}: {
  visualization: string | null
  loading: boolean
  error: string | null
  fallback?: React.ReactNode
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (!visualization) {
    return fallback || <div className="text-muted-foreground text-sm">No visualization available</div>
  }

  // Render SVG or HTML/Mermaid diagram
  return (
    <div className="overflow-auto rounded-lg bg-white/[0.02] p-4 border border-white/5">
      <div dangerouslySetInnerHTML={{ __html: stripScriptTagsFromHtml(visualization) }} />
    </div>
  )
}
