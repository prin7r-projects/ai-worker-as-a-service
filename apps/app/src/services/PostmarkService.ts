// apps/app/src/services/PostmarkService.ts
// Shiftledger Phase 3 — Magic-link onboarding email via Postmark
//
// Sends a magic-link onboarding email after a successful payment.
// Template alias: "shiftledger-onboarding" (configured in Postmark dashboard).
// Falls back to a plaintext email if the template is not configured.

export interface OnboardingEmailArgs {
  toEmail: string;
  contractId: string;
  workerProfileName: string;
  tier: string;
  dashboardUrl: string;
}

export class PostmarkService {
  /**
   * Send a magic-link onboarding email to the customer after payment.
   * Uses the Postmark template alias "shiftledger-onboarding" if configured,
   * otherwise sends a simple HTML email.
   */
  static async sendOnboardingEmail(args: OnboardingEmailArgs): Promise<{ ok: boolean; messageId?: string }> {
    const apiKey = process.env.POSTMARK_API_KEY;
    if (!apiKey) {
      console.log(`[Postmark] POSTMARK_API_KEY not set — skipping onboarding email for ${args.toEmail}`);
      return { ok: false };
    }

    const fromEmail = process.env.POSTMARK_FROM_EMAIL ?? "desk@ai-worker-as-a-service.prin7r.com";

    const hasTemplate = Boolean(process.env.POSTMARK_TEMPLATE_ALIAS);

    if (hasTemplate) {
      // Use template-based email
      try {
        const response = await fetch("https://api.postmarkapp.com/email/withTemplate", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": apiKey,
          },
          body: JSON.stringify({
            From: fromEmail,
            To: args.toEmail,
            TemplateAlias: process.env.POSTMARK_TEMPLATE_ALIAS || "shiftledger-onboarding",
            TemplateModel: {
              contractId: args.contractId,
              workerProfileName: args.workerProfileName,
              tier: args.tier,
              dashboardUrl: args.dashboardUrl,
              subject: `Your Shiftledger ${args.tier} pool is open — start here`,
            },
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { MessageID?: string };
          console.log(`[Postmark] Onboarding email sent to ${args.toEmail} — MessageID: ${data.MessageID}`);
          return { ok: true, messageId: data.MessageID };
        }

        const errorText = await response.text();
        console.error(`[Postmark] Failed to send onboarding email: HTTP ${response.status} — ${errorText.slice(0, 200)}`);
        return { ok: false };
      } catch (err) {
        console.error(`[Postmark] Error sending onboarding email: ${(err as Error).message}`);
        return { ok: false };
      }
    }

    // Fallback: simple HTML email
    try {
      const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #111827;">Your Shiftledger pool is open</h1>
  <p style="font-size: 16px; color: #374151;">Your <strong>${args.tier}</strong> pool for <strong>${args.workerProfileName}</strong> is active and your first shift has been scheduled.</p>
  <p style="font-size: 16px; color: #374151;">Contract ID: <code style="background: #F3F4F6; padding: 2px 6px; border-radius: 4px;">${args.contractId}</code></p>
  <p>
    <a href="${args.dashboardUrl}" style="display: inline-block; background: #111827; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
      Open your dashboard
    </a>
  </p>
  <p style="font-size: 14px; color: #6B7280; margin-top: 32px;">
    You'll receive your first receipt within 24 hours. Questions? Reply to this email or reach out at desk@ai-worker-as-a-service.prin7r.com.
  </p>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="font-size: 12px; color: #9CA3AF;">
    Shiftledger — AI worker as a service, outcome-based. This email was sent to ${args.toEmail} because you opened a Shiftledger pool.
  </p>
</body>
</html>`;

      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": apiKey,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: args.toEmail,
          Subject: `Your Shiftledger ${args.tier} pool is open — start here`,
          HtmlBody: htmlBody,
          MessageStream: "outbound",
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { MessageID?: string };
        console.log(`[Postmark] Onboarding email sent (fallback HTML) to ${args.toEmail} — MessageID: ${data.MessageID}`);
        return { ok: true, messageId: data.MessageID };
      }

      const errorText = await response.text();
      console.error(`[Postmark] Failed to send fallback email: HTTP ${response.status} — ${errorText.slice(0, 200)}`);
      return { ok: false };
    } catch (err) {
      console.error(`[Postmark] Error sending fallback email: ${(err as Error).message}`);
      return { ok: false };
    }
  }
}
