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

interface ExtractedPrompt {
  title?: string;
  content: string;
  category?: string;
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

    const body = await req.json();
    const { fileBase64, fileName, replaceExisting, language } = body as {
      fileBase64: string;
      fileName: string;
      replaceExisting?: boolean;
      language?: "ar" | "en";
    };
    const lang: "ar" | "en" = language === "en" ? "en" : "ar";
    const langName = lang === "ar" ? "Arabic" : "English";

    if (!fileBase64 || !fileName) {
      return new Response(JSON.stringify({ error: 'fileBase64 and fileName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ask Gemini to extract Arabic prompts from the PDF
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': lovableKey,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              `You extract ${langName} AI prompts from PDF documents. Return ONLY valid JSON. Preserve the original ${langName} text exactly. Do not translate.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract every distinct AI prompt from this PDF.

Return strictly this JSON shape:
{"prompts":[{"title":"short ${langName} title (optional)","category":"${langName} category name if visible","content":"the full ${langName} prompt text exactly as written"}]}

Rules:
- Keep the original ${langName} text intact (no translation, no summarization).
- If the PDF groups prompts by section/category, use the section heading as "category".
- Skip page headers, footers, page numbers, and instructional intro text that is not itself a prompt.
- If a prompt has no clear title, omit the title field.
- Return ONLY the JSON object. No markdown, no commentary.`,
              },
              {
                type: 'file',
                file: {
                  filename: fileName,
                  file_data: `data:application/pdf;base64,${fileBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('AI gateway error:', aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: 'AI extraction failed', status: aiResp.status, details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiJson = await aiResp.json();
    const raw: string = aiJson?.choices?.[0]?.message?.content ?? '';

    // Strip possible markdown fencing
    const cleaned = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: { prompts?: ExtractedPrompt[] } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      // Try to find JSON object inside the text
      const match = cleaned.match(/\{[\s\S]*\}$/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {}
      }
    }

    const prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    if (prompts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No prompts could be extracted from the PDF', rawPreview: cleaned.slice(0, 500) }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (replaceExisting) {
      await supabaseAdmin.from('prompts').delete().eq('language', lang);
    }

    const rows = prompts
      .filter((p) => p && typeof p.content === 'string' && p.content.trim().length > 0)
      .map((p, idx) => ({
        title: p.title?.trim() || null,
        content: p.content.trim(),
        category: p.category?.trim() || null,
        language: lang,
        source_file: fileName,
        order_index: idx,
        created_by: user.id,
      }));

    const { error: insertError } = await supabaseAdmin.from('prompts').insert(rows);
    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ inserted: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('extract-prompts error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
