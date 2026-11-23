use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::runner::{run_readonly, run_readonly_raw, GitEnv};

const LOG_LIMIT: usize = 20_000;
const STATE_LOG_LIMIT: usize = 500;
const PATCH_LIMIT: usize = 2_000_000;

fn a(items: &[&str]) -> Vec<String> {
    items.iter().map(|item| item.to_string()).collect()
}

fn truncate_at(value: &mut String, max: usize) {
    if value.len() <= max {
        return;
    }
    let mut end = max;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    value.truncate(end);
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub head_branch: Option<String>,
    pub head_sha: Option<String>,
    pub detached: bool,
    pub is_empty: bool,
    pub git_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefInfo {
    pub name: String,
    pub full_name: String,
    pub kind: String,
    pub target: String,
    pub is_head: bool,
    pub upstream: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefLabel {
    pub name: String,
    pub kind: String,
    pub is_head: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub sha: String,
    pub short_sha: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub committer_name: String,
    pub committer_time: i64,
    pub subject: String,
    pub refs: Vec<RefLabel>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
    pub binary: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetails {
    pub sha: String,
    pub short_sha: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub committer_name: String,
    pub committer_email: String,
    pub committer_time: i64,
    pub subject: String,
    pub body: String,
    pub files: Vec<FileChange>,
    pub additions: u32,
    pub deletions: u32,
    pub is_merge: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffPayload {
    pub sha: String,
    pub parent: Option<String>,
    pub patch: String,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusEntry {
    pub path: String,
    pub index: String,
    pub worktree: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub branch: Option<String>,
    pub head_sha: Option<String>,
    pub upstream: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub entries: Vec<StatusEntry>,
    pub conflicts: Vec<String>,
    pub clean: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchState {
    pub name: String,
    pub sha: String,
    pub is_head: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitState {
    pub sha: String,
    pub parents: Vec<String>,
    pub subject: String,
    pub author_name: String,
    pub author_time: i64,
    pub refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntry {
    pub sha: String,
    pub selector: String,
    pub subject: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoState {
    pub head_branch: Option<String>,
    pub head_sha: Option<String>,
    pub detached: bool,
    pub branches: Vec<BranchState>,
    pub tags: Vec<String>,
    pub commits: Vec<CommitState>,
    pub status: Vec<StatusEntry>,
    pub conflicts: Vec<String>,
    pub stash_count: usize,
    pub files: Vec<String>,
    pub reflog: Vec<ReflogEntry>,
}

fn parse_refs(raw: &str) -> Vec<RefInfo> {
    let mut refs = Vec::new();
    for record in raw.split('\x1e') {
        let record = record.trim_start_matches('\n');
        if record.is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\x1f').collect();
        if fields.len() < 6 {
            continue;
        }
        let full_name = fields[0].to_string();
        let object_name = fields[1];
        let peeled = fields[2];
        let object_type = fields[3];
        let head_marker = fields[4];
        let upstream = fields[5];

        let (kind, name) = if let Some(rest) = full_name.strip_prefix("refs/heads/") {
            ("branch", rest.to_string())
        } else if let Some(rest) = full_name.strip_prefix("refs/remotes/") {
            ("remote", rest.to_string())
        } else if let Some(rest) = full_name.strip_prefix("refs/tags/") {
            ("tag", rest.to_string())
        } else {
            continue;
        };

        let target = if object_type == "tag" && !peeled.is_empty() {
            peeled.to_string()
        } else {
            object_name.to_string()
        };

        refs.push(RefInfo {
            name,
            full_name,
            kind: kind.to_string(),
            target,
            is_head: head_marker == "*",
            upstream: if upstream.is_empty() {
                None
            } else {
                Some(upstream.to_string())
            },
        });
    }

    refs.sort_by(|left, right| {
        let rank = |kind: &str| match kind {
            "branch" => 0,
            "remote" => 1,
            _ => 2,
        };
        rank(&left.kind)
            .cmp(&rank(&right.kind))
            .then_with(|| left.name.cmp(&right.name))
    });

    refs
}

pub fn list_refs(env: &GitEnv, path: &Path) -> AppResult<Vec<RefInfo>> {
    let raw = run_readonly(
        env,
        path,
        &a(&[
            "for-each-ref",
            "--format=%(refname)%1f%(objectname)%1f%(*objectname)%1f%(objecttype)%1f%(HEAD)%1f%(upstream:short)%1e",
            "refs/heads",
            "refs/remotes",
            "refs/tags",
        ]),
    )?;
    Ok(parse_refs(&raw))
}

fn refs_by_sha(refs: &[RefInfo]) -> HashMap<String, Vec<RefLabel>> {
    let mut map: HashMap<String, Vec<RefLabel>> = HashMap::new();
    for reference in refs {
        map.entry(reference.target.clone())
            .or_default()
            .push(RefLabel {
                name: reference.name.clone(),
                kind: reference.kind.clone(),
                is_head: reference.is_head,
            });
    }
    map
}

pub fn open_repo(env: &GitEnv, path: &str) -> AppResult<RepoInfo> {
    let requested = PathBuf::from(path);
    if !requested.exists() {
        return Err(AppError::not_found(format!(
            "Папка не найдена: {}",
            requested.display()
        )));
    }

    let canonical = requested
        .canonicalize()
        .map_err(|error| AppError::io(format!("Не удалось открыть папку: {error}")))?;

    let inside = run_readonly_raw(env, &canonical, &a(&["rev-parse", "--is-inside-work-tree"]))?;
    if !inside.success() || inside.stdout.trim() != "true" {
        return Err(AppError::invalid(
            "Это не рабочая копия git-репозитория. Выбери папку с .git внутри.",
        ));
    }

    let toplevel = run_readonly(env, &canonical, &a(&["rev-parse", "--show-toplevel"]))?;
    let root = PathBuf::from(toplevel.trim());
    let root = root.canonicalize().unwrap_or(root);

    let head_branch = run_readonly_raw(env, &root, &a(&["symbolic-ref", "--short", "-q", "HEAD"]))
        .ok()
        .filter(|output| output.success())
        .map(|output| output.stdout.trim().to_string())
        .filter(|value| !value.is_empty());

    let head = run_readonly_raw(env, &root, &a(&["rev-parse", "--verify", "--quiet", "HEAD"]))?;
    let head_sha = if head.success() {
        Some(head.stdout.trim().to_string())
    } else {
        None
    };

    let name = root
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| root.display().to_string());

    Ok(RepoInfo {
        path: root.display().to_string(),
        name,
        head_branch: head_branch.clone(),
        head_sha: head_sha.clone(),
        detached: head_branch.is_none() && head_sha.is_some(),
        is_empty: head_sha.is_none(),
        git_version: crate::git::runner::git_version().unwrap_or_default(),
    })
}

fn parse_commit_records(raw: &str, labels: &HashMap<String, Vec<RefLabel>>) -> Vec<Commit> {
    let mut commits = Vec::new();
    for record in raw.split('\x1e') {
        let record = record.trim_start_matches('\n');
        if record.is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\x1f').collect();
        if fields.len() < 8 {
            continue;
        }
        let sha = fields[0].to_string();
        commits.push(Commit {
            short_sha: sha.chars().take(7).collect(),
            parents: fields[1]
                .split_whitespace()
                .map(|value| value.to_string())
                .collect(),
            author_name: fields[2].to_string(),
            author_email: fields[3].to_string(),
            author_time: fields[4].parse().unwrap_or(0),
            committer_name: fields[5].to_string(),
            committer_time: fields[6].parse().unwrap_or(0),
            subject: fields[7].to_string(),
            refs: labels.get(&sha).cloned().unwrap_or_default(),
            sha,
        });
    }
    commits
}

/// Версия list_commits с уже загруженными refs: экономит один вызов git.
fn list_commits_with_refs(
    env: &GitEnv,
    path: &Path,
    limit: Option<usize>,
    refs: &[RefInfo],
    head_available: bool,
) -> AppResult<Vec<Commit>> {
    if !head_available {
        return Ok(Vec::new());
    }

    let limit = limit.unwrap_or(LOG_LIMIT).min(LOG_LIMIT);
    let format = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ct%x1f%s%x1e";
    let raw = run_readonly(
        env,
        path,
        &[
            "log".to_string(),
            "--all".to_string(),
            "HEAD".to_string(),
            "--date-order".to_string(),
            format!("--max-count={limit}"),
            format!("--format={format}"),
        ],
    )?;

    let labels = refs_by_sha(refs);
    Ok(parse_commit_records(&raw, &labels))
}

pub fn list_commits(env: &GitEnv, path: &Path, limit: Option<usize>) -> AppResult<Vec<Commit>> {
    let head = run_readonly_raw(env, path, &a(&["rev-parse", "--verify", "--quiet", "HEAD"]))?;
    if !head.success() {
        return Ok(Vec::new());
    }

    let refs = list_refs(env, path).unwrap_or_default();
    list_commits_with_refs(env, path, limit, &refs, true)
}

fn parse_count(value: &str) -> u32 {
    value.parse().unwrap_or(0)
}

fn parse_numstat(raw: &str) -> Vec<(String, Option<String>, u32, u32, bool)> {
    let tokens: Vec<&str> = raw.split('\0').collect();
    let mut result = Vec::new();
    let mut index = 0;

    while index < tokens.len() {
        let token = tokens[index];
        if token.is_empty() {
            index += 1;
            continue;
        }
        let mut parts = token.splitn(3, '\t');
        let additions = parts.next().unwrap_or("");
        let deletions = parts.next().unwrap_or("");
        let path = parts.next().unwrap_or("");

        if path.is_empty() {
            let old_path = tokens.get(index + 1).copied().unwrap_or("");
            let new_path = tokens.get(index + 2).copied().unwrap_or("");
            result.push((
                new_path.to_string(),
                Some(old_path.to_string()),
                parse_count(additions),
                parse_count(deletions),
                additions == "-",
            ));
            index += 3;
        } else {
            result.push((
                path.to_string(),
                None,
                parse_count(additions),
                parse_count(deletions),
                additions == "-",
            ));
            index += 1;
        }
    }

    result
}

fn parse_name_status(raw: &str) -> Vec<(String, Option<String>, String)> {
    let tokens: Vec<&str> = raw.split('\0').collect();
    let mut result = Vec::new();
    let mut index = 0;

    while index < tokens.len() {
        let status = tokens[index];
        if status.is_empty() {
            index += 1;
            continue;
        }
        let letter = status.chars().next().unwrap_or('M').to_string();
        if letter == "R" || letter == "C" {
            let old_path = tokens.get(index + 1).copied().unwrap_or("");
            let new_path = tokens.get(index + 2).copied().unwrap_or("");
            result.push((new_path.to_string(), Some(old_path.to_string()), letter));
            index += 3;
        } else {
            let path = tokens.get(index + 1).copied().unwrap_or("");
            result.push((path.to_string(), None, letter));
            index += 2;
        }
    }

    result
}

fn commit_parents(env: &GitEnv, path: &Path, sha: &str) -> AppResult<Vec<String>> {
    let raw = run_readonly(env, path, &a(&["show", "-s", "--format=%P", sha]))?;
    Ok(raw
        .trim()
        .split_whitespace()
        .map(|value| value.to_string())
        .collect())
}

pub fn commit_details(env: &GitEnv, path: &Path, sha: &str) -> AppResult<CommitDetails> {
    let format = "%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%s%x1f%b";
    let raw = run_readonly(
        env,
        path,
        &a(&["show", "-s", &format!("--format={format}"), sha]),
    )?;

    let fields: Vec<&str> = raw.splitn(10, '\x1f').collect();
    if fields.len() < 10 {
        return Err(AppError::git("Не удалось разобрать данные коммита"));
    }

    let parents: Vec<String> = fields[1]
        .split_whitespace()
        .map(|value| value.to_string())
        .collect();

    let (numstat_args, name_status_args) = if let Some(parent) = parents.first() {
        (
            vec![
                "diff-tree".to_string(),
                "-r".to_string(),
                "-M".to_string(),
                "--numstat".to_string(),
                "-z".to_string(),
                "--no-commit-id".to_string(),
                parent.clone(),
                sha.to_string(),
            ],
            vec![
                "diff-tree".to_string(),
                "-r".to_string(),
                "-M".to_string(),
                "--name-status".to_string(),
                "-z".to_string(),
                "--no-commit-id".to_string(),
                parent.clone(),
                sha.to_string(),
            ],
        )
    } else {
        (
            vec![
                "diff-tree".to_string(),
                "--root".to_string(),
                "-r".to_string(),
                "-M".to_string(),
                "--numstat".to_string(),
                "-z".to_string(),
                "--no-commit-id".to_string(),
                sha.to_string(),
            ],
            vec![
                "diff-tree".to_string(),
                "--root".to_string(),
                "-r".to_string(),
                "-M".to_string(),
                "--name-status".to_string(),
                "-z".to_string(),
                "--no-commit-id".to_string(),
                sha.to_string(),
            ],
        )
    };

    let numstat = run_readonly(env, path, &numstat_args).unwrap_or_default();
    let name_status = run_readonly(env, path, &name_status_args).unwrap_or_default();

    let statuses: HashMap<String, (Option<String>, String)> = parse_name_status(&name_status)
        .into_iter()
        .map(|(path, old_path, status)| (path, (old_path, status)))
        .collect();

    let mut files = Vec::new();
    let mut additions = 0;
    let mut deletions = 0;

    for (file_path, old_path, added, removed, binary) in parse_numstat(&numstat) {
        let (status_old, status) = statuses
            .get(&file_path)
            .cloned()
            .unwrap_or((old_path.clone(), "M".to_string()));
        additions += added;
        deletions += removed;
        files.push(FileChange {
            path: file_path,
            old_path: status_old.or(old_path),
            status,
            additions: added,
            deletions: removed,
            binary,
        });
    }

    files.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(CommitDetails {
        sha: fields[0].to_string(),
        short_sha: fields[0].chars().take(7).collect(),
        parents: parents.clone(),
        author_name: fields[2].to_string(),
        author_email: fields[3].to_string(),
        author_time: fields[4].parse().unwrap_or(0),
        committer_name: fields[5].to_string(),
        committer_email: fields[6].to_string(),
        committer_time: fields[7].parse().unwrap_or(0),
        subject: fields[8].to_string(),
        body: fields[9].trim().to_string(),
        files,
        additions,
        deletions,
        is_merge: parents.len() > 1,
    })
}

pub fn commit_diff(env: &GitEnv, path: &Path, sha: &str) -> AppResult<DiffPayload> {
    let parents = commit_parents(env, path, sha)?;
    let parent = parents.first().cloned();

    let args = if let Some(parent) = &parent {
        vec![
            "diff".to_string(),
            "--no-color".to_string(),
            "--no-ext-diff".to_string(),
            "-M".to_string(),
            parent.clone(),
            sha.to_string(),
        ]
    } else {
        vec![
            "show".to_string(),
            "--format=".to_string(),
            "--no-color".to_string(),
            "--no-ext-diff".to_string(),
            "--root".to_string(),
            sha.to_string(),
        ]
    };

    let mut patch = run_readonly(env, path, &args)?;
    let truncated = patch.len() > PATCH_LIMIT;
    if truncated {
        truncate_at(&mut patch, PATCH_LIMIT);
    }

    Ok(DiffPayload {
        sha: sha.to_string(),
        parent,
        patch,
        truncated,
    })
}

pub fn repo_status(env: &GitEnv, path: &Path) -> AppResult<RepoStatus> {
    let raw = run_readonly(
        env,
        path,
        &a(&[
            "status",
            "--porcelain=v2",
            "-z",
            "--branch",
            "--untracked-files=normal",
        ]),
    )?;

    let tokens: Vec<&str> = raw.split('\0').collect();
    let mut branch = None;
    let mut head_sha = None;
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut entries = Vec::new();
    let mut conflicts = Vec::new();
    let mut index = 0;

    while index < tokens.len() {
        let token = tokens[index];
        if token.is_empty() {
            index += 1;
            continue;
        }

        if let Some(header) = token.strip_prefix("# ") {
            if let Some(value) = header.strip_prefix("branch.head ") {
                if value != "(detached)" {
                    branch = Some(value.to_string());
                }
            } else if let Some(value) = header.strip_prefix("branch.oid ") {
                if value != "(initial)" {
                    head_sha = Some(value.to_string());
                }
            } else if let Some(value) = header.strip_prefix("branch.upstream ") {
                upstream = Some(value.to_string());
            } else if let Some(value) = header.strip_prefix("branch.ab ") {
                let mut parts = value.split_whitespace();
                ahead = parts
                    .next()
                    .and_then(|item| item.trim_start_matches('+').parse().ok())
                    .unwrap_or(0);
                behind = parts
                    .next()
                    .and_then(|item| item.trim_start_matches('-').parse().ok())
                    .unwrap_or(0);
            }
            index += 1;
            continue;
        }

        let kind = token.chars().next().unwrap_or('?');
        match kind {
            '1' | '2' => {
                let field_count = if kind == '2' { 10 } else { 9 };
                let fields: Vec<&str> = token.splitn(field_count, ' ').collect();
                if fields.len() >= field_count {
                    let xy = fields[1];
                    let mut chars = xy.chars();
                    let index_status = chars.next().unwrap_or('.').to_string();
                    let worktree_status = chars.next().unwrap_or('.').to_string();
                    let file_path = fields[field_count - 1].to_string();
                    entries.push(StatusEntry {
                        path: file_path,
                        index: index_status,
                        worktree: worktree_status,
                        kind: if kind == '2' {
                            "renamed".to_string()
                        } else {
                            "changed".to_string()
                        },
                    });
                    if kind == '2' {
                        index += 2;
                    } else {
                        index += 1;
                    }
                } else {
                    index += 1;
                }
            }
            'u' => {
                let fields: Vec<&str> = token.splitn(11, ' ').collect();
                if fields.len() >= 11 {
                    let file_path = fields[10].to_string();
                    conflicts.push(file_path.clone());
                    entries.push(StatusEntry {
                        path: file_path,
                        index: "U".to_string(),
                        worktree: "U".to_string(),
                        kind: "conflict".to_string(),
                    });
                }
                index += 1;
            }
            '?' => {
                let file_path = token[2..].to_string();
                entries.push(StatusEntry {
                    path: file_path,
                    index: "?".to_string(),
                    worktree: "?".to_string(),
                    kind: "untracked".to_string(),
                });
                index += 1;
            }
            '!' => {
                index += 1;
            }
            _ => {
                index += 1;
            }
        }
    }

    Ok(RepoStatus {
        branch,
        head_sha,
        upstream,
        ahead,
        behind,
        clean: entries.is_empty(),
        entries,
        conflicts,
    })
}

fn join_result<'scope, T: Send>(
    handle: std::thread::ScopedJoinHandle<'scope, AppResult<T>>,
) -> AppResult<T> {
    handle
        .join()
        .unwrap_or_else(|_| Err(AppError::io("Фоновый поток git завершился с ошибкой")))
}

pub fn repo_state(env: &GitEnv, path: &Path) -> AppResult<RepoState> {
    // Все чтения независимы — запускаем их параллельно, чтобы состояние
    // песочницы пересчитывалось за один «раунд», а не за десять.
    let (head_branch, head, refs, status, stash_raw, files_raw, reflog_raw) =
        std::thread::scope(|scope| {
            let head_branch = scope.spawn(|| {
                run_readonly_raw(env, path, &a(&["symbolic-ref", "--short", "-q", "HEAD"]))
            });
            let head = scope.spawn(|| {
                run_readonly_raw(env, path, &a(&["rev-parse", "--verify", "--quiet", "HEAD"]))
            });
            let refs = scope.spawn(|| list_refs(env, path));
            let status = scope.spawn(|| repo_status(env, path));
            let stash = scope.spawn(|| run_readonly(env, path, &a(&["stash", "list"])));
            let files = scope.spawn(|| {
                run_readonly(env, path, &a(&["ls-tree", "-r", "--name-only", "HEAD"]))
            });
            let reflog = scope.spawn(|| {
                run_readonly(
                    env,
                    path,
                    &a(&["reflog", "--format=%H%1f%gd%1f%gs", "-n", "50"]),
                )
            });

            (
                join_result(head_branch),
                join_result(head),
                join_result(refs),
                join_result(status),
                join_result(stash),
                join_result(files),
                join_result(reflog),
            )
        });

    let head_branch = head_branch
        .ok()
        .filter(|output| output.success())
        .map(|output| output.stdout.trim().to_string())
        .filter(|value| !value.is_empty());

    let head_sha = match head {
        Ok(output) if output.success() => Some(output.stdout.trim().to_string()),
        _ => None,
    };

    let refs = refs.unwrap_or_default();
    let status = status?;

    let branches = refs
        .iter()
        .filter(|reference| reference.kind == "branch")
        .map(|reference| BranchState {
            name: reference.name.clone(),
            sha: reference.target.clone(),
            is_head: reference.is_head,
        })
        .collect();

    let tags = refs
        .iter()
        .filter(|reference| reference.kind == "tag")
        .map(|reference| reference.name.clone())
        .collect();

    let commits = if head_sha.is_some() {
        list_commits_with_refs(env, path, Some(STATE_LOG_LIMIT), &refs, true)?
            .into_iter()
            .map(|commit| CommitState {
                sha: commit.sha,
                parents: commit.parents,
                subject: commit.subject,
                author_name: commit.author_name,
                author_time: commit.author_time,
                refs: commit.refs.into_iter().map(|label| label.name).collect(),
            })
            .collect()
    } else {
        Vec::new()
    };

    let stash_count = stash_raw
        .unwrap_or_default()
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();

    let files = files_raw
        .unwrap_or_default()
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    let reflog = reflog_raw
        .unwrap_or_default()
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split('\x1f').collect();
            if fields.len() < 3 {
                return None;
            }
            Some(ReflogEntry {
                sha: fields[0].to_string(),
                selector: fields[1].to_string(),
                subject: fields[2].to_string(),
            })
        })
        .collect();

    let detached = head_branch.is_none() && head_sha.is_some();

    Ok(RepoState {
        head_branch,
        head_sha,
        detached,
        branches,
        tags,
        commits,
        status: status.entries,
        conflicts: status.conflicts,
        stash_count,
        files,
        reflog,
    })
}
