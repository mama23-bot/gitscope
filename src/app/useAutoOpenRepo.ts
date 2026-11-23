import { useEffect, useRef } from "react";
import { ipc } from "@/lib/ipc";
import { forgetLastRepo, lastRepoPath, useRepoStore } from "./store";

/** Пробует открыть последний репозиторий при старте приложения. */
export function useAutoOpenRepo(): void {
  const repo = useRepoStore((state) => state.repo);
  const setRepo = useRepoStore((state) => state.setRepo);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || repo) return;
    attempted.current = true;

    const path = lastRepoPath();
    if (!path) return;

    ipc
      .openRepo(path)
      .then(setRepo)
      .catch(() => forgetLastRepo());
  }, [repo, setRepo]);
}
