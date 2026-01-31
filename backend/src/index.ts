import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createRouter } from './routes';
import { DatabaseService } from './services/database.service';
import { LLMService } from './services/llm.service';
import { JobProcessorService } from './services/job-processor.service';
import http from 'http';
import { Server as IOServer } from 'socket.io';

dotenv.config();

async function main() {
  const app = express();
  const port = process.env.PORT || 3000;
  const mongoUri = process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error('DATABASE_URL is not defined in the environment variables.');
  }

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Initialize services and connect to DB
  const dbService = new DatabaseService();
  await dbService.connect(mongoUri);

  const llmService = new LLMService(process.env.GEMINI_API_KEY || '');
  const jobProcessorService = new JobProcessorService(llmService, dbService);

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  // Start server (with socket.io)
  const httpServer = http.createServer(app);
  const io = new IOServer(httpServer, { cors: { origin: '*' } });

  // Socket connection handling: allow clients to join job-scoped rooms
  io.on('connection', (socket) => {
    console.log('[IO] client connected', socket.id);
    socket.on('join', (room: string) => {
      try {
        if (typeof room === 'string' && room.trim()) {
          socket.join(room);
          console.log(`[IO] socket ${socket.id} joined room ${room}`);
        }
      } catch (e) {
        console.warn('[IO] join error', e);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[IO] client disconnected', socket.id, reason);
    });
  });

  // Attach API routes (router needs access to io for emits)
  app.use('/api', createRouter(dbService, jobProcessorService, io));

  httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
  });

  // 404 handler (should come after routes)
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
    });
  });

  // Error handling (after routes and 404)
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  );

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutdown signal received, closing server...');
    httpServer.close(async () => {
      await dbService.disconnect();
      console.log('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
