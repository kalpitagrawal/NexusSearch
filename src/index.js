/**
 * Application Entry Point
 *
 * Port of SearchEngineApplication.java
 *
 * Startup sequence:
 *   1. Load environment variables
 *   2. Connect to MongoDB
 *   3. Rebuild the inverted index from stored documents (same as @PostConstruct)
 *   4. Start the Express server
 */
import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"
import { rebuildIndex } from "./services/search.service.js"

dotenv.config({
    path: "./.env"
})

connectDB()
    .then(async () => {
        // Rebuild inverted index from MongoDB on startup
        // (Port of @PostConstruct rebuildIndex() in SearchService.java)
        await rebuildIndex();

        const port = process.env.PORT || 8080;
        const server = app.listen(port, () => {
            console.log(`SERVER IS RUNNING AT PORT: ${port}`)
        })

        server.on("error", (error) => {
            console.log("ERROR: ", error)
            throw error
        })
    })
    .catch((err) => {
        console.log("DATABASE CONNECTION FAILED", err)
    })