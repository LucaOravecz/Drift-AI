import "server-only"

import { generateIntelligenceEngineDiagram } from '@/lib/visualization-engine'
import { authenticateApiRequest, hasPermission } from '@/lib/middleware/api-auth'

export async function GET() {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated || !auth.context) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.statusCode ?? 401 })
  }

  if (!hasPermission(auth.context, 'read', 'intelligence')) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403 })
  }

  try {
    const diagram = await generateIntelligenceEngineDiagram()

    return new Response(
      JSON.stringify({ diagram, success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[API] Intelligence diagram generation failed:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate diagram', success: false }),
      { status: 500 }
    )
  }
}
