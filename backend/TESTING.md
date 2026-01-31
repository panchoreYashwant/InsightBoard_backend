/\*\*

- Example API usage and integration tests
-
- Run these commands in your terminal to test the API:
  \*/

// 1. Start the backend
// npm run dev

// 2. In another terminal, test the submit endpoint:

// ==== EXAMPLE 1: Simple transcript ====
curl -X POST http://localhost:3000/api/submit \
 -H "Content-Type: application/json" \
 -d '{
"transcript": "In this meeting we need to build a new feature. First, we need to gather requirements. After that, we design the system. Then we implement the backend. Once backend is done, we implement the frontend. Finally we test everything."
}'

// Expected response:
// {
// "jobId": "550e8400-e29b-41d4-a716-446655440000",
// "status": "processing"
// }

// 3. Check the job status:

curl http://localhost:3000/api/status/550e8400-e29b-41d4-a716-446655440000

// After a few seconds, you'll get:
// {
// "status": "done",
// "result": {
// "tasks": [
// {
// "id": "task-1",
// "description": "Gather requirements",
// "priority": "high",
// "dependencies": [],
// "status": "ready"
// },
// {
// "id": "task-2",
// "description": "Design the system",
// "priority": "high",
// "dependencies": ["task-1"],
// "status": "blocked"
// },
// ...
// ],
// "circularDependencies": [],
// "sanitizationReport": {
// "invalidDependenciesRemoved": 0,
// "tasksMarkedAsError": 0
// }
// }
// }

// ==== EXAMPLE 2: Test Idempotency ====
// Submit the SAME transcript twice

curl -X POST http://localhost:3000/api/submit \
 -H "Content-Type: application/json" \
 -d '{
"transcript": "In this meeting we need to build a new feature. First, we need to gather requirements. After that, we design the system. Then we implement the backend. Once backend is done, we implement the frontend. Finally we test everything."
}'

// You'll get the SAME jobId both times!
// Second call returns: "message": "Transcript already submitted, returning existing job ID"

// ==== EXAMPLE 3: Test Cycle Detection ====
// This transcript mentions circular dependencies (A depends on B, B depends on A)

curl -X POST http://localhost:3000/api/submit \
 -H "Content-Type: application/json" \
 -d '{
"transcript": "Task A cannot start until Task B is done. Task B cannot start until Task A is done. Also we need Task C which depends on both A and B."
}'

// When you check the status, the result will show:
// "circularDependencies": [["task-a", "task-b", "task-a"]],
// Tasks A and B will have: "status": "error"
// But the API will NOT crash - it will return the error safely

// ==== EXAMPLE 4: Test Invalid Dependencies ====
// LLM might reference tasks that don't exist - our validation removes them

curl -X POST http://localhost:3000/api/submit \
 -H "Content-Type: application/json" \
 -d '{
"transcript": "We need to do Task 1. Task 2 depends on Task 1. Task 3 depends on Task 1, Task 2, and some undefined task that was never mentioned."
}'

// Result will show:
// "sanitizationReport": {
// "invalidDependenciesRemoved": 1 <- That undefined dependency was removed
// }

// ==== USING WITH JAVASCRIPT/TYPESCRIPT ====

import fetch from 'node-fetch';

async function submitTranscript(transcript: string) {
const response = await fetch('http://localhost:3000/api/submit', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({ transcript }),
});

const data = await response.json();
return data.jobId;
}

async function checkStatus(jobId: string) {
const response = await fetch(`http://localhost:3000/api/status/${jobId}`);
const data = await response.json();

if (data.status === 'processing') {
console.log('Still processing...');
return null;
}

if (data.status === 'error') {
console.error('Processing failed:', data.error);
return null;
}

return data.result;
}

async function waitForResult(jobId: string, maxWaitMs = 30000) {
const startTime = Date.now();

while (Date.now() - startTime < maxWaitMs) {
const result = await checkStatus(jobId);
if (result) {
return result;
}

    await new Promise(resolve => setTimeout(resolve, 1000));

}

throw new Error('Timeout waiting for job completion');
}

// Usage:
async function main() {
const jobId = await submitTranscript('Your meeting transcript here...');
console.log('Job ID:', jobId);

const result = await waitForResult(jobId);
console.log('Tasks:', result.tasks);
console.log('Cycles found:', result.circularDependencies.length);
}

main().catch(console.error);
