import type { ReactNode } from "react";
import { Badge } from "@/components/ui";

export function ComingSoon({
  icon,
  title,
  description,
  bullets,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-line bg-raised text-accent">
          {icon}
        </div>
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{description}</p>
        <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-left text-xs text-fg-muted">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <Badge tone="warning" className="mt-5">
          В разработке
        </Badge>
      </div>
    </div>
  );
}
