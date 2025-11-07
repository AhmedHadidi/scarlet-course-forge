import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
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

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Insufficient permissions');
    }

    const { operation, data } = await req.json();

    console.log('Admin operation:', operation, 'by user:', user.id);

    switch (operation) {
      case 'createUser': {
        const { email, password, full_name, role } = data;
        
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

        console.log('User created:', newUser.user.id);
        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'updateUser': {
        const { userId, email, full_name } = data;
        
        const updates: any = {};
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
        const { userId } = data;
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) throw deleteError;

        console.log('User deleted:', userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'resetPassword': {
        const { userId, newPassword } = data;
        
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
        const { userId, role } = data;
        
        // Delete existing roles
        await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
        
        // Insert new role
        const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
          user_id: userId,
          role: role
        });

        if (roleError) throw roleError;

        console.log('User role updated:', userId, role);
        return new Response(JSON.stringify({ success: true }), {
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
