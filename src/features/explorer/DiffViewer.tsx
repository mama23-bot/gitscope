import { html as renderDiff } from "diff2html";
import { ColorSchemeType } from "diff2html/lib/types";
import { FileDiff } from "lucide-react";
import { useMemo } from "react";
import { EmptyState, ErrorBanner, Spinner } from "@/components/ui";

export function DiffViewer({
  patch,
  truncated,
  loading,
  error,
}: {
  patch?: string;
  truncated?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  const rendered = useMemo(() => {
    if (!patch || !patch.trim()) return "";
    try {
      return renderDiff(patch, {
        drawFileList: false,
        matching: "lines",
        outputFormat: "line-by-line",
        colorScheme: ColorSchemeType.DARK,
      });
    } catch {
      return "";
    }
  }, [patch]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3">
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!patch || !patch.trim()) {
    return (
      <EmptyState
        icon={<FileDiff className="size-5" />}
        title="Нет изменений"
        description="У этого коммита пустой diff — например, merge без конфликтов."
      />
    );
  }

  return (
    <div className="p-3">
      {truncated ? (
        <div className="mb-2 rounded border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning">
          Diff обрезан: коммит слишком большой.
        </div>
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: rendered }} />
    </div>
  );
}
