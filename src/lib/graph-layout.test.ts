import { describe, expect, it } from "vitest";
import { computeGraphLayout } from "./graph-layout";

describe("computeGraphLayout", () => {
  it("keeps a linear history in one lane", () => {
    const layout = computeGraphLayout([
      { sha: "c3", parents: ["c2"] },
      { sha: "c2", parents: ["c1"] },
      { sha: "c1", parents: [] },
    ]);

    expect(layout.rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(layout.laneCount).toBe(1);
  });

  it("places a side branch in its own lane and merges it back", () => {
    const layout = computeGraphLayout([
      { sha: "merge", parents: ["main2", "feature1"] },
      { sha: "main2", parents: ["base"] },
      { sha: "feature1", parents: ["base"] },
      { sha: "base", parents: [] },
    ]);

    const lanes = Object.fromEntries(
      layout.rows.map((row) => [row.sha, row.lane]),
    );

    expect(lanes.merge).toBe(0);
    expect(lanes.main2).toBe(0);
    expect(lanes.feature1).toBe(1);
    expect(lanes.base).toBe(0);
    expect(layout.laneCount).toBe(2);
  });

  it("supports octopus merges with more than two parents", () => {
    const layout = computeGraphLayout([
      { sha: "octopus", parents: ["a", "b", "c"] },
      { sha: "a", parents: ["root"] },
      { sha: "b", parents: ["root"] },
      { sha: "c", parents: ["root"] },
      { sha: "root", parents: [] },
    ]);

    expect(layout.laneCount).toBe(3);
    expect(layout.rows[0].bottom).toHaveLength(3);
  });

  it("frees lanes after the root commit", () => {
    const layout = computeGraphLayout([{ sha: "root", parents: [] }]);
    expect(layout.rows[0].lane).toBe(0);
    expect(layout.rows[0].bottom).toHaveLength(0);
    expect(layout.laneCount).toBe(1);
  });

  it("handles an empty history", () => {
    const layout = computeGraphLayout([]);
    expect(layout.rows).toHaveLength(0);
    expect(layout.laneCount).toBe(0);
  });
});
