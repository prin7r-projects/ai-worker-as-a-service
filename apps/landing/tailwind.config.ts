import type { Config } from "tailwindcss";

/**
 * [TALLY_TAILWIND] Locked tokens for the Tally landing.
 * Mirrors /DESIGN.md sections 4-6. Source of truth lives in DESIGN.md.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.5rem", md: "2.5rem" }
    },
    extend: {
      colors: {
        paper: "#F5F1E8",
        "paper-2": "#ECE6D5",
        ink: "#0E0E0C",
        "ink-2": "#3A3A36",
        audit: "#1F4F8A",
        payday: "#2E6F40",
        flag: "#B5371F"
      },
      fontFamily: {
        display: ["Cardo", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      },
      maxWidth: {
        prose: "1140px"
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        full: "9999px"
      },
      boxShadow: {
        ledger: "0 1px 0 0 rgba(14,14,12,.10)"
      },
      letterSpacing: {
        ledger: "0.18em"
      },
      fontSize: {
        display: ["clamp(56px, 9vw, 104px)", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        h1: ["clamp(36px, 5vw, 56px)", { lineHeight: "1.05", letterSpacing: "-0.012em" }],
        h2: ["clamp(24px, 3vw, 32px)", { lineHeight: "1.15", letterSpacing: "-0.005em" }],
        h3: ["clamp(18px, 2vw, 22px)", { lineHeight: "1.3" }],
        body: ["17px", { lineHeight: "1.55" }],
        caption: ["13px", { lineHeight: "1.4" }],
        "mono-xs": ["12px", { lineHeight: "1.3", letterSpacing: "0.18em" }]
      }
    }
  },
  plugins: []
};

export default config;
