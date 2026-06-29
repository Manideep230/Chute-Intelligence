import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RegionDocument = Region & Document;

@Schema({ timestamps: true })
export class Region {
  @Prop({ required: true })
  name: string; // e.g., "APAC", "AMER", "EMEA"

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ default: '' })
  description: string;
}

export const RegionSchema = SchemaFactory.createForClass(Region);
