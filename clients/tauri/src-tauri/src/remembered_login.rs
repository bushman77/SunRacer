//! Opt-in persistent login in the OS vault, never a plaintext file.
//! Tauri local-only ACL plus main-window check restrict access to bundled UI.
use tauri::WebviewWindow;

fn valid_origin(origin: &str) -> bool {
    if origin.len() > 512 || !origin.is_ascii() { return false; }
    let Ok(url) = reqwest::Url::parse(origin) else { return false; };
    if origin != url.origin().ascii_serialization() || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    match url.scheme() {
        "https" => matches!(url.port_or_known_default(), Some(443 | 4000)),
        "http" => matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
            && url.port() == Some(4000),
        _ => false,
    }
}

fn valid_credential(value: &str) -> bool {
    !value.is_empty() && value.len() <= 2560 && value.bytes().all(|b| b.is_ascii_graphic())
}

#[tauri::command]
pub async fn remembered_credential(
    window: WebviewWindow, origin: String, operation: String, credential: Option<String>,
) -> Result<Option<String>, String> {
    crate::network::require_local(&window)?;
    if !valid_origin(&origin) { return Err("Invalid remembered-login server.".into()); }
    match (operation.as_str(), credential.as_deref()) {
        ("read" | "clear", None) => (),
        ("write", Some(value)) if valid_credential(value) => (),
        _ => return Err("Invalid remembered-login operation.".into()),
    }
    tauri::async_runtime::spawn_blocking(move || {
        let result = platform::access(&origin, &operation, credential.as_deref())?;
        if let Some(ref value) = result {
            if !valid_credential(value) { return Err("Invalid stored login credential.".into()); }
        }
        Ok(result)
    }).await.map_err(|_| "Credential storage task failed.".to_string())?
}

#[cfg(target_os = "linux")]
mod platform {
    use std::{io::Write, process::{Command, Stdio}};
    pub fn access(origin: &str, op: &str, secret: Option<&str>) -> Result<Option<String>, String> {
        let mut command = Command::new("secret-tool");
        match op {
            "read" => { command.arg("lookup"); }
            "clear" => { command.arg("clear"); }
            "write" => { command.args(["store", "--label=SpaceNova remembered login"]); }
            _ => return Err("Invalid credential operation.".into()),
        }
        command.args(["application", "game.sbs.space", "server", origin]);
        command.stdin(if op == "write" { Stdio::piped() } else { Stdio::null() });
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = command.spawn().map_err(|_| "OS credential vault unavailable (install libsecret-tools and unlock your keyring).".to_string())?;
        if let Some(value) = secret {
            let mut stdin = child.stdin.take().ok_or("Credential vault input unavailable.")?;
            stdin.write_all(value.as_bytes()).map_err(|_| "Credential vault write failed.")?;
        }
        let output = child.wait_with_output().map_err(|_| "Credential vault unavailable.")?;
        if !output.status.success() {
            if op != "write" && output.status.code() == Some(1) && output.stderr.is_empty() {
                return Ok(None);
            }
            return Err("OS credential vault unavailable or locked.".into());
        }
        if op == "read" {
            let value = String::from_utf8(output.stdout).map_err(|_| "Invalid stored credential.")?;
            let value = value.trim_end_matches(['\r', '\n']).to_owned();
            Ok(if value.is_empty() { None } else { Some(value) })
        } else { Ok(None) }
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use std::{ffi::c_void, ptr, slice};
    #[repr(C)]
    struct FileTime { low: u32, high: u32 }
    // Win32 CREDENTIALW; generic credentials are protected for the current user.
    #[repr(C)]
    struct Credential {
        flags: u32, kind: u32, target: *mut u16, comment: *mut u16,
        last_written: FileTime, blob_size: u32, blob: *mut u8,
        persist: u32, attribute_count: u32, attributes: *mut c_void,
        alias: *mut u16, username: *mut u16,
    }
    #[link(name = "Advapi32")]
    extern "system" {
        fn CredReadW(target: *const u16, kind: u32, flags: u32, credential: *mut *mut Credential) -> i32;
        fn CredWriteW(credential: *const Credential, flags: u32) -> i32;
        fn CredDeleteW(target: *const u16, kind: u32, flags: u32) -> i32;
        fn CredFree(buffer: *mut c_void);
    }
    #[link(name = "Kernel32")]
    extern "system" { fn GetLastError() -> u32; }
    const GENERIC: u32 = 1;
    const LOCAL_MACHINE: u32 = 2;
    const NOT_FOUND: u32 = 1168;
    fn wide(s: &str) -> Vec<u16> { s.encode_utf16().chain([0]).collect() }
    pub fn access(origin: &str, op: &str, secret: Option<&str>) -> Result<Option<String>, String> {
        let mut target = wide(&format!("game.sbs.space/remember/{origin}"));
        unsafe {
            match op {
                "read" => {
                    let mut entry = ptr::null_mut();
                    if CredReadW(target.as_ptr(), GENERIC, 0, &mut entry) == 0 {
                        return if GetLastError() == NOT_FOUND { Ok(None) } else { Err("Windows credential vault read failed.".into()) };
                    }
                    if entry.is_null() { return Err("Invalid Windows credential.".into()); }
                    let size = (*entry).blob_size as usize;
                    let result = if size > 0 && size <= 2560 && !(*entry).blob.is_null() {
                        String::from_utf8(slice::from_raw_parts((*entry).blob, size).to_vec())
                            .map(Some).map_err(|_| "Invalid stored credential.".to_string())
                    } else { Err("Invalid stored credential.".into()) };
                    CredFree(entry.cast());
                    result
                }
                "write" => {
                    let value = secret.ok_or("Missing remembered credential.")?;
                    let mut username = wide("SpaceNova");
                    let credential = Credential {
                        flags: 0, kind: GENERIC, target: target.as_mut_ptr(), comment: ptr::null_mut(),
                        last_written: FileTime { low: 0, high: 0 }, blob_size: value.len() as u32,
                        blob: value.as_ptr() as *mut u8, persist: LOCAL_MACHINE, attribute_count: 0,
                        attributes: ptr::null_mut(), alias: ptr::null_mut(), username: username.as_mut_ptr(),
                    };
                    if CredWriteW(&credential, 0) == 0 { Err("Windows credential vault write failed.".into()) } else { Ok(None) }
                }
                "clear" => {
                    if CredDeleteW(target.as_ptr(), GENERIC, 0) != 0 || GetLastError() == NOT_FOUND {
                        Ok(None)
                    } else { Err("Windows credential vault clear failed.".into()) }
                }
                _ => Err("Invalid credential operation.".into()),
            }
        }
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
mod platform {
    pub fn access(_: &str, _: &str, _: Option<&str>) -> Result<Option<String>, String> {
        Err("OS credential storage is not supported on this platform.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origin_and_credential_are_bounded() {
        assert!(valid_origin("https://sunracer.ddns.net"));
        assert!(valid_origin("http://127.0.0.1:4000"));
        assert!(!valid_origin("http://example.org:4000"));
        assert!(!valid_origin("https://example.org/path"));
        assert!(!valid_origin("https://name@example.org"));
        assert!(!valid_credential("token\n"));
        assert!(!valid_credential(&"a".repeat(2561)));
        assert!(valid_credential("test-token"));
    }
}
