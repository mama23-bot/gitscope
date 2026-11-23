use crate::error::{AppError, AppResult};

/// Подкоманды, которые разрешено выполнять в репозитории пользователя.
/// Всё остальное — только в песочнице.
const READ_ONLY_SUBCOMMANDS: &[&str] = &[
    "log",
    "show",
    "diff",
    "status",
    "branch",
    "for-each-ref",
    "rev-parse",
    "rev-list",
    "cat-file",
    "ls-tree",
    "ls-files",
    "shortlog",
    "blame",
    "describe",
    "tag",
    "remote",
    "config",
    "reflog",
    "stash",
    "merge-base",
    "name-rev",
    "count-objects",
    "diff-tree",
    "show-ref",
    "symbolic-ref",
    "var",
    "version",
    "help",
];

/// Подкоманды, которые разрешены в песочнице.
const SANDBOX_SUBCOMMANDS: &[&str] = &[
    "init",
    "status",
    "add",
    "commit",
    "log",
    "diff",
    "show",
    "branch",
    "switch",
    "checkout",
    "merge",
    "rebase",
    "reset",
    "revert",
    "stash",
    "reflog",
    "tag",
    "restore",
    "rm",
    "mv",
    "cherry-pick",
    "config",
    "rev-parse",
    "rev-list",
    "cat-file",
    "ls-files",
    "ls-tree",
    "shortlog",
    "blame",
    "describe",
    "clean",
    "notes",
    "apply",
    "am",
    "format-patch",
    "gc",
    "fsck",
    "count-objects",
    "merge-base",
    "name-rev",
    "show-ref",
    "symbolic-ref",
    "update-ref",
    "for-each-ref",
    "diff-tree",
    "whatchanged",
    "help",
    "version",
    "var",
    "check-ignore",
    "check-attr",
    "check-ref-format",
    "stripspace",
    "hash-object",
    "mktree",
    "write-tree",
    "read-tree",
    "commit-tree",
    "update-index",
    "replace",
    "rerere",
    "sparse-checkout",
    "maintenance",
    "prune",
    "repack",
    "pack-refs",
    "verify-pack",
    "interpret-trailers",
    "range-diff",
    "fast-export",
    "bisect",
];

/// Подкоманды, которые в песочнице запрещены всегда.
const SANDBOX_BLOCKED_SUBCOMMANDS: &[&str] = &[
    "clone",
    "fetch",
    "pull",
    "push",
    "remote",
    "submodule",
    "worktree",
    "daemon",
    "instaweb",
    "credential",
    "send-email",
    "request-pull",
    "filter-branch",
    "filter-repo",
    "svn",
    "p4",
    "cvsimport",
    "archimport",
    "fast-import",
    "http-backend",
    "upload-pack",
    "receive-pack",
    "shell",
    "citool",
    "gui",
    "difftool",
    "mergetool",
    "web--browse",
    "bugreport",
    "diagnose",
    "pack-objects",
    "unpack-objects",
    "index-pack",
    "update-server-info",
    "ls-remote",
];

/// Флаги, которые позволяют выйти за пределы песочницы или запустить
/// произвольный процесс.
const BLOCKED_FLAGS: &[&str] = &[
    "-C",
    "--git-dir",
    "--work-tree",
    "--namespace",
    "--exec",
    "--upload-pack",
    "--receive-pack",
    "--super-prefix",
    "--config-env",
    "--output",
    "--no-index",
    "--separate-git-dir",
    "--template",
    "--ext-diff",
    "--open-files-in-pager",
    "--recurse-submodules",
    "--depth",
    "--shallow-since",
    "--shallow-exclude",
    "--global",
    "--system",
];

fn flag_matches(argument: &str, flag: &str) -> bool {
    argument == flag || argument.starts_with(&format!("{flag}="))
}

fn check_flags(args: &[String]) -> AppResult<()> {
    for argument in args {
        for flag in BLOCKED_FLAGS {
            if flag_matches(argument, flag) {
                return Err(AppError::policy(format!(
                    "Флаг {flag} недоступен в GitScope: он выходит за пределы песочницы."
                )));
            }
        }
    }
    Ok(())
}

/// Проверка команды для репозитория пользователя: только чтение.
pub fn assert_read_only(args: &[String]) -> AppResult<()> {
    let subcommand = args
        .first()
        .map(String::as_str)
        .ok_or_else(|| AppError::policy("Пустая команда git"))?;

    if !READ_ONLY_SUBCOMMANDS.contains(&subcommand) {
        return Err(AppError::policy(format!(
            "Команда «git {subcommand}» может изменить репозиторий. В GitScope репозитории пользователя открываются только для чтения."
        )));
    }

    check_flags(args)?;

    match subcommand {
        "branch" => {
            for argument in &args[1..] {
                if argument.starts_with('-') {
                    let allowed = [
                        "-a",
                        "-r",
                        "-v",
                        "-vv",
                        "--list",
                        "--all",
                        "--remotes",
                        "--verbose",
                        "--show-current",
                        "--contains",
                        "--merged",
                        "--no-merged",
                        "--format",
                        "--sort",
                        "--points-at",
                        "--column",
                        "--no-column",
                        "--color",
                        "--no-color",
                        "--omit-empty",
                    ];
                    let is_allowed = allowed.contains(&argument.as_str())
                        || argument.starts_with("--format=")
                        || argument.starts_with("--sort=")
                        || argument.starts_with("--contains=")
                        || argument.starts_with("--points-at=");
                    if !is_allowed {
                        return Err(AppError::policy(format!(
                            "Флаг {argument} для git branch недоступен в режиме чтения."
                        )));
                    }
                } else {
                    return Err(AppError::policy(
                        "Создание и удаление веток в репозитории пользователя запрещено.",
                    ));
                }
            }
        }
        "tag" => {
            for argument in &args[1..] {
                if !argument.starts_with('-') {
                    return Err(AppError::policy(
                        "Создание тегов в репозитории пользователя запрещено.",
                    ));
                }
            }
        }
        "remote" => {
            let allowed = ["-v", "--verbose", "show", "get-url"];
            if args.len() > 1 && !allowed.contains(&args[1].as_str()) {
                return Err(AppError::policy(
                    "Изменение remote в репозитории пользователя запрещено.",
                ));
            }
        }
        "config" => {
            let allowed = [
                "--get",
                "--get-all",
                "--get-regexp",
                "--list",
                "-l",
                "--show-origin",
            ];
            if args.len() > 1 && !allowed.contains(&args[1].as_str()) {
                return Err(AppError::policy(
                    "Изменение конфигурации репозитория пользователя запрещено.",
                ));
            }
        }
        "stash" => {
            if args.len() > 1 && !["list", "show"].contains(&args[1].as_str()) {
                return Err(AppError::policy(
                    "Изменение stash в репозитории пользователя запрещено.",
                ));
            }
        }
        "reflog" => {
            if args.len() > 1 && !["show", "exists"].contains(&args[1].as_str()) {
                return Err(AppError::policy(
                    "Изменение reflog в репозитории пользователя запрещено.",
                ));
            }
        }
        _ => {}
    }

    Ok(())
}

/// Проверка команды для песочницы.
pub fn assert_sandbox(args: &[String]) -> AppResult<()> {
    let subcommand = args
        .first()
        .map(String::as_str)
        .ok_or_else(|| AppError::policy("Пустая команда git"))?;

    if subcommand.starts_with('-') {
        return Err(AppError::policy(
            "Глобальные флаги перед командой git в песочнице не поддерживаются.",
        ));
    }

    if SANDBOX_BLOCKED_SUBCOMMANDS.contains(&subcommand) {
        return Err(AppError::policy(format!(
            "Команда «git {subcommand}» отключена в песочнице: GitScope работает полностью офлайн."
        )));
    }

    if !SANDBOX_SUBCOMMANDS.contains(&subcommand) {
        return Err(AppError::policy(format!(
            "Команда «git {subcommand}» пока не поддерживается в песочнице."
        )));
    }

    check_flags(args)?;

    if subcommand == "rebase" {
        for argument in &args[1..] {
            if argument == "-i" || argument == "--interactive" {
                return Err(AppError::policy(
                    "Интерактивный rebase появится в следующих уроках. Пока используй обычный git rebase.",
                ));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(value: &[&str]) -> Vec<String> {
        value.iter().map(|item| item.to_string()).collect()
    }

    #[test]
    fn read_only_rejects_writes() {
        assert!(assert_read_only(&args(&["commit", "-m", "x"])).is_err());
        assert!(assert_read_only(&args(&["branch", "-D", "main"])).is_err());
        assert!(assert_read_only(&args(&["branch", "-a"])).is_ok());
        assert!(assert_read_only(&args(&["log", "--oneline"])).is_ok());
    }

    #[test]
    fn sandbox_blocks_escape_hatches() {
        assert!(assert_sandbox(&args(&["log", "-C", ".."])).is_err());
        assert!(assert_sandbox(&args(&["diff", "--output=../x"])).is_err());
        assert!(assert_sandbox(&args(&["push"])).is_err());
        assert!(assert_sandbox(&args(&["rebase", "-i", "HEAD~2"])).is_err());
        assert!(assert_sandbox(&args(&["commit", "-m", "ok"])).is_ok());
    }
}
