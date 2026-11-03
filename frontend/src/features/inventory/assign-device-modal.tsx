import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ArrowLeftRight, Loader2, CheckCircle2, User, Building2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client.js';
import { useAssignmentMutations } from '@/hooks/use-assignments.js';
import { useAuth } from '@/context/auth-context.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import type { InventoryItem, AuthUser } from '@/types/api.js';

interface AssignDeviceModalProps {
  item: InventoryItem;
  onClose: () => void;
}

export function AssignDeviceModal({ item, onClose }: AssignDeviceModalProps) {
  const { user } = useAuth();
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>('');
  const [customEmployeeName, setCustomEmployeeName] = useState<string>('');
  const [customEmployeeId, setCustomEmployeeId] = useState<string>('');
  const [assignedFrom, setAssignedFrom] = useState<string>(
    item.inventoryHolder || item.warehouseLocation || 'IT Stock',
  );
  const [requestedBy, setRequestedBy] = useState<string>('');
  const [assignedAt, setAssignedAt] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  // Fetch employees to assign to
  const { data: teamMembers, isLoading: membersLoading } = useQuery<AuthUser[]>({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<AuthUser[]>('/auth/team-members'),
  });

  const { create } = useAssignmentMutations();

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let empName = '';
    let empId = '';

    if (selectedEmpCode === '__CUSTOM__') {
      if (!customEmployeeName.trim() || !customEmployeeId.trim()) {
        setError('Please provide employee name and employee code / email.');
        return;
      }
      empName = customEmployeeName.trim();
      empId = customEmployeeId.trim();
    } else {
      const found = (teamMembers ?? []).find((m) => m.empCode === selectedEmpCode);
      if (!found) {
        setError('Please select an employee to assign this device to.');
        return;
      }
      empName = found.name;
      empId = found.empCode;
    }

    create.mutate(
      {
        itemId: item.imei1 || item.itemId,
        itemName: `${item.brand} ${item.deviceModel}`,
        employeeName: empName,
        employeeId: empId,
        assignedAt,
        assignedFrom: assignedFrom.trim() || 'IT Stock',
        assignedBy: user ? `${user.name} (${user.empCode})` : 'System Admin',
        assignedByRole: user?.role || 'Admin',
        requestedBy: requestedBy.trim() || undefined,
        notes: notes.trim() || `Allocated from inventory (${item.warehouseLocation || 'IT Stock'})`,
        status: 'Active',
      },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => {
            onClose();
          }, 1200);
        },
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : 'Failed to assign device. Please try again.',
          );
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20 border-b">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Assign Device to Employee
            </CardTitle>
            <CardDescription>
              Assign hardware to a team member. The device will be removed from available stock and
              logged in the Assignments registry.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Selected Device Preview Banner */}
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-3.5 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Selected Hardware
                </span>
                <h4 className="text-base font-bold text-foreground">
                  {item.brand} {item.deviceModel}
                </h4>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {item.sampleHwType || 'Sample'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
              <div>
                <span className="font-medium text-foreground">IMEI1: </span>
                <span className="font-mono">{item.imei1}</span>
              </div>
              {item.vcId && (
                <div>
                  <span className="font-medium text-foreground">VC ID: </span>
                  <span className="font-mono">{item.vcId}</span>
                </div>
              )}
              {item.storageRam && (
                <div>
                  <span className="font-medium text-foreground">Storage/RAM: </span>
                  <span>{item.storageRam}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-foreground">Location: </span>
                <span>{item.warehouseLocation}</span>
              </div>
            </div>
          </div>

          {success ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                Device successfully assigned!
              </p>
              <p className="text-xs text-muted-foreground">
                The device has been removed from available stock and recorded in the Assignments table.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAssign} className="space-y-4">
              {/* Select Employee Dropdown */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Assign To Employee <span className="text-destructive">*</span>
                </label>

                {membersLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading employee directory…
                  </div>
                ) : (
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={selectedEmpCode}
                    required
                    onChange={(e) => setSelectedEmpCode(e.target.value)}
                  >
                    <option value="">-- Choose Employee / Team Member --</option>
                    {(teamMembers ?? []).map((m) => (
                      <option key={m.id} value={m.empCode}>
                        {m.name} ({m.empCode}) — {m.team} [{m.role}]
                      </option>
                    ))}
                    <option value="__CUSTOM__">Other (Enter custom employee details)</option>
                  </select>
                )}
              </div>

              {/* Custom Employee Inputs if selected */}
              {selectedEmpCode === '__CUSTOM__' && (
                <div className="grid gap-3 sm:grid-cols-2 rounded-md border p-3 bg-muted/20">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Employee Full Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={customEmployeeName}
                      onChange={(e) => setCustomEmployeeName(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Employee Code / Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 19101234 or email"
                      value={customEmployeeId}
                      onChange={(e) => setCustomEmployeeId(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              )}

              {/* Custody Source & Requisition Reference */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Sourced From (Inventory Stock)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IT Stock / WH-1 (Main Hub)"
                    value={assignedFrom}
                    onChange={(e) => setAssignedFrom(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="text-[11px] text-muted-foreground">Original warehouse / custodian holding unit.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Requested By (Optional Reference)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rohan Raj Singh (Req #402)"
                    value={requestedBy}
                    onChange={(e) => setRequestedBy(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="text-[11px] text-muted-foreground">Name or ticket if requested in advance.</p>
                </div>
              </div>

              {/* Assigned Date & Assigner Stamp */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Assignment Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={assignedAt}
                    onChange={(e) => setAssignedAt(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    Assigned By (Dispatcher)
                  </label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 text-xs font-semibold text-foreground">
                    {user?.name || 'System Admin'} ({user?.empCode || 'Admin'}, {user?.role || 'Admin'})
                  </div>
                </div>
              </div>

              {/* Notes / Purpose */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Allocation Remarks / Project Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assigned for camera benchmarking trial (Sprint 4)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending || !selectedEmpCode}>
                  {create.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning…
                    </>
                  ) : (
                    'Confirm & Assign Device'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
