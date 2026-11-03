import { z } from 'zod';

export const ASSIGNMENT_STATUSES = ['Active', 'Returned'] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z
  .string()
  .trim()
  .regex(dateRegex, 'Date must use YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Date must be valid');

const optionalDateString = z
  .string()
  .trim()
  .refine((val) => val === '' || (dateRegex.test(val) && !Number.isNaN(Date.parse(`${val}T00:00:00Z`))), 'Date must use YYYY-MM-DD format')
  .optional()
  .default('');

export const photoRecordSchema = z.object({
  label: z.enum(['front', 'back', 'extra_1', 'extra_2', 'extra_3']),
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/i),
  sizeBytes: z.number().max(5 * 1024 * 1024, 'Each photo must be under 5 MB'),
  dataUri: z.string().startsWith('data:image/'),
  capturedAt: z.string(),
});

export const assignmentIdSchema = z.object({ id: z.string().trim().min(1).max(100) });

export const assignmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().max(200).optional().default(''),
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(ASSIGNMENT_STATUSES).optional()),
});

export const createAssignmentSchema = z.object({
  itemId: z.string().trim().min(1, 'Item ID is required').max(100),
  itemName: z.string().trim().min(1, 'Item Name is required').max(200),
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(100),
  employeeName: z.string().trim().min(1, 'Employee Name is required').max(200),
  assignedAt: dateString,
  returnedAt: optionalDateString,
  notes: z.string().trim().max(2000).optional().default(''),
  status: z.enum(ASSIGNMENT_STATUSES).default('Active'),
  // Custody tracking
  assignedFrom: z.string().trim().max(200).optional().default('IT Stock'),
  assignedBy: z.string().trim().max(200).optional(),
  assignedByRole: z.string().trim().max(50).optional(),
  requestedBy: z.string().trim().max(200).optional(),
  requestId: z.string().trim().max(100).optional(),
  // Device condition photos (optional; front+back enforced on frontend)
  assignmentPhotos: z.array(photoRecordSchema).max(5).optional(),
});

export const updateAssignmentSchema = z
  .object({
    itemId: z.string().trim().min(1).max(100).optional(),
    itemName: z.string().trim().min(1).max(200).optional(),
    employeeId: z.string().trim().min(1).max(100).optional(),
    employeeName: z.string().trim().min(1).max(200).optional(),
    assignedAt: dateString.optional(),
    returnedAt: optionalDateString,
    notes: z.string().trim().max(2000).optional(),
    status: z.enum(ASSIGNMENT_STATUSES).optional(),
    assignedFrom: z.string().trim().max(200).optional(),
    assignedBy: z.string().trim().max(200).optional(),
    returnedBy: z.string().trim().max(200).optional(),
    returnedTo: z.string().trim().max(200).optional(),
    returnLocation: z.string().trim().max(200).optional(),
    returnCondition: z.string().trim().max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

export const returnAssignmentSchema = z.object({
  returnedAt: optionalDateString,
  returnedBy: z.string().trim().max(200).optional(),
  returnedTo: z.string().trim().max(200).optional(),
  returnLocation: z.string().trim().max(200).optional().default('WH-1 (Main Hub)'),
  returnCondition: z.string().trim().max(200).optional().default('Good'),
  notes: z.string().trim().max(2000).optional(),
  // Device condition photos at return time (optional; front+back enforced on frontend)
  returnPhotos: z.array(photoRecordSchema).max(5).optional(),
});

export type AssignmentQuery = z.infer<typeof assignmentQuerySchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type ReturnAssignmentInput = z.infer<typeof returnAssignmentSchema>;
export type PhotoRecord = z.infer<typeof photoRecordSchema>;
