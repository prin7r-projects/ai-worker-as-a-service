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
