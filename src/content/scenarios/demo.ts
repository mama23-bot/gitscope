import type { SandboxSpec } from "@/types";

export const demoSpec: SandboxSpec = {
  initialBranch: "main",
  files: [
    {
      path: "README.md",
      content:
        "# Aurora\n\nНебольшой демо-проект для GitScope.\n\nЗдесь есть ветки, merge-коммиты и тег — чтобы граф было интересно разглядывать.\n",
    },
    {
      path: "src/app.js",
      content: 'export function start() {\n  console.log("Aurora started");\n}\n\nstart();\n',
    },
    {
      path: "src/styles.css",
      content: "body {\n  margin: 0;\n  font-family: sans-serif;\n}\n",
    },
  ],
  commits: [
    {
      message: "Add project skeleton",
      files: [
        {
          path: "package.json",
          content: '{\n  "name": "aurora",\n  "version": "0.1.0"\n}\n',
        },
      ],
    },
    {
      message: "Add routing",
      files: [
        {
          path: "src/router.js",
          content: 'export const routes = ["/", "/about", "/dashboard"];\n',
        },
      ],
    },
    {
      message: "Fix header spacing",
      files: [
        {
          path: "src/styles.css",
          content:
            "body {\n  margin: 0;\n  font-family: sans-serif;\n}\n\nheader {\n  padding: 12px 16px;\n}\n",
        },
      ],
    },
  ],
  branches: [
    {
      name: "feature/auth",
      from: "main",
      commits: [
        {
          message: "Add login form",
          files: [
            {
              path: "src/auth/login.js",
              content:
                "export function login(user, password) {\n  return Boolean(user && password);\n}\n",
            },
          ],
        },
        {
          message: "Validate credentials",
          files: [
            {
              path: "src/auth/validate.js",
              content:
                "export function validate(user, password) {\n  return user.length > 2 && password.length > 5;\n}\n",
            },
          ],
        },
      ],
    },
    {
      name: "feature/dashboard",
      from: "main",
      commits: [
        {
          message: "Add dashboard layout",
          files: [
            {
              path: "src/dashboard.js",
              content: "export const dashboard = { widgets: [] };\n",
            },
          ],
        },
      ],
    },
  ],
  merges: [
    { into: "main", from: "feature/auth", message: "Merge branch 'feature/auth'" },
    {
      into: "main",
      from: "feature/dashboard",
      message: "Merge branch 'feature/dashboard'",
    },
  ],
  tags: [{ name: "v0.1.0", target: "main" }],
};
