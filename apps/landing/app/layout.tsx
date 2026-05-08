import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ai-worker-as-a-service.prin7r.com"),
  title: "Shiftledger — outcome ledger for AI workers",
  description:
    "Shiftledger is the first AI worker service priced like payroll. You only pay when the shift ships. Pre-trained worker profiles, unit-priced outcome contracts, per-shift receipts. No retainer, no tokens, no seats.",
  openGraph: {
    title: "Shiftledger — outcome ledger for AI workers",
    description: "You only pay when the shift ships. Pre-trained AI worker profiles, unit-priced outcome contracts, per-shift receipts.",
    url: "https://ai-worker-as-a-service.prin7r.com",
    siteName: "Shiftledger",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Shiftledger — outcome ledger for AI workers",
    description: "You only pay when the shift ships. Outcome-billed AI workers."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
