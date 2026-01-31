/**
 * Core type definitions for the Dependency Engine
 */

/**
 * LLM output structure - UNTRUSTED INPUT
 * Must be validated and sanitized before use
 */
export interface LLMTaskOutput {
  id: string;
  description: string;
  priority: "low" | "medium" | "high";
  dependencies: string[];
}

/**
 * Validated task structure after processing
 */
export interface ValidatedTask {
  id: string;
  description: string;
  priority: "low" | "medium" | "high";
  dependencies: string[]; // Only contains valid IDs
  status: "pending" | "ready" | "blocked" | "error";
}

/**
 * Job processing result
 */
export interface ProcessingResult {
  tasks: ValidatedTask[];
  circularDependencies: string[][]; // List of cycles found, if any
  sanitizationReport: {
    invalidDependenciesRemoved: number;
    tasksMarkedAsError: number;
  };
}

/**
 * Graph node for cycle detection
 */
export interface GraphNode {
  taskId: string;
  dependencies: string[];
}

/**
 * DFS cycle detection result
 */
export interface CycleDetectionResult {
  hasCycle: boolean;
  cycles: string[][]; // List of task IDs forming cycles
  errorTaskIds: string[]; // Tasks involved in cycles
}
