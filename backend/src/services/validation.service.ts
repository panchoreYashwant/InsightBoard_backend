import { LLMTaskOutput, ValidatedTask, CycleDetectionResult, GraphNode } from "../types";

/**
 * Validates LLM output against strict schema
 * UNTRUSTED INPUT - Ensures type safety and removes invalid dependencies
 */
export class ValidationService {
  /**
   * Validates and sanitizes LLM output
   * Removes invalid dependencies that reference non-existent tasks
   */
  static validateTasks(
    tasks: unknown[]
  ): { validated: ValidatedTask[]; invalidDependenciesRemoved: number } {
    let invalidCount = 0;
    const validated: ValidatedTask[] = [];

    // First pass: validate schema and collect valid task IDs
    const validTaskIds = new Set<string>();
    const duplicateIds: string[] = [];

    for (const task of tasks) {
      const validated_task = this.validateTaskSchema(task);
      if (validated_task) {
        // Check for duplicate IDs
        if (validTaskIds.has(validated_task.id)) {
          duplicateIds.push(validated_task.id);
        } else {
          validated.push(validated_task);
          validTaskIds.add(validated_task.id);
        }
      }
    }

    // If duplicates were found, fail fast with a validation error so the
    // caller (job processor) can mark the job as failed and surface the
    // duplicate IDs to the user.
    if (duplicateIds.length > 0) {
      throw new Error(
        `Validation failed: duplicate task IDs detected: ${Array.from(
          new Set(duplicateIds),
        ).join(', ')}`
      );
    }

    // Second pass: sanitize dependencies - remove references to non-existent tasks
    const sanitized: ValidatedTask[] = [];
    for (const task of validated) {
      const originalDepsLength = task.dependencies.length;
      task.dependencies = task.dependencies.filter((depId) =>
        validTaskIds.has(depId)
      );

      invalidCount += originalDepsLength - task.dependencies.length;
      sanitized.push(task);
    }

    return { validated: sanitized, invalidDependenciesRemoved: invalidCount };
  }

  /**
   * Validates individual task against schema
   * Returns null if validation fails
   */
  private static validateTaskSchema(task: unknown): ValidatedTask | null {
    if (!task || typeof task !== "object") {
      return null;
    }

    const t = task as Record<string, unknown>;

    // Validate required fields
    if (typeof t.id !== "string" || !t.id.trim()) {
      return null;
    }

    if (typeof t.description !== "string" || !t.description.trim()) {
      return null;
    }

    const priority = t.priority;
    if (!["low", "medium", "high"].includes(priority as string)) {
      return null;
    }

    // Validate dependencies array
    if (!Array.isArray(t.dependencies)) {
      return null;
    }

    const dependencies = t.dependencies.filter(
      (dep): dep is string => typeof dep === "string" && dep.trim() !== ""
    );

    return {
      id: t.id.trim(),
      description: t.description.trim(),
      priority: priority as "low" | "medium" | "high",
      dependencies,
      status: "pending",
    };
  }
}

/**
 * Graph algorithms for cycle detection
 */
export class GraphService {
  /**
   * Detects circular dependencies using Depth-First Search (DFS)
   * Returns info about cycles and marks tasks as error if they're involved in cycles
   *
   * Algorithm:
   * 1. Build adjacency list from task dependencies
   * 2. For each unvisited node, perform DFS
   * 3. Track visiting stack to detect back edges (cycles)
   * 4. Record all cycles and affected tasks
   */
  static detectCycles(tasks: ValidatedTask[]): CycleDetectionResult {
    const graph = new Map<string, string[]>();

    // Build adjacency list
    for (const task of tasks) {
      if (!graph.has(task.id)) {
        graph.set(task.id, []);
      }
      for (const dep of task.dependencies) {
        const deps = graph.get(task.id)!;
        if (!deps.includes(dep)) {
          deps.push(dep);
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const cycles: string[][] = [];
    const errorTaskIds = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (visiting.has(nodeId)) {
        // Found a cycle - extract the cycle from path
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart).concat(nodeId);
          cycles.push(cycle);
          cycle.forEach((id) => errorTaskIds.add(id));
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    // Run DFS from each unvisited node
    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId, []);
      }
    }

    return {
      hasCycle: cycles.length > 0,
      cycles,
      errorTaskIds: Array.from(errorTaskIds),
    };
  }

  /**
   * Marks tasks involved in cycles as error status
   */
  static markCyclicTasksAsError(
    tasks: ValidatedTask[],
    cycleDetection: CycleDetectionResult
  ): ValidatedTask[] {
    return tasks.map((task) => ({
      ...task,
      status: cycleDetection.errorTaskIds.includes(task.id)
        ? "error"
        : (task.status as ValidatedTask["status"]),
    }));
  }

  /**
   * Determines task status based on dependencies
   * - "ready": no dependencies
   * - "blocked": has unmet dependencies
   * - "error": involved in cycle
   */
  static determineTaskStatus(
    task: ValidatedTask,
    allTaskIds: Set<string>
  ): ValidatedTask["status"] {
    if (task.status === "error") {
      return "error"; // Already marked as error (cycle)
    }

    if (task.dependencies.length === 0) {
      return "ready";
    }

    // Check if all dependencies exist
    const allDepsExist = task.dependencies.every((dep) => allTaskIds.has(dep));
    return allDepsExist ? "blocked" : "ready";
  }
}
