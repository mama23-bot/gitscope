import { GitBranch } from "lucide-react";
import { useRepoStore } from "@/app/store";

export function StatusBar() {
  const repo = useRepoStore((state) => state.repo);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-3 text-[11px] text-fg-faint">
      <div className="flex min-w-0 items-center gap-3">
        {repo?.headBranch ? (
          <span className="flex shrink-0 items-center gap-1">
            <GitBranch className="size-3" />
            {repo.headBranch}
          </span>
        ) : null}
        <span className="truncate">{repo ? repo.path : "GitScope"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span>{repo?.gitVersion || "git не найден"}</span>
        <span>v0.1.0</span>
      </div>
    </footer>
  );
}
