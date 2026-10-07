/**
 * Express Application Setup
 */
import express from "express";
import cors from "cors";
import searchRouter from "./routes/search.routes.js";
import { getIndexStatus } from "./services/search.service.js";

const app = express();

const vercelOrigin = "https://search-engine-henna.vercel.app";
const corsOriginEnv = process.env.CORS_ORIGIN;

let allowedOrigins;
if (corsOriginEnv && corsOriginEnv !== "*") {
    allowedOrigins = corsOriginEnv.includes(",") 
        ? corsOriginEnv.split(",").map(o => o.trim()) 
        : corsOriginEnv;
} else if (corsOriginEnv === "*") {
    allowedOrigins = "*";
} else {
    allowedOrigins = [vercelOrigin, "http://localhost:8080", "http://localhost:3000", "http://localhost:5173"];
}

app.use(cors({
    origin: allowedOrigins,
    credentials: false
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ limit: "16kb", extended: true }));
app.use(express.static("public"));

// Health check endpoint for container uptime and readiness monitoring
app.get("/api/health", (req, res) => {
    const status = getIndexStatus();
    res.status(status.isReady ? 200 : 503).json({
        status: status.isReady ? "healthy" : "warming",
        uptime: process.uptime(),
        ...status
    });
});

// Main search routes
app.use("/api", searchRouter);

// Centralized error handling middleware
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: err.message || "Internal Server Error",
        message: err.message || "Internal Server Error",
        errors: err.errors || []
    });
});

export { app };