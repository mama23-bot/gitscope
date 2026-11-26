use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::shell;

const START_MARKER: &str = "# >>> GitScope Linux terminal >>>";
const END_MARKER: &str = "# <<< GitScope Linux terminal <<<";
const APP_PATHS_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\App Paths\cmd.exe";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalIntegrationStatus {
    pub installed: bool,
    pub bash_available: bool,
    pub profiles: Vec<String>,
}

fn profiles() -> Vec<PathBuf> {
    let Some(documents) = dirs::document_dir() else {
        return Vec::new();
    };

    vec![
        documents
            .join("WindowsPowerShell")
            .join("Microsoft.PowerShell_profile.ps1"),
        documents
            .join("PowerShell")
            .join("Microsoft.PowerShell_profile.ps1"),
    ]
}

fn block(bash: &Path) -> String {
    let bash = bash.to_string_lossy().replace('\'', "''");
    format!(
        "{START_MARKER}\n# Added by GitScope. Disable in Settings -> System integration.\nfunction cmd {{\n    & '{bash}' --login -i\n}}\n{END_MARKER}\n"
    )
}

fn strip_block(content: &str) -> String {
    let mut result = String::new();
    let mut inside = false;

    for line in content.lines() {
        if line.trim() == START_MARKER {
            inside = true;
            continue;
        }
        if line.trim() == END_MARKER {
            inside = false;
            continue;
        }
        if !inside {
            result.push_str(line);
            result.push('\n');
        }
    }

    result
}

pub fn status() -> TerminalIntegrationStatus {
    let profiles = profiles();
    let installed = profiles.iter().any(|path| {
        fs::read_to_string(path)
            .map(|content| content.contains(START_MARKER))
            .unwrap_or(false)
    });

    TerminalIntegrationStatus {
        installed,
        bash_available: shell::find_bash().is_some(),
        profiles: profiles
            .iter()
            .map(|path| path.display().to_string())
            .collect(),
    }
}

pub fn enable() -> AppResult<TerminalIntegrationStatus> {
    let bash = shell::find_bash().ok_or_else(|| {
        AppError::new(
            "bashMissing",
            "Git Bash не найден. Установи Git for Windows, чтобы включить Linux-терминал.",
        )
    })?;

    let profiles = profiles();
    if profiles.is_empty() {
        return Err(AppError::new(
            "powershellMissing",
            "Не удалось найти профиль PowerShell.",
        ));
    }

    let block = block(&bash);

    for profile in &profiles {
        if let Some(parent) = profile.parent() {
            fs::create_dir_all(parent)?;
        }

        let existing = fs::read_to_string(profile).unwrap_or_default();
        let mut next = strip_block(&existing);

        if !next.is_empty() && !next.ends_with('\n') {
            next.push('\n');
        }
        next.push('\n');
        next.push_str(&block);

        fs::write(profile, next)?;
    }

    Ok(status())
}

pub fn disable() -> AppResult<TerminalIntegrationStatus> {
    for profile in profiles() {
        if !profile.exists() {
            continue;
        }

        let existing = fs::read_to_string(&profile)?;
        if !existing.contains(START_MARKER) {
            continue;
        }

        fs::write(&profile, strip_block(&existing))?;
    }

    Ok(status())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsIntegrationStatus {
    pub shortcut_installed: bool,
    pub app_paths_installed: bool,
    pub bash_available: bool,
}

fn find_git_bash() -> Option<PathBuf> {
    let candidates = [
        std::env::var("ProgramFiles")
            .ok()
            .map(|path| PathBuf::from(path).join("Git").join("git-bash.exe")),
        std::env::var("ProgramFiles(x86)")
            .ok()
            .map(|path| PathBuf::from(path).join("Git").join("git-bash.exe")),
        std::env::var("LOCALAPPDATA").ok().map(|path| {
            PathBuf::from(path)
                .join("Programs")
                .join("Git")
                .join("git-bash.exe")
        }),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    shell::find_bash()
}

fn shortcut_paths() -> Vec<PathBuf> {
    let mut result = Vec::new();

    if let Some(desktop) = dirs::desktop_dir() {
        result.push(desktop.join("Linux Terminal.lnk"));
    }

    if let Some(config) = dirs::config_dir() {
        result.push(
            config
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
                .join("Linux Terminal.lnk"),
        );
    }

    result
}

fn reg_query_contains(key: &str, needle: &str) -> bool {
    Command::new("reg")
        .args(["query", key, "/ve"])
        .output()
        .map(|output| {
            output.status.success() && String::from_utf8_lossy(&output.stdout).contains(needle)
        })
        .unwrap_or(false)
}

pub fn windows_status() -> WindowsIntegrationStatus {
    WindowsIntegrationStatus {
        shortcut_installed: shortcut_paths().iter().all(|path| path.exists()),
        app_paths_installed: reg_query_contains(APP_PATHS_KEY, "git-bash.exe"),
        bash_available: find_git_bash().is_some(),
    }
}

fn ps_quote(value: &str) -> String {
    value.replace('\'', "''")
}

/// Мини-base64: PowerShell принимает скрипт через `-EncodedCommand` в UTF-16LE,
/// поэтому кириллица в путях не зависит от кодовой страницы консоли.
fn base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(ALPHABET[(triple >> 18) as usize & 63] as char);
        out.push(ALPHABET[(triple >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[(triple >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[triple as usize & 63] as char
        } else {
            '='
        });
    }

    out
}

fn run_powershell(script: &str) -> AppResult<()> {
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
            &base64(&bytes),
        ])
        .output()
        .map_err(|error| AppError::io(format!("Не удалось запустить PowerShell: {error}")))?;

    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::io(if message.is_empty() {
            "PowerShell завершился с ошибкой.".to_string()
        } else {
            message
        }));
    }

    Ok(())
}

pub fn windows_enable() -> AppResult<WindowsIntegrationStatus> {
    let git_bash = find_git_bash().ok_or_else(|| {
        AppError::new(
            "bashMissing",
            "Git for Windows не найден. Установи Git, чтобы включить Linux-терминал.",
        )
    })?;

    let git_bash_text = ps_quote(&git_bash.display().to_string());
    let home = ps_quote(&std::env::var("USERPROFILE").unwrap_or_default());

    let mut script = String::new();

    for path in shortcut_paths() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        script.push_str(&format!(
            "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{shortcut}'); \
             $s.TargetPath = '{git_bash_text}'; \
             $s.WorkingDirectory = '{home}'; \
             $s.IconLocation = '{git_bash_text},0'; \
             $s.Description = 'Linux Terminal (Git Bash)'; \
             $s.Save();\n",
            shortcut = ps_quote(&path.display().to_string()),
        ));
    }

    run_powershell(&script)?;

    let status = Command::new("reg")
        .args([
            "add",
            APP_PATHS_KEY,
            "/ve",
            "/t",
            "REG_SZ",
            "/d",
            &git_bash_text,
            "/f",
        ])
        .status()
        .map_err(|error| AppError::io(format!("Не удалось настроить Win+R: {error}")))?;

    if !status.success() {
        return Err(AppError::io("Не удалось настроить Win+R → Linux."));
    }

    Ok(windows_status())
}

pub fn windows_disable() -> AppResult<WindowsIntegrationStatus> {
    for path in shortcut_paths() {
        if path.exists() {
            fs::remove_file(&path)?;
        }
    }

    let _ = Command::new("reg")
        .args(["delete", APP_PATHS_KEY, "/f"])
        .status();

    Ok(windows_status())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_only_the_marked_block() {
        let content = "before\n# >>> GitScope Linux terminal >>>\nfunction cmd {}\n# <<< GitScope Linux terminal <<<\nafter\n";
        assert_eq!(strip_block(content), "before\nafter\n");
    }

    #[test]
    fn keeps_content_without_the_block() {
        let content = "function hello {}\n";
        assert_eq!(strip_block(content), content);
    }

    #[test]
    fn encodes_base64_with_padding() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn escapes_single_quotes_for_powershell() {
        assert_eq!(ps_quote(r"C:\O'Brien\Git"), r"C:\O''Brien\Git");
    }
}
