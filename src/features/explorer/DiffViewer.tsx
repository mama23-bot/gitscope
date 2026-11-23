import { FileDiff } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, ErrorBanner, Spinner } from "@/components/ui";

/**
 * diff2html весит немало, поэтому подгружаем его только когда пользователь
 * действительно открыл вкладку с изменениями.
 */
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
  const [rendered, setRendered] = useState("");
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!patch?.trim()) {
      setRendered("");
      setRendering(false);
      setRenderError(null);
      return;
    }

    let cancelled = false;
    setRendering(true);
    setRenderError(null);

    Promise.all([
      import("diff2html"),
      import("diff2html/lib/types"),
      import("diff2html/bundles/css/diff2html.min.css"),
    ])
      .then(([diff2html, types]) => {
        if (cancelled) return;
        try {
          setRendered(
            diff2html.html(patch, {
              drawFileList: false,
              matching: "lines",
              outputFormat: "line-by-line",
              colorScheme: types.ColorSchemeType.DARK,
            }),
          );
        } catch {
          setRenderError("Не удалось разобрать diff.");
        } finally {
          setRendering(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRenderError("Не удалось загрузить diff-viewer.");
        setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patch]);

  if (loading || rendering) {
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

  if (renderError) {
    return (
      <div className="p-3">
        <ErrorBanner message={renderError} />
      </div>
    );
  }

  if (!patch?.trim()) {
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
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: diff2html экранирует содержимое patch */}
      <div dangerouslySetInnerHTML={{ __html: rendered }} />
    </div>
  );
}
