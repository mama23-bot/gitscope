use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::git::policy;
use crate::git::repo::{self, RepoState};
use crate::git::runner::{run_git, run_git_ok, run_git_with_env, GitEnv, WRITE_TIMEOUT};
use crate::git::shell;

fn a(items: &[&str]) -> Vec<String> {
    items.iter().map(|item| item.to_string()).collect()
}

fn default_branch() -> String {
    "main".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSpec {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitSpec {
    pub message: String,
    #[serde(default)]
    pub files: Vec<FileSpec>,
    #[serde(default)]
    pub delete: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchSpec {
    pub name: String,
    pub from: String,
    #[serde(default)]
    pub commits: Vec<CommitSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagSpec {
    pub name: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeSpec {
    pub into: String,
    pub from: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxSpec {
    #[serde(default = "default_branch")]
    pub initial_branch: String,
    #[serde(default)]
    pub files: Vec<FileSpec>,
    #[serde(default)]
    pub commits: Vec<CommitSpec>,
    #[serde(default)]
    pub branches: Vec<BranchSpec>,
    #[serde(default)]
    pub merges: Vec<MergeSpec>,
    #[serde(default)]
    pub tags: Vec<TagSpec>,
    #[serde(default)]
    pub untracked_files: Vec<FileSpec>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
    pub duration_ms: u64,
    pub state: RepoState,
    pub cwd: String,
    pub clear: bool,
}

fn safe_relative(path: &str) -> AppResult<PathBuf> {
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(AppError::invalid(format!(
            "Сценарий не может писать по абсолютному пути: {path}"
        )));
    }

    let mut result = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => result.push(part),
            Component::CurDir => {}
            _ => {
                return Err(AppError::invalid(format!(
                    "Недопустимый путь в сценарии: {path}"
                )));
            }
        }
    }

    if result.as_os_str().is_empty() {
        return Err(AppError::invalid("Пустой путь в сценарии"));
    }

    Ok(result)
}

fn write_file(root: &Path, file: &FileSpec) -> AppResult<()> {
    let target = root.join(safe_relative(&file.path)?);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(target, file.content.as_bytes())?;
    Ok(())
}

fn remove_file(root: &Path, path: &str) -> AppResult<()> {
    let target = root.join(safe_relative(path)?);
    if target.exists() {
        fs::remove_file(target)?;
    }
    Ok(())
}

fn commit_with_date(
    env: &GitEnv,
    root: &Path,
    message: &str,
    timestamp: i64,
) -> AppResult<()> {
    let date = format!("@{timestamp} +0000");
    let output = run_git_with_env(
        env,
        root,
        &a(&["commit", "--allow-empty", "-m", message]),
        WRITE_TIMEOUT,
        &[
            ("GIT_AUTHOR_DATE", date.clone()),
            ("GIT_COMMITTER_DATE", date),
        ],
    )?;

    if !output.success() {
        return Err(AppError::git(format!(
            "Не удалось создать коммит «{message}»: {}",
            output.stderr.trim()
        )));
    }

    Ok(())
}

fn apply_commit(
    env: &GitEnv,
    root: &Path,
    spec: &CommitSpec,
    timestamp: i64,
) -> AppResult<()> {
    for file in &spec.files {
        write_file(root, file)?;
    }
    for path in &spec.delete {
        remove_file(root, path)?;
    }
    run_git_ok(env, root, &a(&["add", "-A"]), WRITE_TIMEOUT)?;
    commit_with_date(env, root, &spec.message, timestamp)
}

fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

/// Создаёт (или пересоздаёт) учебный репозиторий по декларативному сценарию.
pub fn create(env: &GitEnv, root: &Path, spec: &SandboxSpec) -> AppResult<()> {
    if root.exists() {
        fs::remove_dir_all(root)?;
    }
    fs::create_dir_all(root)?;

    run_git_ok(
        env,
        root,
        &a(&["init", "-b", &spec.initial_branch]),
        WRITE_TIMEOUT,
    )?;

    let hooks_dir = root.join(".git").join("gitscope-hooks");
    fs::create_dir_all(&hooks_dir)?;

    let config: [(&str, String); 7] = [
        ("user.name", "Ученик GitScope".to_string()),
        ("user.email", "learner@gitscope.local".to_string()),
        ("core.autocrlf", "false".to_string()),
        (
            "core.hooksPath",
            hooks_dir.to_string_lossy().to_string(),
        ),
        ("commit.gpgsign", "false".to_string()),
        ("tag.gpgsign", "false".to_string()),
        ("advice.detachedHead", "false".to_string()),
    ];

    for (key, value) in config {
        run_git_ok(
            env,
            root,
            &a(&["config", "--local", key, &value]),
            WRITE_TIMEOUT,
        )?;
    }

    let mut timestamp = now_seconds() - 7 * 24 * 60 * 60;

    for file in &spec.files {
        write_file(root, file)?;
    }
    run_git_ok(env, root, &a(&["add", "-A"]), WRITE_TIMEOUT)?;
    commit_with_date(env, root, "Initial commit", timestamp)?;
    timestamp += 3600;

    for commit in &spec.commits {
        apply_commit(env, root, commit, timestamp)?;
        timestamp += 3600;
    }

    for branch in &spec.branches {
        run_git_ok(
            env,
            root,
            &a(&["switch", "-c", &branch.name, &branch.from]),
            WRITE_TIMEOUT,
        )?;
        for commit in &branch.commits {
            apply_commit(env, root, commit, timestamp)?;
            timestamp += 3600;
        }
    }

    for merge in &spec.merges {
        run_git_ok(env, root, &a(&["switch", &merge.into]), WRITE_TIMEOUT)?;
        run_git_ok(
            env,
            root,
            &a(&["merge", "--no-ff", "-m", &merge.message, &merge.from]),
            WRITE_TIMEOUT,
        )?;
    }

    run_git_ok(
        env,
        root,
        &a(&["switch", &spec.initial_branch]),
        WRITE_TIMEOUT,
    )?;

    for tag in &spec.tags {
        run_git_ok(
            env,
            root,
            &a(&["tag", &tag.name, &tag.target]),
            WRITE_TIMEOUT,
        )?;
    }

    for file in &spec.untracked_files {
        write_file(root, file)?;
    }

    Ok(())
}

/// Разбирает командную строку на аргументы, не запуская shell.
pub fn tokenize(input: &str) -> AppResult<Vec<String>> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut has_token = false;
    let mut chars = input.chars().peekable();

    while let Some(character) = chars.next() {
        match quote {
            Some(active) => {
                if character == active {
                    quote = None;
                } else if character == '\\' && active == '"' {
                    if let Some(next) = chars.next() {
                        current.push(next);
                    }
                } else {
                    current.push(character);
                }
            }
            None => {
                if character == '\'' || character == '"' {
                    quote = Some(character);
                    has_token = true;
                } else if character.is_whitespace() {
                    if has_token {
                        tokens.push(std::mem::take(&mut current));
                        has_token = false;
                    }
                } else if character == '\\' {
                    if let Some(next) = chars.next() {
                        current.push(next);
                        has_token = true;
                    }
                } else {
                    current.push(character);
                    has_token = true;
                }
            }
        }
    }

    if quote.is_some() {
        return Err(AppError::invalid("Незакрытая кавычка в команде."));
    }

    if has_token {
        tokens.push(current);
    }

    Ok(tokens)
}

enum Redirect {
    None,
    Truncate(String),
    Append(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellMode {
    Safe,
    Full,
}

impl ShellMode {
    pub fn parse(value: &str) -> Self {
        if value == "full" {
            Self::Full
        } else {
            Self::Safe
        }
    }
}

fn split_redirect(tokens: &[String]) -> (Vec<String>, Redirect) {
    for (index, token) in tokens.iter().enumerate() {
        if token == ">" || token == ">>" {
            if let Some(target) = tokens.get(index + 1) {
                let command = tokens[..index].to_vec();
                let redirect = if token == ">" {
                    Redirect::Truncate(target.clone())
                } else {
                    Redirect::Append(target.clone())
                };
                return (command, redirect);
            }
        }
    }
    (tokens.to_vec(), Redirect::None)
}

pub fn run_command(
    env: &GitEnv,
    root: &Path,
    cwd: &str,
    input: &str,
    mode: ShellMode,
) -> AppResult<CommandResult> {
    let tokens = tokenize(input)?;
    if tokens.is_empty() {
        return Err(AppError::invalid("Введи команду, например: git status или ls"));
    }

    let (command_tokens, redirect) = split_redirect(&tokens);
    if command_tokens.is_empty() {
        return Err(AppError::invalid("После > укажи файл"));
    }

    let cwd = if cwd.trim().is_empty() { "/" } else { cwd };

    if mode == ShellMode::Safe && !cwd.starts_with('@') {
        let workdir = shell::resolve(root, cwd, ".")?;
        if !workdir.is_dir() {
            return Err(AppError::invalid(
                "Текущая папка не существует. Выполни cd /.",
            ));
        }
    }

    let started = Instant::now();

    let (output, apply_redirect) = if mode == ShellMode::Full {
        if command_tokens[0] == "git" {
            if command_tokens.len() < 2 {
                return Err(AppError::invalid(
                    "Укажи подкоманду, например: git status или git log --oneline",
                ));
            }
            policy::assert_sandbox(&command_tokens[1..])?;
        }
        (shell::run_full(env, root, cwd, input)?, false)
    } else if command_tokens[0] == "git" {
        let args = &command_tokens[1..];
        if args.is_empty() {
            return Err(AppError::invalid(
                "Укажи подкоманду, например: git status или git log --oneline",
            ));
        }
        policy::assert_sandbox(args)?;
        let workdir = shell::resolve(root, cwd, ".")?;
        let git_output = run_git(env, &workdir, args, WRITE_TIMEOUT)?;
        (
            shell::ShellOutput {
                stdout: git_output.stdout,
                stderr: git_output.stderr,
                code: git_output.code,
                cwd: cwd.to_string(),
                clear: false,
            },
            true,
        )
    } else {
        (shell::run_builtin(root, cwd, &command_tokens)?, true)
    };

    let stdout = if apply_redirect {
        match redirect {
            Redirect::None => output.stdout,
            Redirect::Truncate(target) => {
                shell::redirect_to_file(root, cwd, &output.stdout, &target, false)?;
                String::new()
            }
            Redirect::Append(target) => {
                shell::redirect_to_file(root, cwd, &output.stdout, &target, true)?;
                String::new()
            }
        }
    } else {
        output.stdout
    };

    let state = repo::repo_state(env, root)?;

    Ok(CommandResult {
        command: input.trim().to_string(),
        stdout,
        stderr: output.stderr,
        code: output.code,
        duration_ms: started.elapsed().as_millis() as u64,
        state,
        cwd: output.cwd,
        clear: output.clear,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_quoted_arguments() {
        let tokens = tokenize("git commit -m \"add login page\"").unwrap();
        assert_eq!(tokens, vec!["git", "commit", "-m", "add login page"]);
    }

    #[test]
    fn rejects_unclosed_quotes() {
        assert!(tokenize("git commit -m \"oops").is_err());
    }

    #[test]
    fn rejects_paths_outside_sandbox() {
        assert!(safe_relative("../escape").is_err());
        assert!(safe_relative("C:/Windows").is_err());
        assert!(safe_relative("src/app.js").is_ok());
    }
}
