# InsightBoard Dependency Engine - Backend

## Overview

This is a **Level 1 (Mandatory) + Level 2 (Async & Idempotency)** implementation of the InsightBoard Dependency Engine. The system processes meeting transcripts using an LLM and generates a structured dependency graph with built-in cycle detection.

**Tech Stack:**

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** MongoDB (via Prisma ORM)
- **LLM:** OpenAI API (Claude 3.5 Sonnet)

## Architecture

### Core Services

#### 1. **LLMService** (`src/services/llm.service.ts`)

- Calls OpenAI API with a structured system prompt
- Generates tasks in strict JSON format: `{ id, description, priority, dependencies }`
- **CRITICAL:** Treats output as untrusted input

#### 2. **ValidationService** (`src/services/validation.service.ts`)

- **Validates** LLM output against schema (handles type coercion, null checks)
- **Sanitizes** invalid dependencies (removes references to non-existent tasks)
- Reports how many dependencies were removed
- Returns only tasks that match the strict schema

#### 3. **GraphService** (`src/services/validation.service.ts`)

- Implements **Depth-First Search (DFS)** for cycle detection
- Tracks `visiting` and `visited` sets to detect back edges
- Returns:
  - List of all cycles found (as task ID chains)
  - List of tasks involved in cycles
  - Does NOT crash if cycles are found ✓

#### 4. **DatabaseService** (`src/services/database.service.ts`)

- Persists:
  - Original transcript
  - Job status (processing | done | error)
  - Final sanitized dependency graph
  - Task metadata (id, description, priority, status, dependencies)
- Implements **idempotency** via SHA256 hash of transcript

#### 5. **JobProcessorService** (`src/services/job-processor.service.ts`)

- Orchestrates the entire pipeline:
  1. Call LLM → Get tasks
  2. Validate & sanitize → Remove bad deps
  3. Detect cycles → Find problems
  4. Mark cyclic tasks as error
  5. Determine final task status
  6. Persist to database
- Runs **asynchronously** (doesn't block response)

### Express Routes

#### `POST /api/submit`

**Request:**

```json
{
  "transcript": "Meeting transcript here..."
}
```

**Response (202 Accepted):**

```json
{
  "jobId": "uuid-here",
  "status": "processing"
}
```

**Features:**

- Returns immediately (async processing)
- **Level 2:** Checks if transcript already processed
  - Same transcript = same jobId (idempotency)
  - Prevents duplicate LLM calls

#### `GET /api/status/:jobId`

**Response (processing):**

```json
{
  "status": "processing"
}
```

**Response (done):**

```json
{
  "status": "done",
  "result": {
    "tasks": [
      {
        "id": "task-1",
        "description": "...",
        "priority": "high",
        "dependencies": ["task-0"],
        "status": "blocked"
      }
    ],
    "circularDependencies": [],
    "sanitizationReport": {
      "invalidDependenciesRemoved": 2,
      "tasksMarkedAsError": 0
    }
  }
}
```

**Response (error):**

```json
{
  "status": "error",
  "error": "Error message..."
}
```

---

## Data Validation & Safety

### Strict Schema Enforcement

```typescript
interface ValidatedTask {
  id: string; // UUID or unique ID
  description: string; // Non-empty description
  priority: "low" | "medium" | "high";
  dependencies: string[]; // IDs of dependencies
  status: "pending" | "ready" | "blocked" | "error";
}
```

### Untrusted Input Handling

1. **LLM Output is NOT trusted**
   - May contain invalid JSON
   - May reference non-existent tasks
   - May have wrong priority values
   - May have circular dependencies

2. **Validation removes:**
   - Tasks with missing/invalid fields
   - Dependencies referencing non-existent tasks
   - Invalid priority values
   - Duplicate/malformed data

3. **Cycle Detection marks tasks as error:**
   - Does NOT crash
   - Returns list of cycles
   - Sets status = "error" for cyclic tasks

### Circular Dependency Detection (DFS)

The algorithm works as follows:

```
For each unvisited node:
  DFS(node):
    If node in visiting_set → cycle found (back edge)
    If node in visited_set → already processed

    Add node to visiting
    For each neighbor in dependencies:
      DFS(neighbor)
    Remove node from visiting
    Add node to visited
```

Example cycle: Task A → B → C → A is detected and all three marked as "error"

---

## Database Schema (MongoDB)

### Job Collection

```javascript
{
  _id: ObjectId,
  jobId: string (unique),        // UUID for API reference
  transcript: string,             // Original transcript
  transcriptHash: string (unique), // SHA256 hash for idempotency
  status: string,                 // processing | done | error
  result: JSON,                   // ProcessingResult (if done)
  error: string,                  // Error message (if error)
  createdAt: Date,
  updatedAt: Date
}
```

### Task Collection

```javascript
{
  _id: ObjectId,
  jobId: string,                  // Reference to Job
  taskId: string,                 // Task ID from LLM
  description: string,
  priority: string,               // low | medium | high
  dependencies: [string],         // Array of task IDs
  status: string,                 // pending | ready | blocked | error
  createdAt: Date,
  updatedAt: Date
}
```

---

## Setup & Running

### Prerequisites

- Node.js 18+
- MongoDB Atlas account or local MongoDB
- OpenAI API key

### Installation

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Initialize database (creates collections)
npx prisma db push
```

### Environment Variables

Create `.env` file:

```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/insightboard?retryWrites=true&w=majority
OPENAI_API_KEY=sk-your-api-key
PORT=3000
NODE_ENV=development
```

### Development

```bash
# Run with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm run start
```

### Debugging

```bash
# View database
npx prisma studio

# Check logs
# All console.log statements are prefixed with [Job jobId]
```

---

## Testing the API

### Submit a Transcript

```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "In this meeting we discussed the new product. First, we need to design the architecture. Once that is done, we will implement the API. Then we will write tests. Finally, we will deploy to production."
  }'

# Response:
# {"jobId":"abc-123","status":"processing"}
```

### Check Status

```bash
curl http://localhost:3000/api/status/abc-123

# While processing:
# {"status":"processing"}

# When done:
# {"status":"done","result":{...}}
```

### Test Idempotency

Submit the SAME transcript twice → Should get the same jobId

---

## Code Quality

### Type Safety

- Full TypeScript with `strict: true`
- All functions have return types
- No `any` except for JSON serialization

### Error Handling

- Validation doesn't crash on bad data
- Cycle detection doesn't crash on cycles
- All errors logged with context
- Graceful degradation

### Modularity

- Clear separation of concerns
- Each service has single responsibility
- Easy to test and extend

---

## Important Notes

### Level 1 Requirements ✓

- [x] Strict output schema (id, description, priority, dependencies)
- [x] Validation of all dependencies exist
- [x] Cycle detection (DFS algorithm)
- [x] Database persistence
- [x] Data integrity

### Level 2 Requirements ✓

- [x] Async job processing (POST returns immediately)
- [x] Job status endpoint (GET /status/:jobId)
- [x] Idempotency (SHA256 hash of transcript)

### Future Enhancements (Not Implemented)

- Level 3: Graph visualization frontend
- API authentication/authorization
- Rate limiting
- Monitoring/metrics
- Webhook notifications on job completion

---

## Deployment

### Render Backend

```bash
# Push code
git push

# Render will:
# 1. Install dependencies
# 2. Run prisma generate
# 3. Push database schema
# 4. Start npm run start

# Set environment variables in Render dashboard
```

### Vercel Frontend (Next.js)

```bash
# Will be in /frontend directory
# Deploy with: vercel
```

---

## File Structure

```
backend/
├── src/
│   ├── index.ts                 # Express app & server
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── services/
│   │   ├── index.ts             # Service exports
│   │   ├── llm.service.ts        # OpenAI integration
│   │   ├── validation.service.ts # Validation & cycle detection
│   │   ├── database.service.ts   # MongoDB operations
│   │   └── job-processor.service.ts # Orchestration
│   └── routes/
│       └── index.ts             # Express routes
├── prisma/
│   └── schema.prisma            # MongoDB schema
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── .gitignore
```
