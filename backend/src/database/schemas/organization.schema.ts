import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  domain: string; // e.g., "holcim.com", "rio-tinto"

  @Prop({ default: '' })
  description: string;

  @Prop({
    required: true,
    enum: ['SaaS Starter', 'SaaS Professional', 'SaaS Enterprise'],
    default: 'SaaS Starter',
  })
  subscriptionTier: string;

  @Prop({ default: false })
  ssoEnabled: boolean;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
