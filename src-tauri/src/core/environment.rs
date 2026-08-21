use std::path::PathBuf;

const DEVELOPMENT_NAMESPACE: &str = "development";

pub fn is_development() -> bool {
    cfg!(debug_assertions)
}

pub fn scoped_storage_dir(base: PathBuf) -> PathBuf {
    scoped_storage_dir_for_build(base, is_development())
}

pub fn scoped_service_name(base: &str) -> String {
    scoped_service_name_for_build(base, is_development())
}

pub fn autostart_app_name() -> &'static str {
    if is_development() {
        "mint-development"
    } else {
        "mint"
    }
}

fn scoped_storage_dir_for_build(base: PathBuf, development: bool) -> PathBuf {
    if development {
        base.join(DEVELOPMENT_NAMESPACE)
    } else {
        base
    }
}

fn scoped_service_name_for_build(base: &str, development: bool) -> String {
    if development {
        format!("{base}.{DEVELOPMENT_NAMESPACE}")
    } else {
        base.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn development_storage_uses_a_separate_child_directory() {
        let release_dir = PathBuf::from("user/mint");

        assert_eq!(
            scoped_storage_dir_for_build(release_dir.clone(), true),
            release_dir.join("development")
        );
        assert_eq!(
            scoped_storage_dir_for_build(release_dir.clone(), false),
            release_dir
        );
    }

    #[test]
    fn development_credentials_use_a_separate_service_name() {
        assert_eq!(
            scoped_service_name_for_build("com.ibuibu.mint", true),
            "com.ibuibu.mint.development"
        );
        assert_eq!(
            scoped_service_name_for_build("com.ibuibu.mint", false),
            "com.ibuibu.mint"
        );
    }
}
