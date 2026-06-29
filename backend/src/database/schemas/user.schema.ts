import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  ngId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  phone: string;

  @Prop({
    required: true,
    enum: ['Super Admin', 'Admin', 'Manager', 'Worker'],
    default: 'Worker',
  })
  role: string;

  @Prop({ default: '' })
  profilePic: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: false,
    default: null,
  })
  organizationId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  otp: string | null;

  @Prop({ type: Date, default: null })
  otpExpires: Date | null;

  @Prop({ type: String, default: null })
  tempNewPhone: string | null;

  @Prop({ type: String, default: null })
  tempPhoneOtp: string | null;

  @Prop({ type: Date, default: null })
  tempPhoneOtpExpires: Date | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Plant' }], default: [] })
  assignedPlantIds: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);
