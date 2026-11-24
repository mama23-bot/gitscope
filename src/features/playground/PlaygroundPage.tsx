import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ipc } from "@/lib/ipc";
import type { SandboxSpec, ShellMode, TerminalIntegrationStatus } from "@/types";
import { MiniGraph } from "./MiniGraph";
import { Terminal } from "./Terminal";
import { TerminalIntegrationDialog } from "./TerminalIntegrationDialog";
import { useSandbox } from "./useSandbox";

const playgroundSpec: SandboxSpec = {
  initialBranch: "main",
  files: [
    {
      path: "README.md",
      content:
        "# Песочница GitScope\n\nЭкспериментируй без страха: это отдельный репозиторий, твой код не затрагивается.\n",
    },
    {
      path: "app.js",
      content: 'console.log("hello from GitScope");\n',
    },
  ],
  commits: [
    {
      message: "Add app entry point",
      files: [
        {
          path: "app.js",
          content: 'console.log("hello from GitScope");\nconsole.log("ready");\n',
        },
      ],
    },
  ],
};

export function PlaygroundPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ShellMode>("full");
  const [draft, setDraft] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const prompted = useRef(false);
  const sandbox = useSandbox("playground", playgroundSpec, mode);

  const appInfo = useQuery({ queryKey: ["appInfo"], queryFn: ipc.appInfo });
  const bashAvailable = appInfo.data?.bashAvailable ?? true;

  const settings = useQuery({ queryKey: ["settings"], queryFn: ipc.getSettings });
  const integration = useQuery({
    queryKey: ["terminalIntegration"],
    queryFn: ipc.terminalIntegrationStatus,
  });

  useEffect(() => {
    if (appInfo.data?.bashAvailable === false) {
      setMode("safe");
    }
  }, [appInfo.data]);

  useEffect(() => {
    if (mode !== "full" || prompted.current) return;
    if (!settings.data || !integration.data) return;

    const seen = settings.data["terminal.integration.promptSeen"] === "true";
    if (!seen && !integration.data.installed) {
      prompted.current = true;
      setDialogOpen(true);
    }
  }, [mode, settings.data, integration.data]);

  const closeDialog = async () => {
    setDialogOpen(false);
    await ipc.setSetting("terminal.integration.promptSeen", "true");
    await settings.refetch();
  };

  const enableIntegration = async (next: TerminalIntegrationStatus) => {
    setDialogOpen(false);
    await ipc.setSetting("terminal.integration.promptSeen", "true");
    queryClient.setQueryData(["terminalIntegration"], next);
    await settings.refetch();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <TerminalSquare className="size-4 text-accent" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg">Playground</div>
          <div className="text-[11px] text-fg-faint">
            Свободная песочница: настоящий git и Linux-терминал
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md border border-line bg-canvas p-0.5">
            <button
              type="button"
              onClick={() => setMode("full")}
              disabled={!bashAvailable}
              className={cn(
                "rounded px-2 py-1 text-[11px] transition-colors",
                mode === "full" ? "bg-accent-soft text-fg" : "text-fg-muted hover:text-fg",
                !bashAvailable && "cursor-not-allowed opacity-40",
              )}
            >
              Linux (Git Bash)
            </button>
            <button
              type="button"
              onClick={() => setMode("safe")}
              className={cn(
                "rounded px-2 py-1 text-[11px] transition-colors",
                mode === "safe" ? "bg-accent-soft text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              Безопасный
            </button>
          </div>
          {mode === "full" ? (
            <Badge tone="warning">полный доступ</Badge>
          ) : (
            <Badge tone="success">safe mode</Badge>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          <Terminal
            entries={sandbox.entries}
            busy={sandbox.busy}
            cwd={sandbox.cwd}
            mode={mode}
            onRun={sandbox.run}
            onReset={sandbox.reset}
            draft={draft}
            onDraftConsumed={() => setDraft(null)}
          />
        </div>

        <div className="flex w-[400px] shrink-0 flex-col border-l border-line bg-surface">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3 text-[11px] text-fg-muted">
            <span>Граф репозитория</span>
            <span className="mono text-fg-faint">
              {sandbox.state?.headBranch ?? "detached HEAD"}
            </span>
          </div>

          <div className="min-h-0 flex-1">
            <MiniGraph state={sandbox.state} />
          </div>

          <div className="shrink-0 border-t border-line p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
              Шпаргалка
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                "help",
                "ls -l",
                "cat README.md",
                "git status",
                "git log --oneline --graph --all",
                "git switch -c feature",
                "git add .",
                'git commit -m "..."',
                "git merge --no-ff feature",
                "git branch -d feature",
              ].map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => setDraft(command)}
                  className="mono rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] text-fg-muted transition-colors hover:border-accent/40 hover:text-fg"
                >
                  {command}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TerminalIntegrationDialog
        open={dialogOpen}
        status={integration.data ?? null}
        onClose={closeDialog}
        onEnabled={enableIntegration}
      />
    </div>
  );
}
