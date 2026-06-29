import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Incident,
  IncidentDocument,
} from '../database/schemas/incident.schema';
import {
  AuditLog,
  AuditLogDocument,
} from '../database/schemas/audit-log.schema';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectModel(Incident.name) private incidentModel: Model<IncidentDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async getAll(
    filters: { chuteId?: string; severity?: string; status?: string },
    user?: any,
  ) {
    const query: any = {};
    if (filters.chuteId) {
      query.chuteId = new Types.ObjectId(filters.chuteId);
    } else if (user && user.role !== 'Super Admin') {
      const assignmentModel = this.incidentModel.db.model('Assignment');
      const chuteModel = this.incidentModel.db.model('Chute');

      let allowedChuteIds: Types.ObjectId[] = [];
      if (user.role === 'Admin') {
        const allowedPlantIds = (user.assignedPlantIds || []).map(
          (id: any) => new Types.ObjectId(id),
        );
        const chutes = await chuteModel
          .find({ plantId: { $in: allowedPlantIds } })
          .exec();
        allowedChuteIds = chutes.map((c) => c._id as Types.ObjectId);
      } else if (user.role === 'Manager' || user.role === 'Worker') {
        const assignments = await assignmentModel
          .find({ userId: user._id })
          .exec();
        const chuteIds = assignments
          .filter((a) => a.chuteId)
          .map((a) => a.chuteId);

        if (user.role === 'Manager') {
          const plantIds = assignments
            .filter((a) => a.plantId)
            .map((a) => a.plantId);
          const chutes = await chuteModel
            .find({ plantId: { $in: plantIds } })
            .exec();
          chutes.forEach((c) => {
            if (!chuteIds.some((id) => id.toString() === c._id.toString())) {
              chuteIds.push(c._id as Types.ObjectId);
            }
          });
        }
        allowedChuteIds = chuteIds;
      }
      query.chuteId = { $in: allowedChuteIds };
    }

    if (filters.severity) query.severity = filters.severity;
    if (filters.status) query.status = filters.status;

    return this.incidentModel
      .find(query)
      .populate('reportedBy', 'name role ngId')
      .populate('assignedTo', 'name role ngId')
      .populate('closedBy', 'name role ngId')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async getById(id: string) {
    const incident = await this.incidentModel
      .findById(id)
      .populate('reportedBy', 'name role ngId')
      .populate('assignedTo', 'name role ngId')
      .populate('closedBy', 'name role ngId')
      .lean()
      .exec();
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  async create(body: any, userId: string) {
    const incident = await this.incidentModel.create({
      ...body,
      chuteId: new Types.ObjectId(body.chuteId),
      reportedBy: new Types.ObjectId(userId),
      timeline: [
        {
          timestamp: new Date(),
          action: 'Incident Reported',
          note: body.description,
          performedBy: new Types.ObjectId(userId),
        },
      ],
    });

    await this.auditLogModel.create({
      action: 'INCIDENT_CREATED',
      details: `Incident "${body.title}" (${body.severity}) reported for chute ${body.chuteId}`,
      userId: new Types.ObjectId(userId),
    });

    return incident;
  }

  async update(
    id: string,
    body: {
      status?: string;
      assignedTo?: string;
      rootCause?: string;
      correctionAction?: string;
      note?: string;
    },
    userId: string,
  ) {
    const incident = await this.incidentModel.findById(id);
    if (!incident) throw new NotFoundException('Incident not found');

    const timelineEntry: any = {
      timestamp: new Date(),
      action: 'Updated',
      note: body.note || `Status changed to ${body.status || 'updated'}`,
      performedBy: new Types.ObjectId(userId),
    };

    const updateData: any = { ...body };
    delete updateData.note;
    if (body.assignedTo)
      updateData.assignedTo = new Types.ObjectId(body.assignedTo);

    await this.incidentModel.findByIdAndUpdate(id, {
      $set: updateData,
      $push: { timeline: timelineEntry },
    });

    return { success: true };
  }

  async escalate(id: string, userId: string, note?: string) {
    const incident = await this.incidentModel.findById(id);
    if (!incident) throw new NotFoundException('Incident not found');

    const statusMap: Record<string, string> = {
      Open: 'Investigating',
      Investigating: 'Escalated',
    };

    const nextStatus = statusMap[incident.status];
    if (!nextStatus)
      throw new ForbiddenException('Incident cannot be escalated further');

    await this.incidentModel.findByIdAndUpdate(id, {
      $set: { status: nextStatus },
      $push: {
        timeline: {
          timestamp: new Date(),
          action: `Escalated to ${nextStatus}`,
          note: note || `Incident escalated to ${nextStatus}`,
          performedBy: new Types.ObjectId(userId),
        },
      },
    });

    await this.auditLogModel.create({
      action: 'INCIDENT_ESCALATED',
      details: `Incident ${id} escalated to ${nextStatus}`,
      userId: new Types.ObjectId(userId),
    });

    return { success: true, newStatus: nextStatus };
  }

  async close(
    id: string,
    userId: string,
    body: { rootCause: string; correctionAction: string; note?: string },
  ) {
    const incident = await this.incidentModel.findById(id);
    if (!incident) throw new NotFoundException('Incident not found');

    await this.incidentModel.findByIdAndUpdate(id, {
      $set: {
        status: 'Resolved',
        rootCause: body.rootCause,
        correctionAction: body.correctionAction,
        closedBy: new Types.ObjectId(userId),
        closedAt: new Date(),
      },
      $push: {
        timeline: {
          timestamp: new Date(),
          action: 'Incident Closed',
          note: body.note || body.correctionAction,
          performedBy: new Types.ObjectId(userId),
        },
      },
    });

    await this.auditLogModel.create({
      action: 'INCIDENT_CLOSED',
      details: `Incident "${incident.title}" closed. Root cause: ${body.rootCause}`,
      userId: new Types.ObjectId(userId),
    });

    return { success: true };
  }
}
