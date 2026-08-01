#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowPolicy {
    pub label: &'static str,
    pub persist_position: bool,
    pub persist_size: bool,
}

pub const WINDOW_POLICIES: &[WindowPolicy] = &[
    WindowPolicy {
        label: "main",
        persist_position: true,
        persist_size: true,
    },
    WindowPolicy {
        label: "quickCapture",
        persist_position: true,
        persist_size: true,
    },
    WindowPolicy {
        label: "gameLauncher",
        persist_position: true,
        persist_size: true,
    },
    WindowPolicy {
        label: "calendar",
        persist_position: true,
        persist_size: false,
    },
    WindowPolicy {
        label: "calendarEditor",
        persist_position: true,
        persist_size: true,
    },
];

pub fn policy_for(label: &str) -> Option<&'static WindowPolicy> {
    WINDOW_POLICIES.iter().find(|policy| policy.label == label)
}

pub fn is_persisted(label: &str) -> bool {
    policy_for(label).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_for_returns_matching_policy() {
        let policy = policy_for("quickCapture").unwrap();
        assert!(policy.persist_position);
        assert!(policy.persist_size);
    }

    #[test]
    fn policy_for_returns_none_for_unsupported_windows() {
        assert!(policy_for("clock").is_none());
        assert!(policy_for("fileShelf").is_none());
        assert!(policy_for("unknown").is_none());
    }

    #[test]
    fn calendar_persists_position_only() {
        let policy = policy_for("calendar").unwrap();
        assert!(policy.persist_position);
        assert!(!policy.persist_size);
    }

    #[test]
    fn all_policies_are_unique() {
        let mut labels: Vec<&str> = WINDOW_POLICIES.iter().map(|policy| policy.label).collect();
        labels.sort_unstable();
        labels.dedup();
        assert_eq!(labels.len(), WINDOW_POLICIES.len());
    }
}
