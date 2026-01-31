import { Schema, model, Document } from 'mongoose';
import { ValidatedTask, ProcessingResult } from '../types';

export interface IJob extends Document {
  jobId: string;
  transcript: string;
  transcriptHash: string;
  status: 'processing' | 'done' | 'error';
  result?: ProcessingResult;
  error?: string;
  activities?: { ts: Date; message: string }[];
}

const JobSchema = new Schema<IJob>({
  jobId: { type: String, required: true, unique: true, index: true },
  transcript: { type: String, required: true },
  transcriptHash: { type: String, required: true, unique: true, index: true },
  status: { type: String, required: true, default: 'processing', enum: ['processing', 'done', 'error'] },
  result: { type: Schema.Types.Mixed },
  activities: [{ ts: { type: Date, default: Date.now }, message: { type: String } }],
  error: { type: String },
}, { timestamps: true });

export const JobModel = model<IJob>('Job', JobSchema);
