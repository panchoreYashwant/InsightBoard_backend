# InsightBoard Backend

Backend service for the Dependency Engine that processes transcripts and generates task dependency graphs.

## Environment Variables

Create a `.env` file in the root directory:

```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/insightboard?retryWrites=true&w=majority
OPENAI_API_KEY=sk-...
PORT=3000
NODE_ENV=development
```

## Setup

```bash
npm install
npx prisma generate
npx prisma db push # Initialize MongoDB
npm run dev
```

## Project Structure

- `src/types/` - TypeScript interfaces and types
- `src/services/` - Business logic (LLM, validation, graph algorithms)
- `src/routes/` - Express route handlers
- `src/utils/` - Helper functions

## API Endpoints

- `POST /api/submit` - Submit a transcript for processing
- `GET /api/status/:jobId` - Get processing status and results
