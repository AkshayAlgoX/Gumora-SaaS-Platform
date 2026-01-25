import "dotenv/config";
import { createApp } from "./app";
import { connectMongo } from "./db";
import { initSentry, captureError } from "./lib/sentry";

async function main() {
  // Initialize Sentry first
  initSentry();
  
  await connectMongo();
  const app = createApp();

  const PORT = Number(process.env.PORT) || 5000;

  app.listen(PORT, () => {
    console.log(`API is now running on port ${PORT}`);
  });
}

main().catch((err) => {
  captureError(err, { context: 'boot' });
  console.error("boot failed", err);
  process.exit(1);
});
