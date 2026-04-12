/**
 * Interactive Components Builder
 *
 * Utilities for building rich, interactive React components for dashboards,
 * analytics views, and client portals using Tailwind CSS and shadcn/ui patterns.
 */

export interface ComponentTemplate {
  name: string
  description: string
  category: 'dashboard' | 'card' | 'chart' | 'form' | 'modal'
  code: string
  dependencies: string[]
}

/**
 * Agent Command Center - Interactive dashboard component
 * Shows live agent status, performance metrics, and control buttons
 */
export const AGENT_COMMAND_CENTER_TEMPLATE: ComponentTemplate = {
  name: 'Agent Command Center',
  description: 'Real-time agent status dashboard with run/pause/resume controls',
  category: 'dashboard',
  code: `export function AgentCommandCenter({ agents, onRun, onPause, onResume }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Active</h3>
          <p className="text-3xl font-bold">{agents.filter(a => a.status === 'RUNNING').length}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
          <p className="text-3xl font-bold">{agents.filter(a => a.status === 'COMPLETED').length}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Success Rate</h3>
          <p className="text-3xl font-bold">94%</p>
        </div>
      </div>

      <div className="space-y-3">
        {agents.map(agent => (
          <div key={agent.id} className="bg-card rounded-lg border p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{agent.name}</h4>
              <p className="text-sm text-muted-foreground">{agent.status}</p>
            </div>
            <div className="flex gap-2">
              {agent.status === 'IDLE' && <button onClick={() => onRun(agent.id)}>Run</button>}
              {agent.status === 'RUNNING' && <button onClick={() => onPause(agent.id)}>Pause</button>}
              {agent.status === 'PAUSED' && <button onClick={() => onResume(agent.id)}>Resume</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}`,
  dependencies: ['react', 'tailwindcss'],
}

/**
 * Performance Analytics Card - Shows key metrics with sparklines
 */
export const PERFORMANCE_CARD_TEMPLATE: ComponentTemplate = {
  name: 'Performance Analytics Card',
  description: 'Client portfolio performance overview with trend indicators',
  category: 'card',
  code: `export function PerformanceCard({ client, metrics }) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">{client.name}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">YTD Return</p>
          <p className="text-2xl font-bold text-green-600">{metrics.ytdReturn}%</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">vs Benchmark</p>
          <p className="text-2xl font-bold text-blue-600">{metrics.vsBenchmark > 0 ? '+' : ''}{metrics.vsBenchmark}%</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">On Track</span>
      </div>
    </div>
  )
}`,
  dependencies: ['react', 'recharts', 'tailwindcss'],
}

/**
 * Portfolio Allocation Donut Chart - Interactive pie/donut chart
 */
export const ALLOCATION_CHART_TEMPLATE: ComponentTemplate = {
  name: 'Portfolio Allocation',
  description: 'Interactive donut chart showing asset class allocation',
  category: 'chart',
  code: `import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';

export function AllocationChart({ data }) {
  const COLORS = ['#4f46e5', '#7c3aed', '#0891b2', '#16a34a', '#ea580c'];

  return (
    <div className="w-full h-80">
      <PieChart width={400} height={320}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </div>
  )
}`,
  dependencies: ['react', 'recharts', 'tailwindcss'],
}

/**
 * Intelligence Engine Flow Diagram
 */
export const INTELLIGENCE_FLOW_TEMPLATE: ComponentTemplate = {
  name: 'Intelligence Engine Flow',
  description: 'Visual representation of data flowing through reasoning domains',
  category: 'dashboard',
  code: `export function IntelligenceEngineFlow() {
  const domains = [
    'Market Analysis',
    'Tax Planning',
    'Portfolio Optimization',
    'Risk Management',
    'Compliance',
    'Relationship Intelligence',
    'Wealth Transfer',
    'Performance Analytics'
  ];

  return (
    <div className="p-6 bg-gradient-to-b from-slate-50 to-white rounded-lg border">
      <h3 className="text-lg font-semibold mb-6">Reasoning Domains</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {domains.map(domain => (
          <div key={domain} className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium text-center">{domain}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>Data inputs → Processing domains → Actionable insights</p>
      </div>
    </div>
  )
}`,
  dependencies: ['react', 'tailwindcss'],
}

/**
 * Client Relationship Timeline
 */
export const RELATIONSHIP_TIMELINE_TEMPLATE: ComponentTemplate = {
  name: 'Relationship Timeline',
  description: 'Timeline view of client meetings, reviews, and milestones',
  category: 'card',
  code: `export function RelationshipTimeline({ events }) {
  return (
    <div className="relative space-y-4">
      {events.map((event, idx) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-primary"></div>
            {idx < events.length - 1 && <div className="w-0.5 h-12 bg-border mt-1"></div>}
          </div>
          <div>
            <p className="font-semibold text-sm">{event.title}</p>
            <p className="text-xs text-muted-foreground">{event.date}</p>
            <p className="text-sm mt-1">{event.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}`,
  dependencies: ['react', 'tailwindcss'],
}

/**
 * Get template by category
 */
export function getTemplatesByCategory(category: ComponentTemplate['category']): ComponentTemplate[] {
  return [
    AGENT_COMMAND_CENTER_TEMPLATE,
    PERFORMANCE_CARD_TEMPLATE,
    ALLOCATION_CHART_TEMPLATE,
    INTELLIGENCE_FLOW_TEMPLATE,
    RELATIONSHIP_TIMELINE_TEMPLATE,
  ].filter((t) => t.category === category)
}

/**
 * Generate component code with custom props
 */
export function generateComponentCode(template: ComponentTemplate, props: Record<string, unknown>): string {
  let code = template.code

  Object.entries(props).forEach(([key, value]) => {
    const placeholder = `{${key}}`
    if (code.includes(placeholder)) {
      code = code.replace(new RegExp(placeholder, 'g'), JSON.stringify(value))
    }
  })

  return code
}

/**
 * List all available interactive component templates
 */
export function getAllTemplates(): ComponentTemplate[] {
  return [
    AGENT_COMMAND_CENTER_TEMPLATE,
    PERFORMANCE_CARD_TEMPLATE,
    ALLOCATION_CHART_TEMPLATE,
    INTELLIGENCE_FLOW_TEMPLATE,
    RELATIONSHIP_TIMELINE_TEMPLATE,
  ]
}
