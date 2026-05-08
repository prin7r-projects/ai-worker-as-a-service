// apps/app/src/services/DigestService.ts
// Shiftledger Phase 5 — Weekly contract digests
// Aggregates cleared/voided per active contract and sends Postmark digest emails.

import { db, schema } from "../db/index.js";
import { eq, and, gte, desc } from "drizzle-orm";
import { PostmarkService } from "./PostmarkService.js";

interface ContractDigest {
  contractId: string;
  customerEmail: string;
  workerProfileName: string;
  tier: string;
  status: string;
  weekCleared: number;
  weekVoided: number;
  totalCleared: number;
  totalVoided: number;
  weekRevenue: string;
  totalRevenue: string;
  clearRate: string;
  shiftsRun: number;
}

export class DigestService {
  /**
   * Generate weekly digests for all active contracts.
   * Aggregates cleared/voided lines from the last 7 days.
   * Sends Postmark digest email per active contract.
   */
  static async runWeeklyDigest(): Promise<{
    contractsProcessed: number;
    emailsSent: number;
    errors: string[];
  }> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const errors: string[] = [];

    // Fetch all active contracts
    const activeContracts = await db
      .select()
      .from(schema.contracts)
      .where(eq(schema.contracts.status, "active"));

    if (activeContracts.length === 0) {
      console.log("[digest] No active contracts — skipping digest");
      return { contractsProcessed: 0, emailsSent: 0, errors: [] };
    }

    console.log(`[digest] Processing ${activeContracts.length} active contract(s)`);

    let contractsProcessed = 0;
    let emailsSent = 0;

    for (const contract of activeContracts) {
      try {
        const digest = await DigestService._buildContractDigest(contract.id, weekAgo);
        if (!digest || !digest.customerEmail) {
          errors.push(`No customer email for contract ${contract.id}`);
          contractsProcessed++;
          continue;
        }

        await DigestService._sendDigestEmail(digest);
        emailsSent++;
        contractsProcessed++;
      } catch (err) {
        const msg = `Digest failed for contract ${contract.id}: ${(err as Error).message}`;
        console.error(`[digest] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[digest] Complete — ${contractsProcessed} contracts, ${emailsSent} emails sent, ${errors.length} errors`);
    return { contractsProcessed, emailsSent, errors };
  }

  /**
   * Build a digest object for a single contract.
   */
  static async _buildContractDigest(
    contractId: string,
    since: Date,
  ): Promise<ContractDigest | null> {
    // Fetch contract
    const [contract] = await db
      .select()
      .from(schema.contracts)
      .where(eq(schema.contracts.id, contractId))
      .limit(1);

    if (!contract) return null;

    // Get customer email
    let customerEmail = "";
    if (contract.customerId) {
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, contract.customerId))
        .limit(1);
      customerEmail = customer?.email ?? "";
    }

    // Get worker profile name
    let workerProfileName = contract.workerProfileId ?? "unknown";
    if (contract.workerProfileId) {
      const [wp] = await db
        .select()
        .from(schema.workerProfiles)
        .where(eq(schema.workerProfiles.id, contract.workerProfileId))
        .limit(1);
      workerProfileName = wp?.displayName ?? workerProfileName;
    }

    // Get all shifts for this contract
    const allShifts = await db
      .select()
      .from(schema.shifts)
      .where(eq(schema.shifts.contractId, contractId));

    const shiftIds = allShifts.map((s) => s.id);
    const weekShiftIds = allShifts
      .filter((s) => s.startedAt && s.startedAt >= since)
      .map((s) => s.id);

    // Get all-time receipt lines
    let totalCleared = 0;
    let totalVoided = 0;
    let totalRevenue = 0;

    if (shiftIds.length > 0) {
      const allLines = await db
        .select()
        .from(schema.receiptLines)
        .where(
          and(
            gte(schema.receiptLines.shiftId, shiftIds[shiftIds.length - 1]),
            // We'll filter in memory for simplicity given scale
          ),
        )
        .orderBy(desc(schema.receiptLines.clearedAt));

      // Actually, let's just do direct queries
    }

    // All-time lines — query directly
    let allCleared = 0;
    let allVoided = 0;
    let allRevenue = 0;

    for (const shift of allShifts) {
      allCleared += shift.outcomesCleared ?? 0;
      allVoided += shift.outcomesVoided ?? 0;
      const shiftLines = await db
        .select()
        .from(schema.receiptLines)
        .where(eq(schema.receiptLines.shiftId, shift.id));
      for (const line of shiftLines) {
        if (line.status === "cleared") {
          allRevenue += parseFloat(line.unitPriceUsd ?? "0");
        }
      }
    }

    totalCleared = allCleared;
    totalVoided = allVoided;
    totalRevenue = allRevenue;

    // Week-only lines
    let weekCleared = 0;
    let weekVoided = 0;
    let weekRevenue = 0;

    for (const shiftId of weekShiftIds) {
      const shift = allShifts.find((s) => s.id === shiftId);
      if (shift) {
        weekCleared += shift.outcomesCleared ?? 0;
        weekVoided += shift.outcomesVoided ?? 0;
      }
      const lines = await db
        .select()
        .from(schema.receiptLines)
        .where(eq(schema.receiptLines.shiftId, shiftId));
      for (const line of lines) {
        if (line.status === "cleared") {
          weekRevenue += parseFloat(line.unitPriceUsd ?? "0");
        }
      }
    }

    const totalOutcomes = totalCleared + totalVoided;
    const clearRate = totalOutcomes > 0
      ? ((totalCleared / totalOutcomes) * 100).toFixed(1)
      : "0.0";

    return {
      contractId,
      customerEmail,
      workerProfileName,
      tier: contract.tier ?? "standard",
      status: contract.status ?? "active",
      weekCleared,
      weekVoided,
      totalCleared,
      totalVoided,
      weekRevenue: weekRevenue.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      clearRate,
      shiftsRun: weekShiftIds.length,
    };
  }

  /**
   * Send a digest email for a single contract.
   */
  static async _sendDigestEmail(digest: ContractDigest): Promise<void> {
    const apiKey = process.env.POSTMARK_API_KEY;
    if (!apiKey) {
      console.log(`[digest] POSTMARK_API_KEY not set — skipping digest email for ${digest.customerEmail}`);
      return;
    }

    const fromEmail = process.env.POSTMARK_FROM_EMAIL ?? "desk@ai-worker-as-a-service.prin7r.com";
    const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3001/app/contracts";

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #111827; font-family: Georgia, serif; font-weight: 300; font-size: 28px; letter-spacing: -0.02em;">
    Weekly Shift Digest
  </h1>
  <p style="font-size: 16px; color: #374151;">
    Your <strong>${digest.workerProfileName}</strong> pool (${digest.tier} tier) was active last week.
  </p>

  <!-- Summary Card -->
  <div style="border: 1px solid #E5E5E5; border-radius: 8px; padding: 20px; margin: 20px 0; background: #FAFAF8;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 12px; color: #777169; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Week Cleared</td>
        <td style="padding: 8px 12px; color: #777169; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Week Voided</td>
        <td style="padding: 8px 12px; color: #777169; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Week Revenue</td>
        <td style="padding: 8px 12px; color: #777169; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Shifts Run</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; font-family: monospace; font-size: 18px; color: #2E6F40;">${digest.weekCleared}</td>
        <td style="padding: 8px 12px; font-family: monospace; font-size: 18px; color: #B5371F;">${digest.weekVoided}</td>
        <td style="padding: 8px 12px; font-family: monospace; font-size: 18px;">$${parseFloat(digest.weekRevenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 8px 12px; font-family: monospace; font-size: 18px;">${digest.shiftsRun}</td>
      </tr>
    </table>
  </div>

  <!-- All-Time Summary -->
  <div style="border: 1px solid #E5E5E5; border-radius: 8px; padding: 20px; margin: 20px 0; background: #FFFFFF;">
    <p style="font-size: 12px; color: #777169; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 12px;">All-Time Totals</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 6px 0; color: #3A3A36;">Total Cleared</td>
        <td style="padding: 6px 0; font-family: monospace; color: #2E6F40; text-align: right;">${digest.totalCleared}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #3A3A36;">Total Voided</td>
        <td style="padding: 6px 0; font-family: monospace; color: #B5371F; text-align: right;">${digest.totalVoided}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #3A3A36;">Clear Rate</td>
        <td style="padding: 6px 0; font-family: monospace; text-align: right;">${digest.clearRate}%</td>
      </tr>
      <tr style="border-top: 1px solid #E5E5E5;">
        <td style="padding: 6px 0; color: #3A3A36; font-weight: 600;">Total Revenue</td>
        <td style="padding: 6px 0; font-family: monospace; font-weight: 600; text-align: right;">$${parseFloat(digest.totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    </table>
  </div>

  <p style="margin: 24px 0;">
    <a href="${dashboardUrl}#${digest.contractId}"
       style="display: inline-block; background: #000000; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 500;">
      View Contract Dashboard →
    </a>
  </p>

  <p style="font-size: 12px; color: #9CA3AF; margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E5E5;">
    Shiftledger Weekly Digest — ${new Date().toISOString().slice(0, 10)}<br/>
    Contract: ${digest.contractId}<br/>
    You receive this digest because you have an active Shiftledger pool. To adjust notification settings, visit your dashboard.
  </p>
</body>
</html>`;

    try {
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": apiKey,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: digest.customerEmail,
          Subject: `Shiftledger Weekly: ${digest.weekCleared} outcomes cleared — ${digest.workerProfileName}`,
          HtmlBody: htmlBody,
          MessageStream: "outbound",
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { MessageID?: string };
        console.log(`[digest] Email sent to ${digest.customerEmail} — MessageID: ${data.MessageID}`);
      } else {
        const errorText = await response.text();
        throw new Error(`Postmark HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }
    } catch (err) {
      console.error(`[digest] Failed to send digest to ${digest.customerEmail}: ${(err as Error).message}`);
      throw err;
    }
  }
}
