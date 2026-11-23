import { ArrowLeft, Check, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button } from "@/components/ui";
import { levelInfo } from "@/content/lessons";
import type { Lesson, LessonStep } from "@/content/types";
import { cn } from "@/lib/cn";
import { ipc } from "@/lib/ipc";
import { MiniGraph } from "@/features/playground/MiniGraph";
import { Terminal } from "@/features/playground/Terminal";
import { useSandbox } from "@/features/playground/useSandbox";

type StepStatus = "done" | "current" | "todo";

function StepCard({
  step,
  index,
  status,
  showHint,
  onToggleHint,
  onUseCommand,
}: {
  step: LessonStep;
  index: number;
  status: StepStatus;
  showHint: boolean;
  onToggleHint: () => void;
  onUseCommand: (command: string) => void;
}) {
  const isCurrent = status === "current";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        isCurrent
          ? "border-accent/40 bg-accent-soft/40"
          : "border-line bg-canvas/40",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
            status === "done"
              ? "border-success/40 bg-success/15 text-success"
              : isCurrent
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-line text-fg-faint",
          )}
        >
          {status === "done" ? <Check className="size-3" /> : index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-xs font-medium",
              status === "todo" ? "text-fg-muted" : "text-fg",
            )}
          >
            {step.title}
          </div>

          {isCurrent ? (
            <>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                {step.description}
              </p>

              {step.commands && step.commands.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {step.commands.map((command) => (
                    <button
                      key={command}
                      type="button"
                      onClick={() => onUseCommand(command)}
                      title="Вставить в терминал"
                      className="mono rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] text-fg-muted transition-colors hover:border-accent/40 hover:text-fg"
                    >
                      {command}
                    </button>
                  ))}
                </div>
              ) : null}

              {step.hint ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={onToggleHint}
                    className="text-[10px] font-medium text-accent hover:underline"
                  >
                    {showHint ? "Скрыть подсказку" : "Показать подсказку"}
                  </button>
                  {showHint ? (
                    <div className="mono mt-1 rounded bg-canvas px-2 py-1 text-[10px] leading-relaxed text-fg-muted">
                      {step.hint}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LessonRunner({ lesson }: { lesson: Lesson }) {
  const sandbox = useSandbox(lesson.id, lesson.spec);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [xp, setXp] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const progressLoaded = useRef(false);

  useEffect(() => {
    if (!sandbox.ready || progressLoaded.current) return;
    progressLoaded.current = true;

    if (!sandbox.resumed) {
      void ipc.saveProgress({
        lessonId: lesson.id,
        status: "in_progress",
        stepIndex: 0,
        completedSteps: [],
        xp: 0,
      });
      return;
    }

    ipc
      .getProgress()
      .then((records) => {
        const record = records.find((item) => item.lessonId === lesson.id);
        if (!record) return;
        setStepIndex(record.stepIndex);
        setCompleted(record.completedSteps);
        setXp(record.xp);
      })
      .catch(() => {});
  }, [sandbox.ready, sandbox.resumed, lesson.id]);

  const isDone = stepIndex >= lesson.steps.length;
  const progressPercent = Math.round((completed.length / lesson.steps.length) * 100);

  const handleRun = async (command: string) => {
    const result = await sandbox.run(command);
    if (!result) return;

    const step = lesson.steps[stepIndex];
    if (!step || !step.validate(result.state)) return;

    const nextCompleted = [...completed, step.id];
    const nextIndex = stepIndex + 1;
    const done = nextIndex >= lesson.steps.length;
    const nextXp = xp + 10 + (done ? 50 : 0);

    setCompleted(nextCompleted);
    setStepIndex(nextIndex);
    setXp(nextXp);
    setShowHint(false);

    await ipc.saveProgress({
      lessonId: lesson.id,
      status: done ? "completed" : "in_progress",
      stepIndex: nextIndex,
      completedSteps: nextCompleted,
      xp: nextXp,
    });
  };

  const handleReset = async () => {
    await sandbox.reset();
    setStepIndex(0);
    setCompleted([]);
    setXp(0);
    setShowHint(false);
    await ipc.saveProgress({
      lessonId: lesson.id,
      status: "in_progress",
      stepIndex: 0,
      completedSteps: [],
      xp: 0,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Link
          to="/learn"
          className="rounded p-1 text-fg-faint transition-colors hover:bg-raised hover:text-fg"
          title="К списку уроков"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">{lesson.title}</div>
          <div className="text-[11px] text-fg-faint">
            {levelInfo(lesson.level).title} · {lesson.duration}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="text-[11px] text-fg-muted">
            {completed.length} / {lesson.steps.length}
          </span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <Badge tone="accent">{xp} XP</Badge>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-line bg-surface">
          <div className="p-4">
            <p className="text-xs leading-relaxed text-fg-muted">{lesson.summary}</p>

            <div className="mt-4 space-y-2">
              {lesson.steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  status={
                    index < stepIndex ? "done" : index === stepIndex ? "current" : "todo"
                  }
                  showHint={showHint && index === stepIndex}
                  onToggleHint={() => setShowHint((value) => !value)}
                  onUseCommand={setDraft}
                />
              ))}
            </div>

            {isDone ? (
              <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-success">
                  <CheckCircle2 className="size-4" />
                  Урок пройден
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                  Ты создал ветку, закоммитил изменение, влил его через merge-коммит
                  и удалил ветку. Это базовый рабочий цикл Git.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link to="/learn">
                    <Button size="sm">К урокам</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={handleReset}>
                    Пройти заново
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Terminal
              entries={sandbox.entries}
              busy={sandbox.busy}
              onRun={handleRun}
              onReset={handleReset}
              draft={draft}
              onDraftConsumed={() => setDraft(null)}
            />
          </div>

          <div className="h-[36%] min-h-[180px] shrink-0 border-t border-line bg-surface">
            <div className="flex h-8 items-center justify-between border-b border-line px-3 text-[11px] text-fg-muted">
              <span>Граф репозитория</span>
              <span className="mono text-fg-faint">
                {sandbox.state?.headBranch ?? "detached HEAD"}
              </span>
            </div>
            <div className="h-[calc(100%-2rem)]">
              <MiniGraph state={sandbox.state} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
