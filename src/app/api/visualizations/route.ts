import { NextRequest, NextResponse } from 'next/server'
import {
  generateChart,
  generateAllocationChart,
  generatePerformanceDashboard,
  generateFinancialTimeline,
  generateRiskProfile,
} from '@/lib/visualization-engine'

/**
 * Visualization API Hub
 * Generates SVG charts and diagrams for client dashboards, risk profiles, and analytics
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data, title, description, clientName } = body

    // Validate request
    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
    }

    let visualization = ''

    // Route to appropriate visualization generator
    switch (type) {
      case 'allocation':
        // Portfolio allocation donut chart
        visualization = await generateAllocationChart(data)
        break

      case 'performance':
        // Performance dashboard with gauges
        visualization = await generatePerformanceDashboard(clientName || 'Client', data)
        break

      case 'timeline':
        // Financial timeline (Mermaid diagram)
        visualization = await generateFinancialTimeline(data)
        break

      case 'risk_profile':
        // Risk radar chart
        visualization = await generateRiskProfile(data)
        break

      case 'chart':
        // Generic chart (line, bar, pie, scatter, area, gauge)
        visualization = await generateChart({
          title: title || 'Chart',
          data,
          chartType: data.chartType || 'bar',
          description,
        })
        break

      default:
        return NextResponse.json({ error: `Unknown visualization type: ${type}` }, { status: 400 })
    }

    return NextResponse.json(
      {
        success: true,
        visualization,
        type,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Visualizations API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate visualization',
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for simpler visualization requests (no body)
 * Example: /api/visualizations?type=chart&format=json
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')

  if (!type) {
    return NextResponse.json(
      {
        error: 'Missing type parameter',
        availableTypes: ['allocation', 'performance', 'timeline', 'risk_profile', 'chart'],
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    message: 'Use POST method with body containing type and data',
    availableTypes: ['allocation', 'performance', 'timeline', 'risk_profile', 'chart'],
  })
}
