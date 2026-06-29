import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OpcUaConfigDocument = OpcUaConfig & Document;

@Schema({ timestamps: true })
export class OpcUaConfig {
  @Prop({ type: Types.ObjectId, ref: 'Plant', required: true })
  plantId: Types.ObjectId;

  @Prop({ required: true, default: 'opc.tcp://localhost:4840' })
  endpointUrl: string;

  @Prop({ required: true, default: 'ns=2;s=Nigha_Telemetry' })
  namespaceUri: string;

  @Prop({
    type: Object,
    default: {
      radar_1_dist: 'ns=2;s=Radar1_Distance_Float',
      radar_2_dist: 'ns=2;s=Radar2_Distance_Float',
      radar_3_dist: 'ns=2;s=Radar3_Distance_Float',
      radar_4_dist: 'ns=2;s=Radar4_Distance_Float',
      chute_status: 'ns=2;s=Chute1_Status_Int',
      compressor_p: 'ns=2;s=Compressor_Pressure_Float',
      blast_cmd_register: 'ns=2;s=Blaster_Trigger_Cmd_Bool',
    },
  })
  registerMappings: Record<string, string>;

  @Prop({ default: true })
  isActive: boolean;
}

export const OpcUaConfigSchema = SchemaFactory.createForClass(OpcUaConfig);
