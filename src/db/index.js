/**
 * Database Connection
 *
 * Supports two modes (same pattern as Java's H2 / PostgreSQL dual config):
 *
 * 1. Persistent Local DB (Local Dev) — default
 *    Uses mongodb-memory-server with WiredTiger storage backed by disk at ./data/db.
 *    Direct equivalent of Java's: spring.datasource.url=jdbc:h2:file:./data/searchengine
 *    Indexed documents persist across server restarts!
 *
 * 2. MongoDB Atlas (Production)
 *    Uses a real MongoDB cluster.
 *    Set MONGO_URI in .env and USE_MEMORY_DB=false.
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

let memoryServer = null;

const connectDB = async () => {
    try {
        const useMemoryDB = process.env.USE_MEMORY_DB !== "false";

        let uri;

        if (useMemoryDB) {
            // --- Disk-backed Local Database (Local Dev) ---
            // Equivalent of: spring.datasource.url=jdbc:h2:file:./data/searchengine
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
            // --- MongoDB Atlas (Production) ---
            uri = process.env.MONGO_URI;
            if (!uri) {
                throw new Error("MONGO_URI is required when USE_MEMORY_DB=false");
            }
        }

        const connectionInstance = await mongoose.connect(uri, { dbName: DB_NAME });
        console.log(`\nDATABASE CONNECTED && DB HOST: ${connectionInstance.connection.host}`);

    } catch (error) {
        console.log("DATABASE CONNECTION ERROR:", error);
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