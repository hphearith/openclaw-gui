import { describe, expect, it } from "vitest";
import { buildOpenClawOnboardCommand } from "./commandBuilder";
import type { SetupOptions } from "./types";

const baseOptions: SetupOptions = {
  provider: "openai",
  gatewayPort: 18789,
  gatewayBind: "loopback",
  installDaemon: true
};

describe("buildOpenClawOnboardCommand", () => {
  it("builds OpenAI local setup with daemon enabled", () => {
    const command = buildOpenClawOnboardCommand(baseOptions);

    expect(command.command).toBe("openclaw");
    expect(command.args).toEqual([
      "onboard",
      "--non-interactive",
      "--mode",
      "local",
      "--auth-choice",
      "openai-api-key",
      "--gateway-port",
      "18789",
      "--gateway-bind",
      "loopback",
      "--json",
      "--install-daemon"
    ]);
  });

  it("builds OpenAI local setup with daemon disabled", () => {
    const command = buildOpenClawOnboardCommand({
      ...baseOptions,
      installDaemon: false
    });

    expect(command.args).not.toContain("--install-daemon");
  });

  it("builds Anthropic local setup with daemon enabled", () => {
    const command = buildOpenClawOnboardCommand({
      ...baseOptions,
      provider: "anthropic"
    });

    expect(command.args).toContain("apiKey");
    expect(command.args).toContain("--install-daemon");
  });

  it("builds Anthropic local setup with daemon disabled", () => {
    const command = buildOpenClawOnboardCommand({
      ...baseOptions,
      provider: "anthropic",
      installDaemon: false
    });

    expect(command.args).toContain("apiKey");
    expect(command.args).not.toContain("--install-daemon");
  });

  it("supports a custom valid port", () => {
    const command = buildOpenClawOnboardCommand({
      ...baseOptions,
      gatewayPort: 19876
    });

    expect(command.args).toContain("19876");
  });

  it("rejects invalid ports", () => {
    expect(() =>
      buildOpenClawOnboardCommand({
        ...baseOptions,
        gatewayPort: 70000
      })
    ).toThrow("Gateway port must be an integer between 1 and 65535.");
  });

  it("does not expose secrets in display commands", () => {
    const command = buildOpenClawOnboardCommand(baseOptions);

    expect(command.displayCommand).not.toMatch(/sk-/);
    expect(command.displayCommand).toBe(
      "openclaw onboard --non-interactive --mode local --auth-choice openai-api-key --gateway-port 18789 --gateway-bind loopback --json --install-daemon"
    );
  });
});
