// apps/app/src/services/PiiScrubber.ts
// Phase 4: PII scrub in stdout logs (PRI-2323 task 6)
//
// Masks: integration tokens, pay addresses, customer emails before console.log.
// Replaces the raw values with [REDACTED] markers while preserving log structure.
//
// Usage:
//   import { scrubLog } from "./services/PiiScrubber.js";
//   console.log(scrubLog(JSON.stringify({ email: "user@example.com" })));
//
// Or wrap console.log globally in server.ts.

const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PAY_ADDRESS_RE = /(pay_address|payAddress)["\s:]*([Tt0-9A-Za-z]{25,45})/g;
const TOKEN_RE = /(api_token_encrypted|apiToken|api_token)["\s:]*"([A-Za-z0-9+/=]{20,})"/gi;
const BEARER_RE = /Bearer\s+([A-Za-z0-9._\-+/=]{20,})/g;
const HMAC_RE = /HMAC-SHA512\s+([a-f0-9]{64,})/gi;

/**
 * Scrub PII from a log string.
 * Returns the string with sensitive values replaced by [REDACTED].
 * Idempotent: calling scrubLog twice on the same string is safe.
 */
export function scrubLog(raw: string): string {
  let result = raw;

  // Customer emails → [REDACTED_EMAIL]
  result = result.replace(EMAIL_RE, (_match, email) => {
    // Skip obvious non-PII emails (system, noreply, etc.)
    if (/^(noreply|no-reply|system|admin|desk|hello|hi|support|info|contact)@/i.test(email)) {
      return email;
    }
    // Preserve domain for debugging
    const domain = email.split("@")[1] ?? "unknown";
    return `[REDACTED_EMAIL@${domain}]`;
  });

  // Pay addresses (crypto addresses in NOWPayments fields)
  result = result.replace(PAY_ADDRESS_RE, '$1:"[REDACTED_PAY_ADDRESS]"');

  // Encrypted API tokens (base64 strings in api_token_encrypted fields)
  result = result.replace(TOKEN_RE, '$1:"[REDACTED_TOKEN]"');

  // Bearer tokens in auth headers
  result = result.replace(BEARER_RE, "Bearer [REDACTED_TOKEN]");

  // HMAC signatures in debug logs
  result = result.replace(HMAC_RE, "HMAC-SHA512 [REDACTED_SIG]");

  return result;
}

/**
 * Create a safe console.log wrapper that scrubs all arguments.
 */
export function createSafeLogger(originalLog: typeof console.log) {
  return (...args: unknown[]): void => {
    const safe = args.map((arg) => {
      if (typeof arg === "string") return scrubLog(arg);
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.parse(scrubLog(JSON.stringify(arg)));
        } catch {
          return arg;
        }
      }
      return arg;
    });
    originalLog(...safe);
  };
}

/**
 * Install PII-scrubbed console.log globally.
 * Call once at server startup.
 */
export function installPiiScrubbing(): void {
  const originalLog = console.log.bind(console);
  const safeLog = createSafeLogger(originalLog);

  console.log = safeLog;

  // Also scrub console.error (may contain stack traces with PII)
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]): void => {
    const safe = args.map((arg) => {
      if (typeof arg === "string") return scrubLog(arg);
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.parse(scrubLog(JSON.stringify(arg)));
        } catch {
          return arg;
        }
      }
      return arg;
    });
    originalError(...safe);
  };

  console.log("[pii_scrubber] PII scrubbing installed on console.log and console.error");
}
