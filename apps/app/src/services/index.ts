// apps/app/src/services/index.ts
// Shiftledger Phase 3 — Service barrel exports
export { ContractService } from "./ContractService.js";
export type { CreateContractArgs } from "./ContractService.js";

export { ShiftScheduler } from "./ShiftScheduler.js";
export type { ShiftRow } from "./ShiftScheduler.js";

export { WorkerRunner } from "./WorkerRunner.js";
export type { VerificationEvent } from "./WorkerRunner.js";

export { Verifier } from "./Verifier.js";
export type { VerificationRule, VerificationOutcome } from "./Verifier.js";

export { LedgerService } from "./LedgerService.js";
export type { RecordLineArgs } from "./LedgerService.js";

export { ShiftLedgerOrchestrator } from "./ShiftLedgerOrchestrator.js";

export { ZendeskService } from "./ZendeskService.js";

// Phase 3 services
export { PostmarkService } from "./PostmarkService.js";
export type { OnboardingEmailArgs } from "./PostmarkService.js";
export { NotionService } from "./NotionService.js";

// Phase 4 services (PRI-2323)
export { sendSlackAlert, trackWebhookSigFailure, checkStuckShifts, checkDrift, checkContractAnomaly } from "./SlackAlertService.js";
export type { AlertPayload } from "./SlackAlertService.js";
export { installPiiScrubbing, scrubLog as scrubPii } from "./PiiScrubber.js";
export { startHeartbeat, stopHeartbeat } from "./HeartbeatService.js";

// Phase 5 services (PRI-2322)
export { DigestService } from "./DigestService.js";
export { EvalRunnerService } from "./EvalRunnerService.js";
export { startCronJobs, stopCronJobs } from "./CronScheduler.js";
