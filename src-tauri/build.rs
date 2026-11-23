fn main() {
    // Без desktop-фичи Tauri не собирается: тесты git-движка не должны
    // тянуть WebView2 и генерировать контекст приложения.
    if std::env::var_os("CARGO_FEATURE_DESKTOP").is_none() {
        return;
    }

    let mut windows_attributes = tauri_build::WindowsAttributes::new();

    // MinGW windres не умеет открывать файлы по путям с не-ASCII символами.
    // Если проект лежит в таком пути (например, в профиле с кириллицей),
    // кладём копию иконки в ASCII-локацию и указываем её сборщику ресурсов.
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let source = std::path::Path::new(&manifest_dir)
            .join("icons")
            .join("icon.ico");

        if source.exists() {
            let canonical = std::fs::canonicalize(&source).unwrap_or_else(|_| source.clone());

            if !canonical.to_string_lossy().is_ascii() {
                let target = std::path::PathBuf::from(r"C:\Users\Public\GitScope\icon.ico");

                if let Some(parent) = target.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }

                if std::fs::copy(&source, &target).is_ok() {
                    windows_attributes = windows_attributes.window_icon_path(&target);
                }
            }
        }
    }

    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows_attributes))
        .expect("failed to run tauri-build");
}
