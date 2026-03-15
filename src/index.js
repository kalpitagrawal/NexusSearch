import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"

dotenv.config({
    path: "./.env"
})

connectDB()
    .then(() => {
        const server = app.listen(process.env.PORT || 8000, () => {
            console.log(`SERVER IS RUNNING AT PORT: ${process.env.PORT}`)
        })

        server.on("error", (error) => {
            console.log("ERROR: ", error)
            throw error
        })
    })
    .catch((err) => {
        console.log("DATABASE CONNECTION FAILED", err)
    })