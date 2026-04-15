import { createClient } from 'npm:@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const USER_DOMAINS = ['3plcenter.com', 'eddisammy@gmail.com'];

function extractEmail(fromAddr: string): string | null {
  if (!fromAddr) return null;
  const match = fromAddr.match(/<([^>]+)>/) || fromAddr.match(/([^\s<]+@[^\s>]+)/);
  return match ? match[1].toLowerCase() : null;
}

function isOutbound(fromAddr: string): boolean {
  const lower = (fromAddr || '').toLowerCase();
  return USER_DOMAINS.some(d => lower.includes(d));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing env' }), { status: 500, headers: CORS_HEADERS });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get user with Pipedrive creds (same user as pipedrive-sync)
    const { data: creds } = await supabase
      .from('provider_credentials')
      .select('user_id')
      .eq('provider', 'pipedrive')
      .limit(1);

    const userId = creds?.[0]?.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No user found' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent emails from jarvisd
    // Note: This function runs on Supabase Edge (remote), so it can't reach localhost.
    // Instead, we'll accept emails as POST body from the client or jarvisd.
    const body = await req.json().catch(() => ({ emails: [] }));
    const emails: any[] = body.emails || [];

    if (emails.length === 0) {
      return new Response(JSON.stringify({ linked: 0, reason: 'No emails provided. POST { emails: [...] }' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let linked = 0;

    for (const email of emails) {
      const senderEmail = extractEmail(email.from_addr);
      if (!senderEmail) continue;

      const out = isOutbound(email.from_addr);
      const activityType = out ? 'email_sent' : 'email_received';

      // Find contact by email
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .ilike('email', senderEmail)
        .maybeSingle();

      if (!contact) continue;

      // Find linked deal or lead
      const { data: deal } = await supabase
        .from('deals')
        .select('id')
        .eq('user_id', userId)
        .eq('contact_id', contact.id)
        .limit(1)
        .maybeSingle();

      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('contact_id', contact.id)
        .limit(1)
        .maybeSingle();

      if (!deal && !lead) continue;

      // Dedup: check if we already linked this email
      const { data: existing } = await supabase
        .from('activities')
        .select('id')
        .eq('user_id', userId)
        .eq('source', 'gmail')
        .eq('subject', email.subject || '')
        .eq('occurred_at', email.created_at)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create activity
      await supabase.from('activities').insert({
        user_id: userId,
        deal_id: deal?.id || null,
        lead_id: lead?.id || null,
        contact_id: contact.id,
        type: activityType,
        subject: email.subject || null,
        body: email.snippet || null,
        metadata: {
          email_id: email.id,
          category: email.category,
          from_addr: email.from_addr,
        },
        source: 'gmail',
        occurred_at: email.created_at,
      });

      linked++;
    }

    return new Response(JSON.stringify({ linked, total: emails.length }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
