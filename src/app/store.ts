import { create } from "zustand";
import type { RepoInfo } from "@/types";

const STORAGE_KEY = "gitscope:lastRepo";

interface RepoStore {
  repo: RepoInfo | null;
  setRepo: (repo: RepoInfo | null) => void;
}

export const useRepoStore = create<RepoStore>((set) => ({
  repo: null,
  setRepo: (repo) => {
    if (repo) {
      localStorage.setItem(STORAGE_KEY, repo.path);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ repo });
  },
}));

export function lastRepoPath(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function forgetLastRepo(): void {
  localStorage.removeItem(STORAGE_KEY);
}
