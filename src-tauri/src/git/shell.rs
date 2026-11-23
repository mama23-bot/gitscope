use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};

use crate::error::{AppError, AppResult};
use crate::git::runner::GitEnv;

/// Результат выполнения встроенной команды.
#[derive(Debug, Clone)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
    pub cwd: String,
    pub clear: bool,
}

fn output(stdout: impl Into<String>, cwd: &str) -> ShellOutput {
    ShellOutput {
        stdout: stdout.into(),
        stderr: String::new(),
        code: 0,
        cwd: cwd.to_string(),
        clear: false,
    }
}

fn failure(message: impl Into<String>, cwd: &str) -> ShellOutput {
    ShellOutput {
        stdout: String::new(),
        stderr: message.into(),
        code: 1,
        cwd: cwd.to_string(),
        clear: false,
    }
}

fn join_cwd(root: &Path, cwd: &str) -> PathBuf {
    let relative = cwd.trim_start_matches('/');
    if relative.is_empty() {
        root.to_path_buf()
    } else {
        root.join(relative)
    }
}

/// Превращает путь, введённый пользователем, в путь внутри песочницы.
/// Абсолютные пути (`/src`, `~/src`) считаются от корня песочницы,
/// `..` выше корня не выпускает.
pub fn resolve(root: &Path, cwd: &str, target: &str) -> AppResult<PathBuf> {
    let target = target.trim();
    if target.is_empty() {
        return Ok(join_cwd(root, cwd));
    }

    let (base, relative) = if target == "~" || target.starts_with("~/") {
        (
            root.to_path_buf(),
            target
                .trim_start_matches('~')
                .trim_start_matches('/')
                .to_string(),
        )
    } else if target.starts_with('/') || target.starts_with('\\') {
        (
            root.to_path_buf(),
            target.trim_start_matches(['/', '\\']).to_string(),
        )
    } else {
        (join_cwd(root, cwd), target.to_string())
    };

    let mut result = base;
    for component in Path::new(&relative).components() {
        match component {
            Component::Normal(part) => result.push(part),
            Component::CurDir => {}
            Component::ParentDir => {
                if result != root {
                    result.pop();
                }
                if !result.starts_with(root) {
                    result = root.to_path_buf();
                }
            }
            Component::RootDir => {}
            Component::Prefix(_) => {
                return Err(AppError::invalid(
                    "Абсолютные пути Windows внутри песочницы запрещены",
                ));
            }
        }
    }

    if !result.starts_with(root) {
        return Err(AppError::invalid("Нельзя выйти за пределы песочницы"));
    }

    Ok(result)
}

/// Путь для отображения в приглашении: `/`, `/src`, `/src/auth`.
pub fn display_cwd(root: &Path, path: &Path) -> String {
    let relative = path.strip_prefix(root).unwrap_or(Path::new(""));
    let text = relative.to_string_lossy().replace('\\', "/");
    if text.is_empty() {
        "/".to_string()
    } else {
        format!("/{text}")
    }
}

fn has_flag(args: &[String], name: &str) -> bool {
    args.iter().any(|argument| argument == name)
}

fn positional(args: &[String]) -> Vec<&String> {
    args.iter()
        .filter(|argument| !argument.starts_with('-'))
        .collect()
}

fn read_file(root: &Path, cwd: &str, target: &str) -> AppResult<String> {
    let path = resolve(root, cwd, target)?;
    fs::read_to_string(&path).map_err(|error| AppError::invalid(format!("{target}: {error}")))
}

fn copy_dir_all(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

fn line_count(args: &[String], default: usize) -> usize {
    for (index, argument) in args.iter().enumerate() {
        if argument == "-n" {
            return args
                .get(index + 1)
                .and_then(|value| value.parse().ok())
                .unwrap_or(default);
        }
        if let Some(value) = argument.strip_prefix("-n")
            && let Ok(parsed) = value.parse()
        {
            return parsed;
        }
    }
    default
}

fn cmd_ls(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let long = has_flag(args, "-l");
    let all = has_flag(args, "-a") || has_flag(args, "-la") || has_flag(args, "-al");
    let targets = positional(args);
    let target = targets.first().map(|value| value.as_str()).unwrap_or(".");
    let directory = resolve(root, cwd, target)?;

    let metadata = fs::metadata(&directory)
        .map_err(|error| AppError::invalid(format!("ls: {target}: {error}")))?;

    if !metadata.is_dir() {
        return Ok(output(format!("{target}\n"), cwd));
    }

    let mut entries: Vec<_> = fs::read_dir(&directory)?.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.file_name());

    let mut lines = Vec::new();
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if !all && name.starts_with('.') {
            continue;
        }
        let metadata = entry.metadata()?;
        let is_dir = metadata.is_dir();
        let suffix = if is_dir { "/" } else { "" };
        if long {
            let kind = if is_dir { 'd' } else { '-' };
            lines.push(format!(
                "{kind}rw-r--r--  {:>7}  {name}{suffix}",
                metadata.len()
            ));
        } else {
            lines.push(format!("{name}{suffix}"));
        }
    }

    Ok(output(format!("{}\n", lines.join("\n")), cwd))
}

fn cmd_cd(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let target = positional(args)
        .first()
        .map(|value| value.as_str())
        .unwrap_or("/");
    let path = resolve(root, cwd, target)?;

    if !path.is_dir() {
        return Ok(failure(format!("cd: {target}: не каталог"), cwd));
    }

    Ok(output("", &display_cwd(root, &path)))
}

fn cmd_cat(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let targets = positional(args);
    if targets.is_empty() {
        return Ok(failure("cat: укажи файл", cwd));
    }

    let mut stdout = String::new();
    for target in targets {
        let content = read_file(root, cwd, target)?;
        stdout.push_str(&content);
        if !content.ends_with('\n') {
            stdout.push('\n');
        }
    }

    Ok(output(stdout, cwd))
}

fn cmd_head_tail(root: &Path, cwd: &str, args: &[String], tail: bool) -> AppResult<ShellOutput> {
    let count = line_count(args, 10);
    let targets = positional(args);
    let target = targets.first().map(|value| value.as_str()).unwrap_or("");
    if target.is_empty() {
        return Ok(failure("укажи файл", cwd));
    }

    let content = read_file(root, cwd, target)?;
    let lines: Vec<&str> = content.lines().collect();
    let selected = if tail {
        let start = lines.len().saturating_sub(count);
        &lines[start..]
    } else {
        &lines[..lines.len().min(count)]
    };

    Ok(output(format!("{}\n", selected.join("\n")), cwd))
}

fn cmd_touch(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    for target in positional(args) {
        let path = resolve(root, cwd, target)?;
        fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|error| AppError::invalid(format!("touch: {target}: {error}")))?;
    }
    Ok(output("", cwd))
}

fn cmd_mkdir(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let parents = has_flag(args, "-p");
    for target in positional(args) {
        let path = resolve(root, cwd, target)?;
        let result = if parents {
            fs::create_dir_all(&path)
        } else {
            fs::create_dir(&path)
        };
        result.map_err(|error| AppError::invalid(format!("mkdir: {target}: {error}")))?;
    }
    Ok(output("", cwd))
}

fn cmd_rm(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let recursive = has_flag(args, "-r") || has_flag(args, "-rf") || has_flag(args, "-fr");
    let force = has_flag(args, "-f") || has_flag(args, "-rf") || has_flag(args, "-fr");

    for target in positional(args) {
        let path = resolve(root, cwd, target)?;
        if path == root {
            return Ok(failure("rm: нельзя удалить корень песочницы", cwd));
        }
        if !path.exists() {
            if force {
                continue;
            }
            return Ok(failure(format!("rm: {target}: файл не найден"), cwd));
        }
        if path.is_dir() {
            if !recursive {
                return Ok(failure(format!("rm: {target}: это каталог, нужен -r"), cwd));
            }
            fs::remove_dir_all(&path)
                .map_err(|error| AppError::invalid(format!("rm: {target}: {error}")))?;
        } else {
            fs::remove_file(&path)
                .map_err(|error| AppError::invalid(format!("rm: {target}: {error}")))?;
        }
    }

    Ok(output("", cwd))
}

fn cmd_mv(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let targets = positional(args);
    if targets.len() < 2 {
        return Ok(failure("mv: нужен источник и назначение", cwd));
    }

    let source = resolve(root, cwd, targets[0])?;
    let mut destination = resolve(root, cwd, targets[1])?;
    if destination.is_dir() {
        destination = destination.join(
            source
                .file_name()
                .map(|value| value.to_os_string())
                .unwrap_or_default(),
        );
    }

    fs::rename(&source, &destination).map_err(|error| AppError::invalid(format!("mv: {error}")))?;
    Ok(output("", cwd))
}

fn cmd_cp(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let recursive = has_flag(args, "-r");
    let targets = positional(args);
    if targets.len() < 2 {
        return Ok(failure("cp: нужен источник и назначение", cwd));
    }

    let source = resolve(root, cwd, targets[0])?;
    let mut destination = resolve(root, cwd, targets[1])?;
    if destination.is_dir() {
        destination = destination.join(
            source
                .file_name()
                .map(|value| value.to_os_string())
                .unwrap_or_default(),
        );
    }

    if source.is_dir() {
        if !recursive {
            return Ok(failure("cp: это каталог, нужен -r", cwd));
        }
        copy_dir_all(&source, &destination)
            .map_err(|error| AppError::invalid(format!("cp: {error}")))?;
    } else {
        fs::copy(&source, &destination)
            .map_err(|error| AppError::invalid(format!("cp: {error}")))?;
    }

    Ok(output("", cwd))
}

fn cmd_echo(_root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let newline = !has_flag(args, "-n");
    let text = args
        .iter()
        .filter(|argument| argument.as_str() != "-n")
        .cloned()
        .collect::<Vec<_>>()
        .join(" ");

    Ok(output(
        if newline { format!("{text}\n") } else { text },
        cwd,
    ))
}

fn cmd_wc(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let lines_flag = has_flag(args, "-l");
    let words_flag = has_flag(args, "-w");
    let bytes_flag = has_flag(args, "-c");
    let only_one = (lines_flag as u8 + words_flag as u8 + bytes_flag as u8) == 1;

    let targets = positional(args);
    if targets.is_empty() {
        return Ok(failure("wc: укажи файл", cwd));
    }

    let mut stdout = String::new();
    for target in targets {
        let content = read_file(root, cwd, target)?;
        let lines = content.lines().count();
        let words = content.split_whitespace().count();
        let bytes = content.len();

        if only_one {
            let value = if lines_flag {
                lines
            } else if words_flag {
                words
            } else {
                bytes
            };
            stdout.push_str(&format!("{value} {target}\n"));
        } else {
            stdout.push_str(&format!("{lines} {words} {bytes} {target}\n"));
        }
    }

    Ok(output(stdout, cwd))
}

fn cmd_grep(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let numbered = has_flag(args, "-n");
    let targets = positional(args);
    if targets.len() < 2 {
        return Ok(failure("grep: нужен шаблон и файл", cwd));
    }

    let pattern = targets[0];
    let mut stdout = String::new();

    for target in &targets[1..] {
        let content = read_file(root, cwd, target)?;
        for (index, line) in content.lines().enumerate() {
            if line.contains(pattern) {
                if numbered {
                    stdout.push_str(&format!("{}:{}: {line}\n", target, index + 1));
                } else {
                    stdout.push_str(&format!("{line}\n"));
                }
            }
        }
    }

    Ok(output(stdout, cwd))
}

fn walk(root: &Path, path: &Path, name_filter: Option<&str>, output: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };

    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.file_name());

    for entry in entries {
        let entry_path = entry.path();
        let relative = display_cwd(root, &entry_path);
        let entry_name = entry.file_name().to_string_lossy().to_string();

        let matches = name_filter
            .map(|filter| entry_name.contains(filter))
            .unwrap_or(true);

        if matches {
            output.push(relative.clone());
        }

        if entry_path.is_dir() {
            walk(root, &entry_path, name_filter, output);
        }
    }
}

fn cmd_find(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let targets = positional(args);
    let target = targets.first().map(|value| value.as_str()).unwrap_or(".");
    let start = resolve(root, cwd, target)?;

    let mut name_filter = None;
    for (index, argument) in args.iter().enumerate() {
        if argument == "-name" {
            name_filter = args.get(index + 1).map(|value| value.as_str());
        }
    }

    let mut lines = vec![display_cwd(root, &start)];
    walk(root, &start, name_filter, &mut lines);

    Ok(output(format!("{}\n", lines.join("\n")), cwd))
}

fn tree_walk(path: &Path, prefix: &str, lines: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };

    let mut entries: Vec<_> = entries.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| entry.file_name());

    let count = entries.len();
    for (index, entry) in entries.into_iter().enumerate() {
        let last = index + 1 == count;
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry.path().is_dir();
        lines.push(format!(
            "{prefix}{}{name}",
            if last { "└── " } else { "├── " }
        ));
        if is_dir {
            let next_prefix = format!("{prefix}{}", if last { "    " } else { "│   " });
            tree_walk(&entry.path(), &next_prefix, lines);
        }
    }
}

fn cmd_tree(root: &Path, cwd: &str, args: &[String]) -> AppResult<ShellOutput> {
    let target = positional(args)
        .first()
        .map(|value| value.as_str())
        .unwrap_or(".");
    let start = resolve(root, cwd, target)?;
    if !start.is_dir() {
        return Ok(failure("tree: не каталог", cwd));
    }

    let mut lines = vec![display_cwd(root, &start)];
    tree_walk(&start, "", &mut lines);
    Ok(output(format!("{}\n", lines.join("\n")), cwd))
}

fn cmd_help(cwd: &str) -> ShellOutput {
    let text = "\
GitScope shell — базовые команды POSIX:

  pwd                 текущая папка
  ls [-l] [-a] [путь] список файлов
  cd [путь]           перейти в папку (cd / — корень песочницы)
  cat <файл>          показать файл
  head/tail [-n N]    первые/последние строки
  touch <файл>        создать пустой файл
  mkdir [-p] <папка>  создать папку
  rm [-r] [-f] <путь> удалить
  mv <откуда> <куда>  переместить
  cp [-r] <откуда> <куда>  скопировать
  echo <текст>        вывести текст (можно > файл и >> файл)
  wc [-l|-w|-c] <файл>  строки/слова/байты
  grep [-n] <текст> <файл>  поиск по строкам
  find [путь] [-name текст]  найти файлы
  tree [путь]         дерево папок
  clear               очистить экран
  help                эта справка

Все пути ограничены песочницей. Git-команды работают как обычно.
";
    output(text, cwd)
}

pub fn run_builtin(root: &Path, cwd: &str, tokens: &[String]) -> AppResult<ShellOutput> {
    let command = tokens
        .first()
        .map(String::as_str)
        .ok_or_else(|| AppError::invalid("Пустая команда"))?;
    let args = &tokens[1..];

    match command {
        "pwd" => Ok(output(format!("{cwd}\n"), cwd)),
        "cd" => cmd_cd(root, cwd, args),
        "ls" => cmd_ls(root, cwd, args),
        "cat" => cmd_cat(root, cwd, args),
        "head" => cmd_head_tail(root, cwd, args, false),
        "tail" => cmd_head_tail(root, cwd, args, true),
        "touch" => cmd_touch(root, cwd, args),
        "mkdir" => cmd_mkdir(root, cwd, args),
        "rm" => cmd_rm(root, cwd, args),
        "mv" => cmd_mv(root, cwd, args),
        "cp" => cmd_cp(root, cwd, args),
        "echo" => cmd_echo(root, cwd, args),
        "wc" => cmd_wc(root, cwd, args),
        "grep" => cmd_grep(root, cwd, args),
        "find" => cmd_find(root, cwd, args),
        "tree" => cmd_tree(root, cwd, args),
        "help" => Ok(cmd_help(cwd)),
        "clear" => Ok(ShellOutput {
            stdout: String::new(),
            stderr: String::new(),
            code: 0,
            cwd: cwd.to_string(),
            clear: true,
        }),
        "whoami" => Ok(output("learner\n", cwd)),
        "uname" => Ok(output("GitScope POSIX-like shell (Windows)\n", cwd)),
        "which" => {
            let target = positional(args)
                .first()
                .map(|value| value.as_str())
                .unwrap_or("");
            if target.is_empty() {
                return Ok(failure("which: укажи команду", cwd));
            }
            let known = [
                "git", "pwd", "cd", "ls", "cat", "head", "tail", "touch", "mkdir", "rm", "mv",
                "cp", "echo", "wc", "grep", "find", "tree", "clear", "help",
            ];
            if known.contains(&target) {
                Ok(output(format!("{target}: встроено в GitScope\n"), cwd))
            } else {
                Ok(failure(format!("which: {target}: не найдено"), cwd))
            }
        }
        "export" | "exit" => Ok(output("", cwd)),
        _ => Ok(failure(
            format!("{command}: команда не найдена. Введи help."),
            cwd,
        )),
    }
}

/// Записывает stdout команды в файл для `> file` и `>> file`.
pub fn redirect_to_file(
    root: &Path,
    cwd: &str,
    stdout: &str,
    target: &str,
    append: bool,
) -> AppResult<()> {
    let path = resolve(root, cwd, target)?;
    if append {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|error| AppError::invalid(format!("{target}: {error}")))?;
        file.write_all(stdout.as_bytes())?;
    } else {
        fs::write(&path, stdout.as_bytes())
            .map_err(|error| AppError::invalid(format!("{target}: {error}")))?;
    }
    Ok(())
}

/// Ищет Git Bash из Git for Windows.
pub fn find_bash() -> Option<PathBuf> {
    let candidates = [
        std::env::var("ProgramFiles")
            .ok()
            .map(|path| PathBuf::from(path).join("Git").join("bin").join("bash.exe")),
        std::env::var("ProgramFiles(x86)")
            .ok()
            .map(|path| PathBuf::from(path).join("Git").join("bin").join("bash.exe")),
        std::env::var("LOCALAPPDATA").ok().map(|path| {
            PathBuf::from(path)
                .join("Programs")
                .join("Git")
                .join("bin")
                .join("bash.exe")
        }),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    if Command::new("bash")
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
    {
        return Some(PathBuf::from("bash"));
    }

    None
}

fn to_msys(path: &Path) -> String {
    let text = path.to_string_lossy().replace('\\', "/");
    let bytes = text.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        let drive = text[..1].to_lowercase();
        format!("/{drive}{}", &text[2..])
    } else {
        text
    }
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Полный POSIX-shell через Git Bash: доступны все команды MSYS2,
/// включая pipes, sed, awk, grep, tar, curl и т.д.
pub fn run_full(env: &GitEnv, root: &Path, cwd: &str, input: &str) -> AppResult<ShellOutput> {
    if input.trim() == "clear" {
        return Ok(ShellOutput {
            stdout: String::new(),
            stderr: String::new(),
            code: 0,
            cwd: cwd.to_string(),
            clear: true,
        });
    }

    let bash = find_bash().ok_or_else(|| {
        AppError::new(
            "bashMissing",
            "Git Bash не найден. Установи Git for Windows, чтобы включить полный Linux-терминал.",
        )
    })?;

    let root_msys = to_msys(root);
    let workdir = if let Some(external) = cwd.strip_prefix('@') {
        external.to_string()
    } else if cwd == "/" || cwd.is_empty() {
        root_msys.clone()
    } else {
        format!("{root_msys}{cwd}")
    };

    let marker = format!(
        "__GITSCOPE_PWD_{}_{}__",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0)
    );

    let script = format!(
        "cd {workdir} 2>/dev/null || cd {root}\n{input}\n__gitscope_status=$?\nprintf '\\n{marker}%s\\n' \"$PWD\"\nexit $__gitscope_status",
        workdir = shell_quote(&workdir),
        root = shell_quote(&root_msys),
        input = input,
        marker = marker,
    );

    let output = Command::new(&bash)
        .arg("--noprofile")
        .arg("--norc")
        .arg("-c")
        .arg(&script)
        .current_dir(root)
        .env("HOME", root)
        .env("TERM", "dumb")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("PAGER", "cat")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", &env.config_global)
        .env("LANG", "en_US.UTF-8")
        .stdin(Stdio::null())
        .output()
        .map_err(|error| AppError::io(format!("Не удалось запустить Git Bash: {error}")))?;

    let mut stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let code = output.status.code().unwrap_or(1);

    let mut new_cwd = cwd.to_string();
    if let Some(index) = stdout.rfind(&marker) {
        let pwd = stdout[index + marker.len()..].trim().replace('\\', "/");
        stdout.truncate(index);
        stdout = stdout.trim_end_matches(['\r', '\n']).to_string();

        new_cwd = if let Some(relative) = pwd.strip_prefix(&root_msys) {
            let relative = relative.trim_start_matches('/');
            if relative.is_empty() {
                "/".to_string()
            } else {
                format!("/{relative}")
            }
        } else {
            format!("@{pwd}")
        };
    }

    Ok(ShellOutput {
        stdout,
        stderr,
        code,
        cwd: new_cwd,
        clear: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sandbox(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("gitscope-shell-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create sandbox");
        root
    }

    #[test]
    fn prevents_escaping_the_sandbox() {
        let root = sandbox("escape");
        assert!(resolve(&root, "/", "../..").is_ok());
        assert_eq!(resolve(&root, "/", "../..").unwrap(), root);
        assert!(resolve(&root, "/", "C:/Windows").is_err());
    }

    #[test]
    fn creates_and_reads_files() {
        let root = sandbox("files");
        let tokens = vec!["mkdir".to_string(), "src".to_string()];
        run_builtin(&root, "/", &tokens).expect("mkdir");

        let tokens = vec!["cd".to_string(), "src".to_string()];
        let result = run_builtin(&root, "/", &tokens).expect("cd");
        assert_eq!(result.cwd, "/src");

        let tokens = vec!["echo".to_string(), "hello".to_string(), "world".to_string()];
        let result = run_builtin(&root, "/src", &tokens).expect("echo");
        redirect_to_file(&root, "/src", &result.stdout, "note.txt", false).expect("redirect");

        let tokens = vec!["cat".to_string(), "note.txt".to_string()];
        let result = run_builtin(&root, "/src", &tokens).expect("cat");
        assert_eq!(result.stdout, "hello world\n");
    }

    #[test]
    fn lists_directory() {
        let root = sandbox("ls");
        fs::write(root.join("b.txt"), "b").unwrap();
        fs::create_dir(root.join("a")).unwrap();

        let tokens = vec!["ls".to_string()];
        let result = run_builtin(&root, "/", &tokens).expect("ls");
        assert_eq!(result.stdout, "a/\nb.txt\n");
    }
}
