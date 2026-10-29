import "dotenv/config";
import { createApp } from "./app";
import { connectMongo } from "./db";
import { initSentry, captureError } from "./lib/sentry";
import { startReconciliationLoop } from "./services/reconciliation";

async function main() {
  // Initialize Sentry first
  initSentry();
  
  await connectMongo();
  const app = createApp();

  const PORT = Number(process.env.PORT) || 5000;

  app.listen(PORT, () => {
    console.log(`API is now running on port ${PORT}`);
  });

  // Optional in-process sweep for paid orders whose buyer never returned.
  const reconcileEveryMs = Number(process.env.RECONCILE_INTERVAL_MS ?? 0);
  if (Number.isFinite(reconcileEveryMs) && reconcileEveryMs > 0) {
    startReconciliationLoop(reconcileEveryMs);
    console.log(`Payment reconciliation every ${reconcileEveryMs}ms`);
  }
}

main().catch((err) => {
  captureError(err, { context: 'boot' });
  console.error("boot failed", err);
  process.exit(1);
});
