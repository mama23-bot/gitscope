import { useQuery, useQueryClient } from "@tanstack/react-query";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FolderOpen, GitBranch, Info, ShieldCheck, Terminal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { errorMessage, ipc } from "@/lib/ipc";

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-fg">
        <span className="text-fg-faint">{icon}</span>
        {title}
      </div>
      <div className="mt-3 space-y-2 text-xs text-fg-muted">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-fg-faint">{label}</span>
      <span className="mono min-w-0 break-all text-right text-fg">{value}</span>
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const info = useQuery({ queryKey: ["appInfo"], queryFn: ipc.appInfo });
  const integration = useQuery({
    queryKey: ["terminalIntegration"],
    queryFn: ipc.terminalIntegrationStatus,
  });
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  const toggleIntegration = async (enable: boolean) => {
    setIntegrationBusy(true);
    setIntegrationError(null);
    try {
      const next = enable
        ? await ipc.terminalIntegrationEnable()
        : await ipc.terminalIntegrationDisable();
      queryClient.setQueryData(["terminalIntegration"], next);
    } catch (cause) {
      setIntegrationError(errorMessage(cause));
    } finally {
      setIntegrationBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-8 py-8">
        <h1 className="text-lg font-semibold text-fg">Настройки</h1>
        <p className="mt-1 text-sm text-fg-muted">
          GitScope работает полностью локально: без сети, телеметрии и платных API.
        </p>

        {info.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : info.data ? (
          <div className="mt-5 space-y-3">
            <Card icon={<Info className="size-4" />} title="О приложении">
              <Row label="Версия" value={info.data.version} />
              <Row label="Платформа" value={info.data.platform} />
            </Card>

            <Card icon={<GitBranch className="size-4" />} title="Git">
              <Row label="Версия" value={info.data.gitVersion} />
              <Row
                label="Linux-терминал"
                value={info.data.bashAvailable ? "Git Bash доступен" : "недоступен"}
              />
              <p className="text-[11px] leading-relaxed text-fg-faint">
                GitScope использует системный git. Если команда не найдена, установи Git for Windows
                и перезапусти приложение.
              </p>
            </Card>

            <Card icon={<Terminal className="size-4" />} title="Интеграция с системой">
              <Row
                label="Команда cmd"
                value={integration.data?.installed ? "открывает Git Bash" : "не настроена"}
              />
              <p className="text-[11px] leading-relaxed text-fg-faint">
                GitScope может добавить функцию <span className="mono">cmd</span> в профиль
                PowerShell — тогда команда cmd будет открывать Git Bash. Системный cmd.exe не
                изменяется, изменение обратимо.
              </p>
              {integrationError ? (
                <p className="text-[11px] text-danger">{integrationError}</p>
              ) : null}
              <div className="pt-1">
                {integration.data?.installed ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => toggleIntegration(false)}
                    disabled={integrationBusy}
                  >
                    {integrationBusy ? "Убираю…" : "Убрать команду cmd"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => toggleIntegration(true)}
                    disabled={integrationBusy || integration.data?.bashAvailable === false}
                  >
                    {integrationBusy ? "Добавляю…" : "Добавить команду cmd"}
                  </Button>
                )}
              </div>
              {integration.data?.profiles.length ? (
                <div className="space-y-1">
                  {integration.data.profiles.map((profile) => (
                    <div key={profile} className="mono break-all text-[10px] text-fg-faint">
                      {profile}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card icon={<FolderOpen className="size-4" />} title="Данные">
              <Row label="Папка" value={info.data.dataDir} />
              <div className="pt-1">
                <Button
                  size="sm"
                  icon={<FolderOpen className="size-3.5" />}
                  onClick={() => revealItemInDir(info.data.dataDir)}
                >
                  Открыть папку
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-fg-faint">
                Здесь хранятся база прогресса, настройки и учебные песочницы.
              </p>
            </Card>

            <Card icon={<ShieldCheck className="size-4" />} title="Безопасность">
              <p className="leading-relaxed">
                Репозитории пользователя открываются только для чтения: GitScope выполняет
                исключительно команды просмотра истории. Все изменения происходят в отдельных
                песочницах внутри папки данных.
              </p>
              <p className="leading-relaxed">
                Сетевые команды git (clone, fetch, push) в песочницах отключены.
              </p>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
