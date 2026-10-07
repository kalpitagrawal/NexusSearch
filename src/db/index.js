/**
 * Database Connection Manager
 *
 * Supports two operational modes:
 * 1. Local Development DB: Active only when USE_MEMORY_DB === "true"
 *    Uses mongodb-memory-server backed by local disk storage at ./data/db.
 * 2. MongoDB Atlas (Production & Standard):
 *    Requires MONGO_URI environment variable.
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

let memoryServer = null;

const connectDB = async () => {
    try {
        const useMemoryDB = process.env.USE_MEMORY_DB === "true";
        let uri;

        if (useMemoryDB) {
            const { MongoMemoryServer } = await import("mongodb-memory-server");
            const dbPath = path.resolve("./data/db");
            if (!fs.existsSync(dbPath)) {
                fs.mkdirSync(dbPath, { recursive: true });
            }

            memoryServer = await MongoMemoryServer.create({
                instance: {
                    dbPath,
                    storageEngine: "wiredTiger"
                }
            });
            uri = memoryServer.getUri();
            console.log(`Using persistent local database at ${dbPath}`);
        } else {
            uri = process.env.MONGO_URI;
            if (!uri) {
                throw new Error("MONGO_URI environment variable is required when USE_MEMORY_DB is not explicitly set to 'true'.");
            }
        }

        const connectionInstance = await mongoose.connect(uri, { dbName: DB_NAME });
        console.log(`\nDATABASE CONNECTED && DB HOST: ${connectionInstance.connection.host}`);

    } catch (error) {
        console.log("DATABASE CONNECTION ERROR:", error.message);
        process.exit(1);
    }
};

const cleanupDB = async () => {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        if (memoryServer) {
            await memoryServer.stop();
        }
    } catch (_) {}
};

process.once("SIGINT", async () => {
    await cleanupDB();
    process.exit(0);
});

process.once("SIGTERM", async () => {
    await cleanupDB();
    process.exit(0);
});

process.once("SIGUSR2", async () => {
    await cleanupDB();
    process.kill(process.pid, "SIGUSR2");
});

export default connectDB;