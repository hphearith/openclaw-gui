export type Provider = "openai" | "anthropic";

export type SetupOptions = {
  provider: Provider;
  gatewayPort: number;
  gatewayBind: "loopback";
  installDaemon: boolean;
};

export type PreflightResult = {
  ok: boolean;
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    message?: string;
    fix?: string;
  }>;
};

export type CommandBuildResult = {
  command: "openclaw";
  args: string[];
  displayCommand: string;
};

export type VerificationResult = {
  ok: boolean;
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    message?: string;
    logs?: string;
  }>;
};
