// apps/app/src/services/WorkerRunner.ts
// Shiftledger Phase 1 — Stub worker runner
// Produces N synthetic verification events per contract. No real LLM calls.

export interface VerificationEvent {
  externalId: string;
  cleared: boolean;
}

export class WorkerRunner {
  /**
   * Run a synthetic shift for a contract: produce N verification events.
   *
   * Each event has an `externalId` like `ext-001`, `ext-002`, ...
   * The verifier will later determine cleared/voided status.
   *
   * @param outcomeCount - number of outcomes to attempt (contract.outcomeTarget)
   * @returns Array of verification events
   */
  static run(outcomeCount: number): VerificationEvent[] {
    const events: VerificationEvent[] = [];
    const pad = String(outcomeCount).length;

    for (let i = 1; i <= outcomeCount; i++) {
      const externalId = `ext-${String(i).padStart(pad, "0")}`;
      // The worker produces raw events; the Verifier decides clearance
      events.push({ externalId, cleared: false }); // cleared is set by Verifier
    }

    return events;
  }
}
