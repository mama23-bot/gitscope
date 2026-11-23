import { useEffect, useState } from "react";
import type { Commit } from "@/types";
import { computeGraphLayout, type GraphLayout } from "./graph-layout";

const EMPTY: GraphLayout = { rows: [], laneCount: 0 };

export function useGraphLayout(commits: Commit[]): GraphLayout {
  const [layout, setLayout] = useState<GraphLayout>(EMPTY);

  useEffect(() => {
    if (commits.length === 0) {
      setLayout(EMPTY);
      return;
    }

    const input = commits.map((commit) => ({
      sha: commit.sha,
      parents: commit.parents,
    }));

    let cancelled = false;
    let worker: Worker | null = null;

    try {
      worker = new Worker(new URL("./graph-layout.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<GraphLayout>) => {
        if (!cancelled) setLayout(event.data);
        worker?.terminate();
      };
      worker.onerror = () => {
        if (!cancelled) setLayout(computeGraphLayout(input));
        worker?.terminate();
      };
      worker.postMessage(input);
    } catch {
      setLayout(computeGraphLayout(input));
    }

    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [commits]);

  return layout;
}
