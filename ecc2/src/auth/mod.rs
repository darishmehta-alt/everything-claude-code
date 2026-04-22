use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct OAuthCredentials {
    pub access_token: String,
    pub github_login: String,
    pub scope: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Not logged in. Run 'ecc login' to authenticate.")]
    NotLoggedIn,
    #[error("Credentials file is corrupt: {0}")]
    CorruptCredentials(String),
}

pub fn credentials_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".config")
        .join("ecc2")
        .join("credentials.json")
}

pub fn load_credentials_from_path(path: &PathBuf) -> Result<OAuthCredentials, AuthError> {
    if !path.exists() {
        return Err(AuthError::NotLoggedIn);
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| AuthError::CorruptCredentials(e.to_string()))?;
    let v: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| AuthError::CorruptCredentials(e.to_string()))?;
    let access_token = v["access_token"]
        .as_str()
        .ok_or_else(|| AuthError::CorruptCredentials("missing access_token".into()))?
        .to_string();
    let github_login = v["github_login"].as_str().unwrap_or("unknown").to_string();
    let scope = v["scope"].as_str().unwrap_or("").to_string();
    Ok(OAuthCredentials {
        access_token,
        github_login,
        scope,
    })
}

pub fn load_credentials() -> Result<OAuthCredentials, AuthError> {
    load_credentials_from_path(&credentials_path())
}

pub fn validate_bearer(bearer: &str, creds: &OAuthCredentials) -> bool {
    !bearer.is_empty() && bearer == creds.access_token
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_creds(dir: &TempDir, content: &str) -> PathBuf {
        let path = dir.path().join("credentials.json");
        fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn test_load_credentials_missing_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("credentials.json");
        let result = load_credentials_from_path(&path);
        assert!(matches!(result, Err(AuthError::NotLoggedIn)));
    }

    #[test]
    fn test_load_credentials_valid() {
        let dir = TempDir::new().unwrap();
        let content = r#"{"access_token":"gho_abc","token_type":"bearer","scope":"read:user","github_login":"testuser","stored_at":"2026-01-01T00:00:00Z"}"#;
        let path = write_creds(&dir, content);
        let result = load_credentials_from_path(&path).unwrap();
        assert_eq!(result.access_token, "gho_abc");
        assert_eq!(result.github_login, "testuser");
        assert_eq!(result.scope, "read:user");
    }

    #[test]
    fn test_load_credentials_corrupt_json() {
        let dir = TempDir::new().unwrap();
        let path = write_creds(&dir, "not json");
        let result = load_credentials_from_path(&path);
        assert!(matches!(result, Err(AuthError::CorruptCredentials(_))));
    }

    #[test]
    fn test_load_credentials_missing_token() {
        let dir = TempDir::new().unwrap();
        let path = write_creds(&dir, r#"{"github_login":"testuser"}"#);
        let result = load_credentials_from_path(&path);
        assert!(matches!(result, Err(AuthError::CorruptCredentials(_))));
    }

    #[test]
    fn test_validate_bearer_matches() {
        let creds = OAuthCredentials {
            access_token: "gho_abc123".into(),
            github_login: "testuser".into(),
            scope: "read:user".into(),
        };
        assert!(validate_bearer("gho_abc123", &creds));
    }

    #[test]
    fn test_validate_bearer_wrong_token() {
        let creds = OAuthCredentials {
            access_token: "gho_abc123".into(),
            github_login: "testuser".into(),
            scope: "read:user".into(),
        };
        assert!(!validate_bearer("wrong_token", &creds));
        assert!(!validate_bearer("", &creds));
    }
}
