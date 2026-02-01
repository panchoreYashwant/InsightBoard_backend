import { Router, Request, Response } from "express";
import { Server as IOServer } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { DatabaseService } from "../services/database.service";
import { JobProcessorService } from "../services/job-processor.service";

interface SubmitRequest extends Request {
  body: {
    transcript?: string;
  };
}

interface StatusRequest extends Request {
  params: {
    jobId: string;
  };
}

/**
 * API routes for the Dependency Engine
 */
export function createRouter(
  dbService: DatabaseService,
  jobProcessorService: JobProcessorService,
  io?: IOServer
): Router {
  const router = Router();
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




  router.get("/test", async (req: SubmitRequest, res: Response) => {
    res.status(200).json({ message: "API is working" });
  });
  router.post("/submit", async (req: SubmitRequest, res: Response) => {
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
        console.log(
          `[Idempotency] Transcript already processed, returning jobId: ${existingJobId}`
        );
        return res.status(200).json({
          jobId: existingJobId,
          status: "processing",
          message: "Transcript already submitted, returning existing job ID",
        });
      }

      // Create new job
      const jobId = uuidv4();
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
        .catch((error: any) => {
          console.error(`Background processing failed for job ${jobId}:`, error);
        });
    } catch (error: any) {
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
  router.get("/status/:jobId", async (req: StatusRequest, res: Response) => {
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
      } else if (job.status === "error") {
        res.status(200).json({
          status: "error",
          error: job.error,
        });
      } else {
        // processing
        res.status(200).json({
          status: "processing",
        });
      }
    } catch (error: any) {
      console.error("Error in /status:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  /**
   * PATCH /api/status/:jobId/task/:taskId
   * Toggle or set task completion flag for a job's task
   * Body: { completed: boolean }
   */
  router.patch(
    "/status/:jobId/task/:taskId",
    async (req: Request, res: Response) => {
      try {
        const { jobId, taskId } = req.params as any;
        const { completed } = req.body as { completed?: boolean };

        if (!jobId || !taskId) {
          return res.status(400).json({ error: "Invalid jobId or taskId" });
        }

        if (typeof completed !== "boolean") {
          return res.status(400).json({ error: "Body must include boolean 'completed'" });
        }

        const updated = await dbService.setTaskCompletion(jobId, taskId, completed);
        if (!updated) {
          return res.status(404).json({ error: "Job or task not found" });
        }

        // Emit websocket event to notify clients about the change
        try {
          if (io) {
            // Emit only to clients subscribed to this job's room
            io.to(jobId).emit("taskUpdated", { jobId, taskId, completed });
          }
        } catch (e) {
          console.warn("Failed to emit socket event", e);
        }

        return res.status(200).json({ status: "ok", result: updated });
      } catch (err: any) {
        console.error("Error in PATCH /status/:jobId/task/:taskId", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  return router;
}


