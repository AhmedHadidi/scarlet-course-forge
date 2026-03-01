import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas for each operation
const emailSchema = z.string()
  .trim()
  .email('Invalid email format')
  .max(255, 'Email must be less than 255 characters');

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

const fullNameSchema = z.string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[\p{L}\p{M}\s\-'\.]+$/u, 'Name can only contain letters, spaces, hyphens, apostrophes, and periods');

const uuidSchema = z.string().uuid('Invalid user ID format');

const roleSchema = z.enum(['admin', 'sub_admin', 'user'], {
  errorMap: () => ({ message: 'Role must be "admin", "sub_admin", or "user"' })
});

const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
  role: roleSchema.optional(),
  department_id: z.string().uuid().optional()
});

const updateUserSchema = z.object({
  userId: uuidSchema,
  email: emailSchema.optional(),
  full_name: fullNameSchema.optional()
}).refine(data => data.email || data.full_name, {
  message: 'At least one field (email or full_name) must be provided for update'
});

const deleteUserSchema = z.object({
  userId: uuidSchema
});

const resetPasswordSchema = z.object({
  userId: uuidSchema,
  newPassword: passwordSchema
});

const updateUserRoleSchema = z.object({
  userId: uuidSchema,
  role: roleSchema
});

const operationSchema = z.enum([
  'createUser',
  'updateUser', 
  'deleteUser',
  'resetPassword',
  'updateUserRole',
  'listUsers'
], {
  errorMap: () => ({ message: 'Invalid operation type' })
});

// Helper function to format Zod errors
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
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin - use supabaseAdmin to bypass RLS
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    console.log('Role check:', { userId: user.id, roleData, roleError });

    if (roleError || !roleData) {
      throw new Error('Insufficient permissions');
    }

    const body = await req.json();
    
    // Validate operation type
    const operationResult = operationSchema.safeParse(body.operation);
    if (!operationResult.success) {
      throw new Error(formatZodError(operationResult.error));
    }
    
    const operation = operationResult.data;
    const data = body.data;

    console.log('Admin operation:', operation, 'by user:', user.id);

    switch (operation) {
      case 'createUser': {
        // Validate input
        const validationResult = createUserSchema.safeParse(data);
        if (!validationResult.success) {
          throw new Error(formatZodError(validationResult.error));
        }
        
        const { email, password, full_name, role, department_id } = validationResult.data;
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name }
        });

        if (createError) throw createError;

        // Assign role
        if (role) {
          await supabaseAdmin.from('user_roles').insert({
            user_id: newUser.user.id,
            role: role
          });
        }

        // Update profile with department_id if provided
        if (department_id) {
          await supabaseAdmin
            .from('profiles')
            .update({ department_id })
            .eq('id', newUser.user.id);
        }

        console.log('User created:', newUser.user.id);
        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'updateUser': {
        // Validate input
        const validationResult = updateUserSchema.safeParse(data);
        if (!validationResult.success) {
          throw new Error(formatZodError(validationResult.error));
        }
        
        const { userId, email, full_name } = validationResult.data;
        
        const updates: Record<string, unknown> = {};
        if (email) updates.email = email;
        if (full_name) updates.user_metadata = { full_name };

        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          updates
        );

        if (updateError) throw updateError;

        // Update profile
        if (full_name) {
          await supabaseAdmin
            .from('profiles')
            .update({ full_name })
            .eq('id', userId);
        }

        console.log('User updated:', userId);
        return new Response(JSON.stringify({ success: true, user: updatedUser.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'deleteUser': {
        // Validate input
        const validationResult = deleteUserSchema.safeParse(data);
        if (!validationResult.success) {
          throw new Error(formatZodError(validationResult.error));
        }
        
        const { userId } = validationResult.data;
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) throw deleteError;

        console.log('User deleted:', userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'resetPassword': {
        // Validate input
        const validationResult = resetPasswordSchema.safeParse(data);
        if (!validationResult.success) {
          throw new Error(formatZodError(validationResult.error));
        }
        
        const { userId, newPassword } = validationResult.data;
        
        const { data: updatedUser, error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (resetError) throw resetError;

        console.log('Password reset for user:', userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'updateUserRole': {
        // Validate input
        const validationResult = updateUserRoleSchema.safeParse(data);
        if (!validationResult.success) {
          throw new Error(formatZodError(validationResult.error));
        }
        
        const { userId, role } = validationResult.data;
        
        // Delete existing roles
        await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
        
        // Insert new role
        const { error: insertRoleError } = await supabaseAdmin.from('user_roles').insert({
          user_id: userId,
          role: role
        });

        if (insertRoleError) throw insertRoleError;

        console.log('User role updated:', userId, role);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'listUsers': {
        // No input validation needed for listUsers
        
        // Get all profiles with department info
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, created_at, department_id')
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        // Get department names
        const { data: departments } = await supabaseAdmin
          .from('departments')
          .select('id, name');
        
        const departmentMap = new Map((departments || []).map(d => [d.id, d.name]));

        // Get user details including emails and roles
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
              department_name: profile.department_id ? departmentMap.get(profile.department_id) : null
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
    console.error('Error in admin-operations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
