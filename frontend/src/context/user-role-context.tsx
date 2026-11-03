import React, { createContext, useContext } from 'react';
import type { UserProfile, UserRole } from '@/types/api.js';
import { useAuth } from './auth-context.js';

interface UserRoleContextType {
  role: UserRole;
  user: UserProfile;
  setRole: (role: UserRole) => void;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();

  const role: UserRole = authUser?.role ?? 'Employee';

  const userProfile: UserProfile = {
    id: authUser?.id ?? 'guest',
    name: authUser?.name ?? 'Guest User',
    email: authUser?.email ?? '',
    role,
    employeeId: authUser?.empCode ?? '',
    department: authUser?.department ?? '',
  };

  const setRole = (_newRole: UserRole) => {
    // In production authenticated mode, user role is securely bound to the authenticated account token
  };

  return (
    <UserRoleContext.Provider value={{ role, user: userProfile, setRole }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole(): UserRoleContextType {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}
