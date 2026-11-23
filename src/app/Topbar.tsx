import { FolderGit2, FolderOpen, GitBranch } from "lucide-react";
import { useRepoStore } from "@/app/store";
import { useOpenRepo } from "@/app/useOpenRepo";
import { Badge, Button } from "@/components/ui";

export function Topbar() {
  const repo = useRepoStore((state) => state.repo);
  const { openRepository, busy } = useOpenRepo();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4">
      <div className="flex min-w-0 items-center gap-2">
        {repo ? (
          <>
            <FolderGit2 className="size-4 shrink-0 text-fg-faint" />
            <span className="truncate text-[13px] font-medium text-fg">
              {repo.name}
            </span>
            {repo.headBranch ? (
              <Badge tone="accent">
                <GitBranch className="size-3" />
                {repo.headBranch}
              </Badge>
            ) : repo.detached ? (
              <Badge tone="warning">detached HEAD</Badge>
            ) : null}
            <span className="hidden truncate text-[11px] text-fg-faint xl:inline">
              {repo.path}
            </span>
          </>
        ) : (
          <span className="text-xs text-fg-muted">Репозиторий не выбран</span>
        )}
      </div>

      <Button
        size="sm"
        variant="ghost"
        icon={<FolderOpen className="size-3.5" />}
        onClick={openRepository}
        disabled={busy}
      >
        Открыть
      </Button>
    </header>
  );
}
