import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, Button, Spinner } from "@/components/ui";
import { lessons, levelInfo } from "@/content/lessons";
import { ipc } from "@/lib/ipc";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-[11px] text-fg-faint">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-fg">{value}</div>
    </div>
  );
}

export function ProgressPage() {
  const progress = useQuery({
    queryKey: ["progress"],
    queryFn: ipc.getProgress,
  });

  const records = progress.data ?? [];
  const totalXp = records.reduce((sum, record) => sum + record.xp, 0);
  const completed = records.filter((record) => record.status === "completed").length;
  const inProgress = records.filter((record) => record.status === "in_progress").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <h1 className="text-lg font-semibold text-fg">Прогресс</h1>
        <p className="mt-1 text-sm text-fg-muted">
          XP начисляется за каждый пройденный шаг и бонусом за завершённый урок.
        </p>

        {progress.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="Всего XP" value={totalXp} />
              <Stat label="Пройдено уроков" value={completed} />
              <Stat label="В процессе" value={inProgress} />
            </div>

            <div className="mt-6 space-y-2">
              {lessons.map((lesson) => {
                const record = records.find((item) => item.lessonId === lesson.id);
                const done = record?.completedSteps.length ?? 0;

                return (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-fg">{lesson.title}</div>
                      <div className="text-[11px] text-fg-faint">
                        {levelInfo(lesson.level).title}
                      </div>
                    </div>

                    <div className="shrink-0 text-[11px] text-fg-muted">
                      {done} / {lesson.steps.length}
                    </div>

                    <Badge
                      tone={
                        record?.status === "completed"
                          ? "success"
                          : record?.status === "in_progress"
                            ? "accent"
                            : "neutral"
                      }
                    >
                      {record?.status === "completed"
                        ? "пройден"
                        : record?.status === "in_progress"
                          ? "в процессе"
                          : "не начат"}
                    </Badge>

                    <Link to={`/learn/${lesson.id}`}>
                      <Button size="sm" variant="ghost">
                        Открыть
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
