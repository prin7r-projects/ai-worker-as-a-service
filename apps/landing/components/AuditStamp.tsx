import { cn } from "@/lib/cn";

/**
 * [SHIFTLEDGER_AUDIT_STAMP] The "PAID — OUTCOMES VERIFIED" circular stamp glyph.
 * Used in the hero receipt and anywhere a tier card needs the receipt seal.
 */
type Props = {
  className?: string;
  date?: string; // formatted date string, e.g. "2026-05-08"
  size?: number; // px
};

export function AuditStamp({ className, date = "2026-05-08", size = 120 }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="Shiftledger Paid stamp"
      width={size}
      height={size}
      className={cn("inline-block", className)}
    >
      <title>Shiftledger Paid — Outcomes Verified</title>
      <g transform="rotate(-7 60 60)">
        <circle cx="60" cy="60" r="56" fill="none" stroke="#1F4F8A" strokeWidth="1.6" />
        <circle cx="60" cy="60" r="46" fill="none" stroke="#1F4F8A" strokeWidth="0.8" />
        <text
          x="60"
          y="44"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="14"
          fontWeight="600"
          fill="#1F4F8A"
          letterSpacing="0.2em"
        >
          PAID
        </text>
        <line x1="20" y1="56" x2="100" y2="56" stroke="#1F4F8A" strokeWidth="0.6" />
        <text
          x="60"
          y="72"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="9"
          fill="#1F4F8A"
          letterSpacing="0.18em"
        >
          OUTCOMES
        </text>
        <text
          x="60"
          y="84"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="9"
          fill="#1F4F8A"
          letterSpacing="0.18em"
        >
          VERIFIED
        </text>
        <line x1="20" y1="92" x2="100" y2="92" stroke="#1F4F8A" strokeWidth="0.6" />
        <text
          x="60"
          y="106"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="9"
          fill="#1F4F8A"
          letterSpacing="0.18em"
        >
          {date}
        </text>
      </g>
    </svg>
  );
}
