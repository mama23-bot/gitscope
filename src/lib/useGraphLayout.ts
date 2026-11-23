import { useEffect, useRef, useState } from "react";
import type { Commit } from "@/types";
import { computeGraphLayout, type GraphInput, type GraphLayout } from "./graph-layout";

const EMPTY: GraphLayout = { rows: [], laneCount: 0 };

/** Считает раскладку графа в одном переиспользуемом Web Worker. */
export function useGraphLayout(commits: Commit[]): GraphLayout {
  const [layout, setLayout] = useState<GraphLayout>(EMPTY);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./graph-layout.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      worker = null;
    }
    workerRef.current = worker;

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (commits.length === 0) {
      setLayout(EMPTY);
      return;
    }

    const input: GraphInput[] = commits.map((commit) => ({
      sha: commit.sha,
      parents: commit.parents,
    }));

    const worker = workerRef.current;
    if (!worker) {
      setLayout(computeGraphLayout(input));
      return;
    }

    const requestId = ++requestRef.current;

    const handleMessage = (event: MessageEvent<{ id: number; layout: GraphLayout }>) => {
      if (event.data.id !== requestId) return;
      setLayout(event.data.layout);
    };

    const handleError = () => {
      setLayout(computeGraphLayout(input));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ id: requestId, commits: input });

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
  }, [commits]);

  return layout;
}
