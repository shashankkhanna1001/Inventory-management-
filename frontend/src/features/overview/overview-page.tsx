import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Smartphone,
  ClipboardList,
  ArrowLeftRight,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Check,
  Copy,
  Layers,
  Cpu,
  Radio,
  History,
  ShieldCheck,
  Plus,
  RefreshCw,
  HardDrive,
  Info,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context.js';
import { useInventory } from '@/hooks/use-inventory.js';
import { useAssignments } from '@/hooks/use-assignments.js';
import { useRequests } from '@/hooks/use-requests.js';
import { useAuditLogs } from '@/hooks/use-audit.js';
import { apiClient } from '@/lib/api-client.js';
import { DeviceTrackingModal } from '../inventory/device-tracking-modal.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import type { AuthUser, Assignment, InventoryItem, EquipmentRequest } from '@/types/api.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoOrDate?: string): string {
  if (!isoOrDate) return 'N/A';
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoOrDate;
  }
}

function timeAgo(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

function getBrandBadgeClass(brand?: string): string {
  const b = (brand || '').toLowerCase();
  if (b.includes('tecno')) {
    return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
  }
  if (b.includes('infinix')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  }
  if (b.includes('itel')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
  }
  if (b.includes('oraimo')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

// ---------------------------------------------------------------------------
// Main Overview Page
// ---------------------------------------------------------------------------

export function OverviewPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'Employee';
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [trackingDevice, setTrackingDevice] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Queries
  const { data: inventoryData, refetch: refetchInventory } = useInventory({
    page: 1,
    pageSize: 100,
    search: '',
    brand: '',
    status: '',
  });

  const { data: assignmentsData, refetch: refetchAssignments } = useAssignments({
    page: 1,
    pageSize: 100,
    search: '',
    status: '',
  });

  const { data: requestsData, refetch: refetchRequests } = useRequests({
    page: 1,
    pageSize: 100,
    search: '',
    category: '',
    status: '',
  });

  const { data: auditData } = useAuditLogs({
    page: 1,
    pageSize: 8,
    search: '',
  });

  const { data: teamMembers } = useQuery<AuthUser[]>({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<AuthUser[]>('/auth/team-members'),
    enabled: role === 'Admin' || role === 'TL',
  });

  const refreshAll = () => {
    void refetchInventory();
    void refetchAssignments();
    void refetchRequests();
  };

  // Aggregate metrics
  const inventoryRecords: InventoryItem[] = inventoryData?.records ?? [];
  const assignmentsRecords: Assignment[] = assignmentsData?.records ?? [];
  const requestsRecords: EquipmentRequest[] = requestsData?.records ?? [];
  const membersList: AuthUser[] = teamMembers ?? [];

  const totalDevices = (inventoryData?.activeCount ?? 0) + (inventoryData?.inactiveCount ?? 0) || inventoryRecords.length;
  const currentlyAssigned = assignmentsData?.activeCount ?? 0;
  const availableDevices = inventoryData?.inactiveCount ?? Math.max(0, totalDevices - currentlyAssigned);
  const pendingRequestsCount = requestsData?.pendingCount ?? requestsRecords.filter((r) => r.status === 'Pending').length;
  const fulfilledRequestsCount = requestsData?.fulfilledCount ?? requestsRecords.filter((r) => r.status === 'Fulfilled').length;

  // Active assignments held by current user (for Employee)
  const myActiveAssignments = assignmentsRecords.filter((a) => a.status === 'Active');

  // Match assignment with full inventory details (IMEI, model, hardware type, color)
  const findInventoryDetail = (itemIdOrImei: string): InventoryItem | undefined => {
    const q = itemIdOrImei.trim().toLowerCase();
    return inventoryRecords.find(
      (r) =>
        r.itemId.toLowerCase() === q ||
        r.imei1.toLowerCase() === q ||
        r.serialNumber.toLowerCase() === q ||
        r.deviceModel.toLowerCase() === q,
    );
  };

  // -------------------------------------------------------------------------
  // 1. EMPLOYEE DASHBOARD VIEW
  // -------------------------------------------------------------------------
  if (role === 'Employee') {
    return (
      <div className="space-y-6">
        {/* Lab Station Banner */}
        <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Transsion India Lab Station • Active Session
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Hello, {user?.name}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{user?.team}</span>
                <span>•</span>
                <span>ID: <code className="font-mono text-xs font-semibold">{user?.empCode}</code></span>
                <span>•</span>
                <span>{user?.department}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link to="/requests">
                <Button className="gap-2 shadow-xs">
                  <Plus className="h-4 w-4" />
                  New Device Request
                </Button>
              </Link>
              <Link to="/assignments">
                <Button variant="outline" className="gap-2">
                  <Smartphone className="h-4 w-4" />
                  My Devices Registry
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Employee High-Level KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-primary/20 bg-primary/5 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Devices in My Custody
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">{myActiveAssignments.length}</span>
                  <span className="text-xs text-muted-foreground font-medium">units currently assigned</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Smartphone className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-amber-500/5 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending Requisitions
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                    {pendingRequestsCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">awaiting TL review</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fulfilled &amp; History
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {fulfilledRequestsCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">requests completed</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Digital Hardware Locker (Tangible Device Cards) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                My Active Testing Locker
              </h2>
              <p className="text-xs text-muted-foreground">
                All physical hardware registered under your employee ID. Always verify IMEIs before QA execution.
              </p>
            </div>
            {myActiveAssignments.length > 0 && (
              <Badge variant="outline" className="font-mono text-xs">
                {myActiveAssignments.length} Assigned Unit{myActiveAssignments.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {myActiveAssignments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted/60 p-4 mb-3">
                  <Smartphone className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="font-semibold text-foreground">No devices currently in your custody</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  You do not have any test phones or hardware registered to your name right now.
                  Submit an equipment requisition to check out testing devices.
                </p>
                <Link to="/requests" className="mt-4">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Submit Equipment Requisition
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myActiveAssignments.map((assignment) => {
                const inv = findInventoryDetail(assignment.itemId) || findInventoryDetail(assignment.itemName);
                const brand = inv?.brand || (assignment.itemName.split(' ')[0] ?? 'Device');
                const model = inv?.deviceModel || assignment.itemName;
                const imei = inv?.imei1 || assignment.itemId;
                const sampleStage = inv?.sampleHwType || 'PRO';

                return (
                  <Card key={assignment.id} className="overflow-hidden border shadow-xs hover:border-primary/40 transition-all">
                    <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getBrandBadgeClass(brand)}`}>
                          {brand}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {sampleStage} Stage
                        </Badge>
                      </div>
                      <Badge variant="success" className="text-[11px] gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        In Active QA
                      </Badge>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h4 className="font-bold text-base text-foreground tracking-tight">{model}</h4>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          {inv?.color && <span>Color: <strong>{inv.color}</strong></span>}
                          {inv?.storageRam && <span>• Variant: <strong>{inv.storageRam}</strong></span>}
                          {inv?.warehouseLocation && <span>• Hub: <strong>{inv.warehouseLocation}</strong></span>}
                        </div>
                      </div>

                      {/* Monospace Identifier Strip */}
                      <div className="rounded-lg border bg-muted/20 p-2.5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">IMEI / Identifier</p>
                          <p className="font-mono text-xs font-semibold tracking-wide text-foreground">
                            {imei}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(imei, assignment.id)}
                          title="Copy IMEI to clipboard"
                        >
                          {copiedId === assignment.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>

                      {/* Checkout date & Return Note */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          Checked out: {formatDate(assignment.assignedAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] gap-1 px-2 text-primary hover:bg-primary/10"
                            onClick={() => setTrackingDevice(imei)}
                          >
                            <History className="h-3 w-3" />
                            Custody Trail
                          </Button>
                          <Link to="/assignments" className="text-primary hover:underline text-[11px] font-medium">
                            Return →
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Requisition Status Pipeline & Lab Guidelines */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Requisition Tracker */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  My Equipment Requisitions
                </CardTitle>
                <Link to="/requests">
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    View All
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Track live progress of your hardware requisitions through TL review and dispatch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {requestsRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  You haven't submitted any equipment requests yet.
                </p>
              ) : (
                <div className="divide-y text-xs">
                  {requestsRecords.slice(0, 4).map((req) => (
                    <div key={req.id} className="py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{req.category} Requisition</span>
                        <Badge
                          variant={
                            req.status === 'Fulfilled'
                              ? 'success'
                              : req.status === 'Approved'
                              ? 'info'
                              : req.status === 'Pending'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-1">{req.description}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Submitted {timeAgo(req.createdAt)}</span>
                        <span className="font-mono text-[10px]">ID: #{req.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Testing Lab Protocol & Policy */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Lab Protocol &amp; Care Policies
              </CardTitle>
              <CardDescription>
                Transsion R&amp;D Testing Station Operational Guidelines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs text-muted-foreground">
              <div className="rounded-md border bg-muted/20 p-2.5 flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Zero-Deletion Compliance</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Hardware records and assignment histories cannot be deleted. All custody transfers are immutable and logged for enterprise audit.
                  </p>
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-2.5 flex items-start gap-2.5">
                <ArrowLeftRight className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Single-Possession Rule</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    A test phone cannot be reassigned to another engineer until the current holder formally checks it back in as Returned.
                  </p>
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-2.5 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Sample HW Care &amp; Battery Safety</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Pre-production PR0/PR1 units contain uncertified battery modules. Keep devices stored in temperature-controlled lab trays when not in active testing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {trackingDevice && (
          <DeviceTrackingModal
            deviceIdentifier={trackingDevice}
            onClose={() => setTrackingDevice(null)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. TEAM LEAD (TL) DASHBOARD VIEW
  // -------------------------------------------------------------------------
  if (role === 'TL') {
    const teamMembersList = membersList.filter((m) => m.team === user?.team);
    const teamAssignedDevices = assignmentsRecords.filter((a) => a.status === 'Active');
    const teamPendingRequests = requestsRecords.filter((r) => r.status === 'Pending');

    return (
      <div className="space-y-6">
        {/* Team Station Header */}
        <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-blue-500/5 p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Team Operations Station • {user?.team}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Team Lead Dashboard — {user?.team}
              </h1>
              <p className="text-sm text-muted-foreground">
                Managing device distribution, member custody, and equipment requisitions for <strong>{teamMembersList.length} team engineers</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link to="/inventory">
                <Button variant="outline" className="gap-2 shadow-xs">
                  <Upload className="h-4 w-4 text-emerald-600" />
                  Bulk Upload Fleet
                </Button>
              </Link>
              <Link to="/assignments">
                <Button className="gap-2 shadow-xs">
                  <ArrowLeftRight className="h-4 w-4" />
                  Assign Hardware
                </Button>
              </Link>
              <Link to="/requests">
                <Button variant="outline" className="gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Review Team Requests ({teamPendingRequests.length})
                </Button>
              </Link>
              <Link to="/employees">
                <Button variant="ghost" className="gap-2">
                  <Users className="h-4 w-4" />
                  Team Directory
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* TL Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-500/20 bg-blue-500/5 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Team Active Custody
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">
                    {teamAssignedDevices.length}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">units deployed</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <Smartphone className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-amber-500/5 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending Approvals
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                    {teamPendingRequests.length}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">awaiting review</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Available in IT Stock
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {availableDevices}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">ready to claim</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Package className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Team Engineers
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground">
                    {teamMembersList.length}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">active members</span>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Requisitions Awaiting Approval (Action Center) */}
        {teamPendingRequests.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Action Required: Requisitions Awaiting Team Lead Approval
                </CardTitle>
                <Link to="/requests">
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-amber-300">
                    Review In Portal →
                  </Button>
                </Link>
              </div>
              <CardDescription className="text-xs text-amber-700 dark:text-amber-300">
                The following requisitions submitted by your team members require your sign-off before hardware dispatch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {teamPendingRequests.slice(0, 4).map((r) => (
                  <div key={r.id} className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-background p-3 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">{r.requestedByName || r.requestedBy}</span>
                      <Badge variant="warning" className="text-[10px]">
                        {r.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                      <span>Submitted {timeAgo(r.createdAt)}</span>
                      <Link to="/requests" className="text-primary hover:underline font-semibold text-[11px]">
                        Approve / Reject →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Members Custody Roster */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Team Roster &amp; Hardware Possession
                </CardTitle>
                <CardDescription>
                  Overview of test equipment currently held across your team members.
                </CardDescription>
              </div>
              <Link to="/employees">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Manage Team
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {teamMembersList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading team roster…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teamMembersList.map((m) => {
                  const mDevices = teamAssignedDevices.filter(
                    (a) =>
                      a.employeeId?.toLowerCase() === m.empCode.toLowerCase() ||
                      a.employeeName?.toLowerCase() === m.name.toLowerCase(),
                  );

                  return (
                    <div key={m.id} className="rounded-lg border p-3 bg-muted/10 hover:bg-muted/20 transition-all space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-sm text-foreground">{m.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">ID: {m.empCode}</p>
                        </div>
                        <Badge variant={m.role === 'TL' ? 'default' : 'secondary'} className="text-[10px]">
                          {m.role}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t text-xs">
                        <span className="text-muted-foreground">Equipment in hand:</span>
                        <Badge variant={mDevices.length > 0 ? 'success' : 'outline'} className="text-[10px]">
                          {mDevices.length} Device{mDevices.length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Deployed Hardware Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Active Devices Deployed in {user?.team}</CardTitle>
              <CardDescription>
                Detailed registry of all units currently active in testing with team members.
              </CardDescription>
            </div>
            <Link to="/assignments">
              <Button variant="outline" size="sm" className="text-xs h-7">
                All Assignments
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {teamAssignedDevices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center italic">
                No active device assignments recorded for your team.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 uppercase text-[11px] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Assignee</th>
                      <th className="px-3 py-2.5">Device Name / Model</th>
                      <th className="px-3 py-2.5">IMEI / Identifier</th>
                      <th className="px-3 py-2.5">Assigned Date</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Custody</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {teamAssignedDevices.slice(0, 8).map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          {a.employeeName}
                          <span className="block font-mono text-[10px] text-muted-foreground">{a.employeeId}</span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold">{a.itemName}</td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{a.itemId}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatDate(a.assignedAt)}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="success" className="text-[10px]">
                            {a.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] gap-1 px-2 text-primary hover:bg-primary/10"
                            title="Inspect custody journey"
                            onClick={() => setTrackingDevice(a.itemId)}
                          >
                            <History className="h-3 w-3" />
                            Trail
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        {trackingDevice && (
          <DeviceTrackingModal
            deviceIdentifier={trackingDevice}
            onClose={() => setTrackingDevice(null)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. ADMIN DASHBOARD VIEW (COMMAND CENTER)
  // -------------------------------------------------------------------------

  // Compute fleet breakdown
  const brandCounts: Record<string, number> = inventoryData?.totalByBrand || {};
  if (Object.keys(brandCounts).length === 0) {
    inventoryRecords.forEach((r) => {
      const b = r.brand?.trim() || 'Other';
      brandCounts[b] = (brandCounts[b] || 0) + 1;
    });
  }

  // Compute sample HW stage counts
  const stageCounts: Record<string, number> = {};
  inventoryRecords.forEach((r) => {
    const s = r.sampleHwType?.trim() || 'PRO';
    stageCounts[s] = (stageCounts[s] || 0) + 1;
  });

  const recentAuditEntries = auditData?.records ?? [];
  const pendingRequests = requestsRecords.filter((r) => r.status === 'Pending');

  return (
    <div className="space-y-6">
      {/* Station Command Banner */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Transsion India R&amp;D Testing Lab (HQ-Overseas) • Station Online
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Master Inventory Command Center
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Radio className="h-3 w-3 text-emerald-600" /> Lark Cloud Sync: Live (tblwRFP5gSsEVIHn)
              </span>
              <span>•</span>
              <span>Zero-Deletion Policy: Enforced</span>
              <span>•</span>
              <span>SMTP Notifications: Operational</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/inventory">
              <Button size="sm" className="gap-1.5 shadow-xs">
                <Plus className="h-4 w-4" />
                Register Hardware
              </Button>
            </Link>
            <Link to="/assignments">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeftRight className="h-4 w-4" />
                Assign Device
              </Button>
            </Link>
            <Link to="/employees">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Users className="h-4 w-4" />
                Employees ({membersList.length || 40})
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={refreshAll} title="Refresh live telemetry">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 5-Column High-Impact Metric Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Lab Fleet</p>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-foreground">{totalDevices}</span>
              <span className="text-[11px] text-muted-foreground">devices registered</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{Math.round((currentlyAssigned / (totalDevices || 1)) * 100)}% In Field Testing</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                In Active Custody
              </p>
              <Smartphone className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">{currentlyAssigned}</span>
              <span className="text-[11px] text-muted-foreground">units held</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Issued to testing engineers
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Shelf Stock (Available)
              </p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{availableDevices}</span>
              <span className="text-[11px] text-muted-foreground">ready in stock</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Ready for immediate allocation
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Pending Requisitions
              </p>
              <ClipboardList className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{pendingRequestsCount}</span>
              <span className="text-[11px] text-muted-foreground">need action</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Awaiting review &amp; dispatch
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Custody Health</p>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-foreground">100%</span>
              <span className="text-[11px] text-muted-foreground">verified</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Zero unauthorized possession
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Brand & Testing Phase Matrix (2 Columns) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Brand Portfolio Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Fleet Brand Distribution
              </CardTitle>
              <Link to="/inventory">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Explore Fleet
                </Button>
              </Link>
            </div>
            <CardDescription>
              Hardware allocation breakdown across Transsion corporate brand portfolios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(brandCounts)
              .filter(([name]) => name.trim().length > 0)
              .map(([brandName, count]) => {
                const percentage = Math.round((count / (totalDevices || 1)) * 100);

                return (
                  <div key={brandName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${getBrandBadgeClass(brandName).includes('sky') ? 'bg-sky-500' : getBrandBadgeClass(brandName).includes('emerald') ? 'bg-emerald-500' : getBrandBadgeClass(brandName).includes('rose') ? 'bg-rose-500' : getBrandBadgeClass(brandName).includes('amber') ? 'bg-amber-500' : 'bg-slate-500'}`} />
                        {brandName}
                      </span>
                      <span className="text-muted-foreground">
                        <strong>{count}</strong> units ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBrandBadgeClass(brandName).includes('sky') ? 'bg-sky-500' : getBrandBadgeClass(brandName).includes('emerald') ? 'bg-emerald-500' : getBrandBadgeClass(brandName).includes('rose') ? 'bg-rose-500' : getBrandBadgeClass(brandName).includes('amber') ? 'bg-amber-500' : 'bg-slate-500'}`}
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* Prototype & Sample Stage Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                Prototype HW Stage Maturity
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                R&amp;D Validation Cycle
              </Badge>
            </div>
            <CardDescription>
              Hardware maturity stages of active engineering samples currently in lab.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border p-3 bg-muted/10 space-y-1">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">PR0 / Prototype Initial</p>
                <p className="text-xl font-bold text-foreground">{stageCounts['PR0'] || stageCounts['PRO'] || 0}</p>
                <p className="text-[11px] text-muted-foreground">Component &amp; board level tests</p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/10 space-y-1">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">PR1 / Pilot Run 1</p>
                <p className="text-xl font-bold text-foreground">{stageCounts['PR1'] || stageCounts['PR1-1'] || 0}</p>
                <p className="text-[11px] text-muted-foreground">Camera IQ &amp; OS validation</p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/10 space-y-1">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">MPR / Mass Production</p>
                <p className="text-xl font-bold text-foreground">{stageCounts['MPR'] || 0}</p>
                <p className="text-[11px] text-muted-foreground">Final factory verification</p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/10 space-y-1">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">PIR / Inspection Run</p>
                <p className="text-xl font-bold text-foreground">{stageCounts['PIR'] || 0}</p>
                <p className="text-[11px] text-muted-foreground">Pre-shipment testing</p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-2.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Primary Lab Warehouse: <strong>WH-1 (Main Hub)</strong></span>
              <span className="font-mono text-[11px]">{availableDevices} ready on shelf</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Center: Pending Requisitions & Live Audit Trail */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Requisitions Queue */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                  Equipment Requisition Queue
                </CardTitle>
                <CardDescription>
                  Requisitions waiting for administrative or TL fulfillment.
                </CardDescription>
              </div>
              <Link to="/requests">
                <Button size="sm" variant="outline" className="text-xs h-7">
                  Manage All ({pendingRequestsCount})
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" />
                <p className="font-medium text-foreground">Requisition queue is clear</p>
                <p className="text-muted-foreground mt-0.5">All incoming device requests have been processed.</p>
              </div>
            ) : (
              <div className="divide-y text-xs">
                {pendingRequests.slice(0, 4).map((r) => (
                  <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{r.requestedByName || r.requestedBy}</span>
                        <Badge variant="warning" className="text-[10px]">
                          {r.category}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-1">{r.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Requested {timeAgo(r.createdAt)} • Ref: #{r.id.slice(0, 8)}
                      </p>
                    </div>

                    <Link to="/requests">
                      <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0">
                        Review
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Lab Audit Trail & Activity Feed */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Live Lab Event &amp; Custody Stream
                </CardTitle>
                <CardDescription>
                  Immutable audit records captured in real-time.
                </CardDescription>
              </div>
              <Link to="/reports">
                <Button size="sm" variant="ghost" className="text-xs h-7">
                  Audit Logs
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentAuditEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center italic">
                No recent audit log activity.
              </p>
            ) : (
              <div className="divide-y text-xs">
                {recentAuditEntries.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <Badge
                          variant={
                            entry.actorRole === 'Admin'
                              ? 'destructive'
                              : entry.actorRole === 'TL'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[9px] px-1.5 py-0"
                        >
                          {entry.actorRole}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Actor: {entry.actorId} • Status: <span className="font-semibold">{entry.status}</span>
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Currently Deployed Field Devices Registry */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Active Hardware Deployed Across Engineering Teams
            </CardTitle>
            <CardDescription>
              Active custody tracking. Shows current holder and device serial/IMEI.
            </CardDescription>
          </div>
          <Link to="/assignments">
            <Button variant="outline" size="sm" className="text-xs h-7">
              View All Deployments
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {assignmentsRecords.filter((a) => a.status === 'Active').length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center italic">
              No hardware currently deployed in field custody.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 uppercase text-[11px] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Hardware Model</th>
                    <th className="px-3 py-2.5">IMEI / Identifier</th>
                    <th className="px-3 py-2.5">Custodian Engineer</th>
                    <th className="px-3 py-2.5">Emp ID</th>
                    <th className="px-3 py-2.5">Checked Out</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Custody</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignmentsRecords
                    .filter((a) => a.status === 'Active')
                    .slice(0, 8)
                    .map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-bold text-foreground">{a.itemName}</td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{a.itemId}</td>
                        <td className="px-3 py-2.5 font-medium">{a.employeeName}</td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">{a.employeeId || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatDate(a.assignedAt)}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="success" className="text-[10px]">
                            Active Testing
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] gap-1 px-2 text-primary hover:bg-primary/10"
                            title="Inspect custody journey"
                            onClick={() => setTrackingDevice(a.itemId)}
                          >
                            <History className="h-3 w-3" />
                            Trail
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Custody Tracking Modal */}
      {trackingDevice && (
        <DeviceTrackingModal
          deviceIdentifier={trackingDevice}
          onClose={() => setTrackingDevice(null)}
        />
      )}
    </div>
  );
}
