import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useVerifyAdmin = () => {
  const { session } = useAuth();
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const verifyAdmin = async () => {
      if (!session?.access_token) {
        setIsVerifiedAdmin(false);
        return;
      }

      setIsVerifying(true);
      try {
        const { data, error } = await supabase.functions.invoke('verify-admin', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          console.error('Error verifying admin:', error);
          setIsVerifiedAdmin(false);
        } else {
          setIsVerifiedAdmin(data?.isAdmin === true);
        }
      } catch (error) {
        console.error('Error calling verify-admin:', error);
        setIsVerifiedAdmin(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyAdmin();
  }, [session?.access_token]);

  return { isVerifiedAdmin, isVerifying };
};