import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMTaskOutput } from "../types";

/**
 * Google Gemini LLM integration service
 * Generates structured task lists from meeting transcripts
 */
export class LLMService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Gemini API key is missing.");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // If you want to list models, call this.listModels() manually after instantiation.
  }

  // Add this new function to list available models
  async listModels(): Promise<any | null> {
    try {
      // The official client may not expose listModels on the typed API,
      // so cast to any and try a couple of possible shapes.
      const anyGen: any = this.genAI as any;

      if (typeof anyGen.listModels === "function") {
        const result = await anyGen.listModels();
        console.log("Available Gemini Models:", result.models?.map((m: any) => m.name));
        return result;
      }

      if (anyGen.models && typeof anyGen.models.list === "function") {
        const result = await anyGen.models.list();
        console.log("Available Gemini Models:", result.models?.map((m: any) => m.name));
        return result;
      }

      console.warn("listModels is not available on GoogleGenerativeAI client.");
      return null;
    } catch (error) {
      console.error("Could not list models:", error);
      return null;
    }
  }

  /**
   * Calls Gemini API to generate tasks from transcript
   * Returns JSON structure matching LLMTaskOutput schema
   *
   * IMPORTANT: Output is UNTRUSTED and must be validated
   */
  async generateTasks(transcript: string): Promise<LLMTaskOutput[]> {
    console.log("111111111111111111",process.env.GENERATIVE_MODEL , process.env.GEMINI_MODEL)
    const model = this.genAI.getGenerativeModel({ model:  process.env.GENERATIVE_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-flash" });
console.log("111111111111111111",model,process.env.GENERATIVE_MODEL , process.env.GEMINI_MODEL)
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
      const userPrompt = `Analyze this meeting transcript and extract tasks:\n\n${transcript}`;

      // Allow model override via env var to handle API/model differences
      const modelName = process.env.GENERATIVE_MODEL || process.env.GEMINI_MODEL || "models/text-bison-001";

      // Try a few invocation shapes to be resilient across client versions
      let result: any = null;
      let text: string | null = null;

      try {
        if (typeof (model as any).generateContent === "function") {
          result = await (model as any).generateContent([systemPrompt, userPrompt]);
        } else if (typeof (this.genAI as any).responses?.generate === "function") {
          // Some versions expose a `responses.generate` API
          result = await (this.genAI as any).responses.generate({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
        } else if (typeof (this.genAI as any).generate === "function") {
          result = await (this.genAI as any).generate({ model: modelName, input: [systemPrompt, userPrompt] });
        } else if (typeof (this.genAI as any).getGenerativeModel === "function") {
          // Fallback: request a generative model handle with the configured name
          const genModel = (this.genAI as any).getGenerativeModel({ model: modelName });
          if (typeof genModel.generateContent === "function") {
            result = await genModel.generateContent([systemPrompt, userPrompt]);
          }
        }

        if (!result) {
          throw new Error("No supported generate method found on Gemini client. Set GENERATIVE_MODEL env var if needed.");
        }

        // Normalize possible response shapes
        const response = result?.response ?? result ?? null;
        if (response && typeof response.text === "function") {
          text = response.text();
        } else if (response?.output?.[0]?.content?.[0]?.text) {
          text = response.output[0].content[0].text;
        } else if (typeof response === "string") {
          text = response;
        } else {
          text = JSON.stringify(response);
        }

        console.log("[LLM] Raw response from Gemini:", text);

        if (!text) {
          throw new Error("No content in LLM response");
        }
      } catch (geminiErr) {
        console.warn('[LLM] Gemini generation failed, attempting Hugging Face fallback:', (geminiErr as any)?.message ?? geminiErr);

        const hfApiKey = process.env.HF_API_KEY;
        if (!hfApiKey) {
          console.warn('[LLM] HF_API_KEY not set — using local deterministic fallback instead of HF');
          const parts = transcript
            .split(/\n|\.|;|\t/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8);
          const fallbackTasks: LLMTaskOutput[] = parts.map((p, i) => ({
            id: `task-${i + 1}`,
            description: p.length > 200 ? p.slice(0, 197) + '...' : p,
            priority: 'medium',
            dependencies: [],
          } as LLMTaskOutput));
          console.log('[LLM] Local fallback generated tasks (no HF key):', fallbackTasks);
          return fallbackTasks;
        }

        try {
          // dynamic require to avoid type issues across environments
          const { HfInference } = require('@huggingface/inference');
          const hf = new HfInference(hfApiKey);
          const hfModel = process.env.HF_MODEL || 'gmini';
          const hfInput = `${systemPrompt}\n\n${userPrompt}`;
          const hfRes = await hf.textGeneration({ model: hfModel, inputs: hfInput });

          if (Array.isArray(hfRes)) {
            text = hfRes[0]?.generated_text ?? JSON.stringify(hfRes);
          } else if (hfRes?.generated_text) {
            text = hfRes.generated_text;
          } else {
            text = JSON.stringify(hfRes);
          }

          console.log('[LLM] Raw response from HuggingFace:', text);
        } catch (hfErr) {
          console.error('[LLM] Hugging Face fallback failed:', hfErr);
          throw new Error(`Gemini failure: ${(geminiErr as any)?.message || geminiErr}. HF fallback failure: ${(hfErr as any)?.message || hfErr}`);
        }
      }

        // If we reached here and still have no text, provide a local deterministic fallback
        if (!text) {
          console.warn('[LLM] No text from external LLMs — using local deterministic fallback');
          // Simple heuristic: split transcript into sentences/lines and create tasks
          const parts = transcript
            .split(/\n|\.|;|\t/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8);
          const fallbackTasks: LLMTaskOutput[] = parts.map((p, i) => ({
            id: `task-${i + 1}`,
            description: p.length > 200 ? p.slice(0, 197) + '...' : p,
            priority: 'medium',
            dependencies: [],
          } as LLMTaskOutput));
          console.log('[LLM] Local fallback generated tasks:', fallbackTasks);
          return fallbackTasks;
        }

      // Parse JSON response
      let tasks: LLMTaskOutput[];
      try {
        // Gemini can sometimes wrap the JSON in markdown, so we clean it.
        let jsonStr = String(text).trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.slice(7, -3).trim();
        } else if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.slice(3, -3).trim();
        }
        
        tasks = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse LLM response as JSON:", text, e);
        throw new Error("LLM did not return valid JSON");
      }

      if (!Array.isArray(tasks)) {
        throw new Error("LLM response is not an array");
      }

      return tasks;
    } catch (error) {
      console.error("Gemini API error:", error);
      // Surface original error for easier diagnosis while preserving throwing behavior
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate tasks from LLM. ${message}, ${process.env.GENERATIVE_MODEL}, ${process.env.GEMINI_MODEL}`);
    }
  }
}




