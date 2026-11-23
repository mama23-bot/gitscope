import { TerminalSquare } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui";
import type { SandboxSpec } from "@/types";
import { MiniGraph } from "./MiniGraph";
import { Terminal } from "./Terminal";
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
      content: "console.log(\"hello from GitScope\");\n",
    },
  ],
  commits: [
    {
      message: "Add app entry point",
      files: [
        {
          path: "app.js",
          content: "console.log(\"hello from GitScope\");\nconsole.log(\"ready\");\n",
        },
      ],
    },
  ],
};

export function PlaygroundPage() {
  const sandbox = useSandbox("playground", playgroundSpec);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <TerminalSquare className="size-4 text-accent" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg">Playground</div>
          <div className="text-[11px] text-fg-faint">
            Свободная песочница: настоящий git в отдельном репозитории
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone="success">safe mode</Badge>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          <Terminal
            entries={sandbox.entries}
            busy={sandbox.busy}
            cwd={sandbox.cwd}
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
                "git commit -m \"...\"",
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
    </div>
  );
}
