use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader},
    net::TcpListener,
    process::{Command, Stdio},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreflightRequest {
    provider: String,
    gateway_port: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckResult {
    id: String,
    label: String,
    ok: bool,
    message: Option<String>,
    fix: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreflightResult {
    ok: bool,
    checks: Vec<CheckResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetupRunRequest {
    command: String,
    args: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SetupRunStarted {
    run_id: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SetupLogEvent {
    run_id: String,
    stream: String,
    line: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SetupCompleteEvent {
    run_id: String,
    ok: bool,
    code: Option<i32>,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VerificationResult {
    ok: bool,
    checks: Vec<VerificationCheck>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VerificationCheck {
    id: String,
    label: String,
    ok: bool,
    message: Option<String>,
    logs: Option<String>,
}

#[tauri::command]
fn run_preflight(request: PreflightRequest) -> PreflightResult {
    let mut checks = Vec::new();

    let version = Command::new("openclaw").arg("--version").output();
    checks.push(match version {
        Ok(output) if output.status.success() => CheckResult {
            id: "openclaw-version".into(),
            label: "OpenClaw CLI installed".into(),
            ok: true,
            message: Some(redact(&String::from_utf8_lossy(&output.stdout))),
            fix: None,
        },
        Ok(output) => CheckResult {
            id: "openclaw-version".into(),
            label: "OpenClaw CLI installed".into(),
            ok: false,
            message: Some(redact(&String::from_utf8_lossy(&output.stderr))),
            fix: Some("Install OpenClaw CLI and make sure openclaw is on PATH.".into()),
        },
        Err(error) => CheckResult {
            id: "openclaw-version".into(),
            label: "OpenClaw CLI installed".into(),
            ok: false,
            message: Some(error.to_string()),
            fix: Some("Install OpenClaw CLI and make sure openclaw is on PATH.".into()),
        },
    });

    let port_ok = TcpListener::bind(("127.0.0.1", request.gateway_port)).is_ok();
    checks.push(CheckResult {
        id: "gateway-port".into(),
        label: format!("Gateway port {} available", request.gateway_port),
        ok: port_ok,
        message: if port_ok {
            Some("Port is available on 127.0.0.1.".into())
        } else {
            Some("Port is already in use on 127.0.0.1.".into())
        },
        fix: if port_ok {
            None
        } else {
            Some("Choose a different Gateway port or stop the process using this port.".into())
        },
    });

    let (env_name, label) = match request.provider.as_str() {
        "openai" => ("OPENAI_API_KEY", "OpenAI API key configured"),
        "anthropic" => ("ANTHROPIC_API_KEY", "Anthropic API key configured"),
        _ => ("", "Provider configured"),
    };
    let provider_ok =
        !env_name.is_empty() && std::env::var(env_name).is_ok_and(|value| !value.is_empty());
    checks.push(CheckResult {
        id: "provider-config".into(),
        label: label.into(),
        ok: provider_ok,
        message: if provider_ok {
            Some(format!("{} is present in the environment.", env_name))
        } else {
            Some(format!(
                "{} is not available to this app process.",
                env_name
            ))
        },
        fix: if provider_ok {
            None
        } else {
            Some(format!(
                "Set {} before launching the wizard, then rerun preflight.",
                env_name
            ))
        },
    });

    let ok = checks.iter().all(|check| check.ok);
    PreflightResult { ok, checks }
}

#[tauri::command]
fn start_setup(app: AppHandle, request: SetupRunRequest) -> Result<SetupRunStarted, String> {
    if request.command != "openclaw" {
        return Err("Only the openclaw command can be executed by this wizard.".into());
    }

    if request.args.first().map(String::as_str) != Some("onboard") {
        return Err("Only openclaw onboard can be executed by this wizard.".into());
    }

    let run_id = format!(
        "setup-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis()
    );
    let started = SetupRunStarted {
        run_id: run_id.clone(),
    };

    thread::spawn(move || {
        run_setup_process(app, run_id, request.args);
    });

    Ok(started)
}

#[tauri::command]
fn run_verification(install_daemon: bool, gateway_port: u16) -> VerificationResult {
    let mut checks = Vec::new();

    let version = run_command_capture("openclaw", &["--version"]);
    checks.push(VerificationCheck {
        id: "openclaw-installed".into(),
        label: "OpenClaw installed".into(),
        ok: version.ok,
        message: version.message.clone(),
        logs: Some(version.logs),
    });

    let doctor = run_command_capture("openclaw", &["doctor"]);
    checks.push(VerificationCheck {
        id: "provider-configured".into(),
        label: "Provider configured".into(),
        ok: doctor.ok,
        message: doctor.message.clone(),
        logs: Some(doctor.logs),
    });

    let gateway = run_command_capture("openclaw", &["gateway", "status"]);
    checks.push(VerificationCheck {
        id: "gateway-running".into(),
        label: "Gateway running".into(),
        ok: gateway.ok,
        message: gateway.message.clone(),
        logs: Some(gateway.logs),
    });

    checks.push(VerificationCheck {
        id: "daemon-installed".into(),
        label: "Daemon installed if requested".into(),
        ok: !install_daemon || doctor.ok,
        message: Some(if install_daemon {
            "Daemon installation was requested; openclaw doctor completed.".into()
        } else {
            "Daemon installation was not requested.".into()
        }),
        logs: None,
    });

    let ui_ok = TcpListener::bind(("127.0.0.1", gateway_port)).is_err();
    checks.push(VerificationCheck {
        id: "control-ui-reachable".into(),
        label: "Control UI reachable if possible".into(),
        ok: ui_ok,
        message: Some(if ui_ok {
            format!(
                "Something is listening on http://127.0.0.1:{}/.",
                gateway_port
            )
        } else {
            format!("Nothing is listening on 127.0.0.1:{} yet.", gateway_port)
        }),
        logs: None,
    });

    let ok = checks.iter().all(|check| check.ok);
    VerificationResult { ok, checks }
}

#[tauri::command]
fn open_dashboard(gateway_port: u16) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{}/", gateway_port);

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(["/C", "start", "", &url])
        .status()
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg(&url)
        .status()
        .map_err(|error| error.to_string())?;

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open")
        .arg(&url)
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Could not open {}", url))
    }
}

fn run_setup_process(app: AppHandle, run_id: String, args: Vec<String>) {
    let mut child = match Command::new("openclaw")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            let _ = app.emit(
                "setup-complete",
                SetupCompleteEvent {
                    run_id,
                    ok: false,
                    code: None,
                    message: Some(error.to_string()),
                },
            );
            return;
        }
    };

    let mut readers = Vec::new();
    if let Some(stdout) = child.stdout.take() {
        readers.push(spawn_log_reader(
            app.clone(),
            run_id.clone(),
            "stdout".into(),
            stdout,
        ));
    }
    if let Some(stderr) = child.stderr.take() {
        readers.push(spawn_log_reader(
            app.clone(),
            run_id.clone(),
            "stderr".into(),
            stderr,
        ));
    }

    let status = child.wait();
    for reader in readers {
        let _ = reader.join();
    }

    match status {
        Ok(status) => {
            let _ = app.emit(
                "setup-complete",
                SetupCompleteEvent {
                    run_id,
                    ok: status.success(),
                    code: status.code(),
                    message: if status.success() {
                        Some("Setup completed.".into())
                    } else {
                        Some(format!("Setup exited with code {:?}.", status.code()))
                    },
                },
            );
        }
        Err(error) => {
            let _ = app.emit(
                "setup-complete",
                SetupCompleteEvent {
                    run_id,
                    ok: false,
                    code: None,
                    message: Some(error.to_string()),
                },
            );
        }
    }
}

fn spawn_log_reader<R: std::io::Read + Send + 'static>(
    app: AppHandle,
    run_id: String,
    stream: String,
    reader: R,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let buffered = BufReader::new(reader);
        for line in buffered.lines().map_while(Result::ok) {
            let _ = app.emit(
                "setup-log",
                SetupLogEvent {
                    run_id: run_id.clone(),
                    stream: stream.clone(),
                    line: redact(&line),
                },
            );
        }
    })
}

struct CommandCapture {
    ok: bool,
    message: Option<String>,
    logs: String,
}

fn run_command_capture(command: &str, args: &[&str]) -> CommandCapture {
    match Command::new(command).args(args).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let logs = redact(&format!("{}{}", stdout, stderr));
            CommandCapture {
                ok: output.status.success(),
                message: Some(if output.status.success() {
                    "Command completed successfully.".into()
                } else {
                    format!("Command exited with code {:?}.", output.status.code())
                }),
                logs,
            }
        }
        Err(error) => CommandCapture {
            ok: false,
            message: Some(error.to_string()),
            logs: String::new(),
        },
    }
}

fn redact(input: &str) -> String {
    let mut result = input.to_string();

    for secret in secret_env_values() {
        result = result.replace(&secret, "[REDACTED]");
    }

    for token in input
        .split(|ch: char| ch.is_whitespace() || ch == '"' || ch == '\'' || ch == '=' || ch == ':')
    {
        if looks_like_secret(token) {
            result = result.replace(token, "[REDACTED]");
        }
    }

    result
}

fn secret_env_values() -> Vec<String> {
    std::env::vars()
        .filter(|(name, value)| {
            value.len() >= 8
                && (name.contains("KEY")
                    || name.contains("TOKEN")
                    || name.contains("SECRET")
                    || name.contains("PASSWORD")
                    || name.contains("AUTH")
                    || name.contains("CREDENTIAL"))
        })
        .map(|(_, value)| value)
        .collect()
}

fn looks_like_secret(token: &str) -> bool {
    let trimmed = token
        .trim_matches(|ch: char| ch == ',' || ch == ';' || ch == ')' || ch == ']' || ch == '}');

    trimmed.starts_with("sk-")
        || trimmed.starts_with("sk-proj-")
        || trimmed.starts_with("sk-ant-")
        || (trimmed.len() >= 48
            && trimmed
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || "._~+/-".contains(ch)))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_preflight,
            start_setup,
            run_verification,
            open_dashboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenClaw setup app");
}
