// apps/app/src/services/ZendeskService.ts
// Shiftledger Phase 2 — Real Zendesk integration
// Token paste-and-validate + ticket polling for outcome verification
import crypto from "node:crypto";

const INTEGRATION_KEY = process.env.INTEGRATION_KEY ?? "shiftledger-dev-key-change-in-production";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Derive a 32-byte key from INTEGRATION_KEY using SHA-256.
 */
function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(INTEGRATION_KEY).digest();
}

export class ZendeskService {
  /**
   * Encrypt an API token for storage.
   * Uses AES-256-GCM with a random 16-byte IV.
   * Returns: base64(iv + authTag + ciphertext)
   */
  static encryptToken(token: string): string {
    const key = deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(token, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag();

    // Pack: iv (16) + authTag (16) + ciphertext
    return Buffer.concat([iv, authTag, Buffer.from(encrypted, "base64")]).toString("base64");
  }

  /**
   * Decrypt a stored token.
   */
  static decryptToken(packed: string): string {
    const key = deriveKey();
    const data = Buffer.from(packed, "base64");

    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const ciphertext = data.subarray(32).toString("base64");

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Validate an integration token by making a heartbeat call to the source-of-truth.
   *
   * For Zendesk: GET /api/v2/users/me.json
   * For Intercom: GET /me (with Bearer token)
   * For Salesforce: GET /services/data/vXX.0/ (with Bearer token)
   * For HubSpot: GET /crm/v3/objects/contacts?limit=1
   *
   * Phase 2 implements Zendesk fully. Other providers do a basic connectivity check.
   */
  static async validateToken(
    kind: string,
    apiToken: string,
  ): Promise<{ ok: boolean; details?: string }> {
    switch (kind) {
      case "zendesk":
        return ZendeskService.validateZendeskToken(apiToken);
      case "intercom":
        return ZendeskService.validateIntercomToken(apiToken);
      case "salesforce":
        return ZendeskService.validateSalesforceToken(apiToken);
      case "hubspot":
        return ZendeskService.validateHubSpotToken(apiToken);
      default:
        return { ok: false, details: `Unknown integration kind: ${kind}` };
    }
  }

  /**
   * Zendesk: GET /api/v2/users/me.json
   * Uses Basic auth with {email}/token:{apiToken}
   * The user must provide token in format "email/token:apiToken" or we try with a default.
   *
   * Expected format: user@domain.com:apiToken
   * We split on first ":" to get email and token.
   */
  private static async validateZendeskToken(token: string): Promise<{ ok: boolean; details?: string }> {
    const parts = token.split(":");
    if (parts.length < 2) {
      return { ok: false, details: "Invalid Zendesk token format. Use: your-email@domain.com:your-api-token" };
    }

    const email = parts[0];
    const apiKey = parts.slice(1).join(":"); // Support tokens that contain ":"
    const subdomain = process.env.ZENDESK_SUBDOMAIN || parts[0].split("@")[1]?.split(".")[0] || "";

    if (!email.includes("@")) {
      return { ok: false, details: "Zendesk token must include email. Format: email:token" };
    }

    // Resolve subdomain: try env var, then attempt auto-detection
    const zdSubdomain = process.env.ZENDESK_SUBDOMAIN || "";
    const url = zdSubdomain
      ? `https://${zdSubdomain}.zendesk.com/api/v2/users/me.json`
      : `https://${subdomain}.zendesk.com/api/v2/users/me.json`;

    try {
      const auth = Buffer.from(`${email}/token:${apiKey}`).toString("base64");
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, details: `Authenticated as ${data.user?.email || email}` };
      }

      if (response.status === 401) {
        return { ok: false, details: "Invalid Zendesk credentials" };
      }

      return { ok: false, details: `Zendesk returned HTTP ${response.status}` };
    } catch (err: any) {
      return { ok: false, details: `Zendesk connection failed: ${err.message}` };
    }
  }

  /**
   * Intercom: GET https://api.intercom.io/me with Bearer token
   */
  private static async validateIntercomToken(token: string): Promise<{ ok: boolean; details?: string }> {
    try {
      const response = await fetch("https://api.intercom.io/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Intercom-Version": "2.10",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, details: `Connected as ${data.app?.name || "Intercom app"}` };
      }

      if (response.status === 401) {
        return { ok: false, details: "Invalid Intercom access token" };
      }

      return { ok: false, details: `Intercom returned HTTP ${response.status}` };
    } catch (err: any) {
      return { ok: false, details: `Intercom connection failed: ${err.message}` };
    }
  }

  /**
   * Salesforce: GET /services/data/v60.0/ with Bearer token
   */
  private static async validateSalesforceToken(token: string): Promise<{ ok: boolean; details?: string }> {
    const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
    if (!instanceUrl) {
      return { ok: false, details: "SALESFORCE_INSTANCE_URL env var not set" };
    }

    try {
      const response = await fetch(`${instanceUrl}/services/data/v60.0/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return { ok: true, details: "Salesforce instance reachable" };
      }

      if (response.status === 401) {
        return { ok: false, details: "Invalid Salesforce access token" };
      }

      return { ok: false, details: `Salesforce returned HTTP ${response.status}` };
    } catch (err: any) {
      return { ok: false, details: `Salesforce connection failed: ${err.message}` };
    }
  }

  /**
   * HubSpot: GET /crm/v3/objects/contacts?limit=1
   */
  private static async validateHubSpotToken(token: string): Promise<{ ok: boolean; details?: string }> {
    try {
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return { ok: true, details: "HubSpot API reachable" };
      }

      if (response.status === 401) {
        return { ok: false, details: "Invalid HubSpot access token" };
      }

      return { ok: false, details: `HubSpot returned HTTP ${response.status}` };
    } catch (err: any) {
      return { ok: false, details: `HubSpot connection failed: ${err.message}` };
    }
  }

  /**
   * Real Zendesk verifier: poll GET /api/v2/tickets/{id} and check status.
   * This replaces the Phase 1 stub Verifier for Zendesk-based contracts.
   *
   * Returns the ticket state: cleared if status === 'solved', voided otherwise.
   */
  static async verifyZendeskTicket(
    ticketId: string,
    integrationToken: string,
    subdomain?: string,
  ): Promise<{
    cleared: boolean;
    status: "cleared" | "voided";
    externalId: string;
    details: Record<string, unknown>;
  }> {
    // Parse token (format: email:apiToken)
    const parts = integrationToken.split(":");
    if (parts.length < 2) {
      return {
        cleared: false,
        status: "voided",
        externalId: ticketId,
        details: { error: "Invalid token format" },
      };
    }

    const email = parts[0];
    const apiKey = parts.slice(1).join(":");

    const zdSubdomain = subdomain || process.env.ZENDESK_SUBDOMAIN || "";
    const url = zdSubdomain
      ? `https://${zdSubdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`
      : `https://${ticketId.split("-")[0]}.zendesk.com/api/v2/tickets/${ticketId}.json`;

    try {
      const auth = Buffer.from(`${email}/token:${apiKey}`).toString("base64");
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return {
          cleared: false,
          status: "voided",
          externalId: ticketId,
          details: { error: `HTTP ${response.status}`, httpStatus: response.status },
        };
      }

      const data = await response.json();
      const ticket = data.ticket;

      const isSolved = ticket?.status === "solved";

      return {
        cleared: isSolved,
        status: isSolved ? "cleared" : "voided",
        externalId: ticketId,
        details: {
          ticketStatus: ticket?.status,
          ticketSubject: ticket?.subject,
          resolvedBy: ticket?.assignee_id ? `assignee:${ticket.assignee_id}` : null,
          resolutionTimestamp: ticket?.updated_at || null,
          ticketUrl: ticket?.url || null,
        },
      };
    } catch (err: any) {
      return {
        cleared: false,
        status: "voided",
        externalId: ticketId,
        details: { error: err.message },
      };
    }
  }
}
