"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobModel = void 0;
const mongoose_1 = require("mongoose");
const JobSchema = new mongoose_1.Schema({
    jobId: { type: String, required: true, unique: true, index: true },
    transcript: { type: String, required: true },
    transcriptHash: { type: String, required: true, unique: true, index: true },
    status: { type: String, required: true, default: 'processing', enum: ['processing', 'done', 'error'] },
    result: { type: mongoose_1.Schema.Types.Mixed },
    error: { type: String },
}, { timestamps: true });
exports.JobModel = (0, mongoose_1.model)('Job', JobSchema);
