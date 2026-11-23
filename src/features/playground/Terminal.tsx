import { CornerDownLeft, RotateCcw, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Kbd } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { TerminalEntry } from "./useSandbox";

function friendlyHint(stderr: string): string | null {
  if (stderr.includes("Aborting commit due to empty commit message")) {
    return "Добавь сообщение: git commit -m \"что я сделал\"";
  }
  if (stderr.includes("nothing to commit")) {
    return "Нечего коммитить: измени файл и выполни git add.";
  }
  if (stderr.includes("not a git repository")) {
    return "Это не git-репозиторий.";
  }
  if (stderr.includes("did not match any file")) {
    return "Проверь имя файла: git status покажет актуальные пути.";
  }
  return null;
}

export function Terminal({
  entries,
  busy,
  onRun,
  onReset,
  draft,
  onDraftConsumed,
  className,
}: {
  entries: TerminalEntry[];
  busy: boolean;
  onRun: (command: string) => Promise<unknown>;
  onReset: () => void;
  draft?: string | null;
  onDraftConsumed?: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries, busy]);

  useEffect(() => {
    if (!draft) return;
    setValue(draft);
    inputRef.current?.focus();
    onDraftConsumed?.();
  }, [draft, onDraftConsumed]);

  const submit = async () => {
    const command = value.trim();
    if (!command || busy) return;
    setValue("");
    setHistory((previous) => [command, ...previous].slice(0, 100));
    setHistoryIndex(-1);
    await onRun(command);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const next = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      setValue(history[next]);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setValue("");
        return;
      }
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setValue(history[next]);
    }
  };

  return (
    <div className={cn("flex h-full flex-col bg-[#080b10]", className)}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="flex items-center gap-2 text-[11px] font-medium text-fg-muted">
          <TerminalSquare className="size-3.5 text-fg-faint" />
          Терминал песочницы
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw className="size-3.5" />}
          onClick={onReset}
          disabled={busy}
        >
          Сбросить
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="mono min-h-0 flex-1 overflow-auto p-3 text-[12px] leading-relaxed"
      >
        {entries.length === 0 ? (
          <div className="text-fg-faint">
            Введи команду, например <span className="text-fg-muted">git status</span>.
            История команд — стрелки вверх и вниз.
          </div>
        ) : null}

        {entries.map((entry) => {
          const hint = entry.stderr ? friendlyHint(entry.stderr) : null;
          return (
            <div key={entry.id} className="mb-3">
              <div className="flex items-start gap-2">
                <span className="select-none text-accent">$</span>
                <span className="break-all text-fg">{entry.command}</span>
              </div>
              {entry.stdout ? (
                <pre className="mt-1 whitespace-pre-wrap break-words text-fg-muted">
                  {entry.stdout}
                </pre>
              ) : null}
              {entry.stderr ? (
                <pre className="mt-1 whitespace-pre-wrap break-words text-danger">
                  {entry.stderr}
                </pre>
              ) : null}
              {hint ? (
                <div className="mt-1 text-[11px] text-warning">Подсказка: {hint}</div>
              ) : null}
            </div>
          );
        })}

        {busy ? <div className="text-fg-faint">выполняю…</div> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2">
        <span className="mono select-none text-xs text-accent">$</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="git status"
          spellCheck={false}
          autoComplete="off"
          className="mono min-w-0 flex-1 bg-transparent text-xs text-fg placeholder:text-fg-faint focus:outline-none"
        />
        <span className="hidden items-center gap-1 text-[10px] text-fg-faint sm:flex">
          <Kbd>
            <CornerDownLeft className="size-2.5" />
          </Kbd>
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={() => void submit()}
          disabled={busy || !value.trim()}
        >
          Выполнить
        </Button>
      </div>
    </div>
  );
}
