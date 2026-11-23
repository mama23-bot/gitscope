pub mod error;
pub mod git;

#[cfg(feature = "desktop")]
mod commands;
#[cfg(feature = "desktop")]
mod db;

#[cfg(feature = "desktop")]
use std::sync::Mutex;

#[cfg(feature = "desktop")]
use tauri::Manager;

#[cfg(feature = "desktop")]
use crate::commands::AppState;

#[cfg(feature = "desktop")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            std::fs::create_dir_all(data_dir.join("sandboxes"))?;

            let git_config = data_dir.join("gitconfig");
            if !git_config.exists() {
                std::fs::write(
                    &git_config,
                    "[user]\n\tname = Ученик GitScope\n\temail = learner@gitscope.local\n[init]\n\tdefaultBranch = main\n[core]\n\tautocrlf = false\n",
                )?;
            }

            let connection = db::open(&data_dir.join("gitscope.db"))?;

            app.manage(AppState {
                db: Mutex::new(connection),
                data_dir,
                git_config,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::git_version,
            commands::app_info,
            commands::open_repo,
            commands::list_commits,
            commands::list_refs,
            commands::commit_details,
            commands::commit_diff,
            commands::repo_status,
            commands::recent_repos,
            commands::remove_recent_repo,
            commands::create_sandbox,
            commands::reset_sandbox,
            commands::run_sandbox_command,
            commands::sandbox_state,
            commands::destroy_sandbox,
            commands::get_progress,
            commands::save_progress,
            commands::get_settings,
            commands::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
