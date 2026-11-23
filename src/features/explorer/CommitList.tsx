import { GitBranch, Tag } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { type GraphLayout, type GraphRow, type GraphSegment, laneColor } from "@/lib/graph-layout";
import type { Commit, RefLabel } from "@/types";

const ROW_HEIGHT = 30;
const LANE_WIDTH = 14;
const GRAPH_PADDING = 4;

function laneX(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2 + GRAPH_PADDING;
}

function segmentPath(segment: GraphSegment, half: "top" | "bottom"): string {
  const x1 = laneX(segment.from);
  const x2 = laneX(segment.to);
  const y1 = half === "top" ? 0 : ROW_HEIGHT / 2;
  const y2 = half === "top" ? ROW_HEIGHT / 2 : ROW_HEIGHT;

  if (x1 === x2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  const middle = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`;
}

function RefBadge({ label }: { label: RefLabel }) {
  if (label.kind === "tag") {
    return (
      <Badge tone="warning">
        <Tag className="size-2.5" />
        {label.name}
      </Badge>
    );
  }

  if (label.kind === "remote") {
    return <Badge tone="neutral">{label.name}</Badge>;
  }

  return (
    <Badge tone={label.isHead ? "success" : "accent"}>
      <GitBranch className="size-2.5" />
      {label.name}
    </Badge>
  );
}

function CommitRow({
  commit,
  row,
  graphWidth,
  selected,
  isHead,
  style,
  onSelect,
}: {
  commit: Commit;
  row: GraphRow | undefined;
  graphWidth: number;
  selected: boolean;
  isHead: boolean;
  style: CSSProperties;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={style}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 px-2 text-left transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-raised/70",
      )}
    >
      <svg width={graphWidth} height={ROW_HEIGHT} className="shrink-0" aria-hidden="true">
        {row?.top.map((segment) => (
          <path
            key={`top-${segment.from}-${segment.to}-${segment.color}`}
            d={segmentPath(segment, "top")}
            stroke={laneColor(segment.color)}
            strokeWidth={1.5}
            fill="none"
          />
        ))}
        {row?.bottom.map((segment) => (
          <path
            key={`bottom-${segment.from}-${segment.to}-${segment.color}`}
            d={segmentPath(segment, "bottom")}
            stroke={laneColor(segment.color)}
            strokeWidth={1.5}
            fill="none"
          />
        ))}
        {row ? (
          <circle
            cx={laneX(row.lane)}
            cy={ROW_HEIGHT / 2}
            r={isHead ? 5 : 4}
            fill={laneColor(row.color)}
            stroke={selected ? "var(--color-fg)" : "var(--color-canvas)"}
            strokeWidth={selected ? 1.5 : 1}
          />
        ) : null}
      </svg>

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-[12.5px] text-fg">{commit.subject}</span>
        {commit.refs.map((label) => (
          <RefBadge key={`${label.kind}:${label.name}`} label={label} />
        ))}
      </div>

      <span className="w-28 shrink-0 truncate text-right text-[11px] text-fg-faint">
        {commit.authorName}
      </span>
      <span className="w-20 shrink-0 text-right text-[11px] text-fg-faint">
        {formatRelativeTime(commit.authorTime)}
      </span>
      <span className="mono w-16 shrink-0 text-right text-[11px] text-fg-faint">
        {commit.shortSha}
      </span>
    </button>
  );
}

export function CommitList({
  commits,
  layout,
  selectedSha,
  headSha,
  onSelect,
}: {
  commits: Commit[];
  layout: GraphLayout;
  selectedSha: string | null;
  headSha: string | null;
  onSelect: (sha: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => setViewport(element.clientHeight);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 8);
  const end = Math.min(commits.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + 8);

  const laneCount = Math.max(layout.laneCount, 1);
  const graphWidth = laneCount * LANE_WIDTH + GRAPH_PADDING * 2;

  return (
    <div
      ref={containerRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-auto"
    >
      <div style={{ height: commits.length * ROW_HEIGHT, position: "relative" }}>
        {commits.slice(start, end).map((commit, index) => {
          const rowIndex = start + index;
          return (
            <CommitRow
              key={commit.sha}
              commit={commit}
              row={layout.rows[rowIndex]}
              graphWidth={graphWidth}
              selected={commit.sha === selectedSha}
              isHead={commit.sha === headSha}
              style={{
                position: "absolute",
                top: rowIndex * ROW_HEIGHT,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
              }}
              onSelect={() => onSelect(commit.sha)}
            />
          );
        })}
      </div>
    </div>
  );
}
