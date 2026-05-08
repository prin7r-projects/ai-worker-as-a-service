import type { Config } from "tailwindcss";

/**
 * [SHIFTLEDGER_TAILWIND] Locked tokens for the Shiftledger landing.
 * Refresh 2026-05-08 — palette + type lifted from the ElevenLabs reference
 * (canvas swapped to milky #FAFAF8 per no-beige rule). Source of truth lives
 * in /DESIGN.md sections 4-6.
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
        // ElevenLabs-derived neutrals (milky base swap)
        paper: "#FAFAF8",
        "paper-2": "#F5F3F1",
        "card-white": "#FFFFFF",
        chalk: "#E5E5E5",
        fog: "#B1B0B0",
        slate: "#A59F97",
        gravel: "#777169",
        "ink-2": "#3A3A36",
        ink: "#0E0E0C",
        obsidian: "#000000",
        // Shiftledger semantic accents
        audit: "#1F4F8A",
        payday: "#2E6F40",
        flag: "#B5371F"
      },
      fontFamily: {
        // Cormorant Garamond 300 substitutes Waldenburg 300 (whisper-weight serif headline)
        display: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"]
      },
      maxWidth: {
        prose: "1200px"
      },
      borderRadius: {
        none: "0",
        sm: "4px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        full: "9999px"
      },
      boxShadow: {
        // ElevenLabs hairline shadow system
        hairline: "rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px",
        "inset-subtle": "rgba(0, 0, 0, 0.075) 0px 0px 0px 0.5px inset",
        pill: "rgba(0, 0, 0, 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px",
        ledger: "0 1px 0 0 rgba(14,14,12,.10)"
      },
      letterSpacing: {
        ledger: "0.18em",
        whisper: "-0.02em"
      },
      fontSize: {
        // Sizes from ElevenLabs scale + Shiftledger receipt-display lineage
        display: ["clamp(48px, 7vw, 96px)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h1: ["clamp(36px, 5vw, 56px)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h2: ["clamp(24px, 3vw, 32px)", { lineHeight: "1.17", letterSpacing: "-0.005em" }],
        h3: ["clamp(18px, 2vw, 22px)", { lineHeight: "1.4" }],
        body: ["16px", { lineHeight: "1.5" }],
        caption: ["13px", { lineHeight: "1.4" }],
        "mono-xs": ["12px", { lineHeight: "1.3", letterSpacing: "0.18em" }]
      }
    }
  },
  plugins: []
};

export default config;
