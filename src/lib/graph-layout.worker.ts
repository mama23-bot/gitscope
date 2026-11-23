import { computeGraphLayout, type GraphInput } from "./graph-layout";

const scope = self as unknown as {
  onmessage: (
    event: MessageEvent<{ id: number; commits: GraphInput[] }>,
  ) => void;
  postMessage: (value: unknown) => void;
};

scope.onmessage = (event) => {
  scope.postMessage({
    id: event.data.id,
    layout: computeGraphLayout(event.data.commits),
  });
};
