const KEYRING_SERVICE: &str = "com.ibuibu.mint";
const ALLOWED_SERVICES: &[&str] = &["voice_to_text"];

fn validate_service(service: &str) -> Result<(), String> {
    if ALLOWED_SERVICES.contains(&service) {
        Ok(())
    } else {
        Err(format!("Unauthorized service: {service}"))
    }
}

pub fn load_api_key(service: String) -> Result<String, String> {
    validate_service(&service)?;
    let entry = keyring::Entry::new(&format!("{KEYRING_SERVICE}.{service}"), "api_key")
        .map_err(|error| error.to_string())?;

    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn save_api_key(service: String, key: String) -> Result<(), String> {
    validate_service(&service)?;
    let entry = keyring::Entry::new(&format!("{KEYRING_SERVICE}.{service}"), "api_key")
        .map_err(|error| error.to_string())?;

    if key.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    } else {
        entry.set_password(&key).map_err(|error| error.to_string())
    }
}
