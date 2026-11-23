import { branchExists, commitsAhead, fileExists, isAncestor, tipParents } from "@/lib/validators";
import type { SandboxSpec } from "@/types";
import type { Lesson } from "../types";

const spec: SandboxSpec = {
  initialBranch: "main",
  files: [
    {
      path: "README.md",
      content: "# Учебный проект\n\nЗдесь мы тренируем ветки и merge в GitScope.\n",
    },
    {
      path: "app.js",
      content:
        'function greet(name) {\n  return "Привет, " + name + "!";\n}\n\nconsole.log(greet("мир"));\n',
    },
  ],
  commits: [
    {
      message: "Add project notes",
      files: [
        {
          path: "NOTES.md",
          content: "# Заметки\n\n- изучить ветки\n- разобраться с merge\n",
        },
      ],
    },
  ],
  untrackedFiles: [
    {
      path: "login.js",
      content: "export function login(user, password) {\n  return Boolean(user && password);\n}\n",
    },
  ],
};

export const branchingMergeLesson: Lesson = {
  id: "branching-merge",
  level: "branching",
  title: "Ветки и merge",
  summary: "Создай ветку, сделай в ней коммит и влей изменения в main через явный merge-коммит.",
  duration: "10–15 минут",
  xp: 100,
  spec,
  steps: [
    {
      id: "create-branch",
      title: "Создай ветку feature/login",
      description:
        "Ветка в Git — это подвижная ссылка на коммит. Создай ветку feature/login и сразу переключись на неё.",
      hint: "git switch -c feature/login",
      commands: ["git switch -c feature/login"],
      validate: (state) =>
        state.headBranch === "feature/login" && branchExists(state, "feature/login"),
    },
    {
      id: "commit-login",
      title: "Закоммить login.js",
      description:
        "В рабочей папке уже лежит неотслеживаемый файл login.js. Посмотри на него через git status, добавь в индекс и создай коммит.",
      hint: 'git add login.js, затем git commit -m "add login page"',
      commands: ["git add login.js", 'git commit -m "add login page"'],
      validate: (state) =>
        fileExists(state, "login.js") && commitsAhead(state, "feature/login", "main").length >= 1,
    },
    {
      id: "back-to-main",
      title: "Вернись на main",
      description:
        "Переключись обратно на main. Обрати внимание: login.js исчез из рабочей папки — он живёт только в коммите ветки.",
      hint: "git switch main",
      commands: ["git switch main"],
      validate: (state) => state.headBranch === "main",
    },
    {
      id: "merge-no-ff",
      title: "Влей ветку с merge-коммитом",
      description:
        "Объедини feature/login с main так, чтобы в истории остался явный merge-коммит с двумя родителями. Обычный merge здесь сделал бы fast-forward.",
      hint: "git merge --no-ff feature/login",
      commands: ["git merge --no-ff feature/login"],
      validate: (state) =>
        state.headBranch === "main" &&
        tipParents(state, "main").length > 1 &&
        isAncestor(state, "feature/login", "main"),
    },
    {
      id: "delete-branch",
      title: "Удали ветку",
      description:
        "Коммиты ветки уже в main, поэтому ветку можно безопасно удалить. Файл login.js при этом останется в истории.",
      hint: "git branch -d feature/login",
      commands: ["git branch -d feature/login"],
      validate: (state) => !branchExists(state, "feature/login") && fileExists(state, "login.js"),
    },
  ],
};
