import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MaintenanceTicketDocument = MaintenanceTicket & Document;

@Schema({ _id: false })
class ServiceHistoryItem {
  @Prop({ default: Date.now })
  date: Date;

  @Prop({ required: true })
  action: string; // e.g. "Replaced Seals", "Calibrated Sensor"

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;

  @Prop({ default: '' })
  notes: string;
}

@Schema({ timestamps: true })
export class MaintenanceTicket {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['AirBlaster', 'Solenoid', 'Compressor', 'Sensor'],
  })
  assetType: string;

  @Prop({ type: Types.ObjectId, required: true })
  assetId: Types.ObjectId; // Generic ref to AirBlaster/Solenoid/Compressor/Radar

  @Prop({ required: true })
  description: string;

  @Prop({
    required: true,
    enum: ['Open', 'In Progress', 'Resolved'],
    default: 'Open',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedTo: Types.ObjectId;

  @Prop({ type: [ServiceHistoryItem], default: [] })
  serviceHistory: ServiceHistoryItem[];
}

export const MaintenanceTicketSchema =
  SchemaFactory.createForClass(MaintenanceTicket);
