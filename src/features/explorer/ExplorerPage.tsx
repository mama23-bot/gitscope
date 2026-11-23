import { useRepoStore } from "@/app/store";
import { RepoExplorer } from "./RepoExplorer";
import { RepoPicker } from "./RepoPicker";

export function ExplorerPage() {
  const repo = useRepoStore((state) => state.repo);
  return repo ? <RepoExplorer repo={repo} /> : <RepoPicker />;
}
