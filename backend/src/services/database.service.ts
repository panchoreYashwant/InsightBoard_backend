import crypto from 'crypto';
import mongoose from 'mongoose';
import { JobModel, TaskModel, IJob } from '../models';
import { ValidatedTask, ProcessingResult } from '../types';

/**
 * Database operations for jobs and tasks using Mongoose.
 * Handles persistence of transcripts, results, and job status.
 */
export class DatabaseService {
  /**
   * Connects to the MongoDB database.
   */
  async connect(uri: string): Promise<void> {
    try {
      await mongoose.connect(uri);
      console.log('[DB] Connected to MongoDB');
    } catch (error) {
      console.error('[DB] Connection error:', error);
      throw new Error('Failed to connect to database');
    }
  }

  /**
   * Disconnects from the MongoDB database.
   */
  async disconnect(): Promise<void> {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB');
  }

  /**
   * Generates SHA256 hash of transcript for idempotency.
   */
  private hashTranscript(transcript: string): string {
    return crypto.createHash('sha256').update(transcript).digest('hex');
  }

  /**
   * Checks if a transcript has already been processed (idempotency).
   * Returns jobId if found, null otherwise.
   */
  async findExistingJob(transcript: string): Promise<string | null> {
    const hash = this.hashTranscript(transcript);
    const job = await JobModel.findOne({ transcriptHash: hash });
    return job ? job.jobId : null;
  }

  /**
   * Creates a new job entry.
   */
  async createJob(jobId: string, transcript: string): Promise<void> {
    const hash = this.hashTranscript(transcript);
    const job = new JobModel({
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
  async completeJob(jobId: string, result: ProcessingResult): Promise<void> {
    await JobModel.updateOne({ jobId }, { $set: { status: 'done', result } });
    console.log(`[DB] Completed job ${jobId}`);
  }

  /**
   * Updates job status to "error" with an error message.
   */
  async failJob(jobId: string, error: string): Promise<void> {
    await JobModel.updateOne({ jobId }, { $set: { status: 'error', error } });
    console.log(`[DB] Failed job ${jobId}: ${error}`);
  }

  /**
   * Retrieves a job by its ID.
   */
  async getJob(jobId: string): Promise<IJob | null> {
    return JobModel.findOne({ jobId });
  }

  /**
   * Stores validated tasks in the database.
   */
  async saveTasks(jobId: string, tasks: ValidatedTask[]): Promise<void> {
    const taskDocs = tasks.map(task => ({
      jobId,
      taskId: task.id,
      ...task,
    }));
    await TaskModel.insertMany(taskDocs);
    console.log(`[DB] Saved ${tasks.length} tasks for job ${jobId}`);
  }

  /**
   * Set a task's completion flag inside the job result and return updated result.
   */
  async setTaskCompletion(jobId: string, taskId: string, completed: boolean): Promise<ProcessingResult | null> {
    const job = await JobModel.findOne({ jobId });
    if (!job || !job.result) return null;
    const tasks: any[] = job.result.tasks || [];
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return null;
    t.completed = completed;
    // Update status in job.result
    t.status = completed ? 'completed' : 'ready';
    job.result.tasks = tasks;

    // Update TaskModel document status as well
    await TaskModel.updateOne({ jobId, taskId }, { $set: { status: completed ? 'completed' : 'ready' } }).exec();

    // Append activity to job
    const activityMsg = `Task ${taskId} marked ${completed ? 'completed' : 'not completed'}`;
    job.activities = job.activities || [];
    job.activities.push({ ts: new Date(), message: activityMsg } as any);

    await job.save();

    return job.result as ProcessingResult;
  }
}
