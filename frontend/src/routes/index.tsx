import { createBrowserRouter } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/auth-guard.js';
import { AppLayout } from '@/components/layout/app-layout.js';
import { LoginPage } from '@/pages/login-page.js';
import { ForgotPasswordPage } from '@/pages/forgot-password-page.js';
import { ResetPasswordPage } from '@/pages/reset-password-page.js';
import { ChangePasswordPage } from '@/pages/change-password-page.js';
import { OverviewPage } from '@/features/overview/overview-page.js';
import { PlaceholderPage } from '@/components/placeholder-page.js';
import { InventoryPage } from '@/features/inventory/inventory-page.js';
import { AssignmentsPage } from '@/features/assignments/assignments-page.js';
import { RequestsPage } from '@/features/requests/requests-page.js';
import { AuditPage } from '@/features/audit/audit-page.js';
import { EmployeesPage } from '@/features/employees/employees-page.js';
import { SettingsPage } from '@/features/settings/settings-page.js';

export const router = createBrowserRouter([
  // Public auth routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/change-password',
    element: <ChangePasswordPage />,
  },

  // Protected app layout routes
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <OverviewPage />,
      },
      {
        path: 'inventory',
        element: <InventoryPage />,
      },
      {
        path: 'requests',
        element: <RequestsPage />,
      },
      {
        path: 'assignments',
        element: <AssignmentsPage />,
      },
      {
        path: 'employees',
        element: <EmployeesPage />,
      },
      {
        path: 'reports',
        element: <AuditPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: (
          <PlaceholderPage
            title="Page Not Found"
            description="The page you are looking for does not exist."
          />
        ),
      },
    ],
  },
]);
