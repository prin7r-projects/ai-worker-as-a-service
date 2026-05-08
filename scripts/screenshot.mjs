#!/usr/bin/env node
/**
 * [SHIFTLEDGER_SCREENSHOT] Capture desktop + mobile screenshots from the live URL.
 *
 * Usage:
 *   node scripts/screenshot.mjs
 *   TARGET_URL=https://staging.example.com node scripts/screenshot.mjs
 *
 * Requires: Playwright chromium (auto-resolved from /Users/keer/.cache/playwright
 * if installed there, or from a project node_modules — fall back to npx playwright).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TARGET = process.env.TARGET_URL || "https://ai-worker-as-a-service.prin7r.com";
const ROOT = resolve(import.meta.dirname, "..");
const OUT_DESKTOP = resolve(ROOT, "docs/screenshots/landing-desktop.png");
const OUT_MOBILE = resolve(ROOT, "docs/screenshots/landing-mobile.png");

mkdirSync(dirname(OUT_DESKTOP), { recursive: true });

const browser = await chromium.launch({ headless: true });
console.log(`[SHIFTLEDGER_SCREENSHOT] target=${TARGET}`);

// Desktop 1440x900 full-page
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: "networkidle", timeout: 60000 });
  // Give web fonts a tick to settle
  await page.evaluate(async () => {
    if ("fonts" in document) await document.fonts.ready;
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT_DESKTOP, fullPage: true });
  console.log(`[SHIFTLEDGER_SCREENSHOT] wrote ${OUT_DESKTOP}`);
  await ctx.close();
}

// Mobile 390x844 (iPhone 14 Pro), full-page
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
  });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(async () => {
    if ("fonts" in document) await document.fonts.ready;
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT_MOBILE, fullPage: true });
  console.log(`[SHIFTLEDGER_SCREENSHOT] wrote ${OUT_MOBILE}`);
  await ctx.close();
}

await browser.close();
console.log("[SHIFTLEDGER_SCREENSHOT] done");
