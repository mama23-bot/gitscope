import { useMemo } from "react";
import { Badge } from "@/components/ui";
import { type GraphSegment, laneColor } from "@/lib/graph-layout";
import { useGraphLayout } from "@/lib/useGraphLayout";
import type { Commit, RepoState } from "@/types";

const ROW_HEIGHT = 26;
const LANE_WIDTH = 12;
const PADDING = 4;

function laneX(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2 + PADDING;
}

function segmentPath(segment: GraphSegment, half: "top" | "bottom"): string {
  const x1 = laneX(segment.from);
  const x2 = laneX(segment.to);
  const y1 = half === "top" ? 0 : ROW_HEIGHT / 2;
  const y2 = half === "top" ? ROW_HEIGHT / 2 : ROW_HEIGHT;

  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;

  const middle = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`;
}

export function MiniGraph({ state }: { state: RepoState | null }) {
  const commits = useMemo<Commit[]>(() => {
    if (!state) return [];
    const branchNames = new Set(state.branches.map((branch) => branch.name));
    const tagNames = new Set(state.tags);

    return state.commits.map((commit) => ({
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      parents: commit.parents,
      authorName: commit.authorName,
      authorEmail: "",
      authorTime: commit.authorTime,
      committerName: commit.authorName,
      committerTime: commit.authorTime,
      subject: commit.subject,
      refs: commit.refs.map((name) => ({
        name,
        kind: tagNames.has(name)
          ? ("tag" as const)
          : branchNames.has(name)
            ? ("branch" as const)
            : ("remote" as const),
        isHead: name === state.headBranch,
      })),
    }));
  }, [state]);

  const layout = useGraphLayout(commits);

  if (!state) {
    return <div className="p-3 text-xs text-fg-faint">Загружаю состояние…</div>;
  }

  if (commits.length === 0) {
    return (
      <div className="p-3 text-xs text-fg-faint">
        Пока нет коммитов. Сделай первый — и граф появится здесь.
      </div>
    );
  }

  const laneCount = Math.max(layout.laneCount, 1);
  const width = laneCount * LANE_WIDTH + PADDING * 2;

  return (
    <div className="h-full overflow-auto p-2">
      {commits.map((commit, index) => {
        const row = layout.rows[index];
        return (
          <div key={commit.sha} className="flex h-[26px] items-center gap-2">
            <svg width={width} height={ROW_HEIGHT} className="shrink-0" aria-hidden="true">
              {row?.top.map((segment) => (
                <path
                  key={`top-${segment.from}-${segment.to}-${segment.color}`}
                  d={segmentPath(segment, "top")}
                  stroke={laneColor(segment.color)}
                  strokeWidth={1.4}
                  fill="none"
                />
              ))}
              {row?.bottom.map((segment) => (
                <path
                  key={`bottom-${segment.from}-${segment.to}-${segment.color}`}
                  d={segmentPath(segment, "bottom")}
                  stroke={laneColor(segment.color)}
                  strokeWidth={1.4}
                  fill="none"
                />
              ))}
              {row ? (
                <circle
                  cx={laneX(row.lane)}
                  cy={ROW_HEIGHT / 2}
                  r={3.5}
                  fill={laneColor(row.color)}
                  stroke="var(--color-canvas)"
                  strokeWidth={1}
                />
              ) : null}
            </svg>

            <span className="min-w-0 flex-1 truncate text-[11px] text-fg">{commit.subject}</span>

            {commit.refs.map((ref) => (
              <Badge
                key={`${ref.kind}:${ref.name}`}
                tone={ref.kind === "tag" ? "warning" : ref.isHead ? "success" : "accent"}
              >
                {ref.name}
              </Badge>
            ))}

            <span className="mono shrink-0 text-[10px] text-fg-faint">{commit.shortSha}</span>
          </div>
        );
      })}
    </div>
  );
}
