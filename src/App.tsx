import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import { buildOpenClawOnboardCommand } from "./lib/commandBuilder";
import { redactSecrets } from "./lib/redaction";
import type { PreflightResult, Provider, SetupOptions, VerificationResult } from "./lib/types";

type StepId =
  | "welcome"
  | "preflight"
  | "provider"
  | "gateway"
  | "review"
  | "run"
  | "verify"
  | "finish";

type SetupLog = {
  stream: "stdout" | "stderr";
  line: string;
};

type SetupComplete = {
  ok: boolean;
  code?: number;
  message?: string;
};

const steps: Array<{ id: StepId; label: string }> = [
  { id: "welcome", label: "Welcome" },
  { id: "preflight", label: "Preflight" },
  { id: "provider", label: "Provider" },
  { id: "gateway", label: "Gateway" },
  { id: "review", label: "Review" },
  { id: "run", label: "Run Setup" },
  { id: "verify", label: "Verify" },
  { id: "finish", label: "Finish" }
];

const providerLabels: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic"
};

const providerEnv: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY"
};

export default function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [provider, setProvider] = useState<Provider>("openai");
  const [gatewayPort, setGatewayPort] = useState(18789);
  const [installDaemon, setInstallDaemon] = useState(true);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [setupLogs, setSetupLogs] = useState<SetupLog[]>([]);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupComplete, setSetupComplete] = useState<SetupComplete | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const currentStep = steps[stepIndex].id;
  const options: SetupOptions = {
    provider,
    gatewayPort,
    gatewayBind: "loopback",
    installDaemon
  };

  const commandResult = useMemo(() => {
    try {
      return buildOpenClawOnboardCommand(options);
    } catch {
      return null;
    }
  }, [provider, gatewayPort, installDaemon]);

  useEffect(() => {
    let unlistenLog: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    void listen<{ runId: string; stream: "stdout" | "stderr"; line: string }>(
      "setup-log",
      (event) => {
        setSetupLogs((logs) => [
          ...logs,
          {
            stream: event.payload.stream,
            line: redactSecrets(event.payload.line)
          }
        ]);
      }
    ).then((unlisten) => {
      unlistenLog = unlisten;
    });

    void listen<{ runId: string; ok: boolean; code?: number; message?: string }>(
      "setup-complete",
      (event) => {
        setSetupBusy(false);
        setSetupComplete({
          ok: event.payload.ok,
          code: event.payload.code,
          message: redactSecrets(event.payload.message ?? "")
        });
      }
    ).then((unlisten) => {
      unlistenComplete = unlisten;
    });

    return () => {
      unlistenLog?.();
      unlistenComplete?.();
    };
  }, []);

  async function runPreflight() {
    setPreflightBusy(true);
    setPreflightError(null);

    try {
      const result = await invoke<PreflightResult>("run_preflight", {
        request: {
          provider,
          gatewayPort
        }
      });
      setPreflight(result);
    } catch (error) {
      setPreflightError(redactSecrets(String(error)));
    } finally {
      setPreflightBusy(false);
    }
  }

  async function runSetup() {
    if (!commandResult) {
      return;
    }

    setSetupLogs([]);
    setSetupComplete(null);
    setSetupBusy(true);
    setSetupLogs([
      {
        stream: "stdout",
        line: `Running ${commandResult.displayCommand}`
      }
    ]);

    try {
      const started = await invoke<{ runId: string }>("start_setup", {
        request: commandResult
      });
      setSetupLogs((logs) => [
        ...logs,
        {
          stream: "stdout",
          line: `Run id: ${started.runId}`
        }
      ]);
    } catch (error) {
      setSetupBusy(false);
      setSetupComplete({
        ok: false,
        message: redactSecrets(String(error))
      });
    }
  }

  async function runVerification() {
    setVerificationBusy(true);
    setVerificationError(null);

    try {
      const result = await invoke<VerificationResult>("run_verification", {
        installDaemon,
        gatewayPort
      });
      setVerification(result);
    } catch (error) {
      setVerificationError(redactSecrets(String(error)));
    } finally {
      setVerificationBusy(false);
    }
  }

  async function openDashboard() {
    setOpenError(null);

    try {
      await invoke("open_dashboard", { gatewayPort });
    } catch (error) {
      setOpenError(redactSecrets(String(error)));
    }
  }

  function goNext() {
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function goToStep(id: StepId) {
    setStepIndex(steps.findIndex((step) => step.id === id));
  }

  const canContinueFromRun = setupComplete?.ok === true;
  const canContinueFromVerify = verification?.ok === true;

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Setup steps">
        <div className="brand">
          <span className="brand-mark">OC</span>
          <div>
            <h1>OpenClaw Setup</h1>
            <p>Local installer wizard</p>
          </div>
        </div>

        <ol className="step-list">
          {steps.map((step, index) => (
            <li
              className={[
                "step-item",
                index === stepIndex ? "active" : "",
                index < stepIndex ? "complete" : ""
              ].join(" ")}
              key={step.id}
            >
              <span className="step-number">{index + 1}</span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
      </aside>

      <section className="wizard-panel">
        {currentStep === "welcome" && (
          <WizardStep title="Set up OpenClaw locally">
            <p className="lead">
              Set up OpenClaw locally in a few steps. This wizard will configure your
              model provider, start the Gateway, optionally install the daemon, and
              verify everything is working.
            </p>
            <div className="summary-grid">
              <SummaryItem label="Setup mode" value="Local only" />
              <SummaryItem label="Gateway bind" value="loopback" />
              <SummaryItem label="Default port" value="18789" />
              <SummaryItem label="Providers" value="OpenAI, Anthropic" />
            </div>
          </WizardStep>
        )}

        {currentStep === "preflight" && (
          <WizardStep title="Preflight checks">
            <p className="lead">
              The wizard checks whether OpenClaw is installed, the Gateway port is
              available, and the selected provider can be configured from the current
              environment.
            </p>
            <div className="inline-actions">
              <button className="primary" onClick={runPreflight} disabled={preflightBusy}>
                {preflightBusy ? "Checking..." : "Run Preflight"}
              </button>
              <span className="hint">
                Current provider: {providerLabels[provider]} ({providerEnv[provider]})
              </span>
            </div>
            {preflightError && <ErrorBox title="Preflight failed" message={preflightError} />}
            {preflight && <CheckList checks={preflight.checks} />}
          </WizardStep>
        )}

        {currentStep === "provider" && (
          <WizardStep title="Choose provider">
            <p className="lead">Choose the model provider OpenClaw should use.</p>
            <div className="option-grid">
              <ProviderCard
                active={provider === "openai"}
                description="Uses OPENAI_API_KEY from the environment."
                label="OpenAI"
                onClick={() => setProvider("openai")}
              />
              <ProviderCard
                active={provider === "anthropic"}
                description="Uses ANTHROPIC_API_KEY from the environment."
                label="Anthropic"
                onClick={() => setProvider("anthropic")}
              />
            </div>
          </WizardStep>
        )}

        {currentStep === "gateway" && (
          <WizardStep title="Gateway settings">
            <p className="lead">
              OpenClaw Gateway runs locally and powers the Control UI. The default port
              is 18789.
            </p>
            <div className="field-row">
              <label htmlFor="gateway-port">Gateway port</label>
              <input
                id="gateway-port"
                inputMode="numeric"
                max={65535}
                min={1}
                onChange={(event) => setGatewayPort(Number(event.target.value))}
                type="number"
                value={gatewayPort}
              />
            </div>
            <div className="field-row">
              <label>Gateway bind</label>
              <input readOnly value="loopback" />
            </div>
            <label className="checkbox-row">
              <input
                checked={installDaemon}
                onChange={(event) => setInstallDaemon(event.target.checked)}
                type="checkbox"
              />
              <span>Install the OpenClaw daemon</span>
            </label>
          </WizardStep>
        )}

        {currentStep === "review" && (
          <WizardStep title="Review setup command">
            <p className="lead">Review the setup command before running it.</p>
            {commandResult ? (
              <div className="command-box">{commandResult.displayCommand}</div>
            ) : (
              <ErrorBox
                title="Invalid gateway port"
                message="Gateway port must be an integer between 1 and 65535."
              />
            )}
            <details>
              <summary>Advanced command details</summary>
              <pre>{JSON.stringify(commandResult, null, 2)}</pre>
            </details>
          </WizardStep>
        )}

        {currentStep === "run" && (
          <WizardStep title="Setting up OpenClaw">
            <p className="lead">Setting up OpenClaw...</p>
            <div className="inline-actions">
              <button
                className="primary"
                disabled={!commandResult || setupBusy}
                onClick={runSetup}
              >
                {setupBusy ? "Running..." : setupComplete?.ok ? "Run Again" : "Run Setup"}
              </button>
              {setupComplete?.ok && <span className="status-ok">Setup completed.</span>}
            </div>
            {setupComplete && !setupComplete.ok && (
              <ErrorBox
                title="Setup failed"
                message={[
                  setupComplete.message ?? "The setup command failed.",
                  `Command: ${commandResult?.displayCommand ?? "openclaw onboard"}`,
                  "Next action: review the redacted logs, fix the reported issue, then retry."
                ].join("\n")}
              />
            )}
            <LogViewer logs={setupLogs} />
          </WizardStep>
        )}

        {currentStep === "verify" && (
          <WizardStep title="Verification">
            <p className="lead">Checking that OpenClaw is ready.</p>
            <div className="inline-actions">
              <button
                className="primary"
                disabled={verificationBusy}
                onClick={runVerification}
              >
                {verificationBusy ? "Checking..." : "Run Verification"}
              </button>
              {verification?.ok && <span className="status-ok">OpenClaw is ready.</span>}
            </div>
            {verificationError && (
              <ErrorBox title="Verification failed" message={verificationError} />
            )}
            {verification && <CheckList checks={verification.checks} />}
          </WizardStep>
        )}

        {currentStep === "finish" && (
          <WizardStep title="OpenClaw is set up">
            <p className="lead">
              OpenClaw is set up. You can now open the Control UI.
            </p>
            <div className="summary-grid">
              <SummaryItem label="Provider" value={providerLabels[provider]} />
              <SummaryItem label="Gateway" value={`http://127.0.0.1:${gatewayPort}/`} />
              <SummaryItem label="Daemon" value={installDaemon ? "Installed" : "Skipped"} />
              <SummaryItem label="Bind" value="loopback" />
            </div>
            <button className="primary large" onClick={openDashboard}>
              Open Dashboard
            </button>
            {openError && <ErrorBox title="Could not open dashboard" message={openError} />}
          </WizardStep>
        )}

        <footer className="wizard-footer">
          <button disabled={stepIndex === 0 || setupBusy || verificationBusy} onClick={goBack}>
            Back
          </button>
          <div className="footer-spacer" />
          {currentStep === "preflight" && (
            <button onClick={() => goToStep("provider")}>Continue Anyway</button>
          )}
          {currentStep === "run" && (
            <button disabled={!canContinueFromRun} onClick={goNext}>
              Continue
            </button>
          )}
          {currentStep === "verify" && (
            <button disabled={!canContinueFromVerify} onClick={goNext}>
              Continue
            </button>
          )}
          {!["run", "verify", "finish"].includes(currentStep) && (
            <button
              className="primary"
              disabled={currentStep === "review" && !commandResult}
              onClick={goNext}
            >
              Continue
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

function WizardStep({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="wizard-step">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function ProviderCard({
  active,
  description,
  label,
  onClick
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`provider-card ${active ? "selected" : ""}`} onClick={onClick}>
      <strong>{label}</strong>
      <span>{description}</span>
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CheckList({
  checks
}: {
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    message?: string;
    fix?: string;
    logs?: string;
  }>;
}) {
  return (
    <div className="check-list">
      {checks.map((check) => (
        <article className={`check-row ${check.ok ? "ok" : "bad"}`} key={check.id}>
          <span className="check-status">{check.ok ? "OK" : "Fix"}</span>
          <div>
            <strong>{check.label}</strong>
            {check.message && <p>{redactSecrets(check.message)}</p>}
            {check.fix && <p className="fix">{check.fix}</p>}
            {check.logs && (
              <details>
                <summary>Logs</summary>
                <pre>{redactSecrets(check.logs)}</pre>
              </details>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function LogViewer({ logs }: { logs: SetupLog[] }) {
  return (
    <details className="log-section" open>
      <summary>Live logs</summary>
      <div className="log-viewer" aria-live="polite">
        {logs.length === 0 ? (
          <span className="muted">Logs will appear here when setup starts.</span>
        ) : (
          logs.map((log, index) => (
            <div className={`log-line ${log.stream}`} key={`${log.stream}-${index}`}>
              <span>{log.stream}</span>
              <code>{redactSecrets(log.line)}</code>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

function ErrorBox({ message, title }: { message: string; title: string }) {
  return (
    <div className="error-box" role="alert">
      <strong>{title}</strong>
      <pre>{redactSecrets(message)}</pre>
    </div>
  );
}
