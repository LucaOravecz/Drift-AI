"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { Send, RefreshCw, ChevronRight, AlertTriangle, CheckCircle2, Info, FileText, Zap, Database, Bot, Clock, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CopilotResponse, CopilotResponseSection, WorkflowTrace } from "@/lib/services/copilot.service"
import { WorkingChain, type WorkingStep } from "./working-chain"
import { SourcesPanel } from "./sources-panel"

const SUGGESTED_PROMPTS = [
  "Prepare me for my next scheduled meeting",
  "Show the evidence for the Peterson household IPS constraints",
  "What compliance flags are currently open?",
  "Summarize the latest brief for my next client review",
  "Find the source chunk for the last meeting summary",
  "What open tasks should I cover in the next meeting?",
]

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  response?: CopilotResponse
  error?: string
  loading?: boolean
  workingSteps?: WorkingStep[]
  liveAnswer?: string
}

function newCopilotMessageId(prefix: "u" | "a"): string {
  return `${prefix}-${crypto.randomUUID()}`
}

// ── Section renderer ──────────────────────────────────────────────────────────

function SectionIcon({ type }: { type: CopilotResponseSection["type"] }) {
  if (type === "answer") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
  if (type === "findings") return <BarChart2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
  if (type === "actions") return <Zap className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
  if (type === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
  if (type === "draft") return <FileText className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
  if (type === "missing_data") return <Info className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
  return null
}

function sectionBorderColor(type: CopilotResponseSection["type"]) {
  if (type === "answer") return "border-l-emerald-500/50 bg-emerald-500/5"
  if (type === "findings") return "border-l-blue-500/50 bg-blue-500/5"
  if (type === "actions") return "border-l-violet-500/50 bg-violet-500/5"
  if (type === "warning") return "border-l-amber-500/50 bg-amber-500/5"
  if (type === "draft") return "border-l-sky-500/50 bg-sky-500/5"
  if (type === "missing_data") return "border-l-orange-400/50 bg-orange-400/5"
  return "border-l-muted"
}

function ResponseSection({ section }: { section: CopilotResponseSection }) {
  const isArray = Array.isArray(section.content)
  return (
    <div className={`border-l-2 pl-4 py-3 rounded-r-sm ${sectionBorderColor(section.type)}`}>
      <div className="flex items-start gap-2 mb-2">
        <SectionIcon type={section.type} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {section.label}
        </span>
      </div>
      {isArray ? (
        <ul className="space-y-2">
          {(section.content as string[]).map((item, i) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap">{section.content as string}</p>
      )}
    </div>
  )
}

// ── Workflow trace panel ──────────────────────────────────────────────────────

function TracePanel({ trace }: { trace: WorkflowTrace }) {
  const confidenceColor = trace.confidence === "HIGH" ? "text-emerald-500" : trace.confidence === "MEDIUM" ? "text-amber-500" : "text-red-500"
  const qualityColor = trace.dataQuality === "COMPLETE" ? "bg-emerald-500/15 text-emerald-400" : trace.dataQuality === "PARTIAL" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <Bot className="h-4 w-4 text-primary" />
          Analysis Workflow
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={qualityColor}>
            Data: {trace.dataQuality}
          </Badge>
          <span className={`font-bold ${confidenceColor}`}>
            {trace.confidence} confidence
          </span>
        </div>
      </div>

      {/* Request type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wider text-[10px]">Request Type</p>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {trace.requestType.replace(/_/g, " ")}
          </Badge>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wider text-[10px]">Timestamp</p>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(trace.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Inputs used */}
      <div>
        <p className="text-muted-foreground mb-1.5 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
          <Database className="h-3 w-3" /> Inputs Used
        </p>
        <div className="flex flex-wrap gap-1">
          {trace.inputsUsed.map((inp, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground">
              {inp}
            </span>
          ))}
        </div>
      </div>

      {/* Deterministic checks */}
      <div>
        <p className="text-muted-foreground mb-1.5 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Deterministic Checks
        </p>
        <ul className="space-y-0.5">
          {trace.deterministicChecks.map((check, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500/70 shrink-0 mt-0.5" />
              {check}
            </li>
          ))}
        </ul>
      </div>

      {/* Agent modules */}
      <div>
        <p className="text-muted-foreground mb-1.5 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
          <Bot className="h-3 w-3" /> Agent Modules Used
        </p>
        <div className="flex flex-wrap gap-1">
          {trace.agentModulesUsed.map((mod, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary">
              {mod}
            </span>
          ))}
        </div>
      </div>

      {/* Outputs generated */}
      <div>
        <p className="text-muted-foreground mb-1.5 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
          <Zap className="h-3 w-3" /> Outputs Generated
        </p>
        <div className="flex flex-wrap gap-1">
          {trace.outputsGenerated.map((out, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400">
              {out}
            </span>
          ))}
        </div>
      </div>

      {/* Missing data */}
      {trace.missingData.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1.5 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Missing Data
          </p>
          <ul className="space-y-0.5">
            {trace.missingData.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400/80">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Review required */}
      {trace.reviewRequired && (
        <div className="border border-amber-500/30 rounded bg-amber-500/10 px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-400 text-[11px]">Advisor review required before acting on this output</span>
        </div>
      )}
    </div>
  )
}

// ── Message card ──────────────────────────────────────────────────────────────

function AssistantMessage({ msg, onRetry }: { msg: Message; onRetry: (prompt: string) => void }) {
  const [showTrace, setShowTrace] = useState(false)

  if (msg.loading) {
    const hasSteps = (msg.workingSteps?.length ?? 0) > 0 || msg.liveAnswer;
    if (hasSteps) {
      return (
        <div className="flex gap-3">
          <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 rounded-xl border border-border bg-card p-4 space-y-4">
            <WorkingChain steps={msg.workingSteps ?? []} />
            {msg.liveAnswer && (
              <p className="text-sm text-foreground animate-in fade-in leading-relaxed whitespace-pre-wrap">
                {msg.liveAnswer}
              </p>
            )}
          </div>
        </div>
      )
    }
    return (
      <div className="flex gap-3">
        <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Analyzing your request…
          </div>
        </div>
      </div>
    )
  }

  if (msg.error) {
    return (
      <div className="flex gap-3">
        <div className="h-7 w-7 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <Bot className="h-3.5 w-3.5 text-red-400" />
        </div>
        <div className="flex-1 rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <p className="text-sm text-red-400">{msg.error}</p>
          <Button variant="outline" size="sm" onClick={() => onRetry(msg.content)} className="text-xs h-7">
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!msg.response) return null

  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 space-y-3">
        {/* Working Steps */}
        {msg.workingSteps && msg.workingSteps.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              Show reasoning steps
            </summary>
            <div className="mt-2 pl-2">
              <WorkingChain steps={msg.workingSteps} />
            </div>
          </details>
        )}

        {/* Response sections */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {msg.response.sections.map((section, i) => (
            <ResponseSection key={i} section={section} />
          ))}
        </div>

        {/* Sources Panel */}
        <SourcesPanel sources={msg.response.sources} />

        {/* Trace toggle */}
        <button
          onClick={() => setShowTrace(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showTrace ? "rotate-90" : ""}`} />
          Analysis Workflow
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            {msg.response.trace.confidence}
          </Badge>
        </button>

        {showTrace && <TracePanel trace={msg.response.trace} />}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdvisorCopilotClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isPending, startTransition] = useTransition()
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages])

  async function sendMessage(prompt: string) {
    if (!prompt.trim() || isPending) return

    const userMsg: Message = {
      id: newCopilotMessageId("u"),
      role: "user",
      content: prompt.trim(),
    }
    const loadingMsg: Message = {
      id: newCopilotMessageId("a"),
      role: "assistant",
      content: prompt.trim(),
      loading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput("")

    startTransition(async () => {
      try {
        const res = await fetch("/api/copilot/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() }),
        })

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }))
          setMessages(prev =>
            prev.map(m =>
              m.id === loadingMsg.id
                ? { ...m, loading: false, error: err.error ?? "Request failed" }
                : m
            )
          )
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split("\n\n")
          buffer = parts.pop() || ""

          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const payloadStr = part.slice("data: ".length)
              if (!payloadStr.trim()) continue
              try {
                const payload = JSON.parse(payloadStr)
                setMessages(prev => prev.map(m => {
                  if (m.id !== loadingMsg.id) return m

                  switch (payload.type) {
                    case "step_start":
                      return { ...m, workingSteps: [...(m.workingSteps || []), { ...payload, state: "active" }] }
                    case "step_update":
                      return { ...m, workingSteps: m.workingSteps?.map(s => s.id === payload.id ? { ...s, ...payload } : s) }
                    case "step_complete":
                      return { ...m, workingSteps: m.workingSteps?.map(s => s.id === payload.id ? { ...s, state: "done", evidence: payload.evidence } : s) }
                    case "token":
                      return { ...m, liveAnswer: (m.liveAnswer || "") + payload.text }
                    case "complete":
                      return { ...m, loading: false, response: payload.response }
                    case "error":
                      return { ...m, loading: false, error: payload.message }
                    default:
                      return m
                  }
                }))
              } catch (e) {
                console.error("Failed to parse SSE JSON", e, payloadStr)
              }
            }
          }
        }
      } catch (err) {
        setMessages(prev =>
          prev.map(m =>
            m.id === loadingMsg.id
              ? { ...m, loading: false, error: "Network error — please try again" }
              : m
          )
        )
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Advisor Copilot</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grounded responses from your database — no fabricated analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 py-12">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Drift Advisor Copilot</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask about clients, meetings, tax items, opportunities, or tasks.
                Every response cites the actual data it used.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-xs px-3 py-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex gap-3 justify-end">
                  <div className="max-w-md rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <AssistantMessage msg={msg} onRetry={sendMessage} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Suggested prompts (compact, shown after first message) */}
      {!isEmpty && (
        <div className="px-6 py-2 border-t border-border/50 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, i) => (
              <button
                key={i}
                onClick={() => sendMessage(prompt)}
                disabled={isPending}
                className="whitespace-nowrap text-xs px-2.5 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-border shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about clients, meetings, tasks, tax items…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all min-h-[48px] max-h-[120px]"
            style={{ height: "auto" }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = "auto"
              el.style.height = Math.min(el.scrollHeight, 120) + "px"
            }}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isPending}
            size="icon"
            className="h-12 w-12 rounded-xl shrink-0"
          >
            {isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Responses are assembled from stored records only — no facts are invented. All outputs require advisor review.
        </p>
      </div>
    </div>
  )
}
