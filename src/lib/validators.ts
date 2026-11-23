import type { Commit, RepoState } from "@/types";

export function branchExists(state: RepoState, name: string): boolean {
  return state.branches.some((branch) => branch.name === name);
}

export function tipOf(state: RepoState, branch: string): string | null {
  return state.branches.find((item) => item.name === branch)?.sha ?? null;
}

export function reachableFrom(state: RepoState, sha: string | null): Set<string> {
  const bySha = new Map(state.commits.map((commit) => [commit.sha, commit]));
  const seen = new Set<string>();
  if (!sha) return seen;

  const stack = [sha];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const commit = bySha.get(current);
    if (commit) stack.push(...commit.parents);
  }
  return seen;
}

export function commitsOn(state: RepoState, branch: string): RepoState["commits"] {
  const reachable = reachableFrom(state, tipOf(state, branch));
  return state.commits.filter((commit) => reachable.has(commit.sha));
}

export function commitsAhead(state: RepoState, branch: string, base: string): RepoState["commits"] {
  const branchSet = reachableFrom(state, tipOf(state, branch));
  const baseSet = reachableFrom(state, tipOf(state, base));
  return state.commits.filter((commit) => branchSet.has(commit.sha) && !baseSet.has(commit.sha));
}

export function isAncestor(state: RepoState, ancestor: string, descendant: string): boolean {
  const ancestorTip = tipOf(state, ancestor);
  const descendantTip = tipOf(state, descendant);
  if (!ancestorTip || !descendantTip) return false;
  return reachableFrom(state, descendantTip).has(ancestorTip);
}

export function tipParents(state: RepoState, branch: string): string[] {
  const tip = tipOf(state, branch);
  return state.commits.find((commit) => commit.sha === tip)?.parents ?? [];
}

export function hasMergeCommit(state: RepoState, branch: string): boolean {
  return tipParents(state, branch).length > 1;
}

export function fileExists(state: RepoState, path: string): boolean {
  return state.files.includes(path);
}

export function hasConflicts(state: RepoState): boolean {
  return state.conflicts.length > 0;
}

export function commitCount(state: RepoState): number {
  return state.commits.length;
}

export function filterCommits(
  commits: Commit[],
  filters: { search: string; author: string; branch: string },
): Commit[] {
  let visible = commits;

  if (filters.branch) {
    const tip = commits.find((commit) =>
      commit.refs.some((ref) => ref.kind === "branch" && ref.name === filters.branch),
    )?.sha;
    if (tip) {
      const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
      const reachable = new Set<string>();
      const stack = [tip];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || reachable.has(current)) continue;
        reachable.add(current);
        const commit = bySha.get(current);
        if (commit) stack.push(...commit.parents);
      }
      visible = visible.filter((commit) => reachable.has(commit.sha));
    }
  }

  if (filters.author) {
    visible = visible.filter((commit) => commit.authorName === filters.author);
  }

  if (filters.search.trim()) {
    const query = filters.search.trim().toLowerCase();
    visible = visible.filter(
      (commit) =>
        commit.subject.toLowerCase().includes(query) ||
        commit.sha.toLowerCase().startsWith(query) ||
        commit.authorName.toLowerCase().includes(query),
    );
  }

  const visibleShas = new Set(visible.map((commit) => commit.sha));
  return visible.map((commit) => ({
    ...commit,
    parents: commit.parents.filter((parent) => visibleShas.has(parent)),
  }));
}
