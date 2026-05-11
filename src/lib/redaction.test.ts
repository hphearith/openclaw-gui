import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redaction";

describe("redactSecrets", () => {
  it("masks OpenAI-style API keys", () => {
    const input = "Using sk-proj-abcdefghijklmnopqrstuvwxyz0123456789";

    expect(redactSecrets(input)).toBe("Using [REDACTED]");
  });

  it("masks Anthropic-style API keys", () => {
    const input = "Using sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";

    expect(redactSecrets(input)).toBe("Using [REDACTED]");
  });

  it("masks generic bearer-token-like strings", () => {
    const input = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789.TOKEN_value";

    expect(redactSecrets(input)).toBe("Authorization: Bearer [REDACTED]");
  });

  it("masks long opaque strings", () => {
    const input = "token=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    expect(redactSecrets(input)).toBe("token=[REDACTED]");
  });

  it("masks configured environment variable values", () => {
    const input = "OPENAI_API_KEY=known-secret-value";

    expect(redactSecrets(input, { OPENAI_API_KEY: "known-secret-value" })).toBe(
      "OPENAI_API_KEY=[REDACTED]"
    );
  });
});
