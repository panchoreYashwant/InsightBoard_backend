"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const express_1 = require("express");
const uuid_1 = require("uuid");
/**
 * API routes for the Dependency Engine
 */
function createRouter(dbService, jobProcessorService) {
    const router = (0, express_1.Router)();
    /**
     * POST /api/submit
     * Submit a transcript for async processing
     *
     * Request body: { transcript: string }
     * Response: { jobId: string, status: "processing" }
     *
     * Level 1 & Level 2: Implements async job processing with idempotency
     * - Returns immediately with jobId
     * - Checks for duplicate transcript (same content = same processing)
     * - Processes in background
     */
    router.get("/submit", async (req, res) => {
        res.status(200).json({ message: "API is working" });
    });
    router.post("/submit", async (req, res) => {
        try {
            const { transcript } = req.body;
            // Validate input
            if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
                return res.status(400).json({
                    error: "Invalid input: transcript must be a non-empty string",
                });
            }
            const cleanTranscript = transcript.trim();
            // Level 2: Idempotency check
            // If same transcript submitted twice, return existing jobId
            const existingJobId = await dbService.findExistingJob(cleanTranscript);
            if (existingJobId) {
                console.log(`[Idempotency] Transcript already processed, returning jobId: ${existingJobId}`);
                return res.status(200).json({
                    jobId: existingJobId,
                    status: "processing",
                    message: "Transcript already submitted, returning existing job ID",
                });
            }
            // Create new job
            const jobId = (0, uuid_1.v4)();
            await dbService.createJob(jobId, cleanTranscript);
            // Return immediately (async processing)
            res.status(202).json({
                jobId,
                status: "processing",
            });
            // Process asynchronously in the background
            // Do NOT await this - return response immediately
            jobProcessorService
                .processTranscript(jobId, cleanTranscript)
                .catch((error) => {
                console.error(`Background processing failed for job ${jobId}:`, error);
            });
        }
        catch (error) {
            console.error("Error in /submit:", error);
            res.status(500).json({
                error: "Internal server error",
            });
        }
    });
    /**
     * GET /api/status/:jobId
     * Get processing status and results
     *
     * Response:
     * - status: "processing" | "done" | "error"
     * - result: ProcessingResult (only if status = done)
     * - error: string (only if status = error)
     *
     * Level 1: Returns validated dependency graph once processing completes
     */
    router.get("/status/:jobId", async (req, res) => {
        try {
            const { jobId } = req.params;
            // Validate jobId format
            if (!jobId || typeof jobId !== "string" || !jobId.trim()) {
                return res.status(400).json({
                    error: "Invalid jobId",
                });
            }
            const job = await dbService.getJob(jobId);
            if (!job) {
                return res.status(404).json({
                    error: "Job not found",
                });
            }
            // Return job status
            if (job.status === "done") {
                res.status(200).json({
                    status: "done",
                    result: job.result,
                });
            }
            else if (job.status === "error") {
                res.status(200).json({
                    status: "error",
                    error: job.error,
                });
            }
            else {
                // processing
                res.status(200).json({
                    status: "processing",
                });
            }
        }
        catch (error) {
            console.error("Error in /status:", error);
            res.status(500).json({
                error: "Internal server error",
            });
        }
    });
    return router;
}
