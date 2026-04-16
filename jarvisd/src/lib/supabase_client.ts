// Supabase REST client for jarvisd skills.
// Skills run in the daemon (Node), not the browser, so we use fetch directly.

const SUPA_URL = process.env.VITE_SUPABASE_URL || 'https://bqlmkaapurfxdmqcuvla.supabase.co';
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Jjcla78M8S4zf38QLDIIVw_ecSnMXDs';

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Accept': 'application/json',
    ...extra,
  };
}

export async function supaFetch<T = any>(table: string, query = ''): Promise<T[]> {
  if (!SUPA_URL || !SUPA_KEY) return [];
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function supaInsert(table: string, data: any): Promise<boolean> {
  if (!SUPA_URL || !SUPA_KEY) return false;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: headers({
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      }),
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function supaUpdate(table: string, filter: string, data: any): Promise<boolean> {
  if (!SUPA_URL || !SUPA_KEY) return false;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: headers({
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      }),
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function supaUpsert(table: string, data: any, onConflict: string): Promise<boolean> {
  if (!SUPA_URL || !SUPA_KEY) return false;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: headers({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    return res.ok;
  } catch {
    return false;
  }
}
