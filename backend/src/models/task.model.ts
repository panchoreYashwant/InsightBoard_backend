import { Schema, model, Document } from 'mongoose';

export interface ITask extends Document {
  jobId: string;
  taskId: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];
  status: 'pending' | 'ready' | 'blocked' | 'error' | 'completed';
}

const TaskSchema = new Schema<ITask>({
  jobId: { type: String, required: true, index: true },
  taskId: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, required: true, enum: ['low', 'medium', 'high'] },
  dependencies: [{ type: String }],
  status: { type: String, required: true, default: 'pending', enum: ['pending', 'ready', 'blocked', 'error', 'completed'] },
}, { timestamps: true });

export const TaskModel = model<ITask>('Task', TaskSchema);
