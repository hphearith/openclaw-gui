const REDACTION = "[REDACTED]";

const SECRET_PATTERNS: RegExp[] = [
  /sk-proj-[A-Za-z0-9_-]{16,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sk-ant-api\d{2}-[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{24,}/gi,
  /\b[A-Za-z0-9._~+/-]{48,}\b/g
];

const SECRET_ENV_NAME = /(API[_-]?KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL)/i;

export function redactSecrets(
  value: string,
  env: Record<string, string | undefined> = {}
): string {
  let redacted = value;

  for (const [name, secret] of Object.entries(env)) {
    if (!SECRET_ENV_NAME.test(name) || !secret || secret.length < 8) {
      continue;
    }

    redacted = redacted.split(secret).join(REDACTION);
  }

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match) =>
      match.toLowerCase().startsWith("bearer ") ? "Bearer [REDACTED]" : REDACTION
    );
  }

  return redacted;
}
