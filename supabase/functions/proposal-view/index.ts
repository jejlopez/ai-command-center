import { createClient } from 'npm:@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function htmlResponse(html: string, status = 200): Response {
  const headers = new Headers();
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('access-control-allow-origin', '*');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'no-cache');
  return new Response(new TextEncoder().encode(html), { status, headers });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return htmlResponse(renderError('Missing token', 'No signing token was provided.'), 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const viewUrl = `${supabaseUrl}/functions/v1/proposal-view`;

  // ─── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('*')
      .eq('share_token', token)
      .maybeSingle();

    if (!proposal) {
      return htmlResponse(renderError('Proposal Not Found', 'This proposal link is invalid or has been removed.'), 404);
    }

    // Voided check
    if (proposal.voided_at) {
      return htmlResponse(renderVoided(proposal));
    }

    // Expired check
    if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
      return htmlResponse(renderExpired(proposal));
    }

    // Already executed — show executed record
    if (proposal.status === 'accepted' && proposal.executed_at) {
      await supabase.from('sign_audit_events').insert({
        proposal_id: proposal.id,
        event_type: 'viewed',
        actor: 'signer',
        ip_address: ip,
        user_agent: ua,
        metadata: { page: 'executed_record' },
      });
      return htmlResponse(renderExecuted(proposal, viewUrl));
    }

    // Log view event
    await supabase.from('sign_audit_events').insert({
      proposal_id: proposal.id,
      event_type: 'viewed',
      actor: 'signer',
      ip_address: ip,
      user_agent: ua,
    });

    // Update legacy view count
    await supabase.from('proposals').update({
      view_count: (proposal.view_count ?? 0) + 1,
      viewed_at: new Date().toISOString(),
    }).eq('id', proposal.id);

    const html = renderSigningPage(proposal, viewUrl, token);
    return htmlResponse(html);
  }

  // ─── POST ────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { action } = body;

    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, deal_id, user_id, company_name, content_hash, version, share_token, status, executed_at, voided_at, expires_at')
      .eq('share_token', token)
      .maybeSingle();

    if (!proposal) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Guard: voided or expired proposals cannot be acted on
    if (proposal.voided_at) {
      return new Response(JSON.stringify({ error: 'Proposal has been voided' }), {
        status: 410,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Proposal has expired' }), {
        status: 410,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Lightweight audit event (checkbox interactions, etc.) ──
    if (action === 'audit_event') {
      const { event_type } = body;
      if (!event_type) {
        return new Response(JSON.stringify({ error: 'event_type required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('sign_audit_events').insert({
        proposal_id: proposal.id,
        event_type,
        actor: 'signer',
        ip_address: ip,
        user_agent: ua,
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Sign ──────────────────────────────────────────────────────────────────
    if (action === 'sign') {
      const { signature } = body;

      // Validate required fields
      if (!signature?.name || !signature?.consent_given || !signature?.review_confirmed) {
        return new Response(JSON.stringify({ error: 'Missing required signature fields' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      if (signature.name.trim().length < 2) {
        return new Response(JSON.stringify({ error: 'Full name required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Guard against duplicate signing
      if (proposal.status === 'accepted' && proposal.executed_at) {
        return new Response(JSON.stringify({ error: 'Proposal already signed' }), {
          status: 409,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const now = new Date().toISOString();

      // Build complete signature record
      const signatureRecord = {
        name: signature.name.trim(),
        title: signature.title?.trim() ?? '',
        company: signature.company?.trim() ?? proposal.company_name ?? '',
        consent_given: true,
        review_confirmed: true,
        signed_at: now,
        ip_address: ip,
        user_agent: ua,
        document_hash: proposal.content_hash ?? null,
      };

      // Insert audit events for each legal step
      await supabase.from('sign_audit_events').insert([
        {
          proposal_id: proposal.id,
          event_type: 'consent_checked',
          actor: 'signer',
          ip_address: ip,
          user_agent: ua,
          metadata: { name: signatureRecord.name },
        },
        {
          proposal_id: proposal.id,
          event_type: 'review_checked',
          actor: 'signer',
          ip_address: ip,
          user_agent: ua,
          metadata: { name: signatureRecord.name },
        },
        {
          proposal_id: proposal.id,
          event_type: 'signed',
          actor: 'signer',
          ip_address: ip,
          user_agent: ua,
          metadata: {
            name: signatureRecord.name,
            title: signatureRecord.title,
            company: signatureRecord.company,
            document_hash: signatureRecord.document_hash,
          },
        },
      ]);

      // Update proposal
      await supabase.from('proposals').update({
        status: 'accepted',
        client_response: 'accepted',
        responded_at: now,
        executed_at: now,
        signature: signatureRecord,
      }).eq('id', proposal.id);

      // Notify sender
      const sigNote = `${signatureRecord.name}${signatureRecord.title ? ', ' + signatureRecord.title : ''}${signatureRecord.company ? ' at ' + signatureRecord.company : ''}`;
      await supabase.from('jarvis_suggestions').insert({
        user_id: proposal.user_id,
        type: 'proposal_response',
        suggestion: `${proposal.company_name} SIGNED & ACCEPTED your proposal (${sigNote})`,
        context: {
          proposal_id: proposal.id,
          deal_id: proposal.deal_id,
          action: 'accepted',
          signature: signatureRecord,
        },
      });

      // Update deal to closed_won
      if (proposal.deal_id) {
        await supabase.from('deals').update({
          stage: 'closed_won',
          last_touch: now,
          updated_at: now,
        }).eq('id', proposal.deal_id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Legacy actions (changes_requested, declined) — kept for backward compat
    if (['changes_requested', 'declined'].includes(action)) {
      const { notes } = body;
      await supabase.from('proposals').update({
        client_response: action,
        client_notes: notes ?? null,
        responded_at: new Date().toISOString(),
        status: action === 'declined' ? 'rejected' : 'sent',
      }).eq('id', proposal.id);

      await supabase.from('jarvis_suggestions').insert({
        user_id: proposal.user_id,
        type: 'proposal_response',
        suggestion: `${proposal.company_name} ${action === 'declined' ? 'DECLINED' : 'requested changes on'} your proposal${notes ? `: "${notes}"` : ''}`,
        context: { proposal_id: proposal.id, deal_id: proposal.deal_id, action, notes },
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
});

// ─── HTML RENDERERS ──────────────────────────────────────────────────────────

function baseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0f1117;
      color: rgba(255,255,255,0.85);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .glass {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      backdrop-filter: blur(12px);
    }
    @media print {
      body { background: white !important; color: black !important; }
      .glass { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; backdrop-filter: none !important; }
      .no-print { display: none !important; }
    }
  `;
}

function fontLink(): string {
  return `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">`;
}

function renderError(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — JARVIS Sign</title>
  ${fontLink()}
  <style>
    ${baseStyles()}
    .center { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center; }
    .icon { font-size:48px;margin-bottom:20px; }
    h1 { font-family:'Sora',sans-serif;font-size:22px;color:#fff;margin-bottom:10px; }
    p { color:rgba(255,255,255,0.45);font-size:14px;max-width:360px;line-height:1.6; }
  </style>
</head>
<body>
  <div class="center">
    <div class="icon">⚠</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top:24px;font-size:11px;color:rgba(255,255,255,0.2);">JARVIS Sign — Document Security</p>
  </div>
</body>
</html>`;
}

function renderVoided(p: any): string {
  const voidedDate = p.voided_at ? new Date(p.voided_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voided — ${p.company_name}</title>
  ${fontLink()}
  <style>
    ${baseStyles()}
    .center { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center; }
    .badge { display:inline-block;padding:4px 12px;border-radius:100px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;background:rgba(255,85,119,0.12);color:#FF5577;border:1px solid rgba(255,85,119,0.25);margin-bottom:20px; }
    h1 { font-family:'Sora',sans-serif;font-size:22px;color:#fff;margin-bottom:10px; }
    p { color:rgba(255,255,255,0.45);font-size:14px;max-width:400px;line-height:1.6; }
  </style>
</head>
<body>
  <div class="center">
    <div class="badge">Voided</div>
    <h1>This proposal has been voided</h1>
    <p>The proposal for <strong style="color:rgba(255,255,255,0.7)">${p.company_name}</strong> was voided${voidedDate ? ' on ' + voidedDate : ''}.</p>
    ${p.voided_reason ? `<p style="margin-top:12px;font-size:13px;">${p.voided_reason}</p>` : ''}
    <p style="margin-top:24px;font-size:11px;color:rgba(255,255,255,0.2);">Please contact your sales representative for a replacement document.</p>
  </div>
</body>
</html>`;
}

function renderExpired(p: any): string {
  const expiredDate = p.expires_at ? new Date(p.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expired — ${p.company_name}</title>
  ${fontLink()}
  <style>
    ${baseStyles()}
    .center { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center; }
    .badge { display:inline-block;padding:4px 12px;border-radius:100px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;background:rgba(255,179,64,0.12);color:#FFB340;border:1px solid rgba(255,179,64,0.25);margin-bottom:20px; }
    h1 { font-family:'Sora',sans-serif;font-size:22px;color:#fff;margin-bottom:10px; }
    p { color:rgba(255,255,255,0.45);font-size:14px;max-width:400px;line-height:1.6; }
  </style>
</head>
<body>
  <div class="center">
    <div class="badge">Expired</div>
    <h1>This proposal has expired</h1>
    <p>The proposal for <strong style="color:rgba(255,255,255,0.7)">${p.company_name}</strong> expired${expiredDate ? ' on ' + expiredDate : ''}.</p>
    <p style="margin-top:24px;font-size:11px;color:rgba(255,255,255,0.2);">Please contact your sales representative to request a renewed proposal.</p>
  </div>
</body>
</html>`;
}

function renderExecuted(p: any, viewUrl: string): string {
  const pricing = p.pricing ?? {};
  const lanes = p.lanes ?? [];
  const services = p.services ?? [];
  const terms = p.terms ?? {};
  const sig = p.signature ?? {};

  const executedDate = p.executed_at
    ? new Date(p.executed_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    : '';

  const docContent = buildDocumentContent(p, pricing, lanes, services, terms);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executed — ${p.company_name}</title>
  ${fontLink()}
  <style>
    ${baseStyles()}
    ${sharedDocStyles()}
    .layout { display:flex;gap:0;min-height:100vh; }
    .doc-col { flex:1;min-width:0;padding:40px 32px;overflow-y:auto; }
    .panel-col { width:380px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;border-left:2px solid rgba(0,224,160,0.25);background:rgba(0,224,160,0.02); }
    .exec-panel { padding:32px 24px; }
    .exec-badge { display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:100px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;background:rgba(0,224,160,0.12);color:#00E0A0;border:1px solid rgba(0,224,160,0.25);margin-bottom:20px; }
    .exec-badge::before { content:'✓';font-size:11px; }
    .exec-panel h3 { font-family:'Sora',sans-serif;font-size:18px;font-weight:700;color:#fff;margin-bottom:20px; }
    .signer-block { padding:16px;border-radius:12px;background:rgba(0,224,160,0.06);border:1px solid rgba(0,224,160,0.12);margin-bottom:20px; }
    .signer-name { font-size:16px;font-weight:600;color:#fff;margin-bottom:2px; }
    .signer-meta { font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5; }
    .signed-timestamp { font-size:12px;color:rgba(255,255,255,0.35);margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06); }
    .integrity-row { display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px;font-size:12px;color:rgba(255,255,255,0.45); }
    .integrity-row .chk { color:#00E0A0;font-size:14px; }
    .exec-btn { width:100%;padding:13px;border-radius:12px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;margin-bottom:10px; }
    .btn-download { background:rgba(0,224,160,0.1);color:#00E0A0;border:1px solid rgba(0,224,160,0.2); }
    .btn-download:hover { background:rgba(0,224,160,0.18); }
    .audit-section { margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06); }
    .audit-section h4 { font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.25);margin-bottom:12px;font-weight:500; }
    @media (max-width:900px) {
      .layout { flex-direction:column; }
      .panel-col { width:100%;position:static;height:auto;border-left:none;border-top:2px solid rgba(0,224,160,0.25); }
    }
    @media print {
      .panel-col { position:static;height:auto;border-left:1px solid #ccc; }
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <div class="doc-col">
      <div style="max-width:720px;margin:0 auto;">
        <!-- Executed watermark banner -->
        <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:12px;background:rgba(0,224,160,0.06);border:1px solid rgba(0,224,160,0.15);margin-bottom:28px;">
          <span style="font-size:20px;color:#00E0A0;">✓</span>
          <div>
            <div style="font-size:13px;font-weight:600;color:#00E0A0;">Agreement Executed</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.35);">This document has been legally signed and is now binding.</div>
          </div>
        </div>
        ${docContent}
      </div>
    </div>
    <div class="panel-col">
      <div class="exec-panel">
        <div class="exec-badge">Executed</div>
        <h3>Agreement Executed</h3>

        <div class="signer-block">
          <div class="signer-name">${sig.name ?? 'Unknown'}</div>
          <div class="signer-meta">${sig.title ? sig.title + '<br>' : ''}${sig.company ?? ''}</div>
          <div class="signed-timestamp">${executedDate}</div>
        </div>

        <div class="integrity-row"><span class="chk">✓</span> Document integrity verified</div>
        <div class="integrity-row"><span class="chk">✓</span> Consent recorded under ESIGN Act</div>
        <div class="integrity-row"><span class="chk">✓</span> IP address logged: ${sig.ip_address ? sig.ip_address.split(',')[0] : 'recorded'}</div>

        <button class="exec-btn btn-download no-print" onclick="window.print()">Download Executed PDF</button>

        <div class="audit-section">
          <h4>Document Details</h4>
          <div style="font-size:11px;color:rgba(255,255,255,0.3);line-height:2;">
            <div>Document ID: <span style="color:rgba(255,255,255,0.5)">${p.share_token}</span></div>
            <div>Version: <span style="color:rgba(255,255,255,0.5)">v${p.version ?? 1}</span></div>
            ${p.content_hash ? `<div>SHA-256: <span style="color:rgba(255,255,255,0.5);word-break:break-all;">${p.content_hash.slice(0, 16)}…</span></div>` : ''}
            <div>Executed: <span style="color:rgba(255,255,255,0.5)">${executedDate}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderSigningPage(p: any, viewUrl: string, token: string): string {
  const pricing = p.pricing ?? {};
  const lanes = p.lanes ?? [];
  const services = p.services ?? [];
  const terms = p.terms ?? {};

  const monthly = pricing.monthly_cost ?? 0;
  const annual = pricing.annual_projection ?? 0;
  const validUntil = terms.valid_until ?? '—';
  const payment = terms.payment ?? 'Net 30';

  const docContent = buildDocumentContent(p, pricing, lanes, services, terms);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign — ${p.company_name ?? p.name}</title>
  ${fontLink()}
  <style>
    ${baseStyles()}
    ${sharedDocStyles()}

    /* ── Layout ── */
    .layout {
      display: flex;
      gap: 0;
      min-height: 100vh;
    }
    .doc-col {
      flex: 1;
      min-width: 0;
      padding: 40px 32px;
      overflow-y: auto;
    }
    .panel-col {
      width: 400px;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      border-left: 2px solid rgba(0,224,208,0.2);
      background: rgba(0,224,208,0.015);
    }

    /* ── Signing panel internals ── */
    .signing-panel { padding: 28px 24px; }
    .panel-header { margin-bottom: 20px; }
    .panel-header h3 { font-family:'Sora',sans-serif;font-size:17px;font-weight:700;color:#fff;margin-bottom:6px; }
    .status-badge { display:inline-block;padding:3px 10px;border-radius:100px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;background:rgba(255,179,64,0.12);color:#FFB340;border:1px solid rgba(255,179,64,0.25); }

    /* ── Terms summary ── */
    .terms-summary { margin-bottom:20px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05); }
    .term-row { display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px; }
    .term-row:not(:last-child) { border-bottom:1px solid rgba(255,255,255,0.04); }
    .term-row span:first-child { color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.08em;font-size:10px; }
    .term-row span:last-child { color:rgba(255,255,255,0.75);font-weight:500; }

    /* ── Legal notice ── */
    .legal-notice {
      padding: 14px;
      border-radius: 10px;
      background: rgba(0,224,208,0.04);
      border: 1px solid rgba(0,224,208,0.1);
      font-size: 12px;
      line-height: 1.7;
      color: rgba(255,255,255,0.55);
      margin-bottom: 18px;
    }

    /* ── Checkbox rows ── */
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 10px;
      cursor: pointer;
      font-size: 12px;
      color: rgba(255,255,255,0.6);
      line-height: 1.5;
      transition: border-color 0.15s;
    }
    .checkbox-row:hover { border-color: rgba(0,224,208,0.2); }
    .checkbox-row input[type=checkbox] {
      width: 15px;
      height: 15px;
      min-width: 15px;
      margin-top: 1px;
      cursor: pointer;
      accent-color: #00E0D0;
    }

    /* ── Input fields ── */
    .field-group { margin-bottom: 12px; }
    .field-group label { display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.3);margin-bottom:6px;font-weight:500; }
    .field-group input {
      width: 100%;
      padding: 10px 13px;
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    .field-group input:focus { border-color: rgba(0,224,208,0.35); }
    .field-group input::placeholder { color: rgba(255,255,255,0.2); }

    /* ── Buttons ── */
    .sign-btn {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: none;
      background: rgba(0,224,208,0.15);
      color: #00E0D0;
      border: 1px solid rgba(0,224,208,0.3);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: background 0.2s, opacity 0.2s;
      letter-spacing: 0.02em;
      margin-bottom: 10px;
    }
    .sign-btn:hover:not(:disabled) { background: rgba(0,224,208,0.25); }
    .sign-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .secondary-btn {
      width: 100%;
      padding: 11px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      color: rgba(255,255,255,0.45);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      margin-bottom: 20px;
      transition: background 0.15s;
    }
    .secondary-btn:hover { background: rgba(255,255,255,0.06); }

    /* ── Integrity info ── */
    .integrity-info {
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(255,255,255,0.01);
      border: 1px solid rgba(255,255,255,0.04);
      font-size: 10px;
      color: rgba(255,255,255,0.2);
      line-height: 1.9;
    }
    .integrity-info span { display: block; }

    /* ── Mobile ── */
    @media (max-width: 900px) {
      .layout { flex-direction: column; }
      .panel-col {
        width: 100%;
        position: static;
        height: auto;
        border-left: none;
        border-top: 2px solid rgba(0,224,208,0.2);
      }
    }
    @media print {
      .panel-col { position:static;height:auto;border-left:1px solid #ccc; }
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="layout">

    <!-- ── Document column ── -->
    <div class="doc-col">
      <div style="max-width:720px;margin:0 auto;">
        ${docContent}
      </div>
    </div>

    <!-- ── Signing panel ── -->
    <div class="panel-col" id="signing-panel-col">
      <div class="signing-panel" id="signing-panel">

        <div class="panel-header">
          <h3>Signature Required</h3>
          <span class="status-badge">Pending Signature</span>
        </div>

        <!-- Key terms summary -->
        <div class="terms-summary">
          <div class="term-row"><span>Service</span><span>Warehousing &amp; Fulfillment</span></div>
          <div class="term-row"><span>Provider</span><span>3PL Center LLC</span></div>
          <div class="term-row"><span>Monthly Est.</span><span>${monthly > 0 ? '$' + monthly.toLocaleString() : '—'}</span></div>
          <div class="term-row"><span>Annual Est.</span><span>${annual > 0 ? '$' + annual.toLocaleString() : '—'}</span></div>
          <div class="term-row"><span>Payment Terms</span><span>Net 7 — end of month</span></div>
          <div class="term-row"><span>Jurisdiction</span><span>NJ / Middlesex Co.</span></div>
        </div>

        <!-- Legal notice — large, readable -->
        <div class="legal-notice">
          By checking the boxes below and clicking "Sign and Accept," you agree to use
          electronic records and signatures and intend to be legally bound by this agreement
          under the ESIGN Act (15 U.S.C. §7001 et seq.).
        </div>

        <!-- Consent checkbox — NOT pre-checked -->
        <label class="checkbox-row" for="consent-check">
          <input type="checkbox" id="consent-check" />
          I consent to conduct this transaction electronically and agree that my electronic
          signature is legally equivalent to my handwritten signature.
        </label>

        <!-- Review checkbox — NOT pre-checked -->
        <label class="checkbox-row" for="review-check">
          <input type="checkbox" id="review-check" />
          I have read and reviewed the full agreement on the left, and agree to be legally
          bound by all of its terms and conditions.
        </label>

        <!-- Full legal name -->
        <div class="field-group">
          <label for="signer-name">Full Legal Name <span style="color:#FF5577">*</span></label>
          <input type="text" id="signer-name" placeholder="e.g., Jane Smith" autocomplete="name" />
        </div>

        <!-- Title (optional) -->
        <div class="field-group">
          <label for="signer-title">Title (optional)</label>
          <input type="text" id="signer-title" placeholder="e.g., VP Operations" autocomplete="organization-title" />
        </div>

        <!-- Company -->
        <div class="field-group">
          <label for="signer-company">Company</label>
          <input type="text" id="signer-company" value="${escapeHtml(p.company_name ?? '')}" autocomplete="organization" />
        </div>

        <!-- Sign button — disabled until both boxes + name -->
        <button class="sign-btn no-print" id="sign-btn" disabled onclick="signDocument()">
          Sign and Accept
        </button>

        <!-- Download -->
        <button class="secondary-btn no-print" onclick="window.print()">
          Download PDF
        </button>

        <!-- Document integrity -->
        <div class="integrity-info">
          <span>Document ID: ${p.share_token}</span>
          <span>Version: v${p.version ?? 1}</span>
          <span>Integrity: ${p.content_hash ? '✓ Verified' : 'Pending lock'}</span>
          ${p.content_hash ? `<span>SHA-256: ${p.content_hash.slice(0, 16)}…</span>` : ''}
        </div>

      </div>
    </div>
  </div>

  <script>
    const VIEW_URL = '${viewUrl}';
    const TOKEN = '${token}';

    function updateSignButton() {
      const consent = document.getElementById('consent-check').checked;
      const review = document.getElementById('review-check').checked;
      const name = document.getElementById('signer-name').value.trim();
      document.getElementById('sign-btn').disabled = !(consent && review && name.length >= 2);
    }

    document.getElementById('consent-check').addEventListener('change', function() {
      logEvent(this.checked ? 'consent_checked' : 'consent_unchecked');
      updateSignButton();
    });

    document.getElementById('review-check').addEventListener('change', function() {
      logEvent(this.checked ? 'review_checked' : 'review_unchecked');
      updateSignButton();
    });

    document.getElementById('signer-name').addEventListener('input', updateSignButton);

    function logEvent(eventType) {
      fetch(VIEW_URL + '?token=' + TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit_event', event_type: eventType }),
      }).catch(() => {});
    }

    async function signDocument() {
      const name    = document.getElementById('signer-name').value.trim();
      const title   = document.getElementById('signer-title').value.trim();
      const company = document.getElementById('signer-company').value.trim();
      const consent = document.getElementById('consent-check').checked;
      const review  = document.getElementById('review-check').checked;

      if (!consent || !review || name.length < 2) return;

      const btn = document.getElementById('sign-btn');
      btn.disabled = true;
      btn.textContent = 'Processing…';

      try {
        const res = await fetch(VIEW_URL + '?token=' + TOKEN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sign',
            signature: { name, title, company, consent_given: consent, review_confirmed: review },
          }),
        });

        if (res.ok) {
          const ts = new Date().toLocaleString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
          });
          document.getElementById('signing-panel').innerHTML = \`
            <div style="text-align:center;padding:40px 16px;">
              <div style="width:60px;height:60px;border-radius:50%;background:rgba(0,224,160,0.12);border:1px solid rgba(0,224,160,0.25);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:26px;color:#00E0A0;">✓</div>
              <h3 style="font-family:'Sora',sans-serif;font-size:18px;color:#fff;margin-bottom:8px;">Agreement Signed</h3>
              <p style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:4px;">\${name}\${title ? ', ' + title : ''}</p>
              \${company ? '<p style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:12px;">' + company + '</p>' : ''}
              <p style="font-size:11px;color:rgba(255,255,255,0.3);margin-bottom:24px;">\${ts}</p>
              <p style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:24px;">A confirmation has been sent to your representative.</p>
              <button onclick="window.print()" style="padding:11px 28px;border-radius:10px;border:1px solid rgba(0,224,160,0.25);background:rgba(0,224,160,0.1);color:#00E0A0;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;">
                Download Executed Copy
              </button>
            </div>
          \`;
        } else {
          throw new Error('Server error');
        }
      } catch (e) {
        btn.textContent = 'Sign and Accept';
        btn.disabled = false;
        alert('Failed to process signature. Please try again.');
      }
    }
  </script>
</body>
</html>`;
}

// ─── Helper: price table row ────────────────────────────────────────────────
function priceRow(label: string, value: string | number, last = false): string {
  const border = last ? '' : 'border-bottom:1px solid rgba(255,255,255,0.045);';
  const val = typeof value === 'number' ? (value === 0 ? '—' : `$${value.toFixed(2)}`) : String(value);
  return `<tr>
    <td style="padding:9px 16px;${border}font-size:13px;color:rgba(255,255,255,0.7);">${label}</td>
    <td style="padding:9px 16px;${border}text-align:right;font-size:13px;font-weight:500;color:rgba(255,255,255,0.9);">${val}</td>
  </tr>`;
}

function priceTable(section: string, rows: [string, string | number][]): string {
  return `
  <div style="margin-bottom:20px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.17em;color:rgba(255,255,255,0.3);font-weight:500;margin-bottom:6px;">${section}</div>
    <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.015);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
      <tbody>
        ${rows.map(([l, v], i) => priceRow(l, v, i === rows.length - 1)).join('')}
      </tbody>
    </table>
  </div>`;
}

// ─── Shared document content builder ────────────────────────────────────────

function buildDocumentContent(p: any, pricing: any, _lanes: any[], _services: any[], _terms: any): string {
  // ── Destructure all 3PL pricing sections ────────────────────────────────
  const storage = pricing.storage ?? {};
  const recPal = pricing.receiving_palletized ?? {};
  const recLoose = pricing.receiving_loose ?? {};
  const container = pricing.container_unloading ?? {};
  const outParcel = pricing.outbound_parcel ?? {};
  const outPallet = pricing.outbound_pallet ?? {};
  const special = pricing.special_projects ?? {};
  const integrations = pricing.integrations ?? {};
  const minimums = pricing.minimums ?? {};
  const vol = pricing.estimated_monthly_volume ?? {};

  const rebill = pricing.rebill_per_tracking ?? 7.50;
  const monthlyEst = pricing.monthly_estimate ?? pricing.monthly_cost ?? 0;
  const annualEst = pricing.annual_estimate ?? pricing.annual_projection ?? 0;

  const r = (v: any) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) || 0 : 0);
  const fmt = (v: number) => v > 0 ? `$${v.toFixed(2)}` : '—';
  const fmtOrTbd = (v: any) => v === 'TBD' || v === 'tbd' ? 'TBD' : fmt(r(v));

  const createdDate = new Date(p.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const acctContact = p.accounting_contact ?? {};

  return `
    <!-- ── Header ── -->
    <div class="glass" style="padding:40px 36px 36px;border-color:rgba(0,224,208,0.18);box-shadow:0 0 40px rgba(0,224,208,0.04);margin-bottom:24px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div class="section-label" style="margin-bottom:4px;">Warehousing &amp; Fulfillment Agreement</div>
          <h1 style="font-family:'Sora',sans-serif;font-size:24px;font-weight:700;color:#fff;margin-bottom:6px;">3PL Center LLC</h1>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);">Prepared for <strong style="color:rgba(255,255,255,0.8);">${escapeHtml(p.company_name ?? 'Client')}</strong></div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:4px;">Date</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.7);">${createdDate}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-top:8px;margin-bottom:4px;">Document</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);font-family:monospace;">${p.share_token}</div>
        </div>
      </div>

      <!-- Client Info block -->
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;">
        ${p.client_name ? `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:3px;">Contact</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(p.client_name)}</div></div>` : ''}
        ${p.client_email ? `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:3px;">Email</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(p.client_email)}</div></div>` : ''}
        ${(p.client_phone || p.pricing?.client_phone) ? `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:3px;">Phone</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(p.client_phone ?? '')}</div></div>` : ''}
        ${p.business_address ? `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:3px;">Address</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(p.business_address)}</div></div>` : ''}
        ${acctContact?.name ? `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:3px;">Accounting</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(acctContact.name)}${acctContact.email ? '<br><span style="font-size:11px;color:rgba(255,255,255,0.4);">' + escapeHtml(acctContact.email) + '</span>' : ''}</div></div>` : ''}
      </div>
    </div>

    ${p.executive_summary ? `
    <div class="glass" style="padding:24px 32px;margin-bottom:24px;">
      <div class="section-label">Executive Summary</div>
      <div style="font-size:14px;line-height:1.8;color:rgba(255,255,255,0.65);">${escapeHtml(p.executive_summary)}</div>
    </div>
    ` : ''}

    <!-- ── Rate Schedule ── -->
    <div class="glass" style="padding:28px 32px;margin-bottom:24px;">
      <div class="section-label">Rate Schedule</div>
      <p style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:20px;line-height:1.6;">All rates are per-unit as listed. Storage billed upon receipt: goods received 1st–15th charged full month; 16th–31st charged half month.</p>

      ${priceTable('Monthly Storage', [
        ['30×36×24 (small pallet)', r(storage.small_30x36x24) || 6.00],
        ['40×48×60 (standard)', r(storage.standard_40x48x60) || 14.75],
        ['40×48×72 (tall)', r(storage.tall_40x48x72) || 25.00],
        ['40×48×over 72 (oversized)', r(storage.oversized_40x48xover72) || 40.00],
      ])}

      ${priceTable('Receiving — Palletized', [
        ['Per pallet (1 SKU)', r(recPal.single_sku) || 13.50],
        ['Per pallet (2 SKUs)', r(recPal.two_sku) || 35.00],
        ['Per pallet (Mixed SKU)', r(recPal.mixed_sku) || 75.00],
      ])}

      ${priceTable('Receiving — Loose Cartons', [
        ['Per carton', r(recLoose.per_carton) || 2.50],
        ['Counting pieces (per piece)', r(recLoose.count_per_piece) || 0.50],
      ])}

      ${priceTable('Container Unloading (floor loaded, includes 10 SKUs)', [
        ["20' container (includes 500 cartons)", r(container.twenty_ft) || 425.00],
        ["40' container (includes 1000 cartons)", r(container.forty_ft) || 650.00],
        ["45' container (includes 1000 cartons)", r(container.fortyfive_ft) || 700.00],
        ['Each additional 250 packages', r(container.additional_250_packages) || 45.00],
        ['Each additional 10 SKUs', r(container.additional_10_skus) || 45.00],
      ])}

      ${priceTable('Outbound — Small Parcel (FedEx / UPS / USPS)', [
        ['Order processing', r(outParcel.order_processing) || 3.50],
        ['Per pick (under 30 lbs)', r(outParcel.per_pick) || 0.75],
        ['Rush order fee', r(outParcel.rush_order) || 30.00],
      ])}

      ${priceTable('Outbound — Palletization (LTL / FTL)', [
        ['Per pallet', r(outPallet.per_pallet) || 13.50],
        ['Per pick (under 30 lbs)', r(outPallet.per_pick) || 0.75],
        ['Bill of lading', r(outPallet.bol) || 4.50],
        ['Rush order fee', r(outPallet.rush_order) || 30.00],
      ])}

      ${priceTable('Special Projects', [
        ['Per man hour (standard)', r(special.man_hour) || 40.00],
        ['Per man hour (forklift)', r(special.man_hour_forklift) || 45.00],
        ['Per man hour (manager)', r(special.man_hour_manager) || 55.00],
        ['Per carton / pallet label', r(special.label) || 0.50],
        ['Scanning serial #', r(special.serial_scan) || 0.50],
      ])}

      ${priceTable('Integrations', [
        ['Pre-built (Amazon, Shopify, etc.) — one-time setup', r(integrations.prebuilt) || 750.00],
        ['Monthly integration fee', r(integrations.monthly) || 125.00],
        ['Custom integration (per hour)', r(integrations.custom_per_hour) || 150.00],
        ['EDI', fmtOrTbd(integrations.edi ?? 'TBD')],
      ])}

      ${priceTable('3PL Re-Bill & Monthly Minimums', [
        ['3PL re-bill per tracking (FedEx / UPS / USPS / DHL)', r(rebill) || 7.50],
        ['Monthly handling minimum', r(minimums.handling) || 2500],
        ['Monthly storage minimum', r(minimums.storage) || 1000],
      ])}

      <div style="margin-top:8px;padding:14px 16px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.25);margin-bottom:6px;">Materials (Billed at Cost + Handling)</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">
          Pallet &amp; shrink wrap (Grade B, 40×48): <strong style="color:rgba(255,255,255,0.8);">$20.50</strong> &nbsp;·&nbsp;
          Standard box (includes air pillows &amp; tape): <strong style="color:rgba(255,255,255,0.8);">varies by size</strong>
        </div>
      </div>
    </div>

    <!-- ── Estimated Monthly Cost ── -->
    ${(monthlyEst > 0 || (vol.pallets || vol.orders || vol.picks)) ? `
    <div class="glass" style="padding:28px 32px;margin-bottom:24px;border-color:rgba(0,224,208,0.12);">
      <div class="section-label">Estimated Monthly Cost</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:${monthlyEst > 0 ? '16px' : '0'};">
        ${vol.pallets ? `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:6px;">Pallets / Mo</div><div style="font-size:20px;font-weight:600;color:rgba(255,255,255,0.7);">${vol.pallets}</div></div>` : ''}
        ${vol.orders ? `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:6px;">Orders / Mo</div><div style="font-size:20px;font-weight:600;color:rgba(255,255,255,0.7);">${vol.orders}</div></div>` : ''}
        ${vol.picks ? `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:6px;">Picks / Mo</div><div style="font-size:20px;font-weight:600;color:rgba(255,255,255,0.7);">${vol.picks}</div></div>` : ''}
        ${monthlyEst > 0 ? `<div style="background:rgba(0,224,208,0.06);border:1px solid rgba(0,224,208,0.14);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(0,224,208,0.6);margin-bottom:6px;">Monthly Est.</div><div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:700;color:#00E0D0;">$${monthlyEst.toLocaleString()}</div></div>` : ''}
        ${annualEst > 0 ? `<div style="background:rgba(0,224,160,0.04);border:1px solid rgba(0,224,160,0.1);border-radius:12px;padding:14px;text-align:center;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(0,224,160,0.5);margin-bottom:6px;">Annual Est.</div><div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:700;color:#00E0A0;">$${annualEst.toLocaleString()}</div></div>` : ''}
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,0.25);line-height:1.6;">Estimate is based on projected volumes × rates above. Monthly minimums apply. Actual invoice may vary based on services utilized.</div>
    </div>
    ` : ''}

    <!-- ── Legal Terms ── -->
    <div class="glass" style="padding:28px 32px;margin-bottom:24px;">
      <div class="section-label">Terms &amp; Conditions</div>

      <div style="font-size:13px;line-height:1.8;color:rgba(255,255,255,0.65);">

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Liability</div>
          <p>Supplier's liability to Customer for loss, damage, destruction, or delay of goods shall be limited to the lesser of $0.50 per pound per article or $50.00 per shipment, unless a higher value is declared in writing and accepted by Supplier prior to receipt of goods. 3PL Center LLC shall not be liable for concealed damage, losses or delays resulting from acts of nature, acts beyond its reasonable control, or for any consequential, indirect, or special damages.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Special Circumstances</div>
          <p>When outbound volume in any given month exceeds 30% or more of the current inventory on hand, Customer agrees to make payment in full on the current balance prior to the release of any additional inventory. 3PL Center LLC reserves the right to hold shipments until all outstanding balances are satisfied.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Confidentiality</div>
          <p>Customer acknowledges that the rates, terms, processes, and procedures disclosed under this Agreement are proprietary and confidential. Customer agrees not to disclose any such information to any third party, including competitors, without the prior written consent of 3PL Center LLC. This obligation survives the termination of this Agreement.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Inventory</div>
          <p>3PL Center LLC will maintain accurate inventory counts using its warehouse management system. Monthly cycle counts will be conducted; an annual physical inventory will be performed. 3PL Center LLC maintains a 99% inventory accuracy threshold and allows a 1% shrinkage allowance per year. Discrepancies exceeding 1% will be investigated and reported to Customer.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Non 3PL Center Personnel</div>
          <p>All non-3PL Center LLC personnel visiting the facility must be accompanied by an authorized 3PL Center representative at all times. No outside labor, contractors, or Customer employees may perform work within the 3PL Center facility without prior written authorization from 3PL Center LLC management.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Insurance</div>
          <p>Customer is solely responsible for maintaining adequate insurance coverage for its goods while in storage or in transit. 3PL Center LLC does not provide cargo or property insurance on behalf of Customer. Customer is encouraged to obtain appropriate warehouse legal liability and cargo insurance. Evidence of such insurance may be requested by 3PL Center LLC at any time.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Force Majeure</div>
          <p>Neither party shall be liable for delays or failures in performance resulting from causes beyond its reasonable control, including but not limited to acts of God, acts of government, floods, fires, earthquakes, civil unrest, acts of terror, strikes, labor disputes, internet outages, or other events of force majeure. The affected party shall provide prompt written notice of such event and resume performance as soon as reasonably possible.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Enforceability &amp; Governing Law</div>
          <p>This Agreement shall be governed by and construed in accordance with the laws of the State of New Jersey. Any disputes arising under or related to this Agreement shall be resolved in the courts of Middlesex County, New Jersey. If any provision of this Agreement is found to be unenforceable, the remaining provisions shall remain in full force and effect.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Standard Operating Procedures (SOPs)</div>
          <p><strong>System Usage:</strong> Customer shall use the designated warehouse management system for all inventory transactions, order submissions, and reporting. <strong>SKU Setup:</strong> All SKUs must be set up in the system prior to receiving; Customer is responsible for providing accurate product data, dimensions, and weights. <strong>Receiving Rules:</strong> All inbound shipments require advance shipping notices (ASNs) at least 24 hours prior to arrival; pallets must be labeled per 3PL Center LLC specifications. <strong>Outbound Rules:</strong> All outbound orders must be submitted through the system by 12:00 PM EST for same-day processing; orders submitted after cutoff will be processed the following business day. <strong>Shipping Methods:</strong> Customer must specify carrier and service level for each shipment; 3PL Center LLC is not responsible for carrier selection errors made by Customer.</p>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.3);font-weight:600;margin-bottom:8px;">Payment Terms</div>
          <p>Invoices are issued at the end of each calendar month. Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly late fee on the outstanding balance. Credit card payments are subject to a 3% processing fee (4% for American Express). ACH / wire transfer payments are accepted at no additional charge. 3PL Center LLC reserves the right to suspend services for accounts more than 14 days past due.</p>
        </div>

      </div>
    </div>

    <!-- ── Payment Authorization (informational) ── -->
    <div class="glass" style="padding:24px 32px;margin-bottom:24px;border-color:rgba(255,179,64,0.1);">
      <div class="section-label" style="color:rgba(255,179,64,0.6);">Payment Authorization (Informational)</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.8;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
          <div style="padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:4px;">Credit Card</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.65);">+3% processing fee</div>
          </div>
          <div style="padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:4px;">American Express</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.65);">+4% processing fee</div>
          </div>
          <div style="padding:12px 14px;border-radius:10px;background:rgba(0,224,160,0.04);border:1px solid rgba(0,224,160,0.1);">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(0,224,160,0.5);margin-bottom:4px;">ACH / Wire Transfer</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.65);">No fee — preferred</div>
          </div>
        </div>
        <div style="margin-top:12px;font-size:11px;color:rgba(255,255,255,0.25);">Payment collection is handled separately. Signing this document does not authorize any charge. A payment method on file will be established separately by 3PL Center LLC.</div>
      </div>
    </div>

    <!-- ── Signature Block ── -->
    <div class="glass" style="padding:28px 32px;margin-bottom:24px;">
      <div class="section-label">Signature Block</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div style="padding:20px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.25);margin-bottom:12px;">Client</div>
          <div style="margin-bottom:14px;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">Company</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(p.company_name ?? '')}</div></div>
          <div style="margin-bottom:14px;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">By (signature)</div><div style="height:32px;border-bottom:1px solid rgba(255,255,255,0.12);"></div></div>
          <div style="margin-bottom:14px;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">Title</div><div style="height:24px;border-bottom:1px solid rgba(255,255,255,0.06);"></div></div>
          <div style="margin-bottom:0;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">Date</div><div style="height:24px;border-bottom:1px solid rgba(255,255,255,0.06);"></div></div>
        </div>
        <div style="padding:20px;border-radius:12px;background:rgba(0,224,208,0.03);border:1px solid rgba(0,224,208,0.1);">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(0,224,208,0.5);margin-bottom:12px;">3PL Center LLC</div>
          <div style="margin-bottom:14px;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">Company</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">3PL Center LLC</div></div>
          <div style="margin-bottom:14px;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">By</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">Marcos Eddi</div></div>
          <div style="margin-bottom:14px;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">Title</div><div style="font-size:13px;color:rgba(255,255,255,0.75);">Chief Executive Officer</div></div>
          <div style="margin-bottom:0;"><div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;">Date</div><div style="height:24px;border-bottom:1px solid rgba(0,224,208,0.1);"></div></div>
        </div>
      </div>
    </div>

    <div style="text-align:center;padding:24px;font-size:11px;color:rgba(255,255,255,0.18);">
      Powered by JARVIS Sign &nbsp;·&nbsp; Document ID: ${p.share_token} &nbsp;·&nbsp; v${p.version ?? 1}
      <div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,0.12);">3PL Center LLC · Middlesex County, New Jersey · Governing law: State of New Jersey</div>
    </div>
  `;
}

function sharedDocStyles(): string {
  return `
    .section-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.25);
      font-weight: 500;
      margin-bottom: 12px;
    }
    @media (max-width: 600px) {
      .doc-col { padding: 20px 16px; }
    }
  `;
}

// Safe HTML escaping — prevent XSS in rendered output
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
