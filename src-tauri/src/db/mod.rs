use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::AppResult;

fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

pub fn open(path: &Path) -> AppResult<Connection> {
    let connection = Connection::open(path)?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    connection.pragma_update(None, "synchronous", "NORMAL")?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&connection)?;
    Ok(connection)
}

fn migrate(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS recent_repos (
            path TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            opened_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lesson_progress (
            lesson_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            step_index INTEGER NOT NULL DEFAULT 0,
            completed_steps TEXT NOT NULL DEFAULT '[]',
            xp INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sandboxes (
            id TEXT PRIMARY KEY,
            scenario_id TEXT NOT NULL,
            path TEXT NOT NULL,
            spec_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS analytics_cache (
            repo_path TEXT NOT NULL,
            head_sha TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (repo_path, head_sha)
        );
        "#,
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentRepo {
    pub path: String,
    pub name: String,
    pub opened_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonProgress {
    pub lesson_id: String,
    pub status: String,
    pub step_index: i64,
    pub completed_steps: Vec<String>,
    pub xp: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxRecord {
    pub id: String,
    pub scenario_id: String,
    pub path: String,
    pub spec_json: String,
    pub created_at: i64,
}

pub fn recent_list(connection: &Connection) -> AppResult<Vec<RecentRepo>> {
    let mut statement = connection.prepare(
        "SELECT path, name, opened_at FROM recent_repos ORDER BY opened_at DESC LIMIT 12",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(RecentRepo {
            path: row.get(0)?,
            name: row.get(1)?,
            opened_at: row.get(2)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn recent_touch(connection: &Connection, path: &str, name: &str) -> AppResult<()> {
    connection.execute(
        "INSERT INTO recent_repos (path, name, opened_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(path) DO UPDATE SET name = excluded.name, opened_at = excluded.opened_at",
        params![path, name, now()],
    )?;
    Ok(())
}

pub fn recent_remove(connection: &Connection, path: &str) -> AppResult<()> {
    connection.execute("DELETE FROM recent_repos WHERE path = ?1", params![path])?;
    Ok(())
}

pub fn progress_list(connection: &Connection) -> AppResult<Vec<LessonProgress>> {
    let mut statement = connection.prepare(
        "SELECT lesson_id, status, step_index, completed_steps, xp, updated_at
         FROM lesson_progress ORDER BY updated_at DESC",
    )?;
    let rows = statement.query_map([], |row| {
        let steps_json: String = row.get(3)?;
        let completed_steps: Vec<String> = serde_json::from_str(&steps_json).unwrap_or_default();
        Ok(LessonProgress {
            lesson_id: row.get(0)?,
            status: row.get(1)?,
            step_index: row.get(2)?,
            completed_steps,
            xp: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn progress_save(
    connection: &Connection,
    lesson_id: &str,
    status: &str,
    step_index: i64,
    completed_steps: &[String],
    xp: i64,
) -> AppResult<()> {
    let steps_json = serde_json::to_string(completed_steps)?;
    connection.execute(
        "INSERT INTO lesson_progress (lesson_id, status, step_index, completed_steps, xp, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(lesson_id) DO UPDATE SET
            status = excluded.status,
            step_index = excluded.step_index,
            completed_steps = excluded.completed_steps,
            xp = excluded.xp,
            updated_at = excluded.updated_at",
        params![lesson_id, status, step_index, steps_json, xp, now()],
    )?;
    Ok(())
}

pub fn settings_all(connection: &Connection) -> AppResult<HashMap<String, String>> {
    let mut statement = connection.prepare("SELECT key, value FROM settings")?;
    let rows = statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut result = HashMap::new();
    for row in rows {
        let (key, value) = row?;
        result.insert(key, value);
    }
    Ok(result)
}

pub fn settings_set(connection: &Connection, key: &str, value: &str) -> AppResult<()> {
    connection.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn sandbox_insert(connection: &Connection, record: &SandboxRecord) -> AppResult<()> {
    connection.execute(
        "INSERT INTO sandboxes (id, scenario_id, path, spec_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            record.id,
            record.scenario_id,
            record.path,
            record.spec_json,
            record.created_at
        ],
    )?;
    Ok(())
}

pub fn sandbox_get(connection: &Connection, id: &str) -> AppResult<Option<SandboxRecord>> {
    let mut statement = connection.prepare(
        "SELECT id, scenario_id, path, spec_json, created_at FROM sandboxes WHERE id = ?1",
    )?;
    let mut rows = statement.query(params![id])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(SandboxRecord {
            id: row.get(0)?,
            scenario_id: row.get(1)?,
            path: row.get(2)?,
            spec_json: row.get(3)?,
            created_at: row.get(4)?,
        }));
    }
    Ok(None)
}

pub fn sandbox_delete(connection: &Connection, id: &str) -> AppResult<()> {
    connection.execute("DELETE FROM sandboxes WHERE id = ?1", params![id])?;
    Ok(())
}

#[allow(dead_code)]
pub fn sandbox_list(connection: &Connection) -> AppResult<Vec<SandboxRecord>> {
    let mut statement = connection.prepare(
        "SELECT id, scenario_id, path, spec_json, created_at FROM sandboxes ORDER BY created_at DESC",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(SandboxRecord {
            id: row.get(0)?,
            scenario_id: row.get(1)?,
            path: row.get(2)?,
            spec_json: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}
