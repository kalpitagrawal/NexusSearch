/**
 * Document Model — Mongoose schema for indexed web pages.
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
