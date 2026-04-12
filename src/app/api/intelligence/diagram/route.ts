import { generateIntelligenceEngineDiagram } from '@/lib/visualization-engine'

export async function GET() {
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
