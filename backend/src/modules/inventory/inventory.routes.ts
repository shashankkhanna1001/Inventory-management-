import { Router } from 'express';
import { validate } from '../../middleware/index.js';
import { requireRole } from '../../middleware/auth.middleware.js';
import {
  createInventorySchema,
  inventoryIdSchema,
  inventoryQuerySchema,
  updateInventorySchema,
  bulkUploadSchema,
} from './inventory.schemas.js';
import {
  createInventory,
  bulkUploadInventory,
  deactivateInventory,
  deleteInventory,
  getInventory,
  getDeviceTracking,
  listInventory,
  updateInventory,
} from './inventory.controller.js';

const router = Router();
const asyncRoute =
  (handler: typeof listInventory) =>
  (
    req: Parameters<typeof listInventory>[0],
    res: Parameters<typeof listInventory>[1],
    next: Parameters<typeof listInventory>[2],
  ): void => {
    void handler(req, res, next);
  };

// Read operations — all authenticated users
router.get('/', validate(inventoryQuerySchema, 'query'), asyncRoute(listInventory));
router.get('/:id/tracking', asyncRoute(getDeviceTracking as unknown as typeof listInventory));
router.get('/:id', validate(inventoryIdSchema, 'params'), asyncRoute(getInventory));

// Write operations — Admin and TL for bulk upload; Admin for single mutate/delete
router.post('/bulk-upload', requireRole('Admin', 'TL'), validate(bulkUploadSchema), asyncRoute(bulkUploadInventory));
router.post('/', requireRole('Admin'), validate(createInventorySchema), asyncRoute(createInventory));
router.patch(
  '/:id',
  requireRole('Admin'),
  validate(inventoryIdSchema, 'params'),
  validate(updateInventorySchema),
  asyncRoute(updateInventory),
);
router.post('/:id/deactivate', requireRole('Admin'), validate(inventoryIdSchema, 'params'), asyncRoute(deactivateInventory));
router.delete('/:id', requireRole('Admin'), validate(inventoryIdSchema, 'params'), asyncRoute(deleteInventory));

export { router as inventoryRouter };
