use std::path::{Path, PathBuf};
use std::process::Command;

use gitscope_lib::git::repo;
use gitscope_lib::git::runner::GitEnv;
use gitscope_lib::git::sandbox::{self, SandboxSpec, ShellMode};
use gitscope_lib::git::shell::find_bash;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "gitscope-test-{name}-{}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

fn git(dir: &Path, args: &[&str]) {
    let status = Command::new("git")
        .current_dir(dir)
        .args(args)
        .env("GIT_AUTHOR_NAME", "Test")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .status()
        .expect("run git");
    assert!(status.success(), "git {args:?} failed");
}

#[test]
fn reads_history_and_runs_sandbox() {
    let root = temp_dir("engine");
    let env = GitEnv::new(root.join("gitconfig"));
    std::fs::write(
        &env.config_global,
        "[user]\n\tname = Test\n\temail = test@example.com\n",
    )
    .expect("write gitconfig");

    let repo_dir = root.join("repo");
    std::fs::create_dir_all(&repo_dir).expect("create repo dir");
    git(&repo_dir, &["init", "-b", "main"]);
    std::fs::write(repo_dir.join("README.md"), "# Test\n").expect("write readme");
    git(&repo_dir, &["add", "-A"]);
    git(&repo_dir, &["commit", "-m", "Initial commit"]);

    let info = repo::open_repo(&env, repo_dir.to_str().unwrap()).expect("open repo");
    assert_eq!(info.head_branch.as_deref(), Some("main"));
    assert!(!info.is_empty);

    let commits = repo::list_commits(&env, &repo_dir, None).expect("list commits");
    assert_eq!(commits.len(), 1);
    assert_eq!(commits[0].subject, "Initial commit");

    let details =
        repo::commit_details(&env, &repo_dir, &commits[0].sha).expect("commit details");
    assert_eq!(details.files.len(), 1);
    assert_eq!(details.files[0].path, "README.md");

    let diff = repo::commit_diff(&env, &repo_dir, &commits[0].sha).expect("commit diff");
    assert!(diff.patch.contains("README.md"));

    let sandbox_dir = root.join("sandbox");
    let spec: SandboxSpec = serde_json::from_str(
        r#"{
            "initialBranch": "main",
            "files": [{"path": "app.js", "content": "console.log(1);\n"}],
            "commits": [{"message": "Add app", "files": [{"path": "app.js", "content": "console.log(2);\n"}]}],
            "branches": [{"name": "feature", "from": "main", "commits": [{"message": "Feature", "files": [{"path": "feature.js", "content": "export {};\n"}]}]}],
            "merges": [{"into": "main", "from": "feature", "message": "Merge feature"}],
            "tags": [{"name": "v1", "target": "main"}],
            "untrackedFiles": [{"path": "draft.txt", "content": "draft\n"}]
        }"#,
    )
    .expect("parse spec");

    sandbox::create(&env, &sandbox_dir, &spec).expect("create sandbox");
    let state = repo::repo_state(&env, &sandbox_dir).expect("sandbox state");
    assert_eq!(state.head_branch.as_deref(), Some("main"));
    assert!(state.branches.iter().any(|branch| branch.name == "feature"));
    assert!(state.tags.contains(&"v1".to_string()));
    assert!(state.files.contains(&"app.js".to_string()));
    assert!(state.status.iter().any(|entry| entry.path == "draft.txt"));

    let result = sandbox::run_command(
        &env,
        &sandbox_dir,
        "/",
        "git switch feature",
        ShellMode::Safe,
    )
    .expect("switch branch");
    assert_eq!(result.code, 0);
    assert_eq!(result.state.head_branch.as_deref(), Some("feature"));

    let blocked = sandbox::run_command(&env, &sandbox_dir, "/", "git push", ShellMode::Safe);
    assert!(blocked.is_err(), "network commands must be blocked");

    let escape = sandbox::run_command(&env, &sandbox_dir, "/", "git log -C ..", ShellMode::Safe);
    assert!(escape.is_err(), "path escape must be blocked");

    let shell = sandbox::run_command(&env, &sandbox_dir, "/", "mkdir src", ShellMode::Safe)
        .expect("mkdir");
    assert_eq!(shell.code, 0);
    let shell = sandbox::run_command(&env, &sandbox_dir, "/", "cd src", ShellMode::Safe)
        .expect("cd");
    assert_eq!(shell.cwd, "/src");
    let shell = sandbox::run_command(
        &env,
        &sandbox_dir,
        "/src",
        "echo hello > note.txt",
        ShellMode::Safe,
    )
    .expect("echo redirect");
    assert_eq!(shell.code, 0);
    let shell = sandbox::run_command(
        &env,
        &sandbox_dir,
        "/src",
        "cat note.txt",
        ShellMode::Safe,
    )
    .expect("cat");
    assert_eq!(shell.stdout, "hello\n");
    let escape = sandbox::run_command(&env, &sandbox_dir, "/", "cd ../../..", ShellMode::Safe)
        .expect("cd clamp");
    assert_eq!(escape.cwd, "/");

    if find_bash().is_some() {
        let full = sandbox::run_command(
            &env,
            &sandbox_dir,
            "/",
            "echo linux | tr a-z A-Z",
            ShellMode::Full,
        )
        .expect("full shell");
        assert_eq!(full.stdout, "LINUX");
        assert_eq!(full.cwd, "/");
    }
}
