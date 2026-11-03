import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User, AuthTokenPayload, UserRole } from '../../types/index.js';
import { env } from '../../config/index.js';
import { sendNotificationEmail, notifyPasswordChanged } from '../../services/email/notification.service.js';
import { AppError, ConflictError, NotFoundError } from '../../middleware/error-handler.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateEmployeeInput } from './auth.schemas.js';
import { larkEmployeeSyncService } from '../../services/lark-employee-sync.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Seed data — 40 employees
// ---------------------------------------------------------------------------

interface SeedUser {
  id: string;
  empCode: string;
  name: string;
  email: string;
  team: string;
  department: string;
  role: UserRole;
  tempPassword: string;
}

const SEED_USERS: SeedUser[] = [
  { id: '19100009', empCode: '19100009', name: 'Mohd.Shane Alam', email: 'mohd.shane@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'TL', tempPassword: 'Mohd@19100009' },
  { id: '19101020', empCode: '19101020', name: 'Rohan Raj Singh', email: 'rohan.singh@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Roha@19101020' },
  { id: '19102043', empCode: '19102043', name: 'Aasim Shaikh', email: 'aasim.shaikh@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Aasi@19102043' },
  { id: '19102770', empCode: '19102770', name: 'Arjun Nainwal', email: 'arjun.nainwal@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Arju@19102770' },
  { id: '19103849', empCode: '19103849', name: 'Pranav Kumar', email: 'pranav.kumar@transsion.com', team: 'Scenario team', department: 'India Overseas Station - R&D Testing', role: 'TL', tempPassword: 'Pran@19103849' },
  { id: '19103888', empCode: '19103888', name: 'Amit Mantoon Sharma', email: 'amit.sharma4@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Amit@19103888' },
  { id: '19103905', empCode: '19103905', name: 'Kamal Sharma', email: 'kamal.sharma@transsion.com', team: 'VOC Team', department: 'India Overseas Station - R&D Testing', role: 'TL', tempPassword: 'Kama@19103905' },
  { id: '19103964', empCode: '19103964', name: 'Gurdeep', email: 'gurdeep@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'TL', tempPassword: 'Gurd@19103964' },
  { id: '19104005', empCode: '19104005', name: 'Vikash Kumar Gupta', email: 'vikash.gupta@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Vika@19104005' },
  { id: '19104016', empCode: '19104016', name: 'Jithin K', email: 'jithin.k@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Jith@19104016' },
  { id: '19104017', empCode: '19104017', name: 'Umesh Kumar', email: 'umesh.kumar4@transsion.com', team: 'VOC Team', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Umes@19104017' },
  { id: '19104043', empCode: '19104043', name: 'Aditya Kumar', email: 'aditya.kumar2@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Adit@19104043' },
  { id: '19104121', empCode: '19104121', name: 'Altaf Ahmad Dar', email: 'altaf.dar@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Alta@19104121' },
  { id: '19104231', empCode: '19104231', name: 'Rizwan Maqbool Ahmad', email: 'rizwan.ahmad@transsion.com', team: 'Fans Trial', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Rizw@19104231' },
  { id: '19104683', empCode: '19104683', name: 'Beerendra Kumar Saraswat', email: 'beerendra.saraswat@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'TL', tempPassword: 'Beer@19104683' },
  { id: '19104745', empCode: '19104745', name: 'Shariful Islam', email: 'shariful.islam2@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Shar@19104745' },
  { id: '19105126', empCode: '19105126', name: 'Resham kumari', email: 'resham.kumari@transsion.com', team: 'Fans Trial', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Resh@19105126' },
  { id: '19105163', empCode: '19105163', name: 'Harshit Bhatnagar', email: 'harshit.bhatnagar@transsion.com', team: 'Scenario team', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Hars@19105163' },
  { id: '19105185', empCode: '19105185', name: 'Deepshikha Gandhi', email: 'deepshikha.gandhi@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Deep@19105185' },
  { id: '19105201', empCode: '19105201', name: 'Rahul Tiwari', email: 'rahul.tiwari@transsion.com', team: 'Scenario team', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Rahu@19105201' },
  { id: '19105242', empCode: '19105242', name: 'Subham Kumar', email: 'subham.kumar@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Subh@19105242' },
  { id: '19105243', empCode: '19105243', name: 'Priyesh Mani Pandey', email: 'priyesh.pandey@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Priy@19105243' },
  { id: '19105244', empCode: '19105244', name: 'Prakash Attree', email: 'prakash.attree@transsion.com', team: 'Scenario team', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Prak@19105244' },
  { id: '19105245', empCode: '19105245', name: 'Abhitanshu Pratap Singh Raghav', email: 'abhitanshu.raghav@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Abhi@19105245' },
  { id: '19105257', empCode: '19105257', name: 'Satyam Kumar', email: 'satyam.kumar1@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Saty@19105257' },
  { id: '19105266', empCode: '19105266', name: 'Ajay Yadav', email: 'ajay.yadav1@transsion.com', team: 'Scenario team', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Ajay@19105266' },
  { id: '19105293', empCode: '19105293', name: 'Suraj Singh Bhadoriya', email: 'suraj.bhadoriya@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Sura@19105293' },
  { id: '19105305', empCode: '19105305', name: 'Vikash Singh', email: 'vikas.singh1@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Vika@19105305' },
  { id: '19105372', empCode: '19105372', name: 'Manish Kumar', email: 'manish.kumar12@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Mani@19105372' },
  { id: '19105375', empCode: '19105375', name: 'Pankaj Bisoyee', email: 'pankaj.bisoyee@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Pank@19105375' },
  { id: '19105393', empCode: '19105393', name: 'Aman Singh', email: 'aman.singh5@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Aman@19105393' },
  { id: '19105585', empCode: '19105585', name: 'Anubhav Singh', email: 'anubhav.singh@transsion.com', team: 'Basic Quality', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Anub@19105585' },
  { id: '19105470', empCode: '19105470', name: 'Sachin Prakash', email: 'sachin.prakash1@transsion.com', team: 'Camera IQ', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Sach@19105470' },
  { id: '19104281', empCode: '19104281', name: 'Abhishek Mishra', email: 'abhishek.mishra3@transsion.com', team: 'Camera IQ', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Abhi@19104281' },
  { id: '19104379', empCode: '19104379', name: 'Guriya Kumari', email: 'guriya.kumari@transsion.com', team: 'Camera IQ', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Guri@19104379' },
  { id: '19105816', empCode: '19105816', name: 'Neha Gaurav', email: 'neha.gaurav@transsion.com', team: 'Camera IQ', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Neha@19105816' },
  { id: '19105649', empCode: '19105649', name: 'Aritra Modak', email: 'aritra.modak@transsion.com', team: 'Camera IQ', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Arit@19105649' },
  { id: '19101269', empCode: '19101269', name: 'Vinod Kundra', email: 'vinod.kundra@transsion.com', team: 'India Team', department: 'India Overseas Station - R&D Testing', role: 'Admin', tempPassword: 'Vino@19101269' },
  { id: '19105812', empCode: '19105812', name: 'Aditya', email: 'aditya@transsion.com', team: 'Fans Trial', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Adit@19105812' },
  { id: '19105818', empCode: '19105818', name: 'Rajdeep', email: 'rajdeep@transsion.com', team: 'VOC Team', department: 'India Overseas Station - R&D Testing', role: 'Employee', tempPassword: 'Rajd@19105818' },
];

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

export class AuthService {
  private static instance: AuthService | null = null;
  private users: User[] = [];

  constructor() {
    this.ensureStorage();
    this.loadUsers();
    if (this.users.length === 0) {
      this.seed();
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private ensureStorage(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private loadUsers(): void {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      this.users = JSON.parse(data) as User[];
    } catch {
      this.users = [];
    }
  }

  private save(): void {
    fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf-8');
  }

  private seed(): void {
    console.log('🔑 Seeding users.json with hashed passwords...');
    const now = new Date().toISOString();
    this.users = SEED_USERS.map((u) => ({
      id: u.id,
      empCode: u.empCode,
      name: u.name,
      email: u.email,
      team: u.team,
      department: u.department,
      role: u.role,
      passwordHash: bcrypt.hashSync(u.tempPassword, SALT_ROUNDS),
      passwordResetRequired: true,
      passwordResetToken: null,
      passwordResetExpires: null,
      createdAt: now,
      updatedAt: now,
    }));
    this.save();
    console.log(`✅ Seeded ${this.users.length} users.`);
  }

  private signToken(user: User): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      empCode: user.empCode,
      email: user.email,
      role: user.role,
      team: user.team,
      name: user.name,
    };
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: (env.JWT_EXPIRES_IN || '1h') as string,
    } as jwt.SignOptions);
  }

  private findByEmail(email: string): User | undefined {
    this.loadUsers();
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  private findById(id: string): User | undefined {
    this.loadUsers();
    return this.users.find((u) => u.id === id);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  public login(email: string, password: string): { token: string; user: Omit<User, 'passwordHash'> } {
    const user = this.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = this.signToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser };
  }

  public verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    } catch {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }
  }

  public getProfile(userId: string): Omit<User, 'passwordHash'> {
    const user = this.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    const user = this.users[idx]!;
    const valid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError('Current password is incorrect', 400, 'WRONG_PASSWORD');
    }

    const now = new Date().toISOString();
    this.users[idx] = {
      ...user,
      passwordHash: bcrypt.hashSync(newPassword, SALT_ROUNDS),
      passwordResetRequired: false,
      updatedAt: now,
    };
    this.save();

    // Audit log
    AuditService.getInstance().log({
      actorId: user.email || user.empCode || user.id,
      actorRole: user.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
      details: {
        name: user.name,
        email: user.email,
        empCode: user.empCode,
        message: 'Password successfully updated by user',
      },
      status: 'SUCCESS',
    });

    // Send confirmation security notification email
    void notifyPasswordChanged({
      to: user.email,
      name: user.name,
      empCode: user.empCode,
      changedAt: new Date().toUTCString(),
    });

    const { passwordHash: _, ...safeUser } = this.users[idx]!;
    return safeUser;
  }

  public async forgotPassword(email: string): Promise<{ token: string }> {
    const idx = this.users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) {
      // Don't reveal whether account exists
      return { token: '' };
    }
    const user = this.users[idx]!;

    // Generate 6-char alphanumeric token
    const token = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    this.users[idx] = {
      ...user,
      passwordResetToken: token,
      passwordResetExpires: expiry,
      updatedAt: new Date().toISOString(),
    };
    this.save();

    const resetLink = `http://localhost:5173/reset-password?token=${token}`;

    await sendNotificationEmail({
      to: user.email,
      subject: '[Inventory System] Password Reset Request',
      text: `Hello ${user.name},\n\nYour password reset token is: ${token}\n\nOr click here: ${resetLink}\n\nThis token expires in 1 hour.\n\nIf you did not request a password reset, please ignore this email.\n\nBest regards,\nInventory Management System`,
      html: `<p>Hello <strong>${user.name}</strong>,</p><p>Your password reset token is: <strong>${token}</strong></p><p>Or <a href="${resetLink}">click here to reset your password</a>.</p><p>This token expires in 1 hour.</p><p>If you did not request a password reset, please ignore this email.</p>`,
    });

    // Return token for dev logging purposes
    console.log(`🔑 [DEV] Password reset token for ${email}: ${token}`);
    return { token };
  }

  public async resetPassword(token: string, newPassword: string): Promise<Omit<User, 'passwordHash'>> {
    const idx = this.users.findIndex((u) => u.passwordResetToken === token);
    if (idx === -1) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }
    const user = this.users[idx]!;
    if (!user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
      throw new AppError('Reset token has expired', 400, 'RESET_TOKEN_EXPIRED');
    }

    const now = new Date().toISOString();
    this.users[idx] = {
      ...user,
      passwordHash: bcrypt.hashSync(newPassword, SALT_ROUNDS),
      passwordResetRequired: false,
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: now,
    };
    this.save();

    // Audit log
    AuditService.getInstance().log({
      actorId: user.email || user.empCode || user.id,
      actorRole: user.role,
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: user.id,
      details: {
        name: user.name,
        email: user.email,
        empCode: user.empCode,
        message: 'Password reset via email token',
      },
      status: 'SUCCESS',
    });

    // Send confirmation security notification email
    void notifyPasswordChanged({
      to: user.email,
      name: user.name,
      empCode: user.empCode,
      changedAt: new Date().toUTCString(),
    });

    const { passwordHash: _, ...safeUser } = this.users[idx]!;
    return safeUser;
  }

  public listTeamMembers(tlUserId: string): Omit<User, 'passwordHash'>[] {
    const tlUser = this.findById(tlUserId);
    if (!tlUser) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Admin gets all users; TL gets their team
    const members =
      tlUser.role === 'Admin'
        ? this.users
        : this.users.filter((u) => u.team === tlUser.team && u.id !== tlUserId);

    return members.map(({ passwordHash: _, ...u }) => u);
  }

  public getAllUsers(): Omit<User, 'passwordHash'>[] {
    this.loadUsers();
    return this.users.map(({ passwordHash: _, ...u }) => u);
  }

  public getReviewers(): Omit<User, 'passwordHash'>[] {
    this.loadUsers();
    return this.users
      .filter((u) => u.role === 'TL' || u.role === 'Admin')
      .map(({ passwordHash: _, ...u }) => u);
  }

  public findUser(query: string): User | undefined {
    this.loadUsers();
    const q = query.trim().toLowerCase();
    return this.users.find(
      (u) =>
        u.id.toLowerCase() === q ||
        u.empCode.toLowerCase() === q ||
        u.email.toLowerCase() === q ||
        u.name.toLowerCase() === q,
    );
  }

  public getTeamLeadsForUser(userIdOrEmailOrCode: string): User[] {
    const user = this.findUser(userIdOrEmailOrCode);
    if (!user) {
      return this.users.filter((u) => u.role === 'Admin');
    }

    const team = user.team;
    const teamTLs = this.users.filter((u) => u.team === team && u.role === 'TL');
    if (teamTLs.length > 0) {
      return teamTLs;
    }

    // Fallback: if no TL in this team, notify Admin
    return this.users.filter((u) => u.role === 'Admin');
  }

  public updateUserRole(userId: string, newRole: UserRole): Omit<User, 'passwordHash'> {
    this.loadUsers();
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    this.users[idx] = {
      ...this.users[idx]!,
      role: newRole,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    const { passwordHash: _, ...safeUser } = this.users[idx]!;
    return safeUser;
  }

  public adminResetPassword(userId: string, tempPassword?: string): { message: string; tempPassword: string } {
    this.loadUsers();
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    const user = this.users[idx]!;
    const newPass = tempPassword || `${user.name.slice(0, 4)}@${user.empCode}`;
    this.users[idx] = {
      ...user,
      passwordHash: bcrypt.hashSync(newPass, SALT_ROUNDS),
      passwordResetRequired: true,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return {
      message: `Password reset to temporary password for ${user.name}`,
      tempPassword: newPass,
    };
  }

  public async createEmployee(
    input: CreateEmployeeInput,
    adminUser: { userId: string; email?: string; empCode?: string },
  ): Promise<{ user: Omit<User, 'passwordHash'>; tempPassword: string }> {
    this.loadUsers();

    // Check unique email
    const emailLower = input.email.trim().toLowerCase();
    if (this.users.some((u) => u.email.toLowerCase() === emailLower)) {
      throw new ConflictError(`An employee with email '${input.email}' already exists in the organization.`);
    }

    // Check unique empCode
    const empCodeTrimmed = input.empCode.trim();
    if (this.users.some((u) => u.empCode === empCodeTrimmed || u.id === empCodeTrimmed)) {
      throw new ConflictError(`An employee with ID '${input.empCode}' already exists in the organization.`);
    }

    // Generate temp password if not provided
    const cleanName = input.name.replace(/[^a-zA-Z]/g, '');
    const prefix = cleanName.length >= 4 ? cleanName.slice(0, 4) : (cleanName + 'User').slice(0, 4);
    const tempPassword =
      input.tempPassword ||
      `${prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()}@${empCodeTrimmed}`;

    const now = new Date().toISOString();
    const newUser: User = {
      id: empCodeTrimmed,
      empCode: empCodeTrimmed,
      name: input.name.trim(),
      email: input.email.trim(),
      team: input.team.trim(),
      department: input.department.trim(),
      role: input.role,
      passwordHash: bcrypt.hashSync(tempPassword, SALT_ROUNDS),
      passwordResetRequired: true,
      passwordResetToken: null,
      passwordResetExpires: null,
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(newUser);
    this.save();

    // Sync to Lark Employee Directory (non-blocking, non-fatal)
    void larkEmployeeSyncService.upsertEmployee({
      empCode: newUser.empCode,
      name: newUser.name,
      email: newUser.email,
      team: newUser.team,
      department: newUser.department,
      role: newUser.role,
    });

    // Log to audit trail
    AuditService.getInstance().log({
      actorId: adminUser.email || adminUser.empCode || adminUser.userId,
      actorRole: 'Admin',
      action: 'EMPLOYEE_ADDED',
      entityType: 'User',
      entityId: newUser.id,
      details: {
        name: newUser.name,
        email: newUser.email,
        empCode: newUser.empCode,
        team: newUser.team,
        role: newUser.role,
      },
      status: 'SUCCESS',
    });

    // Send welcome email with credentials
    void sendNotificationEmail({
      to: newUser.email,
      subject: `[Welcome to Transsion Inventory] Your Account Credentials`,
      text: `Hello ${newUser.name},\n\nYou have been added to the Transsion Inventory Management System by the System Administrator.\n\nYour Account Details:\n- Employee Name: ${newUser.name}\n- Employee Code: ${newUser.empCode}\n- Assigned Team: ${newUser.team}\n- Role: ${newUser.role}\n- Temporary Password: ${tempPassword}\n\nPlease log in at http://localhost:5173/login and reset your password.\n\nBest regards,\nIT & Equipment Inventory Team`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #0284c7; margin-top: 0;">👋 Welcome to Transsion Inventory Management</h2>
  <p>Hello <strong>${newUser.name}</strong>,</p>
  <p>Your account has been officially created in the Transsion Inventory & Testing Device Management System.</p>
  <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 14px; margin: 16px 0; font-size: 13px;">
    <p style="margin: 4px 0;"><strong>Corporate Email:</strong> ${newUser.email}</p>
    <p style="margin: 4px 0;"><strong>Employee Code:</strong> ${newUser.empCode}</p>
    <p style="margin: 4px 0;"><strong>Assigned Team:</strong> ${newUser.team}</p>
    <p style="margin: 4px 0;"><strong>Assigned Role:</strong> ${newUser.role}</p>
    <p style="margin: 8px 0 4px 0;"><strong>Temporary Password:</strong> <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>
  </div>
  <p style="font-size: 13px;">You will be prompted to choose a permanent, secure password upon your first sign in.</p>
  <div style="margin: 20px 0;">
    <a href="http://localhost:5173/login" style="background-color: #0284c7; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">Sign In to Portal</a>
  </div>
  <p style="font-size: 12px; color: #64748b;">Transsion R&D Testing Station • Inventory Management System</p>
</div>
`,
    });

    const { passwordHash: _, ...safeUser } = newUser;
    return { user: safeUser, tempPassword };
  }

  public async removeEmployee(
    userId: string,
    adminUser: { userId: string; email?: string; empCode?: string },
    checkActiveAssignments?: (identifiers: string[]) => Promise<boolean>,
  ): Promise<{ message: string; user: Omit<User, 'passwordHash'> }> {
    this.loadUsers();
    const idx = this.users.findIndex((u) => u.id === userId || u.empCode === userId);
    if (idx === -1) {
      throw new NotFoundError(`Employee with ID '${userId}'`);
    }

    const targetUser = this.users[idx]!;

    // Protection 1: Admin cannot delete their own account
    if (
      targetUser.id === adminUser.userId ||
      targetUser.empCode === adminUser.empCode ||
      (adminUser.email && targetUser.email.toLowerCase() === adminUser.email.toLowerCase())
    ) {
      throw new ConflictError('Security violation: Administrators cannot delete their own accounts.');
    }

    // Protection 2: Verify no active equipment is currently assigned to this employee
    if (checkActiveAssignments) {
      const hasActive = await checkActiveAssignments([
        targetUser.empCode,
        targetUser.email,
        targetUser.name,
      ]);
      if (hasActive) {
        throw new ConflictError(
          `Cannot remove '${targetUser.name}' from the organization because they currently have active hardware registered in their custody. Please ensure all devices are returned back to IT Stock first.`,
        );
      }
    }

    // Remove user
    this.users.splice(idx, 1);
    this.save();

    // Audit log
    AuditService.getInstance().log({
      actorId: adminUser.email || adminUser.empCode || adminUser.userId,
      actorRole: 'Admin',
      action: 'EMPLOYEE_REMOVED',
      entityType: 'User',
      entityId: targetUser.id,
      details: {
        name: targetUser.name,
        email: targetUser.email,
        empCode: targetUser.empCode,
        team: targetUser.team,
        role: targetUser.role,
      },
      status: 'SUCCESS',
    });

    // Remove from Lark Employee Directory (non-blocking, non-fatal)
    void larkEmployeeSyncService.removeEmployee(targetUser.empCode);

    const { passwordHash: _, ...safeUser } = targetUser;
    return {
      message: `Employee '${targetUser.name}' (${targetUser.empCode}) has been successfully removed from the organization.`,
      user: safeUser,
    };
  }
}

export const authService = AuthService.getInstance();
