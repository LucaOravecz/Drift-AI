import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 px-4 text-center ${className}`}>
      <div className="rounded-lg bg-muted/50 p-3">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="max-w-sm">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          variant="default"
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
