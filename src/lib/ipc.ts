import { invoke } from "@tauri-apps/api/core";
import type {
  AppInfo,
  CommandResult,
  Commit,
  CommitDetails,
  DiffPayload,
  LessonProgress,
  RecentRepo,
  RefInfo,
  RepoInfo,
  RepoState,
  RepoStatus,
  SandboxInfo,
  SandboxSpec,
  ShellMode,
  TerminalIntegrationStatus,
  WindowsIntegrationStatus,
} from "@/types";
import { mockIpc } from "./mock-ipc";

const realIpc = {
  gitVersion: () => invoke<string>("git_version"),
  appInfo: () => invoke<AppInfo>("app_info"),

  openRepo: (path: string) => invoke<RepoInfo>("open_repo", { path }),
  listCommits: (path: string, limit?: number) => invoke<Commit[]>("list_commits", { path, limit }),
  listRefs: (path: string) => invoke<RefInfo[]>("list_refs", { path }),
  commitDetails: (path: string, sha: string) =>
    invoke<CommitDetails>("commit_details", { path, sha }),
  commitDiff: (path: string, sha: string) => invoke<DiffPayload>("commit_diff", { path, sha }),
  repoStatus: (path: string) => invoke<RepoStatus>("repo_status", { path }),

  recentRepos: () => invoke<RecentRepo[]>("recent_repos"),
  removeRecentRepo: (path: string) => invoke<void>("remove_recent_repo", { path }),

  createSandbox: (scenarioId: string, spec: SandboxSpec) =>
    invoke<SandboxInfo>("create_sandbox", { scenarioId, spec }),
  resetSandbox: (id: string) => invoke<SandboxInfo>("reset_sandbox", { id }),
  runSandboxCommand: (id: string, command: string, cwd: string, mode: ShellMode) =>
    invoke<CommandResult>("run_sandbox_command", { id, command, cwd, mode }),
  sandboxState: (id: string) => invoke<RepoState>("sandbox_state", { id }),
  destroySandbox: (id: string) => invoke<void>("destroy_sandbox", { id }),

  getProgress: () => invoke<LessonProgress[]>("get_progress"),
  saveProgress: (payload: {
    lessonId: string;
    status: string;
    stepIndex: number;
    completedSteps: string[];
    xp: number;
  }) => invoke<void>("save_progress", payload),

  getSettings: () => invoke<Record<string, string>>("get_settings"),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),

  terminalIntegrationStatus: () => invoke<TerminalIntegrationStatus>("terminal_integration_status"),
  terminalIntegrationEnable: () => invoke<TerminalIntegrationStatus>("terminal_integration_enable"),
  terminalIntegrationDisable: () =>
    invoke<TerminalIntegrationStatus>("terminal_integration_disable"),

  windowsIntegrationStatus: () => invoke<WindowsIntegrationStatus>("windows_integration_status"),
  windowsIntegrationEnable: () => invoke<WindowsIntegrationStatus>("windows_integration_enable"),
  windowsIntegrationDisable: () => invoke<WindowsIntegrationStatus>("windows_integration_disable"),
};

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** В Tauri — реальный git, в обычном браузере — демо-мок для превью интерфейса. */
export const ipc: typeof realIpc = isTauri ? realIpc : mockIpc;

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Неизвестная ошибка";
}
