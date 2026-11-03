import { randomUUID } from 'node:crypto';
import { ConflictError, LarkIntegrationError, NotFoundError } from '../../middleware/index.js';
import type { IBitableRepository } from '../../repositories/bitable/bitable.interface.js';
import type { Assignment, AssignmentListResult, BitableRecord, UserRole } from '../../types/index.js';
import {
  notifyDeviceAssigned,
  notifyDeviceReturned,
} from '../../services/email/notification.service.js';
import { env } from '../../config/env.js';
import { auditService } from '../audit/audit.service.js';
import { authService } from '../auth/auth.service.js';
import type {
  AssignmentQuery,
  CreateAssignmentInput,
  ReturnAssignmentInput,
  UpdateAssignmentInput,
} from './assignments.schemas.js';

const FIELD = {
  assignmentId: 'assignment_id',
  itemId: 'item_id',
  itemName: 'Item Name',
  employeeId: 'Employee ID',
  employeeName: 'Employee Name',
  assignedAt: 'Assigned At',
  returnedAt: 'Returned At',
  notes: 'Notes',
  status: 'Status',
} as const;

const INVENTORY_FIELD = {
  itemId: 'item_id',
  imei1: 'IMEI1',
  imei2: 'IMEI2',
  serialNumber: 'Serial Number',
  status: 'Status',
  inventoryHolder: 'Inventory Holder',
  assignedDate: 'Assigned Date',
  warehouseLocation: 'Warehouse/Location',
  remarks: 'Remarks',
} as const;

export interface PhotoRecord {
  label: 'front' | 'back' | 'extra_1' | 'extra_2' | 'extra_3';
  mimeType: string;
  sizeBytes: number;
  dataUri: string;  // base64 data URI, e.g. "data:image/jpeg;base64,..."
  capturedAt: string; // ISO date
}

interface EmbeddedTracking {
  assignedFrom?: string | undefined;
  assignedBy?: string | undefined;
  assignedByRole?: string | undefined;
  requestedBy?: string | undefined;
  requestId?: string | undefined;
  returnedBy?: string | undefined;
  returnedTo?: string | undefined;
  returnLocation?: string | undefined;
  returnCondition?: string | undefined;
}

interface EmbeddedPhotos {
  assignmentPhotos?: PhotoRecord[] | undefined;
  returnPhotos?: PhotoRecord[] | undefined;
}

function parseNotesTracking(rawNotes: string): { cleanNotes: string; tracking: EmbeddedTracking; photos: EmbeddedPhotos } {
  if (!rawNotes) return { cleanNotes: '', tracking: {}, photos: {} };

  // Extract PHOTOS block
  let photos: EmbeddedPhotos = {};
  const photosMatch = rawNotes.match(/<!--PHOTOS:(.*?)-->/s);
  if (photosMatch && photosMatch[1]) {
    try {
      photos = JSON.parse(photosMatch[1]) as EmbeddedPhotos;
    } catch {
      photos = {};
    }
  }

  // Strip PHOTOS block before processing TRACKING
  const notesWithoutPhotos = rawNotes.replace(/<!--PHOTOS:.*?-->/s, '').trim();

  const match = notesWithoutPhotos.match(/<!--TRACKING:(.*?)-->/);
  if (!match || !match[1]) {
    const tracking: EmbeddedTracking = {};
    const fromMatch = notesWithoutPhotos.match(/\[(?:Source|From):\s*([^\]]+)\]/i);
    if (fromMatch && fromMatch[1]) tracking.assignedFrom = fromMatch[1].trim();
    const byMatch = notesWithoutPhotos.match(/\[Assigned by:\s*([^\]]+)\]/i);
    if (byMatch && byMatch[1]) tracking.assignedBy = byMatch[1].trim();
    const reqMatch = notesWithoutPhotos.match(/\[Requested by:\s*([^\]]+)\]/i);
    if (reqMatch && reqMatch[1]) tracking.requestedBy = reqMatch[1].trim();
    const retToMatch = notesWithoutPhotos.match(/\[Returned to:\s*([^\]]+)\]/i);
    if (retToMatch && retToMatch[1]) tracking.returnedTo = retToMatch[1].trim();
    const condMatch = notesWithoutPhotos.match(/\[Condition:\s*([^\]]+)\]/i);
    if (condMatch && condMatch[1]) tracking.returnCondition = condMatch[1].trim();
    return { cleanNotes: notesWithoutPhotos, tracking, photos };
  }
  try {
    const tracking = JSON.parse(match[1]) as EmbeddedTracking;
    const cleanNotes = notesWithoutPhotos.replace(/<!--TRACKING:.*?-->/, '').trim();
    return { cleanNotes, tracking, photos };
  } catch {
    return { cleanNotes: notesWithoutPhotos, tracking: {}, photos };
  }
}

function formatNotesWithTracking(userNotes: string, tracking: EmbeddedTracking, photos?: EmbeddedPhotos): string {
  const parts: string[] = [];
  if (tracking.assignedFrom) parts.push(`[Source: ${tracking.assignedFrom}]`);
  if (tracking.assignedBy) parts.push(`[Assigned by: ${tracking.assignedBy}]`);
  if (tracking.requestedBy) parts.push(`[Requested by: ${tracking.requestedBy}]`);
  if (tracking.returnedTo) parts.push(`[Returned to: ${tracking.returnedTo}]`);
  if (tracking.returnCondition) parts.push(`[Condition: ${tracking.returnCondition}]`);
  if (userNotes && userNotes.trim().length > 0) parts.push(userNotes.trim());

  const humanReadable = parts.join(' ');
  const embeddedTag = `<!--TRACKING:${JSON.stringify(tracking)}-->`;

  let result = `${humanReadable} ${embeddedTag}`.trim();

  // Append photos block if present
  if (photos && (photos.assignmentPhotos?.length || photos.returnPhotos?.length)) {
    result = `${result} <!--PHOTOS:${JSON.stringify(photos)}-->`.trim();
  }

  return result;
}

export class AssignmentsService {
  constructor(private readonly repository: IBitableRepository) {}

  async listAll(): Promise<Assignment[]> {
    const records = await this.readAll();
    return records.map(toAssignment);
  }

  async list(query: AssignmentQuery, allowedEmpCodes?: string[]): Promise<AssignmentListResult> {
    const records = await this.readAll();
    let items = records.map(toAssignment);

    if (allowedEmpCodes && allowedEmpCodes.length > 0) {
      const lowerAllowed = allowedEmpCodes
        .map((c) => (c || '').trim().toLowerCase())
        .filter((c) => c.length > 0);

      if (lowerAllowed.length > 0) {
        items = items.filter((item) => {
          const empIdLower = item.employeeId.toLowerCase();
          const empNameLower = item.employeeName.toLowerCase();
          return lowerAllowed.some(
            (code) =>
              empIdLower === code ||
              empNameLower === code ||
              empIdLower.includes(code) ||
              empNameLower.includes(code),
          );
        });
      }
    }

    const search = (query.search || '').toLowerCase();

    const filtered = items.filter((item) => {
      const searchable = [
        item.itemName,
        item.employeeName,
        item.employeeId,
        item.notes || '',
      ].join(' ').toLowerCase();

      return (
        (search.length === 0 || searchable.includes(search)) &&
        (query.status === undefined || item.status === query.status)
      );
    });

    const start = (query.page - 1) * query.pageSize;

    return {
      records: filtered.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / query.pageSize)),
      activeCount: items.filter((item) => item.status === 'Active').length,
      returnedCount: items.filter((item) => item.status === 'Returned').length,
    };
  }

  async get(id: string): Promise<Assignment> {
    return (await this.resolveItem(id)).item;
  }

  async create(input: CreateAssignmentInput): Promise<Assignment> {
    if (input.status !== 'Active') {
      throw new ConflictError('New assignments must use Active status. Return an assignment through the return workflow.');
    }

    // Duplicate Checkpoint: Assigned devices cannot be reassigned until marked as Returned.
    const all = await this.readAll();
    const active = all.map(toAssignment).filter((a) => a.status === 'Active');
    const existingActive = active.find(
      (a) => a.itemId.toLowerCase() === input.itemId.trim().toLowerCase(),
    );

    if (existingActive) {
      auditService.log({
        actorId: input.employeeId || 'tl@company.com',
        actorRole: 'TL',
        action: 'DUPLICATE_BLOCKED',
        entityType: 'Assignment',
        entityId: input.itemId,
        details: {
          reason: `Device '${input.itemId}' is already actively assigned to ${existingActive.employeeName} (${existingActive.employeeId}). Cannot reassign until marked Returned.`,
          attemptedAssignee: input.employeeName,
        },
        status: 'BLOCKED',
      });

      throw new ConflictError(
        `Duplicate Entry Checkpoint: Device '${input.itemId}' is currently assigned to ${existingActive.employeeName}. Assigned devices cannot be reassigned until marked as Returned.`,
      );
    }

    const inventory = await this.resolveInventoryDevice(input.itemId);
    const inventoryStatus = text(inventory.fields, INVENTORY_FIELD.status);
    if (inventoryStatus !== 'Inactive') {
      throw new ConflictError(
        `Device '${input.itemId}' is not available in inventory. Only Inactive devices can be assigned.`,
      );
    }

    const tracking: EmbeddedTracking = {
      assignedFrom: input.assignedFrom || 'IT Stock',
      assignedBy: input.assignedBy || 'Admin',
      assignedByRole: input.assignedByRole || 'Admin',
      requestedBy: input.requestedBy,
      requestId: input.requestId,
    };
    const photos = input.assignmentPhotos && input.assignmentPhotos.length > 0
      ? { assignmentPhotos: input.assignmentPhotos as PhotoRecord[] }
      : undefined;
    const formattedNotes = formatNotesWithTracking(input.notes || '', tracking, photos);
    await this.repository.updateRecord(this.inventoryTableId(), inventory.recordId, {
      [INVENTORY_FIELD.status]: 'Active',
      [INVENTORY_FIELD.inventoryHolder]: input.employeeName,
      [INVENTORY_FIELD.assignedDate]: dateToLarkTimestamp(input.assignedAt),
      [INVENTORY_FIELD.remarks]: `Assigned on ${input.assignedAt} by ${input.assignedBy || 'Admin'} to ${input.employeeName} (Sourced from: ${input.assignedFrom || 'IT Stock'})${input.notes ? ' | ' + input.notes : ''}`,
    });

    let record: BitableRecord;
    try {
      record = await this.repository.createRecord(this.tableId(), {
        ...toFields({
          ...input,
          notes: formattedNotes,
        }),
        [FIELD.assignmentId]: randomUUID(),
      });
    } catch (error) {
      await this.repository.updateRecord(this.inventoryTableId(), inventory.recordId, {
        [INVENTORY_FIELD.status]: 'Inactive',
        [INVENTORY_FIELD.inventoryHolder]: 'IT Stock',
      });
      throw error;
    }

    const created = toAssignment(record);

    auditService.log({
      actorId: input.assignedBy || input.employeeId || 'tl@company.com',
      actorRole: (input.assignedByRole as UserRole) || 'TL',
      action: 'DEVICE_ASSIGNED',
      entityType: 'Assignment',
      entityId: created.id,
      details: {
        itemName: input.itemName,
        itemId: input.itemId,
        employeeName: input.employeeName,
        employeeId: input.employeeId,
        assignedFrom: input.assignedFrom || 'IT Stock',
        assignedBy: input.assignedBy,
        requestedBy: input.requestedBy,
        requestId: input.requestId,
      },
      status: 'SUCCESS',
    });

    // Notify employee of assignment
    const empUser =
      authService.findUser(input.employeeId) || authService.findUser(input.employeeName);
    const targetEmail =
      empUser?.email || (input.employeeId && input.employeeId.includes('@') ? input.employeeId : undefined);

    if (targetEmail) {
      void notifyDeviceAssigned({
        to: targetEmail,
        employeeName: input.employeeName,
        itemName: input.itemName,
        itemId: input.itemId,
        assignedAt: input.assignedAt,
        notes: input.notes,
      });
    }

    return created;
  }

  async update(id: string, input: UpdateAssignmentInput): Promise<Assignment> {
    const { record } = await this.resolveItem(id);

    if (input.status === 'Returned' && input.status !== undefined) {
      return this.returnAssignment(id, {
        returnedAt: input.returnedAt || '',
        returnLocation: input.returnLocation || 'Main Warehouse',
        returnCondition: input.returnCondition || 'Good',
        ...(input.returnedBy !== undefined && { returnedBy: input.returnedBy }),
        ...(input.returnedTo !== undefined && { returnedTo: input.returnedTo }),
        ...(input.notes !== undefined && { notes: input.notes }),
      });
    }

    if (input.status === 'Active' && input.status !== undefined) {
      const existing = toAssignment(record);
      if (existing.status === 'Returned') {
        throw new ConflictError(
          `Assignment '${existing.id}' is already Returned. Create a new assignment record for a reassignment.`,
        );
      }
    }

    const updated = await this.repository.updateRecord(this.tableId(), record.recordId, toFields(input));
    return toAssignment(updated);
  }

  async hasActiveAssignment(itemId: string): Promise<boolean> {
    const target = itemId.trim().toLowerCase();
    const records = await this.readAll();
    return records.some((record) => {
      const assignment = toAssignment(record);
      return assignment.status === 'Active' && assignment.itemId.trim().toLowerCase() === target;
    });
  }

  async getActiveAssignmentsForEmployee(identifiers: string[]): Promise<Assignment[]> {
    const targets = identifiers.map((id) => (id || '').trim().toLowerCase()).filter(Boolean);
    if (targets.length === 0) return [];
    const records = await this.readAll();
    const assignments = records.map(toAssignment);
    return assignments.filter((a) => {
      if (a.status !== 'Active') return false;
      const empIdLower = a.employeeId.toLowerCase();
      const empNameLower = a.employeeName.toLowerCase();
      return targets.some(
        (t) =>
          empIdLower === t ||
          empNameLower === t ||
          empIdLower.includes(t) ||
          empNameLower.includes(t),
      );
    });
  }

  async returnAssignment(id: string, input: ReturnAssignmentInput): Promise<Assignment> {
    const { record, item: existing } = await this.resolveItem(id);
    let inventory = await this.findInventoryDevice(existing.itemId);
    const returnedAt = input.returnedAt || new Date().toISOString().slice(0, 10);
    const rawNotes = text(record.fields, FIELD.notes);
    const { cleanNotes, tracking: existingTracking, photos: existingPhotos } = parseNotesTracking(rawNotes);

    const updatedTracking: EmbeddedTracking = {
      ...existingTracking,
      returnedBy: input.returnedBy || existing.employeeName,
      returnedTo: input.returnedTo || 'IT Stock (Admin)',
      returnLocation: input.returnLocation || 'WH-1 (Main Hub)',
      returnCondition: input.returnCondition || 'Good',
    };

    const combinedUserNotes = [
      cleanNotes,
      input.notes ? `Return notes: ${input.notes}` : '',
      input.returnCondition ? `Condition: ${input.returnCondition}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    // Merge existing photos with return photos
    const updatedPhotos: EmbeddedPhotos = {
      ...existingPhotos,
      ...(input.returnPhotos && input.returnPhotos.length > 0
        ? { returnPhotos: input.returnPhotos as PhotoRecord[] }
        : {}),
    };

    const formattedNotes = formatNotesWithTracking(
      combinedUserNotes,
      updatedTracking,
      (updatedPhotos.assignmentPhotos?.length || updatedPhotos.returnPhotos?.length)
        ? updatedPhotos
        : undefined,
    );

    const patch: Record<string, unknown> = {
      [FIELD.status]: 'Returned',
      [FIELD.returnedAt]: dateToLarkTimestamp(returnedAt),
      [FIELD.notes]: formattedNotes,
    };

    // Update Master Inventory:
    // 1. If device is in inventory, flip status to Inactive (Available in stock), set holder to IT Stock/receiver
    // 2. If device was NOT in inventory table, automatically create it into inventory so it is stored in stock!
    if (!inventory) {
      const words = (existing.itemName || 'Device').trim().split(/\s+/);
      const possibleBrand = ['Itel', 'Tecno', 'Infinix', 'Oraimo', 'Villaon'].find(
        (b) => b.toLowerCase() === words[0]?.toLowerCase(),
      ) || 'Other';
      const deviceModel = words.length > 1 ? words.slice(1).join(' ') : existing.itemName || 'Returned Mobile';
      const cleanImei = existing.itemId.replace(/^[^\d]+/, '').trim() || existing.itemId;

      inventory = await this.repository.createRecord(this.inventoryTableId(), {
        [INVENTORY_FIELD.itemId]: randomUUID(),
        ['Brand']: possibleBrand,
        ['Device Model']: deviceModel,
        ['Sample HW Type']: 'PRO',
        [INVENTORY_FIELD.imei1]: cleanImei.length === 15 ? cleanImei : existing.itemId,
        [INVENTORY_FIELD.status]: 'Inactive',
        [INVENTORY_FIELD.inventoryHolder]: input.returnedTo || 'IT Stock',
        [INVENTORY_FIELD.warehouseLocation]: input.returnLocation || 'WH-1 (Main Hub)',
        [INVENTORY_FIELD.assignedDate]: dateToLarkTimestamp(returnedAt),
        [INVENTORY_FIELD.remarks]: `Stored in inventory upon return from ${input.returnedBy || existing.employeeName} to ${input.returnedTo || 'IT Stock'} (Condition: ${input.returnCondition || 'Good'})${input.notes ? ' | ' + input.notes : ''}`,
      });
    } else {
      await this.repository.updateRecord(this.inventoryTableId(), inventory.recordId, {
        [INVENTORY_FIELD.status]: 'Inactive',
        [INVENTORY_FIELD.inventoryHolder]: input.returnedTo || 'IT Stock',
        [INVENTORY_FIELD.warehouseLocation]: input.returnLocation || 'WH-1 (Main Hub)',
        [INVENTORY_FIELD.remarks]: `Returned on ${returnedAt} by ${input.returnedBy || existing.employeeName} to ${input.returnedTo || 'IT Stock'} (Condition: ${input.returnCondition || 'Good'})${input.notes ? ' | ' + input.notes : ''}`,
      });
    }

    let updated: BitableRecord;
    try {
      updated = await this.repository.updateRecord(this.tableId(), record.recordId, patch);
    } catch (error) {
      if (inventory) {
        await this.repository.updateRecord(this.inventoryTableId(), inventory.recordId, {
          [INVENTORY_FIELD.status]: 'Active',
          [INVENTORY_FIELD.inventoryHolder]: existing.employeeName,
        });
      }
      throw error;
    }
    const returned = toAssignment(updated);

    auditService.log({
      actorId: input.returnedTo || existing.employeeId || 'admin@inventory.internal',
      actorRole: 'Admin',
      action: 'DEVICE_RETURNED',
      entityType: 'Assignment',
      entityId: id,
      details: {
        itemName: existing.itemName,
        itemId: existing.itemId,
        employeeName: existing.employeeName,
        employeeId: existing.employeeId,
        returnedBy: input.returnedBy || existing.employeeName,
        returnedTo: input.returnedTo || 'IT Stock',
        returnLocation: input.returnLocation || 'WH-1 (Main Hub)',
        returnCondition: input.returnCondition || 'Good',
        returnedAt,
        notes: input.notes,
      },
      status: 'SUCCESS',
    });

    // Notify employee of returned confirmation
    if (existing.employeeId && existing.employeeId.includes('@')) {
      void notifyDeviceReturned({
        to: existing.employeeId,
        employeeName: existing.employeeName,
        itemName: existing.itemName,
        returnedAt,
        ...(input.notes ? { notes: input.notes } : {}),
      });
    }

    return returned;
  }

  async exportCsv(): Promise<{ filename: string; csv: string }> {
    const records = await this.readAll();
    const items = records.map(toAssignment);

    const headers = [
      'Assignment ID',
      'Item Name',
      'IMEI / Device Identifier',
      'Employee Name',
      'Employee ID',
      'Assigned At',
      'Returned At',
      'Status',
      'Notes',
    ];

    const rows = items.map((item) => [
      item.id,
      item.itemName,
      item.itemId,
      item.employeeName,
      item.employeeId,
      item.assignedAt,
      item.returnedAt || '-',
      item.status,
      item.notes || '-',
    ]);

    const escapeCell = (cell: string | number) => {
      const str = String(cell ?? '').replace(/"/g, '""');
      return /[",\n\r]/.test(str) ? `"${str}"` : str;
    };

    const headerLine = headers.map(escapeCell).join(',');
    const rowLines = rows.map((r) => r.map(escapeCell).join(','));
    const csv = [headerLine, ...rowLines].join('\r\n');
    const filename = `Device_Assignments_Export_${new Date().toISOString().slice(0, 10)}.csv`;

    return { filename, csv };
  }

  async delete(id: string, actorId = 'system'): Promise<never> {
    auditService.log({
      actorId,
      actorRole: 'Admin',
      action: 'DELETION_BLOCKED',
      entityType: 'Assignment',
      entityId: id,
      details: 'Attempted delete on assignment entry. Prohibited by policy.',
      status: 'BLOCKED',
    });
    throw new ConflictError(
      'Deletion is strictly prohibited by policy. No deletion rights for any assignment record. Devices must be marked as Returned.',
    );
  }

  private tableId(): string {
    if (!env.LARK_TABLE_ASSIGNMENTS || env.LARK_TABLE_ASSIGNMENTS.length === 0) {
      throw new LarkIntegrationError('LARK_TABLE_ASSIGNMENTS is not configured.', 'ASSIGNMENTS_TABLE_NOT_CONFIGURED');
    }
    return env.LARK_TABLE_ASSIGNMENTS;
  }

  private inventoryTableId(): string {
    if (!env.LARK_TABLE_INVENTORY || env.LARK_TABLE_INVENTORY.length === 0) {
      throw new LarkIntegrationError('LARK_TABLE_INVENTORY is not configured.', 'INVENTORY_TABLE_NOT_CONFIGURED');
    }
    return env.LARK_TABLE_INVENTORY;
  }

  private async findInventoryDevice(itemId: string): Promise<BitableRecord | undefined> {
    const target = itemId.trim().toLowerCase();
    const cleanTarget = target.replace(/^[^\d]+/, '').trim();
    const records: BitableRecord[] = [];
    let pageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await this.repository.listRecords(this.inventoryTableId(), {
        pageSize: 100,
        ...(pageToken !== undefined && { pageToken }),
      });
      records.push(...page.records);
      pageToken = page.pageToken;
      hasMore = page.hasMore && pageToken !== undefined;
    }

    return records.find((candidate) =>
      [INVENTORY_FIELD.itemId, INVENTORY_FIELD.imei1, INVENTORY_FIELD.imei2, INVENTORY_FIELD.serialNumber]
        .some((field) => {
          const val = text(candidate.fields, field).trim().toLowerCase();
          return val === target || (cleanTarget.length > 0 && val === cleanTarget);
        }),
    );
  }

  private async resolveInventoryDevice(itemId: string): Promise<BitableRecord> {
    const record = await this.findInventoryDevice(itemId);
    if (record === undefined) {
      throw new NotFoundError(`Inventory device '${itemId}'`);
    }
    return record;
  }

  private async readAll(): Promise<BitableRecord[]> {
    const records: BitableRecord[] = [];
    let pageToken: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const page = await this.repository.listRecords(this.tableId(), {
        pageSize: 100,
        ...(pageToken !== undefined && { pageToken }),
      });
      records.push(...page.records);
      pageToken = page.pageToken;
      hasMore = page.hasMore && pageToken !== undefined;
    }
    return records;
  }

  private async resolveItem(id: string): Promise<{ record: BitableRecord; item: Assignment }> {
    const tableId = this.tableId();
    const byId = await this.repository.findRecordByField(tableId, FIELD.assignmentId, id);
    const record = byId ?? (await this.repository.getRecord(tableId, id));
    if (record === null) throw new NotFoundError('Assignment');
    return { record, item: toAssignment(record) };
  }
}

function toFields(input: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const fieldName = FIELD[key as keyof typeof FIELD];
    if (fieldName === undefined || value === undefined) {
      continue;
    }

    if ((key === 'assignedAt' || key === 'returnedAt') && typeof value === 'string') {
      if (value.length === 0) {
        continue;
      }
      fields[fieldName] = dateToLarkTimestamp(value);
      continue;
    }

    fields[fieldName] = value;
  }
  return fields;
}

function text(fields: BitableRecord['fields'], key: string): string {
  const value = fields[key];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && (key === FIELD.assignedAt || key === FIELD.returnedAt)) {
    return larkTimestampToDate(value);
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      const named = first as { name?: unknown; text?: unknown };
      return typeof named.name === 'string' ? named.name : typeof named.text === 'string' ? named.text : '';
    }
  }
  if (typeof value === 'object') {
    const named = value as { name?: unknown; text?: unknown; value?: unknown };
    if (typeof named.name === 'string') return named.name;
    if (typeof named.text === 'string') return named.text;
    if (typeof named.value === 'string') return named.value;
  }
  return String(value);
}

function dateToLarkTimestamp(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) {
    throw new LarkIntegrationError('Date must be valid.', 'INVALID_DATE');
  }
  return timestamp;
}

function larkTimestampToDate(value: number): string {
  const timestamp = value < 100000000000 ? value * 1000 : value;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function toAssignment(record: BitableRecord): Assignment {
  const fields = record.fields;
  const rawStatus = text(fields, FIELD.status);
  const returnedAt = text(fields, FIELD.returnedAt);
  const rawNotes = text(fields, FIELD.notes);
  const { cleanNotes, tracking, photos } = parseNotesTracking(rawNotes);

  return {
    id: text(fields, FIELD.assignmentId) || record.recordId,
    itemId: text(fields, FIELD.itemId),
    itemName: text(fields, FIELD.itemName),
    employeeId: text(fields, FIELD.employeeId),
    employeeName: text(fields, FIELD.employeeName),
    assignedAt: text(fields, FIELD.assignedAt),
    status: (rawStatus === 'Returned' ? 'Returned' : 'Active') as Assignment['status'],
    ...(returnedAt.length > 0 ? { returnedAt } : {}),
    ...(cleanNotes.length > 0 ? { notes: cleanNotes } : {}),
    ...(tracking.assignedFrom ? { assignedFrom: tracking.assignedFrom } : {}),
    ...(tracking.assignedBy ? { assignedBy: tracking.assignedBy } : {}),
    ...(tracking.assignedByRole ? { assignedByRole: tracking.assignedByRole } : {}),
    ...(tracking.requestedBy ? { requestedBy: tracking.requestedBy } : {}),
    ...(tracking.requestId ? { requestId: tracking.requestId } : {}),
    ...(tracking.returnedBy ? { returnedBy: tracking.returnedBy } : {}),
    ...(tracking.returnedTo ? { returnedTo: tracking.returnedTo } : {}),
    ...(tracking.returnLocation ? { returnLocation: tracking.returnLocation } : {}),
    ...(tracking.returnCondition ? { returnCondition: tracking.returnCondition } : {}),
    ...(photos.assignmentPhotos?.length ? { assignmentPhotos: photos.assignmentPhotos } : {}),
    ...(photos.returnPhotos?.length ? { returnPhotos: photos.returnPhotos } : {}),
  };
}
