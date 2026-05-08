import { cn } from "@/lib/cn";

/**
 * [TALLY_LOGO] Wordmark "tally" in Cardo italic with the audit-stamp glyph.
 * The stamp is rotated -7deg so it reads as an inked seal on a paper receipt
 * rather than a logo bug. Title element provides accessible name.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 60"
      role="img"
      aria-label="Tally"
      className={cn("h-10 w-auto", className)}
    >
      <title>Tally</title>
      <text
        x="0"
        y="46"
        fontFamily="Cardo, Georgia, serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="48"
        fill="#0E0E0C"
      >
        tally
      </text>
      <g transform="translate(150 6) rotate(-7)" aria-hidden="true">
        <circle cx="22" cy="22" r="22" fill="none" stroke="#1F4F8A" strokeWidth="1.4" />
        <circle cx="22" cy="22" r="17" fill="none" stroke="#1F4F8A" strokeWidth="0.8" />
        <text
          x="22"
          y="20"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="6"
          fill="#1F4F8A"
          letterSpacing="0.2"
        >
          PAID
        </text>
        <text
          x="22"
          y="27"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="4.5"
          fill="#1F4F8A"
        >
          OUTCOMES
        </text>
        <text
          x="22"
          y="33"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="4.5"
          fill="#1F4F8A"
        >
          VERIFIED
        </text>
      </g>
    </svg>
  );
}
