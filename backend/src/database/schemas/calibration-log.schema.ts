import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CalibrationLogDocument = CalibrationLog & Document;

@Schema({ timestamps: true })
export class CalibrationLog {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true, enum: [1, 2, 3, 4] })
  zone: number;

  /** The pre-calibration distance reading in metres */
  @Prop({ required: true })
  baselineDistance: number;

  /** The measured / confirmed clear-chute distance in metres */
  @Prop({ required: true })
  measuredDistance: number;

  /** Percentage accuracy: 100 - abs((measured - baseline) / baseline * 100) */
  @Prop({ required: true })
  accuracyPercent: number;

  @Prop({ required: true, enum: ['Auto', 'Manual'], default: 'Auto' })
  calibrationMode: string;

  @Prop({ default: true })
  passed: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;

  @Prop({ default: '' })
  notes: string;
}

export const CalibrationLogSchema =
  SchemaFactory.createForClass(CalibrationLog);
