import mongoose, { Schema } from "mongoose"

const repoSchema = new Schema({
    repoId: {
        type: String,
        unique: true,
        required: true,
    },
    owner: {
        type: String,
        required: true,
        trim: true
    },
    repoName: {
        type: String,
        required: true,
        trim: true
    },
    repoDescription: {
        type: String,
        trim: true
    },
    language: {
        type: String,
        trim: true,
        lowercase: true
    },
    stars: {
        type: Number,
        required: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    tokens: {
        type: [String],
        required: true
    }

}, {
    timestamps: true
})

export const Repo = mongoose.model("Repo", repoSchema)