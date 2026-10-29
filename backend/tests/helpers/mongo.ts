import mongoose from "mongoose";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";

/**
 * Real mongod processes for integration tests (binaries are downloaded and
 * cached by mongodb-memory-server). Nothing here mocks Mongoose sessions:
 * transactions, write conflicts and failpoints are handled by the server.
 */

// enableTestCommands lets tests use the server's failCommand failpoint.
const TEST_COMMANDS = ["--setParameter", "enableTestCommands=1"];

export async function startReplSet(): Promise<MongoMemoryReplSet> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ args: TEST_COMMANDS }],
  });
  await mongoose.connect(replSet.getUri(), { dbName: "gumora_test" });
  // Create collections up front: implicit creation inside a transaction is
  // supported, but doing it here keeps failpoint counts predictable.
  await Promise.all(Object.values(mongoose.models).map((m) => m.createCollection()));
  return replSet;
}

export async function startStandalone(): Promise<MongoMemoryServer> {
  const server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "gumora_test" });
  return server;
}

export async function stopMongo(server: { stop: () => Promise<unknown> }) {
  await mongoose.disconnect();
  await server.stop();
}

export async function clearCollections() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

/**
 * Configure the server-side failCommand failpoint (requires enableTestCommands).
 * Returns a function that asserts the server actually triggered it, so a test
 * cannot pass merely because the failpoint never fired.
 */
export async function failCommand(data: Record<string, unknown>, times = 1) {
  const admin = mongoose.connection.db!.admin();
  const configured = await admin.command({ configureFailPoint: "failCommand", mode: { times }, data });
  const enteredBefore = Number(configured.count ?? 0);
  return async function assertTriggered() {
    // Throws (MaxTimeMSExpired) if the failpoint was not entered `times` more times.
    await admin.command({ waitForFailPoint: "failCommand", timesEntered: enteredBefore + times, maxTimeMS: 2000 });
  };
}

export async function clearFailPoint() {
  await mongoose.connection.db!.admin().command({ configureFailPoint: "failCommand", mode: "off" });
}
