import type { RepoState, SandboxSpec } from "@/types";

export type LessonLevel =
  | "fundamentals"
  | "branching"
  | "conflicts"
  | "rebase"
  | "recovery"
  | "advanced";

export interface LessonStep {
  id: string;
  title: string;
  description: string;
  hint?: string;
  commands?: string[];
  validate: (state: RepoState) => boolean;
}

export interface Lesson {
  id: string;
  level: LessonLevel;
  title: string;
  summary: string;
  duration: string;
  xp: number;
  spec: SandboxSpec;
  steps: LessonStep[];
}

export interface LevelInfo {
  id: LessonLevel;
  title: string;
  description: string;
}
