export type RefKind = "branch" | "remote" | "tag";

export interface RefLabel {
  name: string;
  kind: RefKind;
  isHead: boolean;
}

export interface Commit {
  sha: string;
  shortSha: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  authorTime: number;
  committerName: string;
  committerTime: number;
  subject: string;
  refs: RefLabel[];
}

export interface RefInfo {
  name: string;
  fullName: string;
  kind: RefKind;
  target: string;
  isHead: boolean;
  upstream: string | null;
}

export interface RepoInfo {
  path: string;
  name: string;
  headBranch: string | null;
  headSha: string | null;
  detached: boolean;
  isEmpty: boolean;
  gitVersion: string;
}

export interface FileChange {
  path: string;
  oldPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  binary: boolean;
}

export interface CommitDetails {
  sha: string;
  shortSha: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  authorTime: number;
  committerName: string;
  committerEmail: string;
  committerTime: number;
  subject: string;
  body: string;
  files: FileChange[];
  additions: number;
  deletions: number;
  isMerge: boolean;
}

export interface DiffPayload {
  sha: string;
  parent: string | null;
  patch: string;
  truncated: boolean;
}

export interface StatusEntry {
  path: string;
  index: string;
  worktree: string;
  kind: string;
}

export interface RepoStatus {
  branch: string | null;
  headSha: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: StatusEntry[];
  conflicts: string[];
  clean: boolean;
}

export interface BranchState {
  name: string;
  sha: string;
  isHead: boolean;
}

export interface CommitState {
  sha: string;
  parents: string[];
  subject: string;
  authorName: string;
  authorTime: number;
  refs: string[];
}

export interface ReflogEntry {
  sha: string;
  selector: string;
  subject: string;
}

export interface RepoState {
  headBranch: string | null;
  headSha: string | null;
  detached: boolean;
  branches: BranchState[];
  tags: string[];
  commits: CommitState[];
  status: StatusEntry[];
  conflicts: string[];
  stashCount: number;
  files: string[];
  reflog: ReflogEntry[];
}

export interface SandboxInfo {
  id: string;
  path: string;
  state: RepoState;
}

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  code: number;
  durationMs: number;
  state: RepoState;
  cwd: string;
  clear: boolean;
}

export interface RecentRepo {
  path: string;
  name: string;
  openedAt: number;
}

export interface LessonProgress {
  lessonId: string;
  status: string;
  stepIndex: number;
  completedSteps: string[];
  xp: number;
  updatedAt: number;
}

export interface AppInfo {
  version: string;
  dataDir: string;
  gitVersion: string;
  platform: string;
  bashAvailable: boolean;
}

export type ShellMode = "safe" | "full";

export interface TerminalIntegrationStatus {
  installed: boolean;
  bashAvailable: boolean;
  profiles: string[];
}

export interface FileSpec {
  path: string;
  content: string;
}

export interface CommitSpec {
  message: string;
  files?: FileSpec[];
  delete?: string[];
}

export interface BranchSpec {
  name: string;
  from: string;
  commits?: CommitSpec[];
}

export interface MergeSpec {
  into: string;
  from: string;
  message: string;
}

export interface TagSpec {
  name: string;
  target: string;
}

export interface SandboxSpec {
  initialBranch?: string;
  files?: FileSpec[];
  commits?: CommitSpec[];
  branches?: BranchSpec[];
  merges?: MergeSpec[];
  tags?: TagSpec[];
  untrackedFiles?: FileSpec[];
}
