import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

@Schema({ timestamps: true })
export class Role {
  @Prop({ required: true, unique: true })
  name: string; // 'Super Admin', 'Admin', 'Manager', 'Worker'

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
