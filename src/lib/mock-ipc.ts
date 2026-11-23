import type {
  AppInfo,
  CommandResult,
  Commit,
  CommitDetails,
  DiffPayload,
  FileChange,
  LessonProgress,
  RecentRepo,
  RefInfo,
  RepoInfo,
  RepoState,
  RepoStatus,
  SandboxInfo,
  SandboxSpec,
  ShellMode,
} from "@/types";

const now = Math.floor(Date.now() / 1000);
const day = 86_400;

function makeCommit(
  sha: string,
  parents: string[],
  subject: string,
  author: string,
  time: number,
  refs: Commit["refs"] = [],
): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    parents,
    authorName: author,
    authorEmail: `${author.split(" ")[0].toLowerCase()}@example.com`,
    authorTime: time,
    committerName: author,
    committerTime: time,
    subject,
    refs,
  };
}

const commits: Commit[] = [
  makeCommit(
    "9f2c1a7b3d4e",
    ["5a1b2c3d4e6f", "7c8d9e0f1a2b"],
    "Merge branch 'feature/dashboard'",
    "Анна Смирнова",
    now - 1800,
    [{ name: "main", kind: "branch", isHead: true }],
  ),
  makeCommit(
    "5a1b2c3d4e6f",
    ["3e4f5a6b7c8d", "1b2c3d4e5f6a"],
    "Merge branch 'feature/auth'",
    "Анна Смирнова",
    now - 7200,
    [{ name: "v0.1.0", kind: "tag", isHead: false }],
  ),
  makeCommit("7c8d9e0f1a2b", ["3e4f5a6b7c8d"], "Add dashboard layout", "Борис Ким", now - 9000, [
    { name: "feature/dashboard", kind: "branch", isHead: false },
  ]),
  makeCommit(
    "1b2c3d4e5f6a",
    ["9a8b7c6d5e4f"],
    "Validate credentials",
    "Анна Смирнова",
    now - 10_800,
    [{ name: "feature/auth", kind: "branch", isHead: false }],
  ),
  makeCommit("9a8b7c6d5e4f", ["3e4f5a6b7c8d"], "Add login form", "Анна Смирнова", now - 12_600, []),
  makeCommit("3e4f5a6b7c8d", ["2d3e4f5a6b7c"], "Fix header spacing", "Борис Ким", now - day, []),
  makeCommit(
    "2d3e4f5a6b7c",
    ["1c2d3e4f5a6b"],
    "Add routing",
    "Анна Смирнова",
    now - day - 3600,
    [],
  ),
  makeCommit("1c2d3e4f5a6b", [], "Initial commit", "Анна Смирнова", now - day - 7200, []),
];

const refs: RefInfo[] = [
  {
    name: "feature/auth",
    fullName: "refs/heads/feature/auth",
    kind: "branch",
    target: "1b2c3d4e5f6a",
    isHead: false,
    upstream: null,
  },
  {
    name: "feature/dashboard",
    fullName: "refs/heads/feature/dashboard",
    kind: "branch",
    target: "7c8d9e0f1a2b",
    isHead: false,
    upstream: null,
  },
  {
    name: "main",
    fullName: "refs/heads/main",
    kind: "branch",
    target: "9f2c1a7b3d4e",
    isHead: true,
    upstream: null,
  },
  {
    name: "v0.1.0",
    fullName: "refs/tags/v0.1.0",
    kind: "tag",
    target: "5a1b2c3d4e6f",
    isHead: false,
    upstream: null,
  },
];

const fileSets: Record<string, FileChange[]> = {
  "9f2c1a7b3d4e": [
    {
      path: "src/dashboard.js",
      oldPath: null,
      status: "A",
      additions: 1,
      deletions: 0,
      binary: false,
    },
  ],
  "5a1b2c3d4e6f": [
    {
      path: "src/auth/login.js",
      oldPath: null,
      status: "A",
      additions: 3,
      deletions: 0,
      binary: false,
    },
    {
      path: "src/auth/validate.js",
      oldPath: null,
      status: "A",
      additions: 3,
      deletions: 0,
      binary: false,
    },
  ],
  "7c8d9e0f1a2b": [
    {
      path: "src/dashboard.js",
      oldPath: null,
      status: "A",
      additions: 1,
      deletions: 0,
      binary: false,
    },
  ],
  "1b2c3d4e5f6a": [
    {
      path: "src/auth/validate.js",
      oldPath: null,
      status: "A",
      additions: 3,
      deletions: 0,
      binary: false,
    },
  ],
  "9a8b7c6d5e4f": [
    {
      path: "src/auth/login.js",
      oldPath: null,
      status: "A",
      additions: 3,
      deletions: 0,
      binary: false,
    },
  ],
  "3e4f5a6b7c8d": [
    {
      path: "src/styles.css",
      oldPath: null,
      status: "M",
      additions: 4,
      deletions: 0,
      binary: false,
    },
  ],
  "2d3e4f5a6b7c": [
    {
      path: "src/router.js",
      oldPath: null,
      status: "A",
      additions: 1,
      deletions: 0,
      binary: false,
    },
  ],
  "1c2d3e4f5a6b": [
    { path: "README.md", oldPath: null, status: "A", additions: 3, deletions: 0, binary: false },
    { path: "src/app.js", oldPath: null, status: "A", additions: 5, deletions: 0, binary: false },
    {
      path: "src/styles.css",
      oldPath: null,
      status: "A",
      additions: 4,
      deletions: 0,
      binary: false,
    },
  ],
};

const patches: Record<string, string> = {
  "3e4f5a6b7c8d": `diff --git a/src/styles.css b/src/styles.css
index 1111111..2222222 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -1,4 +1,8 @@
 body {
   margin: 0;
   font-family: sans-serif;
 }
+
+header {
+  padding: 12px 16px;
+}
`,
  "9a8b7c6d5e4f": `diff --git a/src/auth/login.js b/src/auth/login.js
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/auth/login.js
@@ -0,0 +1,3 @@
+export function login(user, password) {
+  return Boolean(user && password);
+}
`,
};

function detailsFor(commit: Commit): CommitDetails {
  const files = fileSets[commit.sha] ?? [];
  return {
    sha: commit.sha,
    shortSha: commit.shortSha,
    parents: commit.parents,
    authorName: commit.authorName,
    authorEmail: commit.authorEmail,
    authorTime: commit.authorTime,
    committerName: commit.committerName,
    committerEmail: commit.authorEmail,
    committerTime: commit.committerTime,
    subject: commit.subject,
    body: commit.parents.length > 1 ? "Объединение ветки в main." : "",
    files,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    isMerge: commit.parents.length > 1,
  };
}

const repo: RepoInfo = {
  path: "C:\\demo\\aurora",
  name: "aurora",
  headBranch: "main",
  headSha: commits[0].sha,
  detached: false,
  isEmpty: false,
  gitVersion: "git version 2.56.1 (browser mock)",
};

const sandboxState: RepoState = {
  headBranch: "main",
  headSha: "1c2d3e4f5a6b",
  detached: false,
  branches: [{ name: "main", sha: "1c2d3e4f5a6b", isHead: true }],
  tags: [],
  commits: [
    {
      sha: "1c2d3e4f5a6b",
      parents: [],
      subject: "Initial commit",
      authorName: "Ученик GitScope",
      authorTime: now - day,
      refs: ["main"],
    },
  ],
  status: [],
  conflicts: [],
  stashCount: 0,
  files: ["README.md", "app.js", "login.js"],
  reflog: [],
};

const progressKey = "gitscope:mock-progress";

function readProgress(): LessonProgress[] {
  try {
    return JSON.parse(localStorage.getItem(progressKey) ?? "[]") as LessonProgress[];
  } catch {
    return [];
  }
}

export const mockIpc = {
  gitVersion: async () => "git version 2.56.1 (browser mock)",
  appInfo: async (): Promise<AppInfo> => ({
    version: "0.1.0",
    dataDir: "C:\\demo\\GitScope",
    gitVersion: "git version 2.56.1 (browser mock)",
    platform: "browser",
    bashAvailable: true,
  }),

  openRepo: async (path: string): Promise<RepoInfo> => ({ ...repo, path }),
  listCommits: async (): Promise<Commit[]> => commits,
  listRefs: async (): Promise<RefInfo[]> => refs,
  commitDetails: async (_path: string, sha: string): Promise<CommitDetails> => {
    const commit = commits.find((item) => item.sha === sha) ?? commits[0];
    return detailsFor(commit);
  },
  commitDiff: async (_path: string, sha: string): Promise<DiffPayload> => ({
    sha,
    parent: null,
    patch: patches[sha] ?? "",
    truncated: false,
  }),
  repoStatus: async (): Promise<RepoStatus> => ({
    branch: "main",
    headSha: commits[0].sha,
    upstream: null,
    ahead: 0,
    behind: 0,
    entries: [],
    conflicts: [],
    clean: true,
  }),

  recentRepos: async (): Promise<RecentRepo[]> => [
    { path: repo.path, name: repo.name, openedAt: now - 3600 },
  ],
  removeRecentRepo: async () => {},

  createSandbox: async (_scenarioId: string, _spec: SandboxSpec): Promise<SandboxInfo> => ({
    id: "mock-sandbox",
    path: "C:\\demo\\sandbox",
    state: sandboxState,
  }),
  resetSandbox: async (): Promise<SandboxInfo> => ({
    id: "mock-sandbox",
    path: "C:\\demo\\sandbox",
    state: sandboxState,
  }),
  runSandboxCommand: async (
    _id: string,
    command: string,
    cwd: string,
    _mode: ShellMode,
  ): Promise<CommandResult> => ({
    command,
    stdout: "Это браузерный мок: команды не выполняются. Запусти приложение через Tauri.\n",
    stderr: "",
    code: 0,
    durationMs: 1,
    state: sandboxState,
    cwd,
    clear: false,
  }),
  sandboxState: async (): Promise<RepoState> => sandboxState,
  destroySandbox: async () => {},

  getProgress: async (): Promise<LessonProgress[]> => readProgress(),
  saveProgress: async (payload: {
    lessonId: string;
    status: string;
    stepIndex: number;
    completedSteps: string[];
    xp: number;
  }): Promise<void> => {
    const records = readProgress().filter((item) => item.lessonId !== payload.lessonId);
    records.push({ ...payload, updatedAt: now });
    localStorage.setItem(progressKey, JSON.stringify(records));
  },

  getSettings: async (): Promise<Record<string, string>> => ({}),
  setSetting: async () => {},
};
