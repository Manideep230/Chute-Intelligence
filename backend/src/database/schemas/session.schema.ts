import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  refreshTokenHash: string;

  @Prop({ required: true })
  userAgent: string;

  @Prop({ required: true })
  ipAddress: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: Date.now })
  lastUsedAt: Date;

  @Prop({ default: false })
  isRevoked: boolean;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
