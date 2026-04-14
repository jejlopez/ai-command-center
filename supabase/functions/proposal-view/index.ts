import { createClient } from 'npm:@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // GET — serve the proposal presentation
  if (req.method === 'GET') {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('*')
      .eq('share_token', token)
      .maybeSingle();

    if (!proposal) {
      return new Response('Proposal not found', { status: 404 });
    }

    // Track view
    await supabase.from('proposal_views').insert({
      proposal_id: proposal.id,
      ip_address: req.headers.get('x-forwarded-for') ?? 'unknown',
      user_agent: req.headers.get('user-agent') ?? 'unknown',
    });

    // Update view count
    await supabase.from('proposals').update({
      view_count: (proposal.view_count ?? 0) + 1,
      viewed_at: new Date().toISOString(),
    }).eq('id', proposal.id);

    // Render the presentation HTML
    const html = renderProposal(proposal);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // POST — handle client response (accept / request changes / decline)
  if (req.method === 'POST') {
    const body = await req.json();
    const { action, notes, signature } = body;

    if (!['accepted', 'changes_requested', 'declined'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, deal_id, user_id, company_name')
      .eq('share_token', token)
      .maybeSingle();

    if (!proposal) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    // Capture IP server-side and attach to signature record
    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

    const signatureRecord = action === 'accepted' && signature ? {
      name: signature.name ?? '',
      title: signature.title ?? '',
      company: signature.company ?? proposal.company_name ?? '',
      agreed: signature.agreed ?? false,
      signed_at: signature.signed_at ?? new Date().toISOString(),
      ip_address: ipAddress,
    } : null;

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      client_response: action,
      client_notes: notes ?? null,
      responded_at: new Date().toISOString(),
      status: action === 'accepted' ? 'accepted' : action === 'declined' ? 'rejected' : 'sent',
    };
    if (signatureRecord) updatePayload.signature = signatureRecord;

    await supabase.from('proposals').update(updatePayload).eq('id', proposal.id);

    // Create a jarvis_suggestion to notify the user
    const sigNote = signatureRecord ? ` (signed by ${signatureRecord.name}, ${signatureRecord.title})` : '';
    await supabase.from('jarvis_suggestions').insert({
      user_id: proposal.user_id,
      type: 'proposal_response',
      suggestion: `${proposal.company_name} ${action === 'accepted' ? 'ACCEPTED' : action === 'declined' ? 'DECLINED' : 'requested changes on'} your proposal${sigNote}${notes ? `: "${notes}"` : ''}`,
      context: { proposal_id: proposal.id, deal_id: proposal.deal_id, action, notes, signature: signatureRecord },
    });

    // If accepted, update deal stage to closed_won
    if (action === 'accepted' && proposal.deal_id) {
      await supabase.from('deals').update({
        stage: 'closed_won',
        last_touch: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', proposal.deal_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
});

function renderProposal(p: any): string {
  const pricing = p.pricing ?? {};
  const lanes = p.lanes ?? [];
  const services = p.services ?? [];
  const terms = p.terms ?? {};
  const viewUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/proposal-view`;

  const laneRows = lanes.map((l: any) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #1a1f2e;">${l.origin ?? ''} → ${l.destination ?? ''}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #1a1f2e;text-align:right;">${l.volume ?? ''} shipments</td>
      <td style="padding:12px 16px;border-bottom:1px solid #1a1f2e;text-align:right;">$${(l.rate ?? 0).toFixed(2)}/mi</td>
      <td style="padding:12px 16px;border-bottom:1px solid #1a1f2e;text-align:right;">$${(l.per_shipment ?? 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const accessorialRows = (pricing.accessorials ?? []).map((a: any) => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #1a1f2e;">${a.name}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #1a1f2e;text-align:right;">$${(a.amount ?? 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const serviceList = services.map((s: any) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;">
      <div style="width:20px;height:20px;border-radius:50%;background:rgba(0,224,208,0.15);display:grid;place-items:center;font-size:12px;color:#00E0D0;">✓</div>
      <span>${s}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposal — ${p.company_name ?? p.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0f1117;
      color: rgba(255,255,255,0.85);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
    .glass {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      backdrop-filter: blur(12px);
    }
    .hero {
      text-align: center;
      padding: 48px 32px;
      border: 1px solid rgba(0,224,208,0.2);
      box-shadow: 0 0 40px rgba(0,224,208,0.05);
    }
    .hero h1 {
      font-family: 'Sora', sans-serif;
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }
    .hero .subtitle {
      font-size: 16px;
      color: rgba(255,255,255,0.5);
    }
    .hero .date {
      font-size: 12px;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-top: 16px;
    }
    .section-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.3);
      font-weight: 500;
      margin-bottom: 12px;
    }
    h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .summary { font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.65); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(255,255,255,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    th:last-child, td:last-child { text-align: right; }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      margin-top: 16px;
      border-radius: 12px;
      background: rgba(0,224,208,0.08);
      border: 1px solid rgba(0,224,208,0.15);
    }
    .total-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.5); }
    .total-value { font-family: 'Sora', sans-serif; font-size: 24px; font-weight: 700; color: #00E0D0; }
    .monthly-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 16px;
    }
    .monthly-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.04);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .monthly-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.3); margin-bottom: 8px; }
    .monthly-card .value { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 600; }
    .services-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
    .terms-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 14px; }
    .terms-grid .term-label { font-size: 11px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.1em; }
    .terms-grid .term-value { margin-top: 4px; color: rgba(255,255,255,0.75); }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .btn {
      flex: 1;
      padding: 14px 24px;
      border-radius: 12px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Inter', sans-serif;
    }
    .btn-accept {
      background: rgba(0,224,208,0.15);
      color: #00E0D0;
      border: 1px solid rgba(0,224,208,0.3);
    }
    .btn-accept:hover { background: rgba(0,224,208,0.25); }
    .btn-changes {
      background: rgba(255,179,64,0.1);
      color: #FFB340;
      border: 1px solid rgba(255,179,64,0.2);
    }
    .btn-changes:hover { background: rgba(255,179,64,0.2); }
    .response-form {
      display: none;
      margin-top: 16px;
    }
    .response-form textarea {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      resize: vertical;
      min-height: 80px;
      outline: none;
    }
    .response-form textarea:focus { border-color: rgba(0,224,208,0.3); }
    .response-form button {
      margin-top: 12px;
      padding: 10px 24px;
      border-radius: 10px;
      border: none;
      background: rgba(0,224,208,0.15);
      color: #00E0D0;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .sig-form {
      display: none;
      margin-top: 20px;
      padding: 24px;
      border-radius: 16px;
      background: rgba(0,224,208,0.04);
      border: 1px solid rgba(0,224,208,0.15);
    }
    .sig-form h3 {
      font-size: 15px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      margin-bottom: 4px;
    }
    .sig-form .sig-subtitle {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 20px;
    }
    .sig-form input {
      width: 100%;
      padding: 11px 14px;
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.85);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      outline: none;
      margin-bottom: 10px;
    }
    .sig-form input:focus { border-color: rgba(0,224,208,0.3); }
    .sig-form .agree-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin: 16px 0;
      padding: 14px;
      border-radius: 10px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .sig-form .agree-row input[type=checkbox] {
      width: 16px;
      height: 16px;
      min-width: 16px;
      margin: 0;
      margin-top: 1px;
      cursor: pointer;
      accent-color: #00E0D0;
    }
    .sig-form .agree-label {
      font-size: 12px;
      color: rgba(255,255,255,0.6);
      line-height: 1.5;
    }
    .btn-sign {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: none;
      background: rgba(0,224,208,0.15);
      color: #00E0D0;
      border: 1px solid rgba(0,224,208,0.3);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: background 0.2s;
    }
    .btn-sign:hover { background: rgba(0,224,208,0.25); }
    .btn-sign:disabled { opacity: 0.4; cursor: not-allowed; }
    .success-msg {
      display: none;
      text-align: center;
      padding: 48px 24px;
      color: #00E0A0;
      font-size: 16px;
    }
    .footer {
      text-align: center;
      padding: 32px;
      font-size: 11px;
      color: rgba(255,255,255,0.2);
    }
    @media (max-width: 600px) {
      .monthly-grid { grid-template-columns: 1fr; }
      .services-grid { grid-template-columns: 1fr; }
      .terms-grid { grid-template-columns: 1fr; }
      .actions { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="glass hero">
      <div class="section-label">Logistics Proposal</div>
      <h1>${p.company_name ?? p.name ?? 'Proposal'}</h1>
      <div class="subtitle">Prepared for ${p.client_name ?? p.company_name ?? 'Client'}</div>
      <div class="date">${new Date(p.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · v${p.version ?? 1}</div>
    </div>

    ${p.executive_summary ? `
    <div class="glass">
      <div class="section-label">Executive Summary</div>
      <div class="summary">${p.executive_summary}</div>
    </div>
    ` : ''}

    ${lanes.length > 0 ? `
    <div class="glass">
      <div class="section-label">Lane Pricing</div>
      <table>
        <thead>
          <tr>
            <th>Lane</th>
            <th style="text-align:right">Volume</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">Per Shipment</th>
          </tr>
        </thead>
        <tbody>${laneRows}</tbody>
      </table>
      ${pricing.fuel_surcharge_pct ? `<div style="margin-top:12px;font-size:12px;color:rgba(255,255,255,0.4);">Fuel surcharge: ${pricing.fuel_surcharge_pct}% included in rates</div>` : ''}
    </div>
    ` : ''}

    ${accessorialRows ? `
    <div class="glass">
      <div class="section-label">Accessorial Charges</div>
      <table>
        <thead><tr><th>Service</th><th style="text-align:right">Charge</th></tr></thead>
        <tbody>${accessorialRows}</tbody>
      </table>
    </div>
    ` : ''}

    <div class="glass">
      <div class="section-label">Cost Summary</div>
      <div class="total-row">
        <div class="total-label">Per Shipment</div>
        <div class="total-value">$${(pricing.total_per_shipment ?? 0).toLocaleString()}</div>
      </div>
      ${pricing.monthly_cost ? `
      <div class="monthly-grid">
        <div class="monthly-card">
          <div class="label">Monthly Volume</div>
          <div class="value" style="color:rgba(255,255,255,0.75);">${pricing.monthly_shipments ?? 0}</div>
        </div>
        <div class="monthly-card">
          <div class="label">Monthly Cost</div>
          <div class="value" style="color:#00E0D0;">$${(pricing.monthly_cost ?? 0).toLocaleString()}</div>
        </div>
        <div class="monthly-card">
          <div class="label">Annual Projection</div>
          <div class="value" style="color:#00E0A0;">$${(pricing.annual_projection ?? 0).toLocaleString()}</div>
        </div>
      </div>
      ` : ''}
    </div>

    ${services.length > 0 ? `
    <div class="glass">
      <div class="section-label">Services Included</div>
      <div class="services-grid">${serviceList}</div>
    </div>
    ` : ''}

    ${Object.keys(terms).length > 0 ? `
    <div class="glass">
      <div class="section-label">Terms</div>
      <div class="terms-grid">
        ${terms.valid_until ? `<div><div class="term-label">Valid Until</div><div class="term-value">${terms.valid_until}</div></div>` : ''}
        ${terms.payment ? `<div><div class="term-label">Payment Terms</div><div class="term-value">${terms.payment}</div></div>` : ''}
        ${terms.minimum ? `<div><div class="term-label">Minimum Volume</div><div class="term-value">${terms.minimum}</div></div>` : ''}
        ${terms.contract_length ? `<div><div class="term-label">Contract Length</div><div class="term-value">${terms.contract_length}</div></div>` : ''}
      </div>
    </div>
    ` : ''}

    <div class="glass" id="response-section">
      <div class="section-label">Your Response</div>
      <div id="action-buttons" class="actions">
        <button class="btn btn-accept" onclick="showSignatureForm()">Accept Proposal</button>
        <button class="btn btn-changes" onclick="showChangesForm()">Request Changes</button>
      </div>

      <!-- Signature capture form — shown when "Accept Proposal" is clicked -->
      <div id="sig-form" class="sig-form">
        <h3>Sign & Accept Proposal</h3>
        <div class="sig-subtitle">This constitutes a legally binding agreement under the ESIGN Act.</div>
        <input type="text" id="sig-name" placeholder="Full legal name" autocomplete="name" />
        <input type="text" id="sig-title" placeholder="Title / Role (e.g. VP Operations)" autocomplete="organization-title" />
        <input type="text" id="sig-company" placeholder="Company" value="${p.company_name ?? ''}" autocomplete="organization" />
        <div class="agree-row">
          <input type="checkbox" id="sig-agree" onchange="updateSignBtn()" />
          <label class="agree-label" for="sig-agree">
            I agree to the terms outlined in this proposal and understand this constitutes a legally binding agreement under the ESIGN Act.
          </label>
        </div>
        <button class="btn-sign" id="sign-btn" disabled onclick="submitSignature()">Sign &amp; Accept</button>
      </div>

      <div id="changes-form" class="response-form">
        <textarea id="client-notes" placeholder="What changes would you like?"></textarea>
        <button onclick="respond('changes_requested', null)">Submit Feedback</button>
      </div>
      <div id="success" class="success-msg">
        <div id="success-content"></div>
      </div>
    </div>

    <div class="footer">
      Powered by JARVIS OS · Proposal ID: ${p.share_token}
    </div>
  </div>

  <script>
    function showSignatureForm() {
      document.getElementById('action-buttons').style.display = 'none';
      document.getElementById('sig-form').style.display = 'block';
    }

    function showChangesForm() {
      document.getElementById('changes-form').style.display = 'block';
    }

    function updateSignBtn() {
      const agreed = document.getElementById('sig-agree').checked;
      const name = document.getElementById('sig-name').value.trim();
      document.getElementById('sign-btn').disabled = !(agreed && name.length > 0);
    }

    // Enable sign button when name is filled in too
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('sig-name').addEventListener('input', updateSignBtn);
    });

    async function submitSignature() {
      const name    = document.getElementById('sig-name').value.trim();
      const title   = document.getElementById('sig-title').value.trim();
      const company = document.getElementById('sig-company').value.trim();
      const agreed  = document.getElementById('sig-agree').checked;

      if (!name || !agreed) {
        alert('Please enter your full legal name and check the agreement box.');
        return;
      }

      const btn = document.getElementById('sign-btn');
      btn.disabled = true;
      btn.textContent = 'Signing...';

      await respond('accepted', null, {
        name,
        title,
        company,
        agreed,
        signed_at: new Date().toISOString(),
        // ip_address captured server-side
      });
    }

    async function respond(action, notes, signature) {
      const clientNotes = notes ?? document.getElementById('client-notes')?.value ?? '';
      const payload = { action, notes: clientNotes || null };
      if (signature) payload.signature = signature;

      try {
        await fetch('${viewUrl}?token=${p.share_token}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        document.getElementById('action-buttons').style.display = 'none';
        document.getElementById('sig-form').style.display = 'none';
        document.getElementById('changes-form').style.display = 'none';

        const successEl = document.getElementById('success');
        const contentEl = document.getElementById('success-content');

        if (action === 'accepted' && signature) {
          const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          contentEl.innerHTML = \`
            <div style="font-size:48px;margin-bottom:16px;">✓</div>
            <h2 style="font-size:20px;font-weight:700;color:#fff;margin-bottom:8px;">Proposal Accepted &amp; Signed</h2>
            <p style="color:rgba(255,255,255,0.6);margin-bottom:4px;">Signed by \${signature.name}\${signature.title ? ', ' + signature.title : ''}\${signature.company ? ' at ' + signature.company : ''}</p>
            <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-bottom:16px;">\${date}</p>
            <p style="font-size:12px;color:rgba(255,255,255,0.25);">A copy has been sent to your sales representative.</p>
          \`;
        } else {
          contentEl.innerHTML = '<div style="font-size:32px;margin-bottom:12px;">✓</div><p>Thank you — your response has been recorded.</p>';
        }

        successEl.style.display = 'block';
      } catch (e) {
        alert('Failed to submit response. Please try again.');
        const btn = document.getElementById('sign-btn');
        if (btn) { btn.disabled = false; btn.textContent = 'Sign & Accept'; }
      }
    }
  </script>
</body>
</html>`;
}
