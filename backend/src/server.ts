import "dotenv/config";
import { createApp } from "./app";
import { connectMongo } from "./db";

async function main() {
  await connectMongo();
  const app = createApp();

  const PORT = Number(process.env.PORT) || 5000;

  app.listen(PORT, () => {
    console.log(`API is now running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("boot failed", err);
  process.exit(1);
});
