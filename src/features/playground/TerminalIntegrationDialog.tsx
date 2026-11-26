import { useState } from "react";
import { Button } from "@/components/ui";
import { errorMessage, ipc } from "@/lib/ipc";
import type { TerminalIntegrationStatus, WindowsIntegrationStatus } from "@/types";

export function TerminalIntegrationDialog({
  open,
  status,
  onClose,
  onEnabled,
}: {
  open: boolean;
  status: TerminalIntegrationStatus | null;
  onClose: () => Promise<void> | void;
  onEnabled: (windows: WindowsIntegrationStatus, powershell: TerminalIntegrationStatus) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const windows = await ipc.windowsIntegrationEnable();
      const powershell = await ipc.terminalIntegrationEnable();
      onEnabled(windows, powershell);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-fg">Сделать Linux-терминал основным?</h2>

        <p className="mt-2 text-xs leading-relaxed text-fg-muted">
          GitScope создаст ярлык <span className="mono text-fg">Linux Terminal</span> на рабочем
          столе и в меню «Пуск», а команда <span className="mono text-fg">cmd</span> в окне
          «Выполнить» (Win+R) и в PowerShell будет открывать Git Bash.
        </p>

        <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
          Системный файл <span className="mono">cmd.exe</span> не изменяется — скрипты Windows
          продолжат работать. Всё обратимо в настройках GitScope.
        </p>

        {status?.bashAvailable === false ? (
          <p className="mt-2 text-[11px] text-warning">
            Git Bash не найден. Установи Git for Windows.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-[11px] text-danger">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Нет, только в приложении
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={enable}
            disabled={busy || status?.bashAvailable === false}
          >
            {busy ? "Настраиваю…" : "Да, заменить терминал"}
          </Button>
        </div>
      </div>
    </div>
  );
}
