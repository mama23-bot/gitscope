import type { Lesson, LessonLevel, LevelInfo } from "../types";
import { branchingMergeLesson } from "./branching-merge";

export const LEVELS: LevelInfo[] = [
  {
    id: "fundamentals",
    title: "Основы",
    description: "Репозиторий, коммиты, индекс и история",
  },
  {
    id: "branching",
    title: "Ветки",
    description: "Ветки, переключение и merge",
  },
  {
    id: "conflicts",
    title: "Конфликты",
    description: "Разрешение merge-конфликтов",
  },
  {
    id: "rebase",
    title: "Rebase",
    description: "Перенос и переписывание истории",
  },
  {
    id: "recovery",
    title: "Отмена и восстановление",
    description: "reset, revert и reflog",
  },
  {
    id: "advanced",
    title: "Продвинутое",
    description: "stash, cherry-pick и теги",
  },
];

export const lessons: Lesson[] = [branchingMergeLesson];

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.id === id);
}

export function lessonsByLevel(level: LessonLevel): Lesson[] {
  return lessons.filter((lesson) => lesson.level === level);
}

export function levelInfo(level: LessonLevel): LevelInfo {
  return LEVELS.find((item) => item.id === level) ?? LEVELS[0];
}
