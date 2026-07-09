import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Plant,
  PlantDocument,
  Chute,
  ChuteDocument,
  Alert,
  AlertDocument,
  MaintenanceTicket,
  MaintenanceTicketDocument,
  Incident,
  IncidentDocument,
  Assignment,
  AssignmentDocument,
} from '../database/schemas';

@Injectable()
export class MultiTenantGuard implements CanActivate {
  constructor(
    @InjectModel(Plant.name) private plantModel: Model<PlantDocument>,
    @InjectModel(Chute.name) private chuteModel: Model<ChuteDocument>,
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    @InjectModel(MaintenanceTicket.name)
    private ticketModel: Model<MaintenanceTicketDocument>,
    @InjectModel(Incident.name) private incidentModel: Model<IncidentDocument>,
    @InjectModel(Assignment.name)
    private assignmentModel: Model<AssignmentDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User authentication required');
    }

    // 1. Super Admin bypasses all checks
    if (user.role === 'Super Admin') {
      return true;
    }

    const { params, query, body, path } = request;

    // Helper to check plant access for Admin/Manager
    const checkPlantAccess = async (plantIdStr: string): Promise<boolean> => {
      if (!plantIdStr) return false;
      const plantId = new Types.ObjectId(plantIdStr);
      const role = user.role;
      const isAdminRole = role === 'Admin';
      const isManagerRole = ['Manager', 'Plant Manager', 'Maintenance Manager', 'Supervisor'].includes(role);

      if (isAdminRole) {
        const hasAccess = (user.assignedPlantIds || []).some(
          (id: any) => id.toString() === plantIdStr,
        );
        return hasAccess;
      }
      if (isManagerRole) {
        const assignment = await this.assignmentModel
          .findOne({
            userId: user._id,
            plantId,
          })
          .exec();
        return !!assignment;
      }
      return false; // Workers/Operators/Technicians/Viewers don't have plant level access
    };

    // Helper to check chute access
    const checkChuteAccess = async (chuteIdStr: string): Promise<boolean> => {
      if (!chuteIdStr) return false;
      const chuteId = new Types.ObjectId(chuteIdStr);
      const role = user.role;
      const isAdminRole = role === 'Admin';
      const isManagerRole = ['Manager', 'Plant Manager', 'Maintenance Manager', 'Supervisor'].includes(role);
      const isWorkerRole = ['Worker', 'Operator', 'Technician', 'Viewer'].includes(role);

      if (isAdminRole) {
        const chute = await this.chuteModel.findById(chuteId).exec();
        if (!chute) return false;
        return (user.assignedPlantIds || []).some(
          (id: any) => id.toString() === chute.plantId.toString(),
        );
      }

      if (isManagerRole || isWorkerRole) {
        const assignment = await this.assignmentModel
          .findOne({
            userId: user._id,
            chuteId,
          })
          .exec();
        if (assignment) return true;

        // If manager has assignment to the plant of this chute, allow access
        if (isManagerRole) {
          const chute = await this.chuteModel.findById(chuteId).exec();
          if (chute) {
            const plantAssignment = await this.assignmentModel
              .findOne({
                userId: user._id,
                plantId: chute.plantId,
              })
              .exec();
            return !!plantAssignment;
          }
        }
      }
      return false;
    };

    // Determine target plantId or chuteId or other entity ID from request
    let targetPlantId: string | null = null;
    let targetChuteId: string | null = null;

    // Extract plantId
    if (params.plantId) targetPlantId = params.plantId;
    else if (query.plantId) targetPlantId = query.plantId;
    else if (body && body.plantId) targetPlantId = body.plantId;

    // Extract chuteId
    if (params.chuteId) targetChuteId = params.chuteId;
    else if (query.chuteId) targetChuteId = query.chuteId;
    else if (body && body.chuteId) targetChuteId = body.chuteId;

    // Resolve `:id` based on path structure
    if (params.id) {
      const idStr = params.id;
      if (path.includes('/plants/')) {
        targetPlantId = idStr;
      } else if (path.includes('/chutes/')) {
        targetChuteId = idStr;
      } else if (path.includes('/alerts/')) {
        const alert = await this.alertModel.findById(idStr).exec();
        if (alert) targetChuteId = alert.chuteId.toString();
      } else if (path.includes('/maintenance/')) {
        const ticket = await this.ticketModel.findById(idStr).exec();
        if (ticket) targetChuteId = ticket.chuteId?.toString() || null;
      } else if (path.includes('/incidents/')) {
        const incident = await this.incidentModel.findById(idStr).exec();
        if (incident) targetChuteId = incident.chuteId.toString();
      } else if (path.includes('/assignments/')) {
        const assignment = await this.assignmentModel.findById(idStr).exec();
        if (assignment) {
          if (assignment.plantId) targetPlantId = assignment.plantId.toString();
          if (assignment.chuteId) targetChuteId = assignment.chuteId.toString();
        }
      }
    }

    // Perform checks
    if (targetPlantId) {
      const hasPlantAccess = await checkPlantAccess(targetPlantId);
      if (!hasPlantAccess) {
        throw new ForbiddenException(
          'Access denied: User is not authorized for this plant',
        );
      }
    }

    if (targetChuteId) {
      const hasChuteAccess = await checkChuteAccess(targetChuteId);
      if (!hasChuteAccess) {
        throw new ForbiddenException(
          'Access denied: User is not authorized for this chute',
        );
      }
    }

    // Additional validations for creations
    if (path === '/industry/chutes' && request.method === 'POST') {
      const bodyPlantId = body?.plantId;
      if (bodyPlantId) {
        const hasPlantAccess = await checkPlantAccess(bodyPlantId);
        if (!hasPlantAccess) {
          throw new ForbiddenException(
            'Cannot create chute in an unauthorized plant',
          );
        }
      }
    }

    if (path === '/industry/assignments' && request.method === 'POST') {
      // Check that Admin/Manager only creates assignments within their own tenancy
      if (body?.plantId) {
        const hasPlantAccess = await checkPlantAccess(body.plantId);
        if (!hasPlantAccess) {
          throw new ForbiddenException(
            'Cannot create assignment for an unauthorized plant',
          );
        }
      }
      if (body?.chuteId) {
        const hasChuteAccess = await checkChuteAccess(body.chuteId);
        if (!hasChuteAccess) {
          throw new ForbiddenException(
            'Cannot create assignment for an unauthorized chute',
          );
        }
      }
    }

    return true;
  }
}
