"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskModel = void 0;
const mongoose_1 = require("mongoose");
const TaskSchema = new mongoose_1.Schema({
    jobId: { type: String, required: true, index: true },
    taskId: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    dependencies: [{ type: String }],
    status: { type: String, required: true, default: 'pending', enum: ['pending', 'ready', 'blocked', 'error'] },
}, { timestamps: true });
exports.TaskModel = (0, mongoose_1.model)('Task', TaskSchema);
