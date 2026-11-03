import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User,
  KeyRound,
  Shield,
  Mail,
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Users,
  Lock,
  Smartphone,
  ClipboardList,
  Layers,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context.js';
import { apiClient } from '@/lib/api-client.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Spinner } from '@/components/ui/spinner.js';
import { AddEmployeeModal } from '../employees/add-employee-modal.js';
import type { AuthUser, SystemSettingsData, IntegrationStatus } from '@/types/api.js';

function getSessionRemaining(token: string | null): string {
  if (!token) return 'Active (1 Hour)';
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return 'Active (1 Hour)';
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const parsed = JSON.parse(jsonPayload) as { exp?: number };
    if (!parsed.exp) return 'Active (1 Hour)';
    const minsLeft = Math.max(0, Math.round((parsed.exp * 1000 - Date.now()) / 60000));
    return `Active (1 Hour • ~${minsLeft}m left)`;
  } catch {
    return 'Active (1 Hour)';
  }
}

export function SettingsPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role ?? 'Employee';

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'integrations' | 'compliance' | 'users'>(
    'profile',
  );

  // ── Password Change State ────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── Test Email State ─────────────────────────────────────────────────────
  const [testEmailTo, setTestEmailTo] = useState(user?.email || '');
  const [testEmailResult, setTestEmailResult] = useState<{ message: string; success: boolean } | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // ── Connectivity Test State ──────────────────────────────────────────────
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<IntegrationStatus | null>(null);

  // ── User Management State (Admin only) ───────────────────────────────────
  const [userSearch, setUserSearch] = useState('');
  const [userTeamFilter, setUserTeamFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: systemSettings } = useQuery<SystemSettingsData>({
    queryKey: ['system-settings'],
    queryFn: () => apiClient.get<SystemSettingsData>('/auth/system-settings'),
  });

  const { data: allUsers, isLoading: usersLoading, refetch: refetchUsers } = useQuery<AuthUser[]>({
    queryKey: ['all-users-settings'],
    queryFn: () => apiClient.get<AuthUser[]>('/auth/all-users'),
    enabled: role === 'Admin',
  });

  // ── Password change handler ──────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match.');
      return;
    }

    setPwdLoading(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPwdSuccess('Password updated successfully! Your account credentials have been securely refreshed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Failed to change password. Please verify current password.');
    } finally {
      setPwdLoading(false);
    }
  };

  // ── Send Test Email handler ──────────────────────────────────────────────
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTo.trim()) return;

    setTestEmailLoading(true);
    setTestEmailResult(null);

    try {
      const res = await apiClient.post<{ message: string; liveMode: boolean }>('/auth/send-test-email', {
        to: testEmailTo.trim(),
      });
      setTestEmailResult({
        success: true,
        message: res.message,
      });
    } catch (err) {
      setTestEmailResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to dispatch test notification.',
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  // ── Live Lark Connectivity Test ──────────────────────────────────────────
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await apiClient.get<IntegrationStatus>('/integration-status');
      setConnectionResult(res);
    } catch (err) {
      setConnectionResult({
        provider: 'lark',
        level: 'error',
        message: err instanceof Error ? err.message : 'Connection test request failed.',
        baseConfigured: false,
        tables: {},
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // ── Invalidate All Caches ────────────────────────────────────────────────
  const handleFlushCache = () => {
    void queryClient.invalidateQueries();
    setActionSuccess('All client data caches have been flushed and freshly re-synchronized.');
    setTimeout(() => setActionSuccess(''), 4000);
  };

  // ── User Management Handlers (Admin) ─────────────────────────────────────
  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    try {
      await apiClient.patch(`/auth/users/${targetUserId}/role`, { role: newRole });
      setActionSuccess(`Role updated to ${newRole} successfully.`);
      void refetchUsers();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user role.');
    }
  };

  const handleAdminResetPassword = async (targetUserId: string, userName: string) => {
    const confirm = window.confirm(`Reset password for ${userName} to standard temporary format?`);
    if (!confirm) return;

    try {
      const res = await apiClient.post<{ message: string; tempPassword: string }>(
        `/auth/users/${targetUserId}/reset-password`,
        {},
      );
      alert(`Success: ${res.message}\nNew Temp Password: ${res.tempPassword}`);
      void refetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset user password.');
    }
  };

  const handleRemoveUser = async (targetUser: AuthUser) => {
    if (targetUser.id === user?.id || targetUser.empCode === user?.empCode) {
      alert('Security policy: You cannot remove your own administrator account.');
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to remove ${targetUser.name} (${targetUser.empCode}) from the organization? This will permanently delete their account and access credentials.`,
    );
    if (!confirm) return;

    try {
      const res = await apiClient.delete<{ message: string }>(`/auth/users/${targetUser.id}`);
      setActionSuccess(res.message);
      void refetchUsers();
      void queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove user.');
    }
  };

  // Filtered users
  const filteredUsers = (allUsers ?? []).filter((u) => {
    const matchesSearch =
      !userSearch ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.empCode.toLowerCase().includes(userSearch.toLowerCase());

    const matchesTeam = !userTeamFilter || u.team === userTeamFilter;
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;

    return matchesSearch && matchesTeam && matchesRole;
  });

  const uniqueTeams = Array.from(new Set((allUsers ?? []).map((u) => u.team).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System & Account Settings</h2>
          <p className="text-muted-foreground text-sm">
            Manage your credentials, configure notification channels, monitor database integrations, and review compliance rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs px-2.5 py-1 bg-muted/40 font-mono flex items-center gap-1.5"
          >
            <Server className="h-3.5 w-3.5 text-primary" />
            Node: {systemSettings?.server.environment || 'development'}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs px-2.5 py-1 bg-muted/40 font-mono"
          >
            v{systemSettings?.server.version || '0.1.0'}
          </Badge>
        </div>
      </div>

      {actionSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'profile'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>Profile & Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'notifications'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email & Notifications</span>
          {systemSettings?.smtp.configured && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 ml-0.5" title="SMTP Active" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'integrations'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>Cloud Database & Sync</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compliance')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'compliance'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Governance & Policies</span>
        </button>

        {role === 'Admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'users'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>User Roster ({allUsers?.length || 40})</span>
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: PROFILE & SECURITY                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Account Profile Card */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Account Details
              </CardTitle>
              <CardDescription>
                Verified identity details linked to your corporate employee code.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold">
                  {user?.name
                    ? user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                    : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">{user?.name}</h3>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge
                      variant={role === 'Admin' ? 'default' : role === 'TL' ? 'secondary' : 'outline'}
                      className="text-[11px]"
                    >
                      {role === 'Admin' ? 'System Administrator' : role === 'TL' ? 'Team Lead (TL)' : 'Employee'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t text-xs">
                <div>
                  <span className="text-muted-foreground block">Employee Code</span>
                  <span className="font-mono font-semibold">{user?.empCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Assigned Team</span>
                  <span className="font-semibold">{user?.team}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Department</span>
                  <span className="font-semibold">{user?.department}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Session Validity</span>
                  <span className="font-semibold text-emerald-600">{getSessionRemaining(token)}</span>
                </div>
              </div>

              {/* Role Scope summary */}
              <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-1.5 mt-2">
                <p className="font-semibold flex items-center gap-1 text-foreground">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Your Role Capabilities:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                  {role === 'Admin' && (
                    <>
                      <li>Full administrative control over all device master inventories.</li>
                      <li>Authority to allocate, amend, and deactivate hardware records.</li>
                      <li>Approve or reject equipment requests across all departments.</li>
                      <li>Review audit trails and modify user authorization levels.</li>
                    </>
                  )}
                  {role === 'TL' && (
                    <>
                      <li>Visibility over all employees in your team ({user?.team}).</li>
                      <li>Monitor hardware currently assigned to your team members.</li>
                      <li>Review and approve equipment requests from your team.</li>
                      <li>Directly assign available in-stock devices to team members.</li>
                      <li>Bulk upload and batch-import hardware devices into inventory.</li>
                    </>
                  )}
                  {role === 'Employee' && (
                    <>
                      <li>Submit new equipment requests for testing devices.</li>
                      <li>View all hardware currently assigned under your employee code.</li>
                      <li>Track pending request status and return confirmations.</li>
                    </>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Form */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password. Must contain at least 8 characters.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleChangePassword} className="space-y-4">
                {pwdSuccess && (
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{pwdSuccess}</span>
                  </div>
                )}

                {pwdError && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{pwdError}</span>
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  <label className="font-medium text-foreground block">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((p) => !p)}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-medium text-foreground block">New Password (min 8 characters)</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new strong password"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-medium text-foreground block">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  />
                </div>

                <Button type="submit" size="sm" className="w-full gap-1.5" disabled={pwdLoading}>
                  {pwdLoading ? <Spinner size="sm" /> : <Lock className="h-3.5 w-3.5" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: EMAIL & NOTIFICATIONS                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* SMTP Status Card */}
            <Card>
              <CardHeader className="pb-3 border-b bg-muted/10">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Email Gateway Status
                  </span>
                  <Badge variant={systemSettings?.smtp.configured ? 'success' : 'secondary'}>
                    {systemSettings?.smtp.configured ? 'Live SMTP Connected' : 'Simulated / Offline'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Configuration for automated email notifications dispatched by the system.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block">SMTP Host</span>
                    <span className="font-mono font-medium">{systemSettings?.smtp.host}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Port</span>
                    <span className="font-mono font-medium">{systemSettings?.smtp.port} (TLS / STARTTLS)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Sender Account</span>
                    <span className="font-mono font-medium truncate block">{systemSettings?.smtp.fromAddress}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Admin Contact</span>
                    <span className="font-mono font-medium">{systemSettings?.smtp.adminEmail}</span>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-3 space-y-1 text-[11px] text-muted-foreground">
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Automated Workflow Rules:
                  </p>
                  <p>• When an employee submits a device request, an automated email is dispatched to their Team Lead.</p>
                  <p>• When an admin/TL reviews a request, the employee receives an approval or rejection notification.</p>
                  <p>• When a device is assigned, custody instructions are sent directly to the assignee.</p>
                  <p>• Password reset requests send temporary verification links with 1-hour expiration.</p>
                </div>
              </CardContent>
            </Card>

            {/* Test Email Dispatcher */}
            <Card>
              <CardHeader className="pb-3 border-b bg-muted/10">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Dispatch Test Notification
                </CardTitle>
                <CardDescription>
                  Send a verification message to any address to confirm mailbox deliverability.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleSendTestEmail} className="space-y-4">
                  {testEmailResult && (
                    <div
                      className={`rounded-md border p-3 text-xs flex items-center gap-2 ${
                        testEmailResult.success
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-destructive/20 bg-destructive/10 text-destructive'
                      }`}
                    >
                      {testEmailResult.success ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                      )}
                      <span>{testEmailResult.message}</span>
                    </div>
                  )}

                  <div className="space-y-1 text-xs">
                    <label className="font-medium text-foreground block">Recipient Email Address</label>
                    <input
                      type="email"
                      required
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder="e.g. employee@transsion.com"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      A formatted HTML notification will be delivered with diagnostic details.
                    </p>
                  </div>

                  <Button type="submit" size="sm" className="gap-1.5" disabled={testEmailLoading}>
                    {testEmailLoading ? <Spinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
                    Send Test Email Now
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Trigger Matrix */}
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Notification Trigger Matrix
              </CardTitle>
              <CardDescription>
                System event triggers mapped to automated notification dispatches.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="border-b bg-muted/30 uppercase text-muted-foreground text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Event Name</th>
                      <th className="px-4 py-2.5">Trigger Condition</th>
                      <th className="px-4 py-2.5">Recipient</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium">REQUEST_SUBMITTED</td>
                      <td className="px-4 py-2.5 text-muted-foreground">Employee creates hardware request</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">Employee's Team Lead (TL)</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium">REQUEST_ACKNOWLEDGED</td>
                      <td className="px-4 py-2.5 text-muted-foreground">Request recorded in database</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">Requester (Employee)</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium">REQUEST_REVIEWED</td>
                      <td className="px-4 py-2.5 text-muted-foreground">TL / Admin sets Approved or Rejected</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">Requester (Employee)</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium">DEVICE_ASSIGNED</td>
                      <td className="px-4 py-2.5 text-muted-foreground">Hardware allocated to team member</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">Assignee (Employee)</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium">DEVICE_RETURNED</td>
                      <td className="px-4 py-2.5 text-muted-foreground">Hardware checked back into IT stock</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">Assignee (Employee)</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium">PASSWORD_RESET</td>
                      <td className="px-4 py-2.5 text-muted-foreground">Forgot-password link requested</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">Account Owner</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: CLOUD DATABASE & INTEGRATIONS                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Lark / Feishu Bitable Cloud Integration
                  </CardTitle>
                  <CardDescription>
                    Real-time synchronization status with cloud database tables.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="gap-1.5 text-xs"
                  >
                    {testingConnection ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Test Connectivity
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFlushCache}
                    className="gap-1.5 text-xs"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Flush Cache
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {connectionResult && (
                <div
                  className={`rounded-md border p-3 text-xs flex items-center gap-2 ${
                    connectionResult.level === 'connected'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                      : connectionResult.level === 'configured'
                      ? 'border-blue-500/20 bg-blue-500/10 text-blue-800'
                      : 'border-destructive/20 bg-destructive/10 text-destructive'
                  }`}
                >
                  {connectionResult.level === 'connected' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">{connectionResult.message}</p>
                    <p className="text-[10px] mt-0.5 text-muted-foreground">
                      Provider: {connectionResult.provider.toUpperCase()} • Base Token Configured:{' '}
                      {connectionResult.baseConfigured ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <span className="text-muted-foreground block text-[11px]">Provider</span>
                  <span className="font-semibold text-foreground text-sm uppercase">
                    {systemSettings?.lark.provider}
                  </span>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <span className="text-muted-foreground block text-[11px]">App ID (Masked)</span>
                  <span className="font-mono font-semibold text-foreground">
                    {systemSettings?.lark.appIdMasked}
                  </span>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Bitable App Token</span>
                  <span className="font-mono font-semibold text-foreground">
                    {systemSettings?.lark.baseTokenMasked}
                  </span>
                </div>
              </div>

              {/* Configured Table IDs */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-foreground">Configured Cloud Tables</h4>
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-md border p-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Device Master Inventory</p>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        {systemSettings?.lark.tables.inventory}
                      </p>
                    </div>
                    <Badge variant="success" className="text-[10px]">Connected</Badge>
                  </div>

                  <div className="rounded-md border p-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Device Assignments Table</p>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        {systemSettings?.lark.tables.assignments}
                      </p>
                    </div>
                    <Badge variant="success" className="text-[10px]">Connected</Badge>
                  </div>

                  <div className="rounded-md border p-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Equipment Requests Table</p>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        {systemSettings?.lark.tables.requests}
                      </p>
                    </div>
                    <Badge variant="success" className="text-[10px]">Connected</Badge>
                  </div>

                  {/* Employee Directory row with Sync button */}
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Employee Directory Table</p>
                        <p className="text-muted-foreground font-mono text-[11px]">
                          {systemSettings?.lark.tables.employees}
                        </p>
                      </div>
                      <Badge
                        variant={
                          systemSettings?.lark.tables.employees &&
                          systemSettings.lark.tables.employees !== 'tbl_employees_default'
                            ? 'success'
                            : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {systemSettings?.lark.tables.employees &&
                        systemSettings.lark.tables.employees !== 'tbl_employees_default'
                          ? 'Connected'
                          : 'Not Configured'}
                      </Badge>
                    </div>
                    {role === 'Admin' && systemSettings?.lark.tables.employees !== 'tbl_employees_default' && (
                      <LarkSyncButton />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: GOVERNANCE & POLICIES                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    Zero-Deletion Policy
                  </CardTitle>
                  <Badge variant="success" className="text-[10px]">ENFORCED</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>
                  Hard deletion of mobile devices, assignments, or equipment requests is permanently disabled.
                </p>
                <p className="text-[11px]">
                  Retiring hardware transitions its status to <code>Inactive</code>. Returned devices are preserved in the historical registry to satisfy enterprise audit standards.
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-blue-600" />
                    Duplicate Checkpoint Validation
                  </CardTitle>
                  <Badge variant="default" className="text-[10px] bg-blue-600">ACTIVE</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>
                  Every hardware registration verifies IMEI1 (15 digits), IMEI2, and Serial Number against the database.
                </p>
                <p className="text-[11px]">
                  Attempts to introduce duplicate entries or re-register an active device are blocked and recorded in the audit trail.
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600" />
                    Single Possession Custody Rule
                  </CardTitle>
                  <Badge variant="default" className="text-[10px] bg-purple-600">ACTIVE</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>
                  Only devices marked as <code>Inactive / Available</code> can be allocated to a team member.
                </p>
                <p className="text-[11px]">
                  A device currently assigned to one employee cannot be allocated to another until the first holder completes a formal Return check-in.
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Server className="h-4 w-4 text-amber-600" />
                    Audit Trail & Ledger
                  </CardTitle>
                  <Badge variant="default" className="text-[10px] bg-amber-600">LOGGING</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>
                  All device allocations, returns, status changes, and blocked duplicate attempts are written synchronously to disk.
                </p>
                <p className="text-[11px]">
                  Full reports are available for export under the <strong>Audit & Compliance Reports</strong> section.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: USER MANAGEMENT (Admin Only)                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && role === 'Admin' && (
        <Card>
          <CardHeader className="pb-3 border-b bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Employee Directory & Role Administration
                </CardTitle>
                <CardDescription>
                  Manage authorization levels and credentials for the 40 Transsion team members.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Showing {filteredUsers.length} of {allUsers?.length || 40} Users
                </Badge>
                <Button size="sm" onClick={() => setShowAddUserModal(true)} className="gap-1.5 shadow-xs">
                  <UserPlus className="h-4 w-4" />
                  Add Employee / TL
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-wrap gap-2 text-xs">
              <input
                type="text"
                placeholder="Search by name, email, or emp ID..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-8 min-w-56 flex-1 rounded-md border border-input bg-background px-3"
              />

              <select
                value={userTeamFilter}
                onChange={(e) => setUserTeamFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="">All Teams ({uniqueTeams.length})</option>
                {uniqueTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="TL">Team Lead (TL)</option>
                <option value="Employee">Employee</option>
              </select>
            </div>

            {/* User Table */}
            <div className="max-h-[460px] overflow-y-auto rounded-md border text-xs">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-muted/60 uppercase text-[10px] text-muted-foreground border-b backdrop-blur-xs">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Employee</th>
                    <th className="px-3.5 py-2 font-medium">Emp ID</th>
                    <th className="px-3.5 py-2 font-medium">Team</th>
                    <th className="px-3.5 py-2 font-medium">Current Role</th>
                    <th className="px-3.5 py-2 font-medium text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center">
                        <Spinner />
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No team members matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/20">
                        <td className="px-3.5 py-2">
                          <p className="font-semibold text-foreground">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{u.email}</p>
                        </td>
                        <td className="px-3.5 py-2 font-mono text-muted-foreground">{u.empCode}</td>
                        <td className="px-3.5 py-2">{u.team}</td>
                        <td className="px-3.5 py-2">
                          <Badge
                            variant={u.role === 'Admin' ? 'default' : u.role === 'TL' ? 'secondary' : 'outline'}
                            className="text-[10px]"
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Role changer dropdown */}
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="h-6 rounded border bg-background px-1.5 text-[10px] font-medium"
                              title="Change Role"
                            >
                              <option value="Employee">Employee</option>
                              <option value="TL">TL</option>
                              <option value="Admin">Admin</option>
                            </select>

                            {/* Reset Password button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                              title={`Reset password to temporary format (${u.name.slice(0, 4)}@${u.empCode})`}
                              onClick={() => handleAdminResetPassword(u.id, u.name)}
                            >
                              <KeyRound className="h-3 w-3 mr-1" />
                              Reset Pwd
                            </Button>

                            {/* Remove User from organization */}
                            {u.id !== user?.id && u.empCode !== user?.empCode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title={`Remove ${u.name} from organization`}
                                onClick={() => handleRemoveUser(u)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showAddUserModal && (
        <AddEmployeeModal
          onClose={() => setShowAddUserModal(false)}
          onSuccess={(newEmp) => {
            setActionSuccess(`Successfully added ${newEmp.name} (${newEmp.role}) to team ${newEmp.team}!`);
            void refetchUsers();
            void queryClient.invalidateQueries({ queryKey: ['team-members'] });
            setTimeout(() => setActionSuccess(''), 4000);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LarkSyncButton — used in the integrations tab to trigger bulk sync
// ---------------------------------------------------------------------------

function LarkSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ synced: number; failed: number; message: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await apiClient.post<{ message: string; synced: number; failed: number; total: number }>(
        '/auth/sync-lark',
        {},
      );
      setResult({ synced: res.synced, failed: res.failed, message: res.message });
    } catch (err) {
      setResult({ synced: 0, failed: -1, message: err instanceof Error ? err.message : 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        className="text-[11px] h-7 gap-1"
        onClick={() => void handleSync()}
        disabled={syncing}
      >
        {syncing ? (
          <Spinner size="sm" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        {syncing ? 'Syncing…' : 'Sync All to Lark'}
      </Button>
      {result && (
        <span
          className={`text-[11px] ${result.failed < 0 ? 'text-destructive' : result.failed > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
        >
          {result.failed < 0 ? `❌ ${result.message}` : `✅ ${result.synced} synced${result.failed > 0 ? `, ${result.failed} failed` : ''}`}
        </span>
      )}
    </div>
  );
}
