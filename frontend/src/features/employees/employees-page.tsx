import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Smartphone, Search, Mail, Shield, UserCheck, UserPlus, Trash2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client.js';
import { useAuth } from '@/context/auth-context.js';
import { useAssignments } from '@/hooks/use-assignments.js';
import { useInventory } from '@/hooks/use-inventory.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Spinner } from '@/components/ui/spinner.js';
import { ErrorState } from '@/components/ui/error-state.js';
import { EmptyState } from '@/components/ui/empty-state.js';
import { AddEmployeeModal } from './add-employee-modal.js';
import type { AuthUser, Assignment, InventoryItem } from '@/types/api.js';

export interface AssignedEquipment {
  id: string;
  itemName: string;
  itemId: string;
  assignedAt?: string;
}

export function EmployeesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<string>('');

  // Fetch team members
  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
  } = useQuery<AuthUser[]>({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<AuthUser[]>('/auth/team-members'),
  });

  // Fetch active assignments (pageSize: 100 within API limit)
  const { data: assignmentsData, isLoading: assignmentsLoading } = useAssignments({
    page: 1,
    pageSize: 100,
    search: '',
    status: 'Active',
  });

  // Fetch active inventory items (as complementary source for holder tracking)
  const { data: inventoryData, isLoading: inventoryLoading } = useInventory({
    page: 1,
    pageSize: 100,
    search: '',
    brand: '',
    status: 'Active',
  });

  const isLoading = membersLoading || assignmentsLoading || inventoryLoading;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (membersError) {
    return (
      <ErrorState
        title="Could not load team directory"
        message={membersError instanceof Error ? membersError.message : 'Unknown error'}
      />
    );
  }

  const allMembers = members ?? [];

  // Get unique teams for Admin filter
  const teams = Array.from(new Set(allMembers.map((m) => m.team).filter(Boolean)));

  // Filter members
  const filteredMembers = allMembers.filter((m) => {
    const matchesSearch =
      search.length === 0 ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.empCode.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());

    const matchesTeam = selectedTeam === 'All' || m.team === selectedTeam;

    return matchesSearch && matchesTeam;
  });

  const assignmentRecords: Assignment[] = assignmentsData?.records ?? [];
  const inventoryRecords: InventoryItem[] = inventoryData?.records ?? [];

  const getDevicesForMember = (m: AuthUser): AssignedEquipment[] => {
    const mCode = (m.empCode || '').toLowerCase().trim();
    const mId = (m.id || '').toLowerCase().trim();
    const mEmail = (m.email || '').toLowerCase().trim();
    const mName = (m.name || '').toLowerCase().trim();
    const mNameClean = mName.replace(/[^a-z0-9]/g, '');

    const devices: AssignedEquipment[] = [];
    const seenItemIds = new Set<string>();

    // 1. Match from active Assignments
    for (const a of assignmentRecords) {
      if (a.status !== 'Active') continue;

      const aId = (a.employeeId || '').toLowerCase().trim();
      const aName = (a.employeeName || '').toLowerCase().trim();
      const aNameClean = aName.replace(/[^a-z0-9]/g, '');

      const isMatch =
        (mCode && (aId === mCode || aName === mCode)) ||
        (mId && (aId === mId || aName === mId)) ||
        (mEmail && (aId === mEmail || aName === mEmail)) ||
        (mName && (aName === mName || aId === mName)) ||
        (mNameClean && (aNameClean === mNameClean || aId.replace(/[^a-z0-9]/g, '') === mNameClean)) ||
        (mName.length >= 4 && (aName.includes(mName) || mName.includes(aName)));

      if (isMatch) {
        const itemKey = (a.itemId || a.id).toLowerCase().trim();
        if (!seenItemIds.has(itemKey)) {
          seenItemIds.add(itemKey);
          devices.push({
            id: a.id,
            itemName: a.itemName,
            itemId: a.itemId,
            assignedAt: a.assignedAt,
          });
        }
      }
    }

    // 2. Match from active Inventory devices (holder field tracking)
    for (const inv of inventoryRecords) {
      if (inv.status !== 'Active') continue;

      const holder = (inv.inventoryHolder || '').toLowerCase().trim();
      const holderClean = holder.replace(/[^a-z0-9]/g, '');

      const isMatch =
        (mCode && holder === mCode) ||
        (mId && holder === mId) ||
        (mEmail && holder === mEmail) ||
        (mName && holder === mName) ||
        (mNameClean && holderClean === mNameClean) ||
        (mName.length >= 4 && (holder.includes(mName) || mName.includes(holder)));

      if (isMatch) {
        const itemKey = (inv.imei1 || inv.itemId).toLowerCase().trim();
        if (!seenItemIds.has(itemKey)) {
          seenItemIds.add(itemKey);
          devices.push({
            id: inv.itemId,
            itemName: `${inv.brand} ${inv.deviceModel}`.trim(),
            itemId: inv.imei1 || inv.itemId,
            assignedAt: inv.assignedDate,
          });
        }
      }
    }

    return devices;
  };

  const totalAssignedDevices = filteredMembers.reduce(
    (sum, m) => sum + getDevicesForMember(m).length,
    0,
  );

  const handleRemoveMember = async (member: AuthUser, activeDeviceCount: number) => {
    if (activeDeviceCount > 0) {
      alert(
        `Cannot remove ${member.name} because they currently have ${activeDeviceCount} device(s) assigned in their possession. Return all devices first.`,
      );
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to remove ${member.name} (${member.empCode}) from the organization? This will permanently delete their account and access credentials.`,
    );
    if (!confirm) return;

    try {
      const res = await apiClient.delete<{ message: string }>(`/auth/users/${member.id}`);
      setNotification(res.message);
      void queryClient.invalidateQueries({ queryKey: ['team-members'] });
      void queryClient.invalidateQueries({ queryKey: ['all-users-settings'] });
      setTimeout(() => setNotification(''), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove employee.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {user?.role === 'TL' ? `${user.team} — Team Directory` : 'Employee Directory & Devices'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {user?.role === 'TL'
              ? `Manage your team members and view devices assigned to each employee.`
              : `Company employee roster and active equipment allocations.`}
          </p>
        </div>
        {user?.role === 'Admin' && (
          <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5 shadow-xs">
            <UserPlus className="h-4 w-4" />
            Add Employee / TL
          </Button>
        )}
      </div>

      {notification && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {user?.role === 'TL' ? 'Team Members' : 'Total Employees'}
              </p>
              <p className="text-2xl font-bold mt-1">{filteredMembers.length}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Devices In Use by Team
              </p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{totalAssignedDevices}</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600">
              <Smartphone className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Your Role
              </p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{user?.role}</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600">
              {user?.role === 'Admin' ? (
                <Shield className="h-5 w-5" />
              ) : (
                <UserCheck className="h-5 w-5" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, employee code, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {user?.role === 'Admin' && teams.length > 0 && (
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="All">All Teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {/* Employee List with Assigned Devices */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="Try clearing your search or filter criteria."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMembers.map((m) => {
            const devices = getDevicesForMember(m);

            return (
              <Card key={m.id} className="overflow-hidden border shadow-sm">
                <CardHeader className="bg-muted/30 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                        {m.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {m.name}
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {m.empCode}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5">
                          <span>{m.team}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {m.email}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          m.role === 'Admin'
                            ? 'destructive'
                            : m.role === 'TL'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {m.role}
                      </Badge>

                      {user?.role === 'Admin' && m.id !== user.id && m.empCode !== user.empCode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={devices.length > 0}
                          onClick={() => handleRemoveMember(m, devices.length)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title={
                            devices.length > 0
                              ? `Cannot remove while ${devices.length} active device(s) are in custody`
                              : `Remove ${m.name} from organization`
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5" />
                        Assigned Equipment ({devices.length})
                      </span>
                    </div>

                    {devices.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-1">
                        No devices currently assigned.
                      </p>
                    ) : (
                      <div className="divide-y rounded-md border text-xs">
                        {devices.map((device) => (
                          <div
                            key={device.id}
                            className="p-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors"
                          >
                            <div>
                              <p className="font-semibold text-foreground">{device.itemName}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">
                                ID / IMEI: {device.itemId}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="success" className="text-[10px]">
                                Active
                              </Badge>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Since {device.assignedAt || 'N/A'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newEmp) => {
            setNotification(`Successfully added ${newEmp.name} (${newEmp.role}) to team ${newEmp.team}!`);
            void queryClient.invalidateQueries({ queryKey: ['team-members'] });
            void queryClient.invalidateQueries({ queryKey: ['all-users-settings'] });
            setTimeout(() => setNotification(''), 4000);
          }}
        />
      )}
    </div>
  );
}
