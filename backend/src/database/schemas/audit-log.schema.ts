import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId; // can be null for system actions

  @Prop({ required: true })
  action: string; // e.g. "Login", "Blast Trigger", "User Creation"

  @Prop({ required: true })
  details: string; // JSON description or descriptive text

  @Prop({ default: 'System' })
  ipAddress: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

// Enforce database-level immutability using modern async throw patterns
AuditLogSchema.pre('save', async function () {
  if (!this.isNew) {
    throw new Error('Audit logs are immutable and cannot be modified.');
  }
});

AuditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are immutable and cannot be modified.');
});

AuditLogSchema.pre('updateMany', function () {
  throw new Error('Audit logs are immutable and cannot be modified.');
});

AuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit logs are immutable and cannot be modified.');
});

AuditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs are immutable and cannot be deleted.');
});

AuditLogSchema.pre('deleteMany', function () {
  throw new Error('Audit logs are immutable and cannot be deleted.');
});

AuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('Audit logs are immutable and cannot be deleted.');
});
