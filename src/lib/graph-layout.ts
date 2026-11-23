export interface GraphInput {
  sha: string;
  parents: string[];
}

export interface GraphSegment {
  from: number;
  to: number;
  color: number;
}

export interface GraphRow {
  sha: string;
  lane: number;
  color: number;
  top: GraphSegment[];
  bottom: GraphSegment[];
}

export interface GraphLayout {
  rows: GraphRow[];
  laneCount: number;
}

const LANE_COLORS = 10;

/**
 * Раскладывает коммиты по «дорожкам» (lanes), как в gitk.
 * Коммиты должны идти в порядке git log (родитель никогда не раньше ребёнка).
 */
export function computeGraphLayout(commits: GraphInput[]): GraphLayout {
  const lanes: Array<string | null> = [];
  const colors: number[] = [];
  let nextColor = 0;
  let maxLane = 0;
  const rows: GraphRow[] = [];

  const allocate = (sha: string): number => {
    let index = lanes.indexOf(null);
    if (index === -1) {
      index = lanes.length;
      lanes.push(null);
      colors.push(0);
    }
    lanes[index] = sha;
    colors[index] = nextColor % LANE_COLORS;
    nextColor += 1;
    return index;
  };

  for (const commit of commits) {
    let lane = lanes.indexOf(commit.sha);
    if (lane === -1) {
      lane = allocate(commit.sha);
    }

    const color = colors[lane] ?? 0;

    const incoming: number[] = [];
    for (let index = 0; index < lanes.length; index += 1) {
      if (lanes[index] === commit.sha) incoming.push(index);
    }

    const top: GraphSegment[] = [];
    for (let index = 0; index < lanes.length; index += 1) {
      if (lanes[index] === null) continue;
      if (incoming.includes(index)) {
        if (index !== lane) {
          top.push({ from: index, to: lane, color: colors[index] ?? 0 });
        }
      } else {
        top.push({ from: index, to: index, color: colors[index] ?? 0 });
      }
    }

    const bottom: GraphSegment[] = [];
    if (commit.parents.length === 0) {
      lanes[lane] = null;
    } else {
      const firstParent = commit.parents[0];
      const existing = lanes.indexOf(firstParent);
      if (existing === -1) {
        lanes[lane] = firstParent;
        bottom.push({ from: lane, to: lane, color });
      } else {
        lanes[lane] = null;
        bottom.push({ from: lane, to: existing, color: colors[existing] ?? 0 });
      }

      for (let parentIndex = 1; parentIndex < commit.parents.length; parentIndex += 1) {
        const parent = commit.parents[parentIndex];
        let target = lanes.indexOf(parent);
        if (target === -1) {
          target = allocate(parent);
        }
        bottom.push({ from: lane, to: target, color: colors[target] ?? 0 });
      }
    }

    for (const index of incoming) {
      if (index !== lane) lanes[index] = null;
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop();
      colors.pop();
    }

    for (const segment of top) {
      maxLane = Math.max(maxLane, segment.from, segment.to);
    }
    for (const segment of bottom) {
      maxLane = Math.max(maxLane, segment.from, segment.to);
    }
    maxLane = Math.max(maxLane, lane);

    rows.push({ sha: commit.sha, lane, color, top, bottom });
  }

  return { rows, laneCount: rows.length === 0 ? 0 : maxLane + 1 };
}

export function laneColor(color: number): string {
  return `var(--color-lane-${(color % LANE_COLORS) + 1})`;
}
