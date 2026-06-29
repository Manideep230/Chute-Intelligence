import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AssignmentDocument = Assignment & Document;

@Schema({ timestamps: true })
export class Assignment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Plant', default: null })
  plantId: Types.ObjectId; // For Admins/Managers

  @Prop({ type: Types.ObjectId, ref: 'Chute', default: null })
  chuteId: Types.ObjectId; // For Workers/Managers
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
export { Types };
