/**
 * Shared helpers for the serverless form handlers (Vercel /api and Netlify functions).
 * Web-standard Request/Response so the same code runs on both hosts.
 */

export type Env = Record<string, string | undefined>;
export const env: Env = typeof process !== 'undefined' ? process.env : {};

export async function readForm(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = (await req.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(data)) out[k] = String(v ?? '').trim();
    return out;
  }
  const fd = await req.formData();
  for (const [k, v] of fd.entries()) if (typeof v === 'string') out[k] = v.trim();
  return out;
}

export const wantsJson = (req: Request) => (req.headers.get('accept') || '').includes('application/json');

/** JSON for fetch() callers; a 303 redirect for plain HTML form posts (no JavaScript). */
export function reply(req: Request, opts: { ok: boolean; error?: string; status?: number; redirect: string }) {
  if (wantsJson(req)) {
    return new Response(JSON.stringify({ ok: opts.ok, error: opts.error }), {
      status: opts.status ?? (opts.ok ? 200 : 400),
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  const url = opts.ok ? opts.redirect : `${opts.redirect}?error=${encodeURIComponent(opts.error || 'error')}`;
  return new Response(null, { status: 303, headers: { location: url } });
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;

/** US numbers to E.164 (+1XXXXXXXXXX); returns '' when it can't be parsed. */
export function toE164(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return '';
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const clip = (s: string | undefined, max = 500) => (s || '').slice(0, max);

export function clientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    undefined
  );
}

/**
 * Cloudflare Turnstile check. If TURNSTILE_SECRET_KEY isn't set (local dev,
 * or before launch) verification is skipped and logged, so forms still work.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('[forms] TURNSTILE_SECRET_KEY not set: skipping spam check');
    return true;
  }
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (err) {
    console.error('[forms] Turnstile verify failed', err);
    return false;
  }
}

/**
 * Send an email through Resend (https://resend.com). Swap this one function
 * to use Postmark, SendGrid, SES, etc.
 */
export async function sendEmail(msg: { to: string | string[]; subject: string; text: string; html: string; replyTo?: string }) {
  const key = env.RESEND_API_KEY;
  const from = env.FORMS_FROM_EMAIL || 'F.Y.C. / N.Y.C. Website <website@thefycnyc.com>';
  if (!key) {
    // Never silently drop a guest's inquiry in production: fail so the form shows the fallback email.
    const production = env.REQUIRE_EMAIL === 'true' || env.VERCEL_ENV === 'production' || env.CONTEXT === 'production';
    console.warn('[forms] RESEND_API_KEY not set: email not sent.\n', msg.subject, '\n', msg.text);
    return { ok: !production, skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      reply_to: msg.replyTo,
    }),
  });
  if (!res.ok) console.error('[forms] Resend error', res.status, await res.text().catch(() => ''));
  return { ok: res.ok, skipped: false };
}

/** Simple two-column HTML table for notification emails. */
export function emailTable(rows: [string, string][]) {
  const tr = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><th align="left" style="padding:6px 16px 6px 0;color:#6b665d;font:600 13px system-ui,sans-serif;vertical-align:top">${escapeHtml(k)}</th>` +
        `<td style="padding:6px 0;font:15px system-ui,sans-serif;color:#141414;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  return `<table cellpadding="0" cellspacing="0">${tr}</table>`;
}
