import { redactSecrets } from "./redaction";
import type { CommandBuildResult, SetupOptions } from "./types";

const MIN_PORT = 1;
const MAX_PORT = 65535;

const PROVIDER_AUTH_FLAGS: Record<SetupOptions["provider"], string> = {
  openai: "openai-api-key",
  anthropic: "apiKey"
};

export function validateGatewayPort(port: number): void {
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error("Gateway port must be an integer between 1 and 65535.");
  }
}

export function buildOpenClawOnboardCommand(options: SetupOptions): CommandBuildResult {
  validateGatewayPort(options.gatewayPort);

  const args = [
    "onboard",
    "--non-interactive",
    "--mode",
    "local",
    "--auth-choice",
    PROVIDER_AUTH_FLAGS[options.provider],
    "--gateway-port",
    String(options.gatewayPort),
    "--gateway-bind",
    options.gatewayBind,
    "--json"
  ];

  if (options.installDaemon) {
    args.push("--install-daemon");
  }

  const displayCommand = redactSecrets(
    ["openclaw", ...args.map((arg) => quoteShellArg(arg))].join(" ")
  );

  return {
    command: "openclaw",
    args,
    displayCommand
  };
}

function quoteShellArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/(["\\$`])/g, "\\$1")}"`;
}
