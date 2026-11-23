import { computeGraphLayout, type GraphInput } from "./graph-layout";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GraphInput[]>) => void) | null;
  postMessage: (value: unknown) => void;
};

scope.onmessage = (event) => {
  scope.postMessage(computeGraphLayout(event.data));
};
