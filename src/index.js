/**
 * Application Entry Point
 *
 * Startup sequence:
 *   1. Load environment variables
 *   2. Connect to MongoDB
 *   3. Bind port and start Express server immediately (fast health check / readiness)
 *   4. Rebuild inverted index asynchronously in background via streaming cursor
 */
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { rebuildIndex } from "./services/search.service.js";

dotenv.config({
    path: "./.env"
});

connectDB()
    .then(() => {
        const port = process.env.PORT || 8080;
        const server = app.listen(port, () => {
            console.log(`SERVER IS RUNNING AT PORT: ${port}`);
        });

        server.on("error", (error) => {
            console.error("SERVER ERROR:", error);
            throw error;
        });

        // Trigger background asynchronous index reconstruction without blocking port binding
        rebuildIndex().catch((err) => {
            console.error("Index rebuild background error:", err);
        });
    })
    .catch((err) => {
        console.error("DATABASE CONNECTION FAILED:", err);
    });