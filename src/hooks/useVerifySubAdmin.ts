import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useVerifySubAdmin = () => {
  const { session, user } = useAuth();
  const [isVerifiedSubAdmin, setIsVerifiedSubAdmin] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  useEffect(() => {
    const verifySubAdmin = async () => {
      if (!session?.access_token || !user?.id) {
        setIsVerifiedSubAdmin(false);
        return;
      }

      setIsVerifying(true);
      try {
        // Check if user has sub_admin role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'sub_admin')
          .maybeSingle();

        if (roleError) {
          console.error('Error checking sub_admin role:', roleError);
          setIsVerifiedSubAdmin(false);
          setIsVerifying(false);
          return;
        }

        if (!roleData) {
          setIsVerifiedSubAdmin(false);
          setIsVerifying(false);
          return;
        }

        // Check if user is assigned to a department
        const { data: deptAdmin, error: deptError } = await supabase
          .from('department_admins')
          .select('department_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (deptError) {
          console.error('Error checking department assignment:', deptError);
          setIsVerifiedSubAdmin(false);
        } else if (deptAdmin) {
          setIsVerifiedSubAdmin(true);
          setDepartmentId(deptAdmin.department_id);
        } else {
          // Has sub_admin role but not assigned to department
          setIsVerifiedSubAdmin(true);
          setDepartmentId(null);
        }
      } catch (error) {
        console.error('Error verifying sub_admin:', error);
        setIsVerifiedSubAdmin(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifySubAdmin();
  }, [session?.access_token, user?.id]);

  return { isVerifiedSubAdmin, isVerifying, departmentId };
};
