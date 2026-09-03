import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-1.5", className)}>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Mizan
      </span>
      <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
      </span>
    </span>
  );
}
