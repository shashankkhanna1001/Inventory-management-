import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateRoleSchema = z.object({
  role: z.enum(['Admin', 'TL', 'Employee']),
});

export const sendTestEmailSchema = z.object({
  to: z.string().email(),
});

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email address required'),
  empCode: z.string().min(2, 'Employee code is required'),
  team: z.string().min(1, 'Team is required'),
  department: z.string().default('India Overseas Station - R&D Testing'),
  role: z.enum(['Employee', 'TL', 'Admin']).default('Employee'),
  tempPassword: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SendTestEmailInput = z.infer<typeof sendTestEmailSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
