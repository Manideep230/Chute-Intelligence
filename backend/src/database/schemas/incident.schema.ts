import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IncidentDocument = Incident & Document;

@Schema({ _id: false })
class TimelineEntry {
  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  note: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;
}

@Schema({ timestamps: true })
export class Incident {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: ['Low', 'Medium', 'High', 'Critical'] })
  severity: string;

  @Prop({
    required: true,
    enum: ['Open', 'Investigating', 'Escalated', 'Resolved'],
    default: 'Open',
  })
  status: string;

  @Prop({ default: '' })
  rootCause: string;

  @Prop({ default: '' })
  correctionAction: string;

  /** The zone number (1–4) or null for non-radar incidents */
  @Prop({ default: null })
  affectedZone: number;

  @Prop({
    required: true,
    enum: ['Radar', 'Compressor', 'Solenoid', 'Structural', 'Process', 'Other'],
    default: 'Other',
  })
  incidentType: string;

  @Prop({ type: [TimelineEntry], default: [] })
  timeline: TimelineEntry[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reportedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedTo: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  closedBy: Types.ObjectId;

  @Prop({ default: null })
  closedAt: Date;
}

export const IncidentSchema = SchemaFactory.createForClass(Incident);
IncidentSchema.index({ chuteId: 1, status: 1, severity: 1 });
