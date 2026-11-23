import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-line px-2", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "relative -mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-xs font-medium transition-colors",
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className="rounded bg-raised px-1 text-[10px] text-fg-faint">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
