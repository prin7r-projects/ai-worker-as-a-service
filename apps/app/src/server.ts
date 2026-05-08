// apps/app/src/server.ts — Shiftledger app server entry (Phase 0 scaffold)
import express from "express";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "shiftledger-app", timestamp: new Date().toISOString() });
});

// Hello-Shiftledger placeholder
app.get("/api", (_req, res) => {
  res.json({
    message: "Hello-Shiftledger",
    version: "0.1.0",
    docs: "See docs/12-technical-specification.md and docs/13-implementation-plan.md",
    endpoints: {
      health: "GET /api/health",
      contracts: "POST /api/contracts (Phase 1)",
      checkout: "POST /api/checkout/nowpayments (landing — already live)",
    },
  });
});

app.listen(PORT, () => {
  console.log(`[shiftledger-app] Running on http://localhost:${PORT}`);
});

export default app;
