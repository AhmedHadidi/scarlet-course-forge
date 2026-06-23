import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const ALLOWED_ORIGINS = [
  "https://wcmfpcejlldihchyaavn.lovable.app",
  "https://scarlet-course-forge.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface DbPrompt {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  source_file: string | null;
  order_index: number | null;
}

interface TranslatedItem {
  id: string;
  title: string | null;
  category: string | null;
  content: string;
}

const BATCH_SIZE = 8;

async function translateBatch(
  apiKey: string,
  items: DbPrompt[],
): Promise<TranslatedItem[]> {
  const payload = items.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    content: p.content,
  }));

  const userMsg = `Translate every prompt in the JSON array below from Arabic to natural, professional English.

Rules:
- Translate the "title", "category", and "content" fields when present.
- Keep the same "id" for each item — do NOT change it.
- Preserve placeholders, code blocks, variable names, brackets like [الموضوع] (translate the inside), and line breaks.
- Do not add commentary. Output ONLY a JSON object of shape:
{"prompts":[{"id":"...","title":"...","category":"...","content":"..."}]}

Input:
${JSON.stringify(payload)}`;

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': apiKey,
      'X-Lovable-AIG-SDK': 'vercel-ai-sdk',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You translate Arabic AI prompts to English. Return only valid JSON. Preserve structure and placeholders exactly.',
        },
        { role: 'user', content: userMsg },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? '';
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  let parsed: { prompts?: TranslatedItem[] } = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch {}
    }
  }
  return Array.isArray(parsed.prompts) ? parsed.prompts : [];
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const replaceExisting: boolean = !!body?.replaceExisting;

    // Load all Arabic prompts
    const { data: arPrompts, error: fetchErr } = await supabaseAdmin
      .from('prompts')
      .select('id, title, content, category, source_file, order_index')
      .eq('language', 'ar')
      .order('order_index', { ascending: true });

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const source = (arPrompts || []) as DbPrompt[];
    if (source.length === 0) {
      return new Response(JSON.stringify({ error: 'No Arabic prompts to translate' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (replaceExisting) {
      await supabaseAdmin.from('prompts').delete().eq('language', 'en');
    }

    const byId = new Map(source.map((p) => [p.id, p]));
    const translatedAll: TranslatedItem[] = [];

    for (let i = 0; i < source.length; i += BATCH_SIZE) {
      const batch = source.slice(i, i + BATCH_SIZE);
      try {
        const out = await translateBatch(lovableKey, batch);
        translatedAll.push(...out);
      } catch (err) {
        console.error('Batch translate error', err);
      }
    }

    if (translatedAll.length === 0) {
      return new Response(JSON.stringify({ error: 'Translation produced no results' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = translatedAll
      .filter((t) => t && typeof t.content === 'string' && t.content.trim().length > 0 && byId.has(t.id))
      .map((t, idx) => {
        const src = byId.get(t.id)!;
        return {
          title: t.title?.trim() || null,
          content: t.content.trim(),
          category: t.category?.trim() || null,
          language: 'en',
          source_file: src.source_file,
          order_index: src.order_index ?? idx,
          created_by: user.id,
        };
      });

    const { error: insertError } = await supabaseAdmin.from('prompts').insert(rows);
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ inserted: rows.length, sourceCount: source.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('translate-prompts error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
