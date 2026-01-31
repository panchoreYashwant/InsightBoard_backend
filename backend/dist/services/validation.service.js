"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphService = exports.ValidationService = void 0;
/**
 * Validates LLM output against strict schema
 * UNTRUSTED INPUT - Ensures type safety and removes invalid dependencies
 */
class ValidationService {
    /**
     * Validates and sanitizes LLM output
     * Removes invalid dependencies that reference non-existent tasks
     */
    static validateTasks(tasks) {
        let invalidCount = 0;
        const validated = [];
        // First pass: validate schema and collect valid task IDs
        const validTaskIds = new Set();
        for (const task of tasks) {
            const validated_task = this.validateTaskSchema(task);
            if (validated_task) {
                validated.push(validated_task);
                validTaskIds.add(validated_task.id);
            }
        }
        // Second pass: sanitize dependencies - remove references to non-existent tasks
        const sanitized = [];
        for (const task of validated) {
            const originalDepsLength = task.dependencies.length;
            task.dependencies = task.dependencies.filter((depId) => validTaskIds.has(depId));
            invalidCount += originalDepsLength - task.dependencies.length;
            sanitized.push(task);
        }
        return { validated: sanitized, invalidDependenciesRemoved: invalidCount };
    }
    /**
     * Validates individual task against schema
     * Returns null if validation fails
     */
    static validateTaskSchema(task) {
        if (!task || typeof task !== "object") {
            return null;
        }
        const t = task;
        // Validate required fields
        if (typeof t.id !== "string" || !t.id.trim()) {
            return null;
        }
        if (typeof t.description !== "string" || !t.description.trim()) {
            return null;
        }
        const priority = t.priority;
        if (!["low", "medium", "high"].includes(priority)) {
            return null;
        }
        // Validate dependencies array
        if (!Array.isArray(t.dependencies)) {
            return null;
        }
        const dependencies = t.dependencies.filter((dep) => typeof dep === "string" && dep.trim() !== "");
        return {
            id: t.id.trim(),
            description: t.description.trim(),
            priority: priority,
            dependencies,
            status: "pending",
        };
    }
}
exports.ValidationService = ValidationService;
/**
 * Graph algorithms for cycle detection
 */
class GraphService {
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
    static detectCycles(tasks) {
        const graph = new Map();
        // Build adjacency list
        for (const task of tasks) {
            if (!graph.has(task.id)) {
                graph.set(task.id, []);
            }
            for (const dep of task.dependencies) {
                const deps = graph.get(task.id);
                if (!deps.includes(dep)) {
                    deps.push(dep);
                }
            }
        }
        const visited = new Set();
        const visiting = new Set();
        const cycles = [];
        const errorTaskIds = new Set();
        const dfs = (nodeId, path) => {
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
    static markCyclicTasksAsError(tasks, cycleDetection) {
        return tasks.map((task) => ({
            ...task,
            status: cycleDetection.errorTaskIds.includes(task.id)
                ? "error"
                : task.status,
        }));
    }
    /**
     * Determines task status based on dependencies
     * - "ready": no dependencies
     * - "blocked": has unmet dependencies
     * - "error": involved in cycle
     */
    static determineTaskStatus(task, allTaskIds) {
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
exports.GraphService = GraphService;
