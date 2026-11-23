import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, ipc } from "@/lib/ipc";
import type { CommandResult, RepoState, SandboxSpec } from "@/types";

export interface TerminalEntry {
  id: number;
  command: string;
  stdout: string;
  stderr: string;
  code: number;
  durationMs: number;
}

export function useSandbox(scenarioId: string, spec: SandboxSpec) {
  const storageKey = `gitscope:sandbox:${scenarioId}`;
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [state, setState] = useState<RepoState | null>(null);
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [cwd, setCwd] = useState("/");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);
  const started = useRef(false);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const info = await ipc.createSandbox(scenarioId, spec);
      sessionStorage.setItem(storageKey, info.id);
      setSandboxId(info.id);
      setState(info.state);
      setEntries([]);
      setCwd("/");
      setResumed(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, [scenarioId, spec, storageKey]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const existing = sessionStorage.getItem(storageKey);
    if (!existing) {
      void create();
      return;
    }

    ipc
      .sandboxState(existing)
      .then((snapshot) => {
        setSandboxId(existing);
        setState(snapshot);
        setCwd("/");
        setResumed(true);
        setReady(true);
      })
      .catch(() => {
        sessionStorage.removeItem(storageKey);
        void create();
      });
  }, [create, storageKey]);

  const run = useCallback(
    async (command: string): Promise<CommandResult | null> => {
      if (!sandboxId) return null;
      setBusy(true);
      setError(null);
      try {
        const result = await ipc.runSandboxCommand(sandboxId, command, cwd);
        setState(result.state);
        setCwd(result.cwd);

        if (result.clear) {
          setEntries([]);
          return result;
        }

        setEntries((previous) => [
          ...previous,
          {
            id: counter.current++,
            command: result.command,
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code,
            durationMs: result.durationMs,
          },
        ]);
        return result;
      } catch (cause) {
        const message = errorMessage(cause);
        setError(message);
        setEntries((previous) => [
          ...previous,
          {
            id: counter.current++,
            command,
            stdout: "",
            stderr: message,
            code: 1,
            durationMs: 0,
          },
        ]);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [sandboxId, cwd],
  );

  const reset = useCallback(async () => {
    if (!sandboxId) {
      await create();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const info = await ipc.resetSandbox(sandboxId);
      setState(info.state);
      setEntries([]);
      setCwd("/");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }, [sandboxId, create]);

  return {
    sandboxId,
    state,
    entries,
    cwd,
    busy,
    ready,
    resumed,
    error,
    run,
    reset,
    create,
  };
}
