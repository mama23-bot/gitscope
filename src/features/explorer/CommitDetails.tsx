import { useQuery } from "@tanstack/react-query";
import { Copy, GitCommitHorizontal } from "lucide-react";
import { useState } from "react";
import { Badge, Button, EmptyState, ErrorBanner, Spinner, Tabs } from "@/components/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { errorMessage, ipc } from "@/lib/ipc";
import type { FileChange } from "@/types";
import { DiffViewer } from "./DiffViewer";

const STATUS_TONE: Record<string, string> = {
  A: "text-success",
  D: "text-danger",
  M: "text-warning",
  R: "text-info",
  C: "text-info",
  T: "text-warning",
};

function FileList({ files }: { files: FileChange[] }) {
  if (files.length === 0) {
    return (
      <EmptyState
        title="Файлы не изменились"
        description="Коммит не содержит изменений в файлах."
      />
    );
  }

  return (
    <div className="divide-y divide-line/60">
      {files.map((file) => (
        <div
          key={`${file.path}:${file.oldPath ?? ""}`}
          className="flex items-center gap-2 px-3 py-1.5 text-xs"
        >
          <span
            className={`mono w-4 shrink-0 text-center font-semibold ${
              STATUS_TONE[file.status] ?? "text-fg-muted"
            }`}
            title={file.status}
          >
            {file.status}
          </span>
          <span className="mono min-w-0 flex-1 truncate text-fg" title={file.path}>
            {file.oldPath ? (
              <>
                <span className="text-fg-faint">{file.oldPath}</span>
                <span className="text-fg-faint"> → </span>
              </>
            ) : null}
            {file.path}
          </span>
          {file.binary ? (
            <span className="shrink-0 text-[10px] text-fg-faint">binary</span>
          ) : (
            <span className="shrink-0 text-[11px]">
              <span className="text-success">+{formatNumber(file.additions)}</span>{" "}
              <span className="text-danger">−{formatNumber(file.deletions)}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function CommitDetails({ repoPath, sha }: { repoPath: string; sha: string | null }) {
  const [tab, setTab] = useState("overview");

  const details = useQuery({
    queryKey: ["commit", repoPath, sha],
    queryFn: () => ipc.commitDetails(repoPath, sha as string),
    enabled: Boolean(sha),
  });

  const diff = useQuery({
    queryKey: ["diff", repoPath, sha],
    queryFn: () => ipc.commitDiff(repoPath, sha as string),
    enabled: Boolean(sha) && tab === "changes",
  });

  if (!sha) {
    return (
      <EmptyState
        icon={<GitCommitHorizontal className="size-5" />}
        title="Выбери коммит"
        description="Кликни по строке в истории, чтобы увидеть автора, файлы и diff."
      />
    );
  }

  if (details.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (details.error) {
    return (
      <div className="p-3">
        <ErrorBanner message={errorMessage(details.error)} />
      </div>
    );
  }

  const data = details.data;
  if (!data) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold leading-snug text-fg">{data.subject}</h2>
          <Button
            size="sm"
            variant="ghost"
            title="Скопировать полный хеш"
            icon={<Copy className="size-3.5" />}
            onClick={() => navigator.clipboard.writeText(data.sha)}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
          <span className="mono rounded bg-raised px-1.5 py-0.5 text-fg">{data.shortSha}</span>
          {data.isMerge ? <Badge tone="info">merge</Badge> : null}
          <span className="truncate">{data.authorName}</span>
          <span className="text-fg-faint">·</span>
          <span>{formatDateTime(data.authorTime)}</span>
        </div>

        {data.body ? (
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">
            {data.body}
          </pre>
        ) : null}

        <div className="mt-3 flex items-center gap-3 text-[11px]">
          <span className="text-success">+{formatNumber(data.additions)}</span>
          <span className="text-danger">−{formatNumber(data.deletions)}</span>
          <span className="text-fg-faint">{formatNumber(data.files.length)} файлов</span>
        </div>
      </div>

      <Tabs
        items={[
          { id: "overview", label: "Обзор" },
          { id: "changes", label: "Изменения", count: data.files.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "overview" ? (
          <FileList files={data.files} />
        ) : (
          <DiffViewer
            patch={diff.data?.patch}
            truncated={diff.data?.truncated}
            loading={diff.isLoading}
            error={diff.error ? errorMessage(diff.error) : null}
          />
        )}
      </div>
    </div>
  );
}
