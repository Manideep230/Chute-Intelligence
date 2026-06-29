import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebhookDocument = Webhook & Document;

@Schema({ timestamps: true })
export class Webhook {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  name: string; // e.g., "SAP PM Outbound Integration"

  @Prop({ required: true })
  url: string; // Webhook delivery endpoint URL

  @Prop({ type: [String], default: ['alert.created', 'blast.success'] })
  events: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: '' })
  secret: string; // Webhook payload signing key
}

export const WebhookSchema = SchemaFactory.createForClass(Webhook);
