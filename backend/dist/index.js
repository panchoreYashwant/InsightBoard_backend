"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = require("./routes");
const database_service_1 = require("./services/database.service");
const llm_service_1 = require("./services/llm.service");
const job_processor_service_1 = require("./services/job-processor.service");
dotenv_1.default.config();
async function main() {
    const app = (0, express_1.default)();
    const port = process.env.PORT || 3000;
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
        throw new Error('DATABASE_URL is not defined in the environment variables.');
    }
    // Middleware
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '10mb' }));
    // Initialize services and connect to DB
    const dbService = new database_service_1.DatabaseService();
    await dbService.connect(mongoUri);
    const llmService = new llm_service_1.LLMService(process.env.GEMINI_API_KEY || '');
    const jobProcessorService = new job_processor_service_1.JobProcessorService(llmService, dbService);
    // Health check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });
    // API routes
    app.use('/api', (0, routes_1.createRouter)(dbService, jobProcessorService));
    // Error handling
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({
            error: 'Internal server error',
        });
    });
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            error: 'Not found',
        });
    });
    // Start server
    const server = app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
        console.log(`Health check: http://localhost:${port}/health`);
    });
    // Graceful shutdown
    const shutdown = async () => {
        console.log('Shutdown signal received, closing server...');
        server.close(async () => {
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
