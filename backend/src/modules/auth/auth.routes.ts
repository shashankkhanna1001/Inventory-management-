import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/index.js';
import {
  login,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  getTeamMembers,
  getReviewers,
  getAllUsersList,
  updateUserRole,
  adminResetPassword,
  sendTestEmailHandler,
  getSystemSettings,
  createEmployeeHandler,
  removeEmployeeHandler,
  getLarkDirectoryHandler,
  syncAllToLarkHandler,
} from './auth.controller.js';

const router = Router();

// Helper to wrap async handlers
const ar =
  (handler: (req: Parameters<typeof login>[0], res: Parameters<typeof login>[1], next: Parameters<typeof login>[2]) => Promise<void>) =>
  (req: Parameters<typeof login>[0], res: Parameters<typeof login>[1], next: Parameters<typeof login>[2]): void => {
    void handler(req, res, next);
  };

// Public routes
router.post('/login', ar(login));
router.post('/forgot-password', ar(forgotPassword));
router.post('/reset-password', ar(resetPassword));

// Protected routes
router.post('/logout', requireAuth, ar(logout));
router.get('/me', requireAuth, ar(getMe));
router.post('/change-password', requireAuth, ar(changePassword));
router.get('/team-members', requireAuth, requireRole('Admin', 'TL'), ar(getTeamMembers));
router.get('/reviewers', requireAuth, ar(getReviewers));

// Settings & Administration routes
router.get('/system-settings', requireAuth, getSystemSettings);
router.post('/send-test-email', requireAuth, requireRole('Admin', 'TL'), ar(sendTestEmailHandler));
router.get('/all-users', requireAuth, requireRole('Admin'), ar(getAllUsersList));
router.patch('/users/:id/role', requireAuth, requireRole('Admin'), ar(updateUserRole));
router.post('/users/:id/reset-password', requireAuth, requireRole('Admin'), ar(adminResetPassword));
router.post('/users', requireAuth, requireRole('Admin'), ar(createEmployeeHandler));
router.delete('/users/:id', requireAuth, requireRole('Admin'), ar(removeEmployeeHandler));

// Lark Employee Directory sync routes
router.get('/lark-directory', requireAuth, requireRole('Admin', 'TL'), ar(getLarkDirectoryHandler));
router.post('/sync-lark', requireAuth, requireRole('Admin'), ar(syncAllToLarkHandler));

export { router as authRouter };
