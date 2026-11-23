import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { errorMessage, ipc } from "@/lib/ipc";
import { useRepoStore } from "./store";

export function useOpenRepo() {
  const setRepo = useRepoStore((state) => state.setRepo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRepository = async () => {
    setBusy(true);
    setError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Выбери git-репозиторий",
      });
      if (typeof selected !== "string") return;
      const info = await ipc.openRepo(selected);
      setRepo(info);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return {
    openRepository,
    busy,
    error,
    clearError: () => setError(null),
  };
}
