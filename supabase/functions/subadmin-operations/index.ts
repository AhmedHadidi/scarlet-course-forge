import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const emailSchema = z.string().trim().email('Invalid email format').max(255);
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Must contain a special character');
const fullNameSchema = z.string().trim().min(2).max(100).regex(/^[\p{L}\p{M}\s\-'\.]+$/u);
const uuidSchema = z.string().uuid();

const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
});

const updateUserSchema = z.object({
  userId: uuidSchema,
  full_name: fullNameSchema.optional(),
}).refine(data => data.full_name, { message: 'At least full_name must be provided' });

const deleteUserSchema = z.object({ userId: uuidSchema });
const resetPasswordSchema = z.object({ userId: uuidSchema, newPassword: passwordSchema });

const operationSchema = z.enum([
  'createUser', 'updateUser', 'deleteUser', 'resetPassword', 'listUsers'
]);

function formatZodError(error: z.ZodError): string {
  return error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    // Verify sub_admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'sub_admin')
      .maybeSingle();

    if (roleError || !roleData) throw new Error('Insufficient permissions: sub_admin role required');

    // Get sub-admin's department
    const { data: deptAdmin, error: deptError } = await supabaseAdmin
      .from('department_admins')
      .select('department_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (deptError || !deptAdmin) throw new Error('No department assignment found');

    const departmentId = deptAdmin.department_id;

    const body = await req.json();
    const operationResult = operationSchema.safeParse(body.operation);
    if (!operationResult.success) throw new Error(formatZodError(operationResult.error));

    const operation = operationResult.data;
    const data = body.data;

    console.log('Sub-admin operation:', operation, 'by user:', user.id, 'dept:', departmentId);

    // Helper: verify a user belongs to this department
    const verifyUserInDepartment = async (userId: string) => {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('department_id')
        .eq('id', userId)
        .single();
      if (error || !profile || profile.department_id !== departmentId) {
        throw new Error('User does not belong to your department');
      }
    };

    switch (operation) {
      case 'createUser': {
        const validationResult = createUserSchema.safeParse(data);
        if (!validationResult.success) throw new Error(formatZodError(validationResult.error));

        const { email, password, full_name } = validationResult.data;

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name }
        });
        if (createError) throw createError;

        // Assign user role
        await supabaseAdmin.from('user_roles').insert({
          user_id: newUser.user.id,
          role: 'user'
        });

        // Assign to sub-admin's department
        await supabaseAdmin
          .from('profiles')
          .update({ department_id: departmentId, approval_status: 'approved' })
          .eq('id', newUser.user.id);

        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'updateUser': {
        const validationResult = updateUserSchema.safeParse(data);
        if (!validationResult.success) throw new Error(formatZodError(validationResult.error));

        const { userId, full_name } = validationResult.data;
        await verifyUserInDepartment(userId);

        if (full_name) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { full_name }
          });
          await supabaseAdmin.from('profiles').update({ full_name }).eq('id', userId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'deleteUser': {
        const validationResult = deleteUserSchema.safeParse(data);
        if (!validationResult.success) throw new Error(formatZodError(validationResult.error));

        const { userId } = validationResult.data;
        await verifyUserInDepartment(userId);

        // Prevent deleting admins or sub_admins
        const { data: targetRoles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);
        
        const hasElevatedRole = targetRoles?.some(r => r.role === 'admin' || r.role === 'sub_admin');
        if (hasElevatedRole) throw new Error('Cannot delete admin or sub-admin users');

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) throw deleteError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'resetPassword': {
        const validationResult = resetPasswordSchema.safeParse(data);
        if (!validationResult.success) throw new Error(formatZodError(validationResult.error));

        const { userId, newPassword } = validationResult.data;
        await verifyUserInDepartment(userId);

        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
          userId, { password: newPassword }
        );
        if (resetError) throw resetError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'listUsers': {
        // Get profiles in this department
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, created_at, department_id')
          .eq('department_id', departmentId)
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        const usersWithDetails = await Promise.all(
          (profiles || []).map(async (profile) => {
            const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(profile.id);
            const { data: rolesData } = await supabaseAdmin
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.id);

            return {
              ...profile,
              email: authUser?.email || 'N/A',
              roles: rolesData || [],
            };
          })
        );

        return new Response(JSON.stringify({ success: true, users: usersWithDetails }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error('Invalid operation');
    }
  } catch (error) {
    console.error('Error in subadmin-operations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
