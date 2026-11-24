use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::shell;

const START_MARKER: &str = "# >>> GitScope Linux terminal >>>";
const END_MARKER: &str = "# <<< GitScope Linux terminal <<<";

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
}
