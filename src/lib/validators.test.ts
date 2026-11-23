import { describe, expect, it } from "vitest";
import type { RepoState } from "@/types";
import {
  branchExists,
  commitsAhead,
  fileExists,
  filterCommits,
  isAncestor,
  tipParents,
} from "./validators";

function state(overrides: Partial<RepoState> = {}): RepoState {
  return {
    headBranch: "main",
    headSha: "c3",
    detached: false,
    branches: [
      { name: "main", sha: "c3", isHead: true },
      { name: "feature", sha: "f1", isHead: false },
    ],
    tags: [],
    commits: [
      { sha: "c3", parents: ["c2", "f1"], subject: "merge", authorName: "A", authorTime: 3, refs: ["main"] },
      { sha: "c2", parents: ["c1"], subject: "main work", authorName: "A", authorTime: 2, refs: [] },
      { sha: "f1", parents: ["c1"], subject: "feature work", authorName: "B", authorTime: 2, refs: ["feature"] },
      { sha: "c1", parents: [], subject: "initial", authorName: "A", authorTime: 1, refs: [] },
    ],
    status: [],
    conflicts: [],
    stashCount: 0,
    files: ["README.md", "login.js"],
    reflog: [],
    ...overrides,
  };
}

describe("validators", () => {
  it("detects branches and files", () => {
    expect(branchExists(state(), "feature")).toBe(true);
    expect(branchExists(state(), "missing")).toBe(false);
    expect(fileExists(state(), "login.js")).toBe(true);
  });

  it("computes commits ahead of a base branch", () => {
    const unmerged = state({
      headSha: "c2",
      branches: [
        { name: "main", sha: "c2", isHead: true },
        { name: "feature", sha: "f1", isHead: false },
      ],
      commits: [
        { sha: "c2", parents: ["c1"], subject: "main work", authorName: "A", authorTime: 2, refs: ["main"] },
        { sha: "f1", parents: ["c1"], subject: "feature work", authorName: "B", authorTime: 2, refs: ["feature"] },
        { sha: "c1", parents: [], subject: "initial", authorName: "A", authorTime: 1, refs: [] },
      ],
    });

    const ahead = commitsAhead(unmerged, "feature", "main");
    expect(ahead.map((commit) => commit.sha)).toEqual(["f1"]);
  });

  it("detects ancestry", () => {
    expect(isAncestor(state(), "feature", "main")).toBe(true);
    expect(isAncestor(state(), "main", "feature")).toBe(false);
  });

  it("detects merge commits by parent count", () => {
    expect(tipParents(state(), "main")).toHaveLength(2);
    expect(tipParents(state(), "feature")).toHaveLength(1);
  });
});

describe("filterCommits", () => {
  const commits = [
    {
      sha: "aaa111",
      shortSha: "aaa111",
      parents: ["bbb222"],
      authorName: "Анна",
      authorEmail: "a@example.com",
      authorTime: 3,
      committerName: "Анна",
      committerTime: 3,
      subject: "Add login page",
      refs: [{ name: "main", kind: "branch" as const, isHead: true }],
    },
    {
      sha: "bbb222",
      shortSha: "bbb222",
      parents: [],
      authorName: "Борис",
      authorEmail: "b@example.com",
      authorTime: 2,
      committerName: "Борис",
      committerTime: 2,
      subject: "Initial commit",
      refs: [],
    },
  ];

  it("filters by search text", () => {
    const result = filterCommits(commits, { search: "login", author: "", branch: "" });
    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe("aaa111");
  });

  it("filters by author", () => {
    const result = filterCommits(commits, { search: "", author: "Борис", branch: "" });
    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe("bbb222");
  });

  it("drops parents that are filtered out", () => {
    const result = filterCommits(commits, { search: "login", author: "", branch: "" });
    expect(result[0].parents).toEqual([]);
  });
});
