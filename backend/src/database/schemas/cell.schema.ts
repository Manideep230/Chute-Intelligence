import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CellDocument = Cell & Document;

/**
 * Cell — a physical section within a chute.
 *
 * Each cell groups radars, SABs, solenoid valves and a hub
 * into a logical blast-coverage zone.
 *
 * Hierarchy: Plant → Chute → Cell → Hub / Radar / SAB / Solenoid
 */
@Schema({ timestamps: true })
export class Cell {
  @Prop({ type: Types.ObjectId, ref: 'Chute', required: true })
  chuteId: Types.ObjectId;

  /** Human-readable label, e.g. "Cell A", "Cell B" */
  @Prop({ required: true })
  name: string;

  /**
   * Describes the blast coverage area this cell represents.
   * Free-text, e.g. "Upper transfer point", "Lower bend".
   */
  @Prop({ default: '' })
  blastCoverage: string;

  /**
   * References to the AirBlaster documents active in this cell.
   * Used by the SAB Selection Engine to find candidate blasters.
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'AirBlaster' }], default: [] })
  activeSabs: Types.ObjectId[];

  /**
   * References to the Radar documents installed in this cell.
   * Used by the prediction engine to scope telemetry to a zone.
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Radar' }], default: [] })
  radars: Types.ObjectId[];

  /**
   * Reference to the Hub gateway serving this cell.
   * A cell is typically served by one hub, but null means unassigned.
   */
  @Prop({ type: Types.ObjectId, ref: 'Hub', default: null })
  hubId: Types.ObjectId | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CellSchema = SchemaFactory.createForClass(Cell);
CellSchema.index({ chuteId: 1 });
CellSchema.index({ hubId: 1 });
