import { Router } from 'express';
import { validate } from '../../middleware/index.js';
import { requireRole } from '../../middleware/auth.middleware.js';
import {
  assignmentIdSchema,
  assignmentQuerySchema,
  createAssignmentSchema,
  returnAssignmentSchema,
  updateAssignmentSchema,
} from './assignments.schemas.js';
import {
  createAssignment,
  deleteAssignment,
  exportAssignments,
  getAssignment,
  listAssignments,
  returnAssignment,
  updateAssignment,
} from './assignments.controller.js';

const router = Router();
const asyncRoute =
  (handler: typeof listAssignments) =>
  (
    req: Parameters<typeof listAssignments>[0],
    res: Parameters<typeof listAssignments>[1],
    next: Parameters<typeof listAssignments>[2],
  ): void => {
    void handler(req, res, next);
  };

// All authenticated users can list/get assignments (filtering applied at controller/service level via req.user)
router.get('/', validate(assignmentQuerySchema, 'query'), asyncRoute(listAssignments));
router.get('/export', asyncRoute(exportAssignments));
router.get('/:id', validate(assignmentIdSchema, 'params'), asyncRoute(getAssignment));

// Admin and TL can create/update/return/delete assignments
router.post('/', requireRole('Admin', 'TL'), validate(createAssignmentSchema), asyncRoute(createAssignment));
router.patch(
  '/:id',
  requireRole('Admin', 'TL'),
  validate(assignmentIdSchema, 'params'),
  validate(updateAssignmentSchema),
  asyncRoute(updateAssignment),
);
router.post(
  '/:id/return',
  requireRole('Admin', 'TL'),
  validate(assignmentIdSchema, 'params'),
  validate(returnAssignmentSchema),
  asyncRoute(returnAssignment),
);
router.delete('/:id', requireRole('Admin'), validate(assignmentIdSchema, 'params'), asyncRoute(deleteAssignment));

export { router as assignmentsRouter };
