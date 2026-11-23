import { useQuery } from "@tanstack/react-query";
import { GitCommitHorizontal, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, ErrorBanner, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { errorMessage, ipc } from "@/lib/ipc";
import { useGraphLayout } from "@/lib/useGraphLayout";
import { filterCommits } from "@/lib/validators";
import type { RepoInfo } from "@/types";
import { CommitDetails } from "./CommitDetails";
import { CommitList } from "./CommitList";
import { Filters, type ExplorerFilters } from "./Filters";

export function RepoExplorer({ repo }: { repo: RepoInfo }) {
  const [filters, setFilters] = useState<ExplorerFilters>({
    search: "",
    author: "",
    branch: "",
  });
  const [selectedSha, setSelectedSha] = useState<string | null>(null);

  const commitsQuery = useQuery({
    queryKey: ["commits", repo.path],
    queryFn: () => ipc.listCommits(repo.path),
  });

  const refsQuery = useQuery({
    queryKey: ["refs", repo.path],
    queryFn: () => ipc.listRefs(repo.path),
  });

  const commits = commitsQuery.data ?? [];
  const refs = refsQuery.data ?? [];

  const authors = useMemo(
    () =>
      Array.from(new Set(commits.map((commit) => commit.authorName))).sort((left, right) =>
        left.localeCompare(right, "ru"),
      ),
    [commits],
  );

  const branches = useMemo(
    () =>
      refs
        .filter((reference) => reference.kind === "branch")
        .map((reference) => reference.name),
    [refs],
  );

  const filtered = useMemo(
    () => filterCommits(commits, filters),
    [commits, filters],
  );

  const layout = useGraphLayout(filtered);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedSha(null);
      return;
    }
    if (!selectedSha || !filtered.some((commit) => commit.sha === selectedSha)) {
      setSelectedSha(filtered[0].sha);
    }
  }, [filtered, selectedSha]);

  const refresh = () => {
    commitsQuery.refetch();
    refsQuery.refetch();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
          <GitCommitHorizontal className="size-4 text-fg-faint" />
          <span className="font-medium text-fg">{formatNumber(commits.length)}</span>
          <span className="text-fg-faint">коммитов</span>
        </div>

        <div className="h-4 w-px shrink-0 bg-line" />

        <Filters
          filters={filters}
          authors={authors}
          branches={branches}
          onChange={setFilters}
        />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {filtered.length !== commits.length ? (
            <span className="text-[11px] text-fg-faint">
              показано {formatNumber(filtered.length)}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            title="Обновить"
            icon={
              <RefreshCw
                className={cn("size-3.5", commitsQuery.isFetching && "animate-spin")}
              />
            }
            onClick={refresh}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {commitsQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : commitsQuery.error ? (
            <div className="p-3">
              <ErrorBanner
                message={errorMessage(commitsQuery.error)}
                onRetry={() => commitsQuery.refetch()}
              />
            </div>
          ) : commits.length === 0 ? (
            <EmptyState
              icon={<GitCommitHorizontal className="size-5" />}
              title="В репозитории пока нет коммитов"
              description="Сделай первый коммит — и история появится здесь."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              description="Попробуй изменить запрос или сбросить фильтры."
            />
          ) : (
            <CommitList
              commits={filtered}
              layout={layout}
              selectedSha={selectedSha}
              headSha={repo.headSha}
              onSelect={setSelectedSha}
            />
          )}
        </div>

        <div className="w-[440px] shrink-0 border-l border-line bg-surface">
          <CommitDetails repoPath={repo.path} sha={selectedSha} />
        </div>
      </div>
    </div>
  );
}
