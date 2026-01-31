# InsightBoard Backend - Implementation Summary

**Status:** ✅ Level 1 (Mandatory) + Level 2 (Async & Idempotency) Complete

## What Has Been Built

A production-ready backend service that:

1. **Accepts meeting transcripts** via REST API
2. **Calls OpenAI LLM** to extract tasks in structured JSON
3. **Validates all input** treating LLM output as untrusted
4. **Removes invalid dependencies** automatically
5. **Detects circular dependencies** using DFS algorithm
6. **Marks problematic tasks** as "error" status without crashing
7. **Persists everything** to MongoDB (transcript, results, metadata)
8. **Processes asynchronously** - returns jobId immediately
9. **Implements idempotency** - same transcript = same result, no duplicate LLM calls
10. **Provides status endpoint** to check processing progress and retrieve results

---

## Key Design Decisions

### 1. **Untrusted Input Handling**

- LLM output is validated against strict schema
- Dependencies referencing non-existent tasks are removed silently
- Invalid field values are caught and tasks skipped
- No crashes - graceful degradation

### 2. **Cycle Detection (DFS Algorithm)**

```
For each task, track:
  - visiting: Currently exploring this path
  - visited: Already processed this task

If we encounter a task in "visiting" set → found a cycle (back edge)
- Record the full cycle chain
- Mark all involved tasks as "error"
- Continue processing other tasks
```

### 3. **Async Job Processing**

```
POST /submit → Returns jobId immediately (202 Accepted)
              ↓ (background processing starts)
              Calls LLM
              Validates & sanitizes
              Detects cycles
              Saves to database
              ↓
GET /status/:jobId → Returns result when done
```

### 4. **Idempotency via Content Hash**

```
SHA256(transcript) = transcript_hash
- If same transcript submitted twice → same jobId returned
- LLM never called again for same transcript
- Prevents accidental duplicate processing
- Database unique constraint ensures only one job per transcript
```

---

## File Structure

```
backend/
├── src/
│   ├── index.ts                 # Express server
│   ├── types/index.ts           # TypeScript interfaces
│   │
│   ├── services/
│   │   ├── llm.service.ts        # OpenAI API calls
│   │   ├── validation.service.ts # Input validation + DFS cycle detection
│   │   ├── database.service.ts   # MongoDB operations
│   │   ├── job-processor.service.ts # Orchestration pipeline
│   │   └── index.ts             # Exports
│   │
│   └── routes/
│       └── index.ts             # Express routes
│
├── prisma/
│   └── schema.prisma            # MongoDB schema (Job + Task collections)
│
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── ARCHITECTURE.md              # Detailed technical documentation
├── TESTING.md                   # API testing examples
├── start.sh                     # Quick start script
└── .gitignore
```

---

## API Contracts

### POST /api/submit

**Request:**

```json
{
  "transcript": "Meeting transcript text..."
}
```

**Response (202 Accepted):**

```json
{
  "jobId": "uuid",
  "status": "processing"
}
```

---

### GET /api/status/:jobId

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
        "priority": "high|medium|low",
        "dependencies": ["task-0"],
        "status": "ready|blocked|error|pending"
      }
    ],
    "circularDependencies": [["task-a", "task-b", "task-a"]],
    "sanitizationReport": {
      "invalidDependenciesRemoved": 2,
      "tasksMarkedAsError": 1
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

## Database Schema

### Job Collection (MongoDB)

```javascript
{
  _id: ObjectId,
  jobId: string (unique),
  transcript: string,
  transcriptHash: string (unique),  // SHA256 hash
  status: "processing" | "done" | "error",
  result: {...},
  error: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Task Collection (MongoDB)

```javascript
{
  _id: ObjectId,
  jobId: string,
  taskId: string,
  description: string,
  priority: "low" | "medium" | "high",
  dependencies: string[],
  status: "pending" | "ready" | "blocked" | "error",
  createdAt: Date,
  updatedAt: Date
}
```

---

## Type Safety

All code is written with `strict: true` TypeScript:

- ✅ No implicit `any`
- ✅ All functions have return types
- ✅ All parameters are typed
- ✅ Discriminated unions for status types

---

## Error Handling

| Scenario                 | Behavior                                                  |
| ------------------------ | --------------------------------------------------------- |
| Invalid JSON in request  | 400 Bad Request                                           |
| Empty transcript         | 400 Bad Request                                           |
| LLM returns invalid JSON | Job status = "error"                                      |
| LLM API fails            | Job status = "error" + message                            |
| Cycles detected          | Tasks marked status = "error", job completes successfully |
| Invalid dependencies     | Removed silently, report in `sanitizationReport`          |
| Job not found            | 404 Not Found                                             |

---

## How to Use

### 1. **Setup**

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and OpenAI API key

npm install
npx prisma generate
npx prisma db push
```

### 2. **Run**

```bash
npm run dev
# Server runs on http://localhost:3000
```

### 3. **Submit Transcript**

```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"transcript": "..."}'
```

### 4. **Check Status**

```bash
curl http://localhost:3000/api/status/{jobId}
```

---

## What's NOT Implemented (Out of Scope)

- ❌ Level 3 (Graph visualization UI) - optional bonus
- ❌ Authentication/Authorization
- ❌ Rate limiting
- ❌ API versioning
- ❌ Webhook notifications
- ❌ Batch processing endpoint

---

## Production Readiness

✅ **Type Safety:** Full TypeScript with strict mode
✅ **Error Handling:** No unhandled crashes
✅ **Data Validation:** Untrusted input is sanitized
✅ **Database Design:** Proper indexes and schema
✅ **Async Processing:** Non-blocking job handling
✅ **Idempotency:** Content hashing prevents duplicates
✅ **Logging:** Context-aware console logs with job IDs
✅ **Code Organization:** Clean separation of concerns
✅ **Documentation:** Comprehensive inline comments

---

## Key Algorithms

### Cycle Detection (Depth-First Search)

**Time Complexity:** O(V + E) where V = tasks, E = dependencies
**Space Complexity:** O(V) for visited/visiting sets

```typescript
function dfs(nodeId, path):
  if nodeId in visiting_set:
    → Found cycle
  if nodeId in visited_set:
    → Already processed

  Add to visiting
  For each neighbor:
    dfs(neighbor)
  Remove from visiting
  Add to visited
```

### Idempotency (SHA256 Hashing)

```
transcript → SHA256 → hash
hash unique in database
If exists → return existing jobId
Else → create new job
```

---

## Next Steps for Frontend

The frontend (Next.js + Material UI) will:

1. Call `POST /api/submit` with transcript
2. Poll `GET /api/status/:jobId` until done
3. Display tasks and dependencies
4. Render graph visualization (Level 3)
5. Handle user interactions (click task to mark complete)

---

## Deployment

### Render (Backend)

```
1. Push code to GitHub
2. Connect Render to repo
3. Set environment variables (DATABASE_URL, OPENAI_API_KEY)
4. Deploy - Render will run: npm install → npm run build → npm start
```

### Vercel (Frontend)

```
1. Create frontend in /frontend directory (Next.js)
2. Deploy from Vercel dashboard
3. Configure NEXT_PUBLIC_API_URL to point to Render backend
```

---

## Questions?

Refer to:

- `ARCHITECTURE.md` - Technical deep dive
- `TESTING.md` - API examples and curl commands
- Inline code comments - Logic explanations

All code follows the assignment requirements exactly. ✅
