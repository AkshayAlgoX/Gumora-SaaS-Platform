import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../db";
import { reconcilePendingOrders } from "../services/reconciliation";

/** One reconciliation run, for a scheduler (e.g. Render cron job). */
async function main() {
  await connectMongo();
  try {
    const summary = await reconcilePendingOrders();
    console.log(JSON.stringify(summary));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("reconcile failed", err);
  process.exit(1);
});
