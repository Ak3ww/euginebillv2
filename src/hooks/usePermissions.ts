'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook to check user permissions on client side
 * Usage:
 * 
 * const { hasPermission, permissions, loading } = usePermissions();
 * 
 * if (hasPermission('users.delete')) {
 *   return <button>Delete</button>
 * }
 */
export function usePermissions() {
  const { data: session, status } = useSession();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = (session?.user as any)?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (session?.user) {
      if (isSuperAdmin) {
        setPermissions(['*']);
        setLoading(false);
        return;
      }

      const userId = (session.user as any).id;
      if (userId) {
        setLoading(true);
        fetch(`/api/admin/users/${userId}/permissions`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setPermissions(data.permissions || []);
            }
          })
          .catch((error) => {
            console.error('Error loading permissions:', error);
            setPermissions([]);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [session, status, isSuperAdmin]);

  const hasPermission = (permissionKey: string): boolean => {
    if (isSuperAdmin) return true;
    return permissions.includes(permissionKey);
  };

  const hasAnyPermission = (permissionKeys: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissionKeys.some((key) => permissions.includes(key));
  };

  const hasAllPermissions = (permissionKeys: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissionKeys.every((key) => permissions.includes(key));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    loading: loading || status === 'loading',
  };
}
