"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
/**
 * Database operations for jobs and tasks using Mongoose.
 * Handles persistence of transcripts, results, and job status.
 */
class DatabaseService {
    /**
     * Connects to the MongoDB database.
     */
    async connect(uri) {
        try {
            await mongoose_1.default.connect(uri);
            console.log('[DB] Connected to MongoDB');
        }
        catch (error) {
            console.error('[DB] Connection error:', error);
            throw new Error('Failed to connect to database');
        }
    }
    /**
     * Disconnects from the MongoDB database.
     */
    async disconnect() {
        await mongoose_1.default.disconnect();
        console.log('[DB] Disconnected from MongoDB');
    }
    /**
     * Generates SHA256 hash of transcript for idempotency.
     */
    hashTranscript(transcript) {
        return crypto_1.default.createHash('sha256').update(transcript).digest('hex');
    }
    /**
     * Checks if a transcript has already been processed (idempotency).
     * Returns jobId if found, null otherwise.
     */
    async findExistingJob(transcript) {
        const hash = this.hashTranscript(transcript);
        const job = await models_1.JobModel.findOne({ transcriptHash: hash });
        return job ? job.jobId : null;
    }
    /**
     * Creates a new job entry.
     */
    async createJob(jobId, transcript) {
        const hash = this.hashTranscript(transcript);
        const job = new models_1.JobModel({
            jobId,
            transcript,
            transcriptHash: hash,
            status: 'processing',
        });
        await job.save();
        console.log(`[DB] Created job ${jobId}`);
    }
    /**
     * Updates job status to "done" with results.
     */
    async completeJob(jobId, result) {
        await models_1.JobModel.updateOne({ jobId }, { $set: { status: 'done', result } });
        console.log(`[DB] Completed job ${jobId}`);
    }
    /**
     * Updates job status to "error" with an error message.
     */
    async failJob(jobId, error) {
        await models_1.JobModel.updateOne({ jobId }, { $set: { status: 'error', error } });
        console.log(`[DB] Failed job ${jobId}: ${error}`);
    }
    /**
     * Retrieves a job by its ID.
     */
    async getJob(jobId) {
        return models_1.JobModel.findOne({ jobId });
    }
    /**
     * Stores validated tasks in the database.
     */
    async saveTasks(jobId, tasks) {
        const taskDocs = tasks.map(task => ({
            jobId,
            taskId: task.id,
            ...task,
        }));
        await models_1.TaskModel.insertMany(taskDocs);
        console.log(`[DB] Saved ${tasks.length} tasks for job ${jobId}`);
    }
}
exports.DatabaseService = DatabaseService;
