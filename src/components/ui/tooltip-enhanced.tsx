import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReactNode } from "react";

interface EnhancedTooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
  className?: string;
}

/**
 * Enhanced tooltip component with better styling and default configuration
 * Extends the base Tooltip with sensible defaults
 */
export function EnhancedTooltip({
  content,
  children,
  side = "top",
  delayDuration = 200,
  className = "",
}: EnhancedTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        className={`bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs py-1.5 px-2.5 rounded-md shadow-lg ${className}`}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Information icon with tooltip
 */
export function TooltipIcon({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <EnhancedTooltip content={content}>
      <div className={`inline-flex items-center justify-center cursor-help ${className}`}>
        <svg
          className="h-4 w-4 text-muted-foreground"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </EnhancedTooltip>
  );
}
