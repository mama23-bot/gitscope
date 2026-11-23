import { useQuery } from "@tanstack/react-query";
import { Clock, ListChecks, Zap } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui";
import { LEVELS, lessons, lessonsByLevel } from "@/content/lessons";
import type { Lesson, LessonLevel } from "@/content/types";
import { cn } from "@/lib/cn";
import { ipc } from "@/lib/ipc";
import type { LessonProgress } from "@/types";

function LessonCard({ lesson, progress }: { lesson: Lesson; progress?: LessonProgress }) {
  const status = progress?.status;

  return (
    <Link
      to={`/learn/${lesson.id}`}
      className="group flex flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-raised"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-fg">{lesson.title}</div>
        {status === "completed" ? (
          <Badge tone="success">пройден</Badge>
        ) : status === "in_progress" ? (
          <Badge tone="accent">в процессе</Badge>
        ) : (
          <Badge tone="neutral">урок</Badge>
        )}
      </div>

      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-fg-muted">{lesson.summary}</p>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-faint">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {lesson.duration}
        </span>
        <span className="flex items-center gap-1">
          <Zap className="size-3" />
          {lesson.xp} XP
        </span>
        <span className="flex items-center gap-1">
          <ListChecks className="size-3" />
          {lesson.steps.length} шагов
        </span>
      </div>
    </Link>
  );
}

export function LearnPage() {
  const [params, setParams] = useSearchParams();
  const activeLevel = params.get("level") as LessonLevel | null;

  const progress = useQuery({
    queryKey: ["progress"],
    queryFn: ipc.getProgress,
  });

  const progressMap = useMemo(
    () => new Map((progress.data ?? []).map((item) => [item.lessonId, item])),
    [progress.data],
  );

  const visible = activeLevel ? lessonsByLevel(activeLevel) : lessons;
  const level = activeLevel ? LEVELS.find((item) => item.id === activeLevel) : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-8">
        <h1 className="text-lg font-semibold text-fg">Обучение Git</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">
          Короткие уроки с настоящим git в изолированной песочнице. Ошибаться безопасно: твой код и
          репозитории остаются нетронутыми.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setParams({})}
            className={cn(
              "h-7 rounded-md border px-2.5 text-xs transition-colors",
              !activeLevel
                ? "border-accent/40 bg-accent-soft text-fg"
                : "border-line bg-surface text-fg-muted hover:text-fg",
            )}
          >
            Все
          </button>
          {LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setParams({ level: item.id })}
              className={cn(
                "h-7 rounded-md border px-2.5 text-xs transition-colors",
                activeLevel === item.id
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-line bg-surface text-fg-muted hover:text-fg",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>

        {level ? <p className="mt-4 text-xs text-fg-muted">{level.description}</p> : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {visible.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} progress={progressMap.get(lesson.id)} />
          ))}

          {visible.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-line p-8 text-center text-xs text-fg-faint">
              В этом разделе уроки ещё готовятся.
            </div>
          ) : null}
        </div>

        {!activeLevel ? (
          <div className="mt-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
              Скоро
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {LEVELS.filter((item) => lessonsByLevel(item.id).length === 0).map((item) => (
                <div key={item.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="text-xs font-medium text-fg-muted">{item.title}</div>
                  <div className="mt-0.5 text-[11px] text-fg-faint">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
