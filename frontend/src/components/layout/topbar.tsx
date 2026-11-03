import { Shield, UserCheck, User, LogOut, KeyRound, Smartphone } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context.js';
import { useAssignments } from '@/hooks/use-assignments.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';

const pageTitles: Record<string, string> = {
  '/': 'Overview & Dashboard',
  '/inventory': 'Inventory Catalog',
  '/requests': 'Equipment Requests',
  '/assignments': 'Device Assignments',
  '/employees': 'Team & Employees',
  '/reports': 'Audit & Compliance Reports',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname in pageTitles) {
    return pageTitles[pathname] ?? 'Inventory';
  }
  const match = Object.keys(pageTitles).find(
    (key) => key !== '/' && pathname.startsWith(key),
  );
  return (match !== undefined ? pageTitles[match] : null) ?? 'Inventory';
}

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = getPageTitle(location.pathname);
  const { user, logout } = useAuth();

  const role = user?.role ?? 'Employee';

  // Live count of active assignments for the current user
  const { data: assignmentsData } = useAssignments({
    page: 1,
    pageSize: 1,
    search: '',
    status: 'Active',
  });
  const assignedCount = assignmentsData?.activeCount ?? 0;

  const getRoleBadge = () => {
    switch (role) {
      case 'Admin':
        return (
          <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      case 'TL':
        return (
          <Badge variant="default" className="gap-1 bg-blue-600 hover:bg-blue-700">
            <UserCheck className="h-3 w-3" />
            Team Lead ({user?.team})
          </Badge>
        );
      case 'Employee':
        return (
          <Badge variant="secondary" className="gap-1">
            <User className="h-3 w-3" />
            Employee ({user?.team})
          </Badge>
        );
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* User profile & actions */}
      <div className="flex items-center gap-3">
        {/* Role Badge */}
        {getRoleBadge()}

        {/* Assigned Devices Indicator Pill */}
        {role === 'Employee' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/assignments')}
            title="View devices registered in your name"
            className="gap-1.5 text-xs font-semibold border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary h-8 shadow-xs"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{assignedCount} {assignedCount === 1 ? 'Device Assigned' : 'Devices Assigned'}</span>
          </Button>
        ) : role === 'TL' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/assignments')}
            title="View devices assigned to your team"
            className="gap-1.5 text-xs font-semibold border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400 h-8 shadow-xs"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{assignedCount} Team Devices</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/assignments')}
            title="View all device assignments"
            className="hidden md:inline-flex gap-1.5 text-xs font-semibold border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 h-8 shadow-xs"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{assignedCount} Assigned</span>
          </Button>
        )}

        {/* User profile details */}
        {user && (
          <div className="hidden sm:flex items-center gap-2 border-l pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="text-left text-xs leading-tight">
              <p className="font-semibold text-foreground">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {user.empCode} • {user.team}
              </p>
            </div>
          </div>
        )}

        {/* Change password button */}
        <Button
          variant="ghost"
          size="icon"
          title="Change Password"
          onClick={() => navigate('/change-password')}
          className="text-muted-foreground hover:text-foreground"
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        {/* Sign out button */}
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
