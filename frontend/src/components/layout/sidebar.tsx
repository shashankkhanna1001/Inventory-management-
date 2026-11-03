import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ArrowLeftRight,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { useState } from 'react';
import { useAuth } from '@/context/auth-context.js';
import { useAssignments } from '@/hooks/use-assignments.js';
import type { UserRole } from '@/types/api.js';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const allNavItems: NavItem[] = [
  {
    label: 'Overview',
    href: '/',
    icon: LayoutDashboard,
    roles: ['Admin', 'TL', 'Employee'],
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['Admin', 'TL'],
  },
  {
    label: 'Team & Employees',
    href: '/employees',
    icon: Users,
    roles: ['Admin', 'TL'],
  },
  {
    label: 'Assignments',
    href: '/assignments',
    icon: ArrowLeftRight,
    roles: ['Admin', 'TL'],
  },
  {
    label: 'My Devices',
    href: '/assignments',
    icon: Smartphone,
    roles: ['Employee'],
  },
  {
    label: 'Equipment Requests',
    href: '/requests',
    icon: ClipboardList,
    roles: ['Admin', 'TL', 'Employee'],
  },
  {
    label: 'Audit & Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['Admin'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['Admin', 'TL', 'Employee'],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const role: UserRole = user?.role ?? 'Employee';

  // Live count of active assignments for badge
  const { data: assignmentsData } = useAssignments({
    page: 1,
    pageSize: 1,
    search: '',
    status: 'Active',
  });
  const myDevicesCount = assignmentsData?.activeCount ?? 0;

  const visibleNavItems = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center' : 'gap-3',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Package className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">Inventory</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Transsion R&D</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-0.5 px-2" role="list">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.href);

            return (
              <li key={`${item.href}-${item.label}`}>
                <NavLink
                  to={item.href}
                  title={
                    collapsed
                      ? item.label === 'My Devices'
                        ? `My Devices (${myDevicesCount} assigned)`
                        : item.label
                      : undefined
                  }
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon
                    className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')}
                    aria-hidden="true"
                  />
                  {!collapsed && (
                    <div className="flex flex-1 items-center justify-between min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.label === 'My Devices' && (
                        <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/20 px-1.5 text-[11px] font-bold text-primary">
                          {myDevicesCount}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info footer in sidebar when not collapsed */}
      {!collapsed && user && (
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-muted/40 p-2 text-xs">
            <p className="font-medium text-foreground truncate">{user.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.team}</p>
            <span className="mt-1 inline-block text-[10px] font-semibold uppercase text-primary">
              {user.role}
            </span>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            collapsed && 'justify-center px-2',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
