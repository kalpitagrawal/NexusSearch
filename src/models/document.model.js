/**
 * Document Model — Mongoose schema for indexed web pages.
 *
 * Direct port of Document.java (@Entity)
 *
 * | Java Field      | Mongoose Field  | Type      | Notes                           |
 * |-----------------|-----------------|-----------|----------------------------------|
 * | id (auto)       | _id (auto)      | ObjectId  | Primary key, auto-generated      |
 * | documentId      | documentId      | String    | URL used as document identifier  |
 * | title           | title           | String    | Page title from crawled HTML     |
 * | content         | content         | String    | Full extracted text content       |
 * | url             | url             | String    | The original URL                 |
 * | indexedAt       | indexedAt       | Date      | When the document was indexed    |
 */
import mongoose, { Schema } from "mongoose";

const documentSchema = new Schema({
    documentId: {
        type: String,
        unique: true,
        required: true,
    },
    title: {
        type: String,
        trim: true,
    },
    content: {
        type: String,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    indexedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

export const Document = mongoose.model("Document", documentSchema);
