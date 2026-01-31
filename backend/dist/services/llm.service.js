"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const generative_ai_1 = require("@google/generative-ai");
/**
 * Google Gemini LLM integration service
 * Generates structured task lists from meeting transcripts
 */
class LLMService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error("Gemini API key is missing.");
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    /**
     * Calls Gemini API to generate tasks from transcript
     * Returns JSON structure matching LLMTaskOutput schema
     *
     * IMPORTANT: Output is UNTRUSTED and must be validated
     */
    async generateTasks(transcript) {
        const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        const systemPrompt = `You are an expert project manager AI. Analyze the given meeting transcript and extract a structured list of actionable tasks.

CRITICAL: You MUST respond with a valid JSON array. Each task must have exactly these fields:
- id: A unique string identifier (e.g., "task-1", "task-2")
- description: Clear task description
- priority: One of "low", "medium", or "high"
- dependencies: Array of task IDs that must be completed first

Example response format:
[
  {"id": "task-1", "description": "Review requirements", "priority": "high", "dependencies": []},
  {"id": "task-2", "description": "Design architecture", "priority": "high", "dependencies": ["task-1"]},
  {"id": "task-3", "description": "Implement API", "priority": "medium", "dependencies": ["task-2"]}
]

Rules:
1. Only include ACTIONABLE tasks mentioned in the transcript
2. Do NOT invent tasks not discussed
3. Do NOT create circular dependencies
4. Use realistic, achievable task descriptions
5. Ensure dependencies make logical sense
6. Return ONLY the JSON array, no additional text or markdown formatting.`;
        try {
            const result = await model.generateContent([
                systemPrompt,
                `Analyze this meeting transcript and extract tasks:\n\n${transcript}`
            ]);
            const response = result.response;
            const text = response.text();
            if (!text) {
                throw new Error("No content in LLM response");
            }
            // Parse JSON response
            let tasks;
            try {
                // Gemini can sometimes wrap the JSON in markdown, so we clean it.
                let jsonStr = text.trim();
                if (jsonStr.startsWith("```json")) {
                    jsonStr = jsonStr.slice(7, -3).trim();
                }
                else if (jsonStr.startsWith("```")) {
                    jsonStr = jsonStr.slice(3, -3).trim();
                }
                tasks = JSON.parse(jsonStr);
            }
            catch (e) {
                console.error("Failed to parse LLM response as JSON:", text);
                throw new Error("LLM did not return valid JSON");
            }
            if (!Array.isArray(tasks)) {
                throw new Error("LLM response is not an array");
            }
            return tasks;
        }
        catch (error) {
            console.error("Gemini API error:", error);
            throw new Error("Failed to generate tasks from LLM.");
        }
    }
}
exports.LLMService = LLMService;
