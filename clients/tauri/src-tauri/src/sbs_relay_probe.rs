//! Opt-in TLS-only headset LAN pairing proof. Stage 1 only: NO game data,
//! assets, remote Phoenix bridge or control commands. The proof is single-use.
use ring::{constant_time, rand::{SecureRandom, SystemRandom}};
use serde::Serialize;
use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::WebviewWindow;
use tokio::{
    io::{AsyncReadExt, AsyncWrite, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::{Mutex as AsyncMutex, Semaphore},
    time::timeout,
};
use tokio_rustls::{
    rustls::{pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer}, ServerConfig},
    TlsAcceptor,
};

const TTL: Duration = Duration::from_secs(600);
const MAX_HEADERS: usize = 8192;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);

const PROOF_PAGE: &str = r##"<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Space Nova - LAN Relay Proof</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#030b16;color:#d9fff5;font:16px system-ui,sans-serif}
main{max-width:26rem;border:1px solid #56d3c2;border-radius:12px;padding:1.5rem;margin:1rem;background:#0b2530}
h1{font-size:1.25rem;margin-top:0}small{color:#a1c5ca}
</style></head><body><main><h1>SPACE NOVA - LOCAL LINK</h1>
<p id="status" role="status">Checking secure laptop connection...</p>
<small>Stage 1 test only: no game state or graphics transfer.</small>
</main><script>
(async()=>{
  const status=document.querySelector("#status");
  // Only the same laptop's existing HTTPS headset page can receive this
  // boolean confirmation. Never post the invitation or game credentials.
  const report=(passed)=>{
    if(window.parent!==window){
      window.parent.postMessage(
        {type:"space-nova:relay-proof",passed},
        "https://"+location.hostname+":4443");
    }
  };
  const token=location.hash.startsWith("#")?location.hash.slice(1):"";
  history.replaceState(null,"","/relay-check");
  if(!/^[0-9a-f]{48}$/.test(token)){
    status.textContent="Invalid local invitation. Scan a fresh PILOT HMD QR code.";
    report(false);
    return;
  }
  try{
    const result=await fetch("/relay/prove",{method:"POST",
      headers:{"Authorization":"Bearer "+token},
      cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"});
    status.textContent=result.ok
      ?"SECURE LAN LINK CONFIRMED. The phone reached your Tauri client directly over trusted HTTPS."
      :"Invitation expired, already used, or rejected. Restart the test from the laptop.";
    report(result.ok);
  }catch{
    status.textContent="Connection failed. Check LAN reachability and the trusted TLS certificate.";
    report(false);
  }
})();
</script></body></html>"##;

#[derive(Serialize)]
pub struct ProbeInfo {
    pub url: String,
    pub expires_seconds: u64,
    pub warning: &'static str,
}
#[derive(Serialize)]
pub struct ProbeStatus {
    pub running: bool,
    pub verified: bool,
}

struct Shared {
    token: AsyncMutex<Option<String>>,
    expires: Instant,
    verified: AtomicBool,
}
struct Active {
    task: tauri::async_runtime::JoinHandle<()>,
    shared: Arc<Shared>,
}
static ACTIVE: OnceLock<Mutex<Option<Active>>> = OnceLock::new();
fn active() -> &'static Mutex<Option<Active>> {
    ACTIVE.get_or_init(|| Mutex::new(None))
}

fn private_lan(ip: Ipv4Addr) -> bool {
    let [a,b,c,d] = ip.octets();
    d != 0 && d != 255 &&
        (a == 10 || (a == 172 && (16..=31).contains(&b)) ||
         (a == 192 && b == 168) || (a == 100 && (64..=127).contains(&b)))
}
fn bind_address() -> Result<SocketAddr, String> {
    let raw = std::env::var("SPACE_NOVA_SBS_BIND")
        .map_err(|_| "Set SPACE_NOVA_SBS_BIND=your-LAN-IP:4455 before launching Tauri.")?;
    let address: SocketAddr = raw.parse()
        .map_err(|_| "SPACE_NOVA_SBS_BIND must be a private IPv4 address with a port.")?;
    match address {
        SocketAddr::V4(a) if a.port() >= 1024 && private_lan(*a.ip()) => Ok(address),
        _ => Err("SBS requires an explicit private IPv4 address, not 0.0.0.0, loopback or a public address.".into()),
    }
}
fn tls_config() -> Result<Arc<ServerConfig>, String> {
    let cert = std::env::var("SPACE_NOVA_SBS_CERT")
        .map_err(|_| "Set SPACE_NOVA_SBS_CERT to your trusted PEM certificate.")?;
    let key = std::env::var("SPACE_NOVA_SBS_KEY")
        .map_err(|_| "Set SPACE_NOVA_SBS_KEY to your matching PEM private key.")?;
    let certs: Vec<CertificateDer<'static>> = CertificateDer::pem_file_iter(&cert)
        .map_err(|error| format!("SBS certificate cannot be read: {error}"))?
        .collect::<Result<_, _>>()
        .map_err(|error| format!("SBS certificate invalid: {error}"))?;
    if certs.is_empty() {return Err("SBS certificate PEM is empty.".into())}
    let key = PrivateKeyDer::from_pem_file(&key)
        .map_err(|error| format!("SBS key cannot be loaded: {error}"))?;
    let config = ServerConfig::builder().with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(|error| format!("SBS TLS certificate/key invalid: {error}"))?;
    Ok(Arc::new(config))
}
fn random_token() -> Result<String, String> {
    let mut bytes = [0u8; 24];
    SystemRandom::new().fill(&mut bytes)
        .map_err(|_| "Secure random generator unavailable; refusing pairing.".to_string())?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

#[tauri::command]
pub async fn start_sbs_relay_probe(window: WebviewWindow) -> Result<ProbeInfo, String> {
    crate::network::require_local(&window)?;
    if window.label() != "main" {
        return Err("The SBS relay requires the local Tauri main game window.".into())
    }
    if active().lock().map_err(|_| "Relay state locked.")?.is_some() {
        return Err("SBS test already running. Stop it before making another invitation.".into())
    }
    // Validate cert and exact LAN address before binding; NEVER use plain HTTP.
    let address = bind_address()?;
    let config = tls_config()?;
    let token = random_token()?;
    let listener = TcpListener::bind(address).await
        .map_err(|error| format!("Unable to bind secure SBS listener: {error}"))?;
    let shared = Arc::new(Shared {
        token: AsyncMutex::new(Some(token.clone())),
        expires: Instant::now() + TTL,
        verified: AtomicBool::new(false),
    });
    let task_shared = Arc::clone(&shared);
    let task = tauri::async_runtime::spawn(async move {
        serve(listener, TlsAcceptor::from(config), task_shared, address).await;
    });
    let mut state = active().lock().map_err(|_| "Relay state locked.")?;
    if state.is_some() {
        task.abort();
        return Err("SBS test started concurrently. Try again.".into())
    }
    *state = Some(Active {task, shared});
    Ok(ProbeInfo {
        // Fragment is never sent to the LAN server. JS immediately clears it.
        url: format!("https://{address}/relay-check#{token}"),
        expires_seconds: TTL.as_secs(),
        warning: "The phone must trust the laptop's TLS certificate. This is a one-time connection proof, not a game-state relay.",
    })
}

#[tauri::command]
pub fn sbs_relay_probe_status(window: WebviewWindow) -> Result<ProbeStatus, String> {
    crate::network::require_local(&window)?;
    let state = active().lock().map_err(|_| "Relay state locked.")?;
    Ok(match state.as_ref() {
        Some(p) => ProbeStatus {running: true, verified: p.shared.verified.load(Ordering::Acquire)},
        None => ProbeStatus {running: false, verified: false},
    })
}

#[tauri::command]
pub fn stop_sbs_relay_probe(window: WebviewWindow) -> Result<(), String> {
    crate::network::require_local(&window)?;
    if let Some(p) = active().lock().map_err(|_| "Relay state locked.")?.take() {
        p.task.abort();
    }
    Ok(())
}

async fn serve(listener: TcpListener, tls: TlsAcceptor, shared: Arc<Shared>, address: SocketAddr) {
    let clients = Arc::new(Semaphore::new(8));
    loop {
        let Ok((socket, peer)) = listener.accept().await else {break};
        if !matches!(peer.ip(), IpAddr::V4(ip) if private_lan(ip) || ip.is_loopback()) {
            continue;
        }
        let Ok(permit) = Arc::clone(&clients).try_acquire_owned() else {continue};
        let tls = tls.clone();
        let shared = Arc::clone(&shared);
        tauri::async_runtime::spawn(async move {
            let _permit = permit;
            let _ = timeout(REQUEST_TIMEOUT, serve_one(socket, tls, shared, address)).await;
        });
    }
}

async fn serve_one(socket: TcpStream, acceptor: TlsAcceptor,
                   shared: Arc<Shared>, address: SocketAddr) -> std::io::Result<()> {
    let mut stream = acceptor.accept(socket).await?;
    let mut data = Vec::with_capacity(1024);
    let mut buffer = [0u8; 1024];
    while !data.windows(4).any(|w| w == b"\r\n\r\n") {
        let size = stream.read(&mut buffer).await?;
        if size == 0 {return Ok(())}
        data.extend_from_slice(&buffer[..size]);
        if data.len() > MAX_HEADERS {
            return respond(&mut stream, 431, "text/plain", "Request too large.").await
        }
    }
    let request = match std::str::from_utf8(&data) {
        Ok(s) => s,
        Err(_) => return respond(&mut stream, 400, "text/plain", "Invalid request.").await,
    };
    let (method, path, bearer) = match parse_request(request, address) {
        Some(x) => x,
        None => return respond(&mut stream, 400, "text/plain", "Invalid request.").await,
    };
    match (method, path) {
        ("GET", "/relay-check") =>
            respond(&mut stream, 200, "text/html; charset=utf-8", PROOF_PAGE).await,
        ("POST", "/relay/prove") => {
            let mut secret = shared.token.lock().await;
            let correct = Instant::now() < shared.expires &&
                secret.as_deref().is_some_and(|expected|
                    bearer.is_some_and(|candidate|
                        constant_time::verify_slices_are_equal(
                            expected.as_bytes(), candidate.as_bytes()).is_ok()));
            if correct {
                *secret = None;
                shared.verified.store(true, Ordering::Release);
            }
            drop(secret);
            if correct {
                respond(&mut stream, 200, "application/json",
                    r#"{"ok":true,"scope":"one_time_tls_proof","game_state":false}"#).await
            } else {
                respond(&mut stream, 401, "application/json", r#"{"ok":false}"#).await
            }
        }
        _ => respond(&mut stream, 404, "text/plain", "Not found.").await,
    }
}

fn parse_request<'a>(headers: &'a str, address: SocketAddr)
    -> Option<(&'a str, &'a str, Option<&'a str>)> {
    let mut parts = headers.split("\r\n");
    let mut first = parts.next()?.split_ascii_whitespace();
    let method = first.next()?;
    let path = first.next()?;
    if first.next()? != "HTTP/1.1" || first.next().is_some() {return None}
    let mut host = false;
    let mut bearer = None;
    for line in parts {
        if line.is_empty() {break}
        let (name, value) = line.split_once(':')?;
        let value = value.trim();
        if name.eq_ignore_ascii_case("host") {
            if host || value != address.to_string() {return None}
            host = true;
        } else if name.eq_ignore_ascii_case("authorization") {
            if bearer.is_some() {return None}
            bearer = value.strip_prefix("Bearer ");
        } else if name.eq_ignore_ascii_case("content-length") {
            if value != "0" {return None}
        } else if name.eq_ignore_ascii_case("transfer-encoding") {
            return None;
        }
    }
    host.then_some((method, path, bearer))
}

async fn respond<S: AsyncWrite + Unpin>(
    stream: &mut S, code: u16, content_type: &str, body: &str,
) -> std::io::Result<()> {
    let status = match code {
        200 => "OK", 400 => "Bad Request", 401 => "Unauthorized",
        404 => "Not Found", 431 => "Request Header Fields Too Large", _ => "Error",
    };
    let head = format!(
        "HTTP/1.1 {code} {status}\r\nContent-Type: {content_type}\r\n\
         Content-Length: {}\r\nCache-Control: no-store\r\n\
         Referrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\n\
         Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; \
         style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'\r\n\
         Connection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes()).await?;
    stream.write_all(body.as_bytes()).await?;
    stream.shutdown().await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn listener_accepts_only_explicit_private_addresses() {
        for ip in ["8.8.8.8", "127.0.0.1", "0.0.0.0", "169.254.1.10"] {
            assert!(!private_lan(ip.parse().unwrap()), "{ip}");
        }
        for ip in ["10.1.2.3", "172.31.2.3", "192.168.1.3", "100.100.1.3"] {
            assert!(private_lan(ip.parse().unwrap()), "{ip}");
        }
    }
    #[test]
    fn malformed_http_and_cross_host_requests_fail() {
        let addr = "192.168.1.8:4455".parse().unwrap();
        assert!(parse_request(
            "POST /relay/prove HTTP/1.1\r\nHost: 192.168.1.8:4455\r\nAuthorization: Bearer x\r\nContent-Length: 0\r\n\r\n", addr
        ).is_some());
        assert!(parse_request("GET /relay-check HTTP/1.1\r\nHost: evil.invalid\r\n\r\n", addr).is_none());
        assert!(parse_request("POST /relay/prove HTTP/1.1\r\nHost: 192.168.1.8:4455\r\nTransfer-Encoding: chunked\r\n\r\n", addr).is_none());
    }
    #[test]
    fn invitations_use_192_bits_of_os_randomness() {
        let first = random_token().unwrap();
        let second = random_token().unwrap();
        assert_eq!(first.len(), 48);
        assert_ne!(first, second);
        assert!(first.bytes().all(|b| b.is_ascii_hexdigit()));
    }
}
