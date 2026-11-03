import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../../types/index.js';
import { authService } from './auth.service.js';
import {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateRoleSchema,
  sendTestEmailSchema,
  createEmployeeSchema,
} from './auth.schemas.js';
import { sendNotificationEmail } from '../../services/email/notification.service.js';
import { AssignmentsService } from '../assignments/assignments.service.js';
import { LarkBitableRepository } from '../../repositories/bitable/lark-bitable.repository.js';
import { env } from '../../config/env.js';
import { larkEmployeeSyncService } from '../../services/lark-employee-sync.service.js';

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = authService.login(input.email, input.password);
    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

export async function logout(_req: Request, res: Response): Promise<void> {
  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: 'Logged out successfully' },
  };
  res.json(response);
}

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = authService.getProfile(req.user!.userId);
    const response: ApiResponse<typeof user> = { success: true, data: user };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = changePasswordSchema.parse(req.body);
    const updatedUser = await authService.changePassword(
      req.user!.userId,
      input.currentPassword,
      input.newPassword,
    );
    const response: ApiResponse<{ message: string; user: typeof updatedUser }> = {
      success: true,
      data: {
        message: 'Password changed successfully. A security confirmation email has been dispatched to your email address.',
        user: updatedUser,
      },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(input.email);
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'If an account exists with this email, a reset link has been sent.' },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(input.token, input.newPassword);
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Password reset successfully. A security confirmation email has been sent. Please log in with your new password.' },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/team-members
// ---------------------------------------------------------------------------

export async function getTeamMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const members = authService.listTeamMembers(req.user!.userId);
    const response: ApiResponse<typeof members> = { success: true, data: members };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/reviewers (All authenticated users: TLs and Admins directory)
// ---------------------------------------------------------------------------

export async function getReviewers(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reviewers = authService.getReviewers();
    const response: ApiResponse<typeof reviewers> = { success: true, data: reviewers };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/all-users (Admin only)
// ---------------------------------------------------------------------------

export async function getAllUsersList(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const users = authService.getAllUsers();
    const response: ApiResponse<typeof users> = { success: true, data: users };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/auth/users/:id/role (Admin only)
// ---------------------------------------------------------------------------

export async function updateUserRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { role } = updateRoleSchema.parse(req.body);
    const updated = authService.updateUserRole(req.params.id as string, role);
    const response: ApiResponse<typeof updated> = { success: true, data: updated };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/users/:id/reset-password (Admin only)
// ---------------------------------------------------------------------------

export async function adminResetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tempPassword = req.body.tempPassword as string | undefined;
    const result = authService.adminResetPassword(req.params.id as string, tempPassword);
    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/send-test-email (Admin / TL)
// ---------------------------------------------------------------------------

export async function sendTestEmailHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { to } = sendTestEmailSchema.parse(req.body);
    const host = env.SMTP_HOST.replace(/['"]/g, '').trim();
    const user = env.SMTP_USER.replace(/['"]/g, '').trim();
    const isLive = Boolean(host && user);

    await sendNotificationEmail({
      to,
      subject: '[Inventory System] Test Notification Delivery',
      text: `Hello,\n\nThis is a verification test email from the Transsion Inventory Management System Settings page.\n\nTriggered by: ${req.user?.name} (${req.user?.role})\nTimestamp: ${new Date().toISOString()}\nDelivery Channel: ${isLive ? 'Live SMTP (' + host + ')' : 'Console / Simulated'}\n\nAll notification channels are operating normally.\n\nBest regards,\nIT & Equipment Inventory Team`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #0284c7; margin-top: 0;">🧪 Notification Delivery Test</h2>
  <p>This is a test notification confirming that the automated email delivery system is functioning correctly.</p>
  <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px; margin: 16px 0; font-size: 13px;">
    <p style="margin: 4px 0;"><strong>Triggered By:</strong> ${req.user?.name} (${req.user?.role})</p>
    <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <p style="margin: 4px 0;"><strong>Channel:</strong> ${isLive ? 'Live SMTP (' + host + ')' : 'Console / Simulated'}</p>
  </div>
  <p style="font-size: 12px; color: #64748b;">Inventory Management System • Transsion R&D</p>
</div>
`,
    });

    const response: ApiResponse<{ message: string; liveMode: boolean; recipient: string }> = {
      success: true,
      data: {
        message: isLive
          ? `Test email dispatched to ${to} via Gmail SMTP.`
          : `Simulated test email logged for ${to} (configure SMTP in .env for external delivery).`,
        liveMode: isLive,
        recipient: to,
      },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/system-settings (Authenticated)
// ---------------------------------------------------------------------------

export function getSystemSettings(_req: Request, res: Response): void {
  const host = env.SMTP_HOST.replace(/['"]/g, '').trim();
  const user = env.SMTP_USER.replace(/['"]/g, '').trim();
  const response: ApiResponse<{
    server: {
      environment: string;
      port: number;
      uptimeSeconds: number;
      timestamp: string;
      version: string;
    };
    smtp: {
      configured: boolean;
      host: string;
      user: string;
      port: number;
      fromAddress: string;
      adminEmail: string;
    };
    lark: {
      provider: string;
      appIdMasked: string;
      baseTokenMasked: string;
      tables: {
        inventory: string;
        assignments: string;
        requests: string;
        employees: string;
      };
    };
    policies: {
      zeroDeletion: boolean;
      duplicateCheckpoint: boolean;
      singlePossession: boolean;
      auditPersistence: boolean;
    };
  }> = {
    success: true,
    data: {
      server: {
        environment: env.NODE_ENV,
        port: env.PORT,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: '0.1.0',
      },
      smtp: {
        configured: Boolean(host && user),
        host: host || 'smtp.gmail.com (default fallback)',
        user: user || 'techteam8865@gmail.com',
        port: env.SMTP_PORT,
        fromAddress: user ? user : env.EMAIL_FROM,
        adminEmail: env.ADMIN_EMAIL,
      },
      lark: {
        provider: env.LARK_PROVIDER,
        appIdMasked: env.LARK_APP_ID
          ? `${env.LARK_APP_ID.slice(0, 6)}••••${env.LARK_APP_ID.slice(-4)}`
          : 'Not configured',
        baseTokenMasked: env.LARK_BITABLE_APP_TOKEN
          ? `${env.LARK_BITABLE_APP_TOKEN.slice(0, 6)}••••${env.LARK_BITABLE_APP_TOKEN.slice(-4)}`
          : 'Not configured',
        tables: {
          inventory: env.LARK_TABLE_INVENTORY || 'tbl_inventory_default',
          assignments: env.LARK_TABLE_ASSIGNMENTS || 'tbl_assignments_default',
          requests: env.LARK_TABLE_REQUESTS || 'tbl_requests_default',
          employees: env.LARK_TABLE_EMPLOYEES || 'tbl_employees_default',
        },
      },
      policies: {
        zeroDeletion: true,
        duplicateCheckpoint: true,
        singlePossession: true,
        auditPersistence: true,
      },
    },
  };
  res.json(response);
}

// ---------------------------------------------------------------------------
// POST /api/auth/users (Admin only) — Add Employee or TL
// ---------------------------------------------------------------------------

export async function createEmployeeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createEmployeeSchema.parse(req.body);
    const result = await authService.createEmployee(input, req.user!);
    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/auth/users/:id (Admin only) — Remove Employee or TL
// ---------------------------------------------------------------------------

export async function removeEmployeeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const assignmentsService = new AssignmentsService(new LarkBitableRepository());
    const result = await authService.removeEmployee(
      req.params.id as string,
      req.user!,
      async (identifiers) => {
        const active = await assignmentsService.getActiveAssignmentsForEmployee(identifiers);
        return active.length > 0;
      },
    );
    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/lark-directory — Read Employee Directory from Lark (Admin/TL)
// ---------------------------------------------------------------------------

export async function getLarkDirectoryHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const employees = await larkEmployeeSyncService.listFromLark();
    const tableConfigured =
      Boolean(env.LARK_TABLE_EMPLOYEES) &&
      env.LARK_TABLE_EMPLOYEES.length > 0 &&
      env.LARK_TABLE_EMPLOYEES !== 'tbl_employees_default';

    const response: ApiResponse<{
      employees: typeof employees;
      total: number;
      tableConfigured: boolean;
      tableId: string;
    }> = {
      success: true,
      data: {
        employees,
        total: employees.length,
        tableConfigured,
        tableId: env.LARK_TABLE_EMPLOYEES || '',
      },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/sync-lark — Bulk sync all users to Lark Directory (Admin only)
// ---------------------------------------------------------------------------

export async function syncAllToLarkHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const allUsers = authService.getAllUsers();
    let synced = 0;
    let failed = 0;

    for (const user of allUsers) {
      try {
        await larkEmployeeSyncService.upsertEmployee({
          empCode: user.empCode,
          name: user.name,
          email: user.email,
          team: user.team,
          department: user.department,
          role: user.role,
        });
        synced++;
      } catch {
        failed++;
      }
    }

    const response: ApiResponse<{ message: string; synced: number; failed: number; total: number }> = {
      success: true,
      data: {
        message: `Sync complete. ${synced} employees synced to Lark Employee Directory.${failed > 0 ? ` ${failed} failed.` : ''}`,
        synced,
        failed,
        total: allUsers.length,
      },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
}
