import { FAQAccordion } from "@/components/FAQAccordion";
import { Footer } from "@/components/Footer";
import { HeroReceipt } from "@/components/HeroReceipt";
import { Masthead } from "@/components/Masthead";
import { OutcomePricingTable } from "@/components/OutcomePricingTable";
import { TierPricing } from "@/components/TierPricing";
import { VerificationTrust } from "@/components/VerificationTrust";
import { WorkerCatalog } from "@/components/WorkerCatalog";

/**
 * [SHIFTLEDGER_LANDING] Single-page editorial layout.
 * Section order locked in /DESIGN.md section 9. Real copy lives in
 * /docs/08-marketing-strategy.md "Copy specimen". Anything edited here
 * must be mirrored in DESIGN.md section 9 + the marketing doc.
 */
export default function Page() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <Masthead />
      <HeroReceipt />
      <WorkerCatalog />
      <OutcomePricingTable />
      <VerificationTrust />
      <TierPricing />
      <FAQAccordion />
      <Footer />
    </main>
  );
}
