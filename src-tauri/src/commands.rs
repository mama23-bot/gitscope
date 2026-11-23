use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::db::{self, LessonProgress, RecentRepo, SandboxRecord};
use crate::error::{AppError, AppResult};
use crate::git::repo::{
    self, Commit, CommitDetails, DiffPayload, RefInfo, RepoInfo, RepoState, RepoStatus,
};
use crate::git::runner::{self, GitEnv};
use crate::git::sandbox::{self, CommandResult, SandboxSpec};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub data_dir: PathBuf,
    pub git_config: PathBuf,
}

impl AppState {
    pub fn git_env(&self) -> GitEnv {
        GitEnv::new(self.git_config.clone())
    }

    pub fn sandboxes_dir(&self) -> PathBuf {
        self.data_dir.join("sandboxes")
    }
}

fn lock_db(state: &AppState) -> AppResult<MutexGuard<'_, Connection>> {
    state
        .db
        .lock()
        .map_err(|_| AppError::db("База данных временно недоступна"))
}

fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxInfo {
    pub id: String,
    pub path: String,
    pub state: RepoState,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub data_dir: String,
    pub git_version: String,
    pub platform: String,
}

#[tauri::command]
pub async fn git_version() -> AppResult<String> {
    runner::git_version()
}

#[tauri::command]
pub async fn app_info(state: State<'_, AppState>) -> AppResult<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir: state.data_dir.display().to_string(),
        git_version: runner::git_version().unwrap_or_else(|_| "не найден".to_string()),
        platform: std::env::consts::OS.to_string(),
    })
}

#[tauri::command]
pub async fn open_repo(state: State<'_, AppState>, path: String) -> AppResult<RepoInfo> {
    let env = state.git_env();
    let info = repo::open_repo(&env, &path)?;
    {
        let connection = lock_db(state.inner())?;
        db::recent_touch(&connection, &info.path, &info.name)?;
    }
    Ok(info)
}

#[tauri::command]
pub async fn list_commits(
    state: State<'_, AppState>,
    path: String,
    limit: Option<usize>,
) -> AppResult<Vec<Commit>> {
    let env = state.git_env();
    repo::list_commits(&env, Path::new(&path), limit)
}

#[tauri::command]
pub async fn list_refs(state: State<'_, AppState>, path: String) -> AppResult<Vec<RefInfo>> {
    let env = state.git_env();
    repo::list_refs(&env, Path::new(&path))
}

#[tauri::command]
pub async fn commit_details(
    state: State<'_, AppState>,
    path: String,
    sha: String,
) -> AppResult<CommitDetails> {
    let env = state.git_env();
    repo::commit_details(&env, Path::new(&path), &sha)
}

#[tauri::command]
pub async fn commit_diff(
    state: State<'_, AppState>,
    path: String,
    sha: String,
) -> AppResult<DiffPayload> {
    let env = state.git_env();
    repo::commit_diff(&env, Path::new(&path), &sha)
}

#[tauri::command]
pub async fn repo_status(state: State<'_, AppState>, path: String) -> AppResult<RepoStatus> {
    let env = state.git_env();
    repo::repo_status(&env, Path::new(&path))
}

#[tauri::command]
pub async fn recent_repos(state: State<'_, AppState>) -> AppResult<Vec<RecentRepo>> {
    let connection = lock_db(state.inner())?;
    db::recent_list(&connection)
}

#[tauri::command]
pub async fn remove_recent_repo(state: State<'_, AppState>, path: String) -> AppResult<()> {
    let connection = lock_db(state.inner())?;
    db::recent_remove(&connection, &path)
}

#[tauri::command]
pub async fn create_sandbox(
    state: State<'_, AppState>,
    scenario_id: String,
    spec: SandboxSpec,
) -> AppResult<SandboxInfo> {
    let env = state.git_env();
    let id = uuid::Uuid::new_v4().to_string();
    let root = state.sandboxes_dir().join(&id);

    sandbox::create(&env, &root, &spec)?;

    let record = SandboxRecord {
        id: id.clone(),
        scenario_id,
        path: root.display().to_string(),
        spec_json: serde_json::to_string(&spec)?,
        created_at: now(),
    };

    {
        let connection = lock_db(state.inner())?;
        db::sandbox_insert(&connection, &record)?;
    }

    let snapshot = repo::repo_state(&env, &root)?;
    Ok(SandboxInfo {
        id,
        path: record.path,
        state: snapshot,
    })
}

#[tauri::command]
pub async fn reset_sandbox(state: State<'_, AppState>, id: String) -> AppResult<SandboxInfo> {
    let env = state.git_env();
    let record = {
        let connection = lock_db(state.inner())?;
        db::sandbox_get(&connection, &id)?
            .ok_or_else(|| AppError::not_found("Песочница не найдена. Создай новую."))?
    };

    let spec: SandboxSpec = serde_json::from_str(&record.spec_json)?;
    let root = PathBuf::from(&record.path);
    sandbox::create(&env, &root, &spec)?;
    let snapshot = repo::repo_state(&env, &root)?;

    Ok(SandboxInfo {
        id,
        path: record.path,
        state: snapshot,
    })
}

#[tauri::command]
pub async fn run_sandbox_command(
    state: State<'_, AppState>,
    id: String,
    command: String,
) -> AppResult<CommandResult> {
    let env = state.git_env();
    let record = {
        let connection = lock_db(state.inner())?;
        db::sandbox_get(&connection, &id)?
            .ok_or_else(|| AppError::not_found("Песочница не найдена. Создай новую."))?
    };

    let root = PathBuf::from(&record.path);
    if !root.exists() {
        return Err(AppError::not_found(
            "Папка песочницы удалена. Нажми «Сбросить», чтобы создать её заново.",
        ));
    }

    sandbox::run_command(&env, &root, &command)
}

#[tauri::command]
pub async fn sandbox_state(state: State<'_, AppState>, id: String) -> AppResult<RepoState> {
    let env = state.git_env();
    let record = {
        let connection = lock_db(state.inner())?;
        db::sandbox_get(&connection, &id)?
            .ok_or_else(|| AppError::not_found("Песочница не найдена. Создай новую."))?
    };

    repo::repo_state(&env, Path::new(&record.path))
}

#[tauri::command]
pub async fn destroy_sandbox(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let record = {
        let connection = lock_db(state.inner())?;
        db::sandbox_get(&connection, &id)?
    };

    if let Some(record) = record {
        let root = PathBuf::from(&record.path);
        if root.exists() {
            std::fs::remove_dir_all(&root)?;
        }
        let connection = lock_db(state.inner())?;
        db::sandbox_delete(&connection, &id)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_progress(state: State<'_, AppState>) -> AppResult<Vec<LessonProgress>> {
    let connection = lock_db(state.inner())?;
    db::progress_list(&connection)
}

#[tauri::command]
pub async fn save_progress(
    state: State<'_, AppState>,
    lesson_id: String,
    status: String,
    step_index: i64,
    completed_steps: Vec<String>,
    xp: i64,
) -> AppResult<()> {
    let connection = lock_db(state.inner())?;
    db::progress_save(
        &connection,
        &lesson_id,
        &status,
        step_index,
        &completed_steps,
        xp,
    )
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<HashMap<String, String>> {
    let connection = lock_db(state.inner())?;
    db::settings_all(&connection)
}

#[tauri::command]
pub async fn set_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> AppResult<()> {
    let connection = lock_db(state.inner())?;
    db::settings_set(&connection, &key, &value)
}
