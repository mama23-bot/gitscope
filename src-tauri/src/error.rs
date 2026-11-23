use serde::Serialize;

/// Ошибка, которую можно безопасно отдать во фронтенд.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub kind: String,
    pub message: String,
}

impl AppError {
    pub fn new(kind: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            kind: kind.into(),
            message: message.into(),
        }
    }

    pub fn git(message: impl Into<String>) -> Self {
        Self::new("git", message)
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new("io", message)
    }

    pub fn db(message: impl Into<String>) -> Self {
        Self::new("db", message)
    }

    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("invalid", message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("notFound", message)
    }

    pub fn policy(message: impl Into<String>) -> Self {
        Self::new("policy", message)
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self::new("timeout", message)
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::io(error.to_string())
    }
}

#[cfg(feature = "desktop")]
impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::db(error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("json", error.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
