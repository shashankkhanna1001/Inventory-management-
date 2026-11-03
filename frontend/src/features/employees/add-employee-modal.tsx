import { useState } from 'react';
import { X, UserPlus, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import type { AuthUser, UserRole } from '@/types/api.js';

interface AddEmployeeModalProps {
  onClose: () => void;
  onSuccess: (user: AuthUser, tempPassword: string) => void;
}

const DEFAULT_TEAMS = [
  'Basic Quality',
  'Scenario team',
  'VOC Team',
  'Fans Trial',
  'Camera IQ',
  'India Team',
];

export function AddEmployeeModal({ onClose, onSuccess }: AddEmployeeModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [team, setTeam] = useState('Basic Quality');
  const [customTeam, setCustomTeam] = useState('');
  const [department, setDepartment] = useState('India Overseas Station - R&D Testing');
  const [role, setRole] = useState<UserRole>('Employee');
  const [customPassword, setCustomPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdInfo, setCreatedInfo] = useState<{ user: AuthUser; tempPassword: string } | null>(null);

  // Auto-generate preview password
  const cleanName = name.replace(/[^a-zA-Z]/g, '');
  const prefix = cleanName.length >= 4 ? cleanName.slice(0, 4) : (cleanName + 'User').slice(0, 4);
  const formattedPrefix = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase() : 'Pass';
  const suggestedPassword = `${formattedPrefix}@${empCode || 'EmpCode'}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalTeam = team === '__CUSTOM__' ? customTeam.trim() : team;
    if (!finalTeam) {
      setError('Please specify an assigned team for this team member.');
      return;
    }

    if (!empCode.trim()) {
      setError('Please provide a unique Employee Code.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<{ user: AuthUser; tempPassword: string }>('/auth/users', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        empCode: empCode.trim(),
        team: finalTeam,
        department: department.trim(),
        role,
        tempPassword: customPassword.trim() || undefined,
      });

      setCreatedInfo(res);
      onSuccess(res.user, res.tempPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Team Member to Organization
            </CardTitle>
            <CardDescription>
              Register a new Employee or Team Lead into the central directory.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-5">
          {createdInfo ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Account Created Successfully!
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  <strong>{createdInfo.user.name}</strong> ({createdInfo.user.empCode}) has been registered with role{' '}
                  <span className="font-semibold underline">{createdInfo.user.role}</span> in team{' '}
                  <strong>{createdInfo.user.team}</strong>.
                </p>
                <div className="bg-background/80 rounded border p-2.5 text-xs font-mono mt-2">
                  <p className="text-[11px] text-muted-foreground font-sans">Temporary Initial Password:</p>
                  <p className="font-bold text-sm text-primary select-all">{createdInfo.tempPassword}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A welcome email with login instructions has been dispatched to <code>{createdInfo.user.email}</code>.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={onClose}>
                  Done & Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 text-xs sm:col-span-2">
                  <label className="font-semibold text-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pooja Sharma"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  />
                </div>

                <div className="space-y-1 text-xs sm:col-span-2">
                  <label className="font-semibold text-foreground">
                    Corporate Email Address <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. pooja.sharma@transsion.com"
                      className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-semibold text-foreground">
                    Employee Code / ID <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    placeholder="e.g. 19106001"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-semibold text-foreground">
                    Organization Role <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value="Employee">Employee (Custody & Requests)</option>
                    <option value="TL">Team Lead / TL (Team Management)</option>
                    <option value="Admin">Administrator (Full Control)</option>
                  </select>
                </div>

                <div className="space-y-1 text-xs sm:col-span-2">
                  <label className="font-semibold text-foreground">
                    Assigned Team <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {DEFAULT_TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="__CUSTOM__">Other / Create New Team...</option>
                  </select>
                </div>

                {team === '__CUSTOM__' && (
                  <div className="space-y-1 text-xs sm:col-span-2">
                    <label className="font-semibold text-foreground">
                      New Team Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customTeam}
                      onChange={(e) => setCustomTeam(e.target.value)}
                      placeholder="e.g. Automation QA"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1 text-xs sm:col-span-2">
                  <label className="font-semibold text-foreground">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="India Overseas Station - R&D Testing"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  />
                </div>

                <div className="space-y-1 text-xs sm:col-span-2">
                  <label className="font-semibold text-foreground">
                    Temporary Initial Password (Optional)
                  </label>
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder={`Suggested: ${suggestedPassword}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Leave blank to auto-generate: <code>{suggestedPassword}</code>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
                  {loading ? <Spinner size="sm" /> : <UserPlus className="h-4 w-4" />}
                  Register & Send Welcome Email
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
