import { ValidatedTask, ProcessingResult, LLMTaskOutput } from "../types";
import { ValidationService, GraphService } from "./validation.service";
import { DatabaseService } from "./database.service";
import { LLMService } from "./llm.service";

/**
 * Core orchestration service for async job processing
 * Handles the complete pipeline: LLM -> Validation -> Cycle Detection -> Persistence
 */
export class JobProcessorService {
  private llmService: LLMService;
  private dbService: DatabaseService;

  constructor(llmService: LLMService, dbService: DatabaseService) {
    this.llmService = llmService;
    this.dbService = dbService;
  }

  /**
   * Main processing pipeline
   * This runs asynchronously after job creation
   */
  async processTranscript(jobId: string, transcript: string): Promise<void> {
    try {
      console.log(`[Job ${jobId}] Starting processing...`);

      // Step 1: Call LLM to generate tasks
      console.log(`[Job ${jobId}] Calling LLM...`);
      const llmOutput = await this.llmService.generateTasks(transcript);

      // Step 2: Validate and sanitize LLM output
      // UNTRUSTED INPUT - Remove invalid dependencies, validate schema
      console.log(`[Job ${jobId}] Validating tasks...`);
      const {
        validated: sanitizedTasks,
        invalidDependenciesRemoved,
      } = ValidationService.validateTasks(llmOutput);

      if (sanitizedTasks.length === 0) {
        throw new Error("No valid tasks extracted from transcript");
      }

      // Step 3: Detect circular dependencies using DFS
      console.log(`[Job ${jobId}] Detecting cycles...`);
      const cycleResult = GraphService.detectCycles(sanitizedTasks);

      // Step 4: Mark cyclic tasks as error (but don't crash)
      const processedTasks = GraphService.markCyclicTasksAsError(
        sanitizedTasks,
        cycleResult
      );

      // Step 5: Determine final status for all tasks
      const allTaskIds = new Set(processedTasks.map((t) => t.id));
      const finalTasks: ValidatedTask[] = processedTasks.map((task) => {
        if (task.status === "error") {
          return task; // Keep error status from cycle detection
        }
        return {
          ...task,
          status: GraphService.determineTaskStatus(task, allTaskIds),
        };
      });

      // Step 6: Build result object
      const result: ProcessingResult = {
        tasks: finalTasks,
        circularDependencies: cycleResult.cycles,
        sanitizationReport: {
          invalidDependenciesRemoved,
          tasksMarkedAsError: cycleResult.errorTaskIds.length,
        },
      };

      // Step 7: Persist to database
      console.log(`[Job ${jobId}] Saving results...`);
      await this.dbService.saveTasks(jobId, finalTasks);
      await this.dbService.completeJob(jobId, result);

      console.log(
        `[Job ${jobId}] Processing complete. Tasks: ${finalTasks.length}, Cycles: ${cycleResult.cycles.length}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[Job ${jobId}] Processing failed:`, errorMessage);
      await this.dbService.failJob(jobId, errorMessage);
    }
  }
}
