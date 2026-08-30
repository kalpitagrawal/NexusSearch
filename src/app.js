/**
 * Express Application Setup
 *
 * Preserved from your existing MERN project:
 *   - cors() middleware
 *   - cookie-parser
 *   - JSON body parsing with 16kb limit
 *   - URL-encoded body parsing
 *   - Static file serving (public/)
 *   - Global error middleware (ApiError → JSON response)
 *
 * Updated to match Java's route structure:
 *   - Routes mounted at /api (matching @RequestMapping("/api"))
 */
import express from "express"
import cookieParser from "cookie-parser"
import cors from "cors"

const app = express()

// import routes
import searchRouter from "./routes/search.routes.js"


app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ limit: "16kb", extended: true }));
app.use(express.static("public"));
app.use(cookieParser());


// routes declaration
// Mounted at /api to match Java's @RequestMapping("/api")
app.use("/api", searchRouter)


// proper error response
// (preserved from your existing MERN project)
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors
    });
});

export { app }