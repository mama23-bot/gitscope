use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::{AppError, AppResult};

pub const READ_TIMEOUT: Duration = Duration::from_secs(30);
pub const WRITE_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone)]
pub struct GitOutput {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

impl GitOutput {
    pub fn success(&self) -> bool {
        self.code == 0
    }
}

/// Изолированное окружение git: свой global-конфиг, без системного,
/// без пейджера и без интерактивных запросов.
#[derive(Debug, Clone)]
pub struct GitEnv {
    pub config_global: PathBuf,
}

impl GitEnv {
    pub fn new(config_global: PathBuf) -> Self {
        Self { config_global }
    }
}

fn build_command(env: &GitEnv, cwd: &Path, args: &[String]) -> Command {
    let mut command = Command::new("git");
    command
        .current_dir(cwd)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("PAGER", "cat")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", &env.config_global)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_EDITOR", "echo")
        .env("GIT_SEQUENCE_EDITOR", "echo")
        .env("LC_ALL", "C")
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_INDEX_FILE")
        .env_remove("GIT_OBJECT_DIRECTORY")
        .env_remove("GIT_ALTERNATE_OBJECT_DIRECTORIES")
        .env_remove("GIT_NAMESPACE")
        .env_remove("GIT_CEILING_DIRECTORIES");
    command
}

/// Запускает git и всегда возвращает вывод, даже при ненулевом коде возврата.
pub fn run_git(
    env: &GitEnv,
    cwd: &Path,
    args: &[String],
    timeout: Duration,
) -> AppResult<GitOutput> {
    run_git_with_env(env, cwd, args, timeout, &[])
}

/// То же, но с дополнительными переменными окружения (например, датами коммитов).
pub fn run_git_with_env(
    env: &GitEnv,
    cwd: &Path,
    args: &[String],
    timeout: Duration,
    extra_env: &[(&str, String)],
) -> AppResult<GitOutput> {
    let mut command = build_command(env, cwd, args);
    for (key, value) in extra_env {
        command.env(key, value);
    }

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            AppError::new(
                "gitMissing",
                "Git не найден в PATH. Установи Git for Windows и перезапусти GitScope.",
            )
        } else {
            AppError::io(format!("Не удалось запустить git: {error}"))
        }
    })?;

    let mut stdout_pipe = child
        .stdout
        .take()
        .ok_or_else(|| AppError::io("Не удалось захватить stdout git"))?;
    let mut stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| AppError::io("Не удалось захватить stderr git"))?;

    let stdout_thread = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = stdout_pipe.read_to_end(&mut buffer);
        buffer
    });
    let stderr_thread = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = stderr_pipe.read_to_end(&mut buffer);
        buffer
    });

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(AppError::timeout(
                        "Команда git выполнялась слишком долго и была остановлена.",
                    ));
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(error) => return Err(AppError::io(error.to_string())),
        }
    };

    let stdout = String::from_utf8_lossy(&stdout_thread.join().unwrap_or_default()).to_string();
    let stderr = String::from_utf8_lossy(&stderr_thread.join().unwrap_or_default()).to_string();

    Ok(GitOutput {
        stdout,
        stderr,
        code: status.code().unwrap_or(-1),
    })
}

/// Запускает git и превращает ненулевой код возврата в ошибку.
pub fn run_git_ok(
    env: &GitEnv,
    cwd: &Path,
    args: &[String],
    timeout: Duration,
) -> AppResult<String> {
    let output = run_git(env, cwd, args, timeout)?;
    if !output.success() {
        let message = output.stderr.trim();
        return Err(AppError::git(if message.is_empty() {
            format!(
                "git {} завершился с кодом {}",
                args.first().map(String::as_str).unwrap_or(""),
                output.code
            )
        } else {
            message.to_string()
        }));
    }
    Ok(output.stdout)
}

/// Читающая команда: проверяется политикой и не может изменить репозиторий.
pub fn run_readonly(env: &GitEnv, cwd: &Path, args: &[String]) -> AppResult<String> {
    crate::git::policy::assert_read_only(args)?;
    run_git_ok(env, cwd, args, READ_TIMEOUT)
}

/// То же, но возвращает вывод даже при ненулевом коде возврата.
pub fn run_readonly_raw(env: &GitEnv, cwd: &Path, args: &[String]) -> AppResult<GitOutput> {
    crate::git::policy::assert_read_only(args)?;
    run_git(env, cwd, args, READ_TIMEOUT)
}

pub fn git_version() -> AppResult<String> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let output = Command::new("git")
        .arg("--version")
        .current_dir(cwd)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                AppError::new(
                    "gitMissing",
                    "Git не найден в PATH. Установи Git for Windows и перезапусти GitScope.",
                )
            } else {
                AppError::io(error.to_string())
            }
        })?;

    if !output.status.success() {
        return Err(AppError::git("Не удалось определить версию git"));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
