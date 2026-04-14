type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info"

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel]
}

function formatEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  }
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (shouldLog("debug")) console.debug(JSON.stringify(formatEntry("debug", message, data)))
  },
  info(message: string, data?: Record<string, unknown>) {
    if (shouldLog("info")) console.info(JSON.stringify(formatEntry("info", message, data)))
  },
  warn(message: string, data?: Record<string, unknown>) {
    if (shouldLog("warn")) console.warn(JSON.stringify(formatEntry("warn", message, data)))
  },
  error(message: string, data?: Record<string, unknown>) {
    if (shouldLog("error")) console.error(JSON.stringify(formatEntry("error", message, data)))
  },
}
