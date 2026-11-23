import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, GitBranch, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useRepoStore } from "@/app/store";
import { useOpenRepo } from "@/app/useOpenRepo";
import { Logo } from "@/components/Logo";
import { Button, ErrorBanner, Spinner } from "@/components/ui";
import { demoSpec } from "@/content/scenarios/demo";
import { errorMessage, ipc } from "@/lib/ipc";
import { formatRelativeTime } from "@/lib/format";

export function RepoPicker() {
  const setRepo = useRepoStore((state) => state.setRepo);
  const { openRepository, busy, error } = useOpenRepo();
  const queryClient = useQueryClient();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const recent = useQuery({
    queryKey: ["recentRepos"],
    queryFn: ipc.recentRepos,
  });

  const openPath = async (path: string) => {
    setDemoError(null);
    try {
      setRepo(await ipc.openRepo(path));
    } catch (cause) {
      setDemoError(errorMessage(cause));
    }
  };

  const createDemo = async () => {
    setDemoBusy(true);
    setDemoError(null);
    try {
      const sandbox = await ipc.createSandbox("demo", demoSpec);
      setRepo(await ipc.openRepo(sandbox.path));
      await queryClient.invalidateQueries({ queryKey: ["recentRepos"] });
    } catch (cause) {
      setDemoError(errorMessage(cause));
    } finally {
      setDemoBusy(false);
    }
  };

  const removeRecent = async (path: string) => {
    await ipc.removeRecentRepo(path);
    await queryClient.invalidateQueries({ queryKey: ["recentRepos"] });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-14">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">GitScope</h1>
            <p className="text-xs text-fg-muted">
              Explore your Git history. Understand every commit.
            </p>
          </div>
        </div>

        <p className="mt-7 max-w-xl text-sm leading-relaxed text-fg-muted">
          Открой локальный репозиторий, чтобы увидеть граф коммитов, ветки и
          изменения. GitScope работает только на чтение и никогда не меняет твой
          код.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={<FolderOpen className="size-4" />}
            onClick={openRepository}
            disabled={busy}
          >
            Открыть репозиторий
          </Button>
          <Button
            icon={<Sparkles className="size-4" />}
            onClick={createDemo}
            disabled={demoBusy}
          >
            {demoBusy ? "Создаю демо…" : "Создать демо-репозиторий"}
          </Button>
        </div>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        ) : null}
        {demoError ? (
          <div className="mt-4">
            <ErrorBanner message={demoError} />
          </div>
        ) : null}

        <div className="mt-10">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
            Недавние репозитории
          </div>

          {recent.isLoading ? (
            <div className="flex h-16 items-center justify-center">
              <Spinner />
            </div>
          ) : recent.data && recent.data.length > 0 ? (
            <div className="space-y-1">
              {recent.data.map((item) => (
                <div
                  key={item.path}
                  className="group flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 transition-colors hover:border-line-strong hover:bg-raised"
                >
                  <button
                    type="button"
                    onClick={() => openPath(item.path)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <GitBranch className="size-4 shrink-0 text-fg-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-fg">
                        {item.name}
                      </span>
                      <span className="mono block truncate text-[10px] text-fg-faint">
                        {item.path}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-fg-faint">
                      {formatRelativeTime(item.openedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Убрать из недавних"
                    onClick={() => removeRecent(item.path)}
                    className="shrink-0 rounded p-1 text-fg-faint opacity-0 transition-opacity hover:bg-overlay hover:text-fg group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-fg-faint">
              Пока пусто. Открой репозиторий или создай демо.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
