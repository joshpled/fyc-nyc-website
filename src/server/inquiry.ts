/**
 * POST /api/inquiry — private event (and catering) inquiries.
 * Emails the events inbox with the guest as reply-to.
 *
 * Env:
 *   RESEND_API_KEY         email delivery (required in production)
 *   EVENTS_TO_EMAIL        defaults to events@thefycnyc.com
 *   FORMS_FROM_EMAIL       verified sender, e.g. "F.Y.C. / N.Y.C. <website@thefycnyc.com>"
 *   TURNSTILE_SECRET_KEY   Cloudflare Turnstile secret
 */
import { readForm, reply, isEmail, toE164, clip, clientIp, verifyTurnstile, sendEmail, emailTable, env } from './http';

const REDIRECTS: Record<string, string> = {
  private_event: '/private-events/thanks/',
  catering: '/catering/thanks/',
};

function fmtDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export async function handleInquiry(req: Request): Promise<Response> {
  let data: Record<string, string>;
  try {
    data = await readForm(req);
  } catch {
    return reply(req, { ok: false, error: 'Bad request', redirect: '/private-events/' });
  }
  const type = data.type === 'catering' ? 'catering' : 'private_event';
  const back = type === 'catering' ? '/catering/' : '/private-events/';

  // Honeypot: pretend it worked
  if (data.website_url) return reply(req, { ok: true, redirect: REDIRECTS[type] });

  // Spam check
  if (!(await verifyTurnstile(data['cf-turnstile-response'], clientIp(req)))) {
    return reply(req, { ok: false, status: 403, error: 'Spam check failed. Please try again.', redirect: back });
  }

  // Validate
  const missing = ['name', 'email', 'phone', 'date', 'guests'].filter((k) => !data[k]);
  if (type === 'private_event') missing.push(...['occasion', 'budget'].filter((k) => !data[k]));
  if (missing.length) return reply(req, { ok: false, error: `Missing: ${missing.join(', ')}`, redirect: back });
  if (!isEmail(data.email)) return reply(req, { ok: false, error: 'Invalid email', redirect: back });
  const phone = toE164(data.phone) || clip(data.phone, 40);

  const label = type === 'catering' ? 'Catering inquiry' : 'Event inquiry';
  const subject = `${label}: ${clip(data.occasion || data.service || 'event', 60)}, ${clip(data.guests, 20)} guests, ${fmtDate(data.date)}${data.flexible ? ' (flexible)' : ''}`;
  const rows: [string, string][] = [
    ['Name', clip(data.name, 120)],
    ['Email', clip(data.email, 254)],
    ['Phone', phone],
    ['Company', clip(data.company, 160)],
    ['Date', `${fmtDate(data.date)}${data.flexible ? ' (flexible)' : ''}`],
    ['Guests', clip(data.guests, 20)],
    ['Occasion', clip(data.occasion, 60)],
    ['Service', clip(data.service, 60)],
    ['Budget per guest', clip(data.budget, 40)],
    ['Notes', clip(data.notes, 2000)],
    ['Source', clip(data.source || 'website', 60)],
  ];
  const text = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `<p style="font:15px system-ui,sans-serif">New ${label.toLowerCase()} from thefycnyc.com. Reply to this email to answer the guest directly.</p>${emailTable(rows)}`;

  const sent = await sendEmail({
    to: (env.EVENTS_TO_EMAIL || 'events@thefycnyc.com').split(',').map((s) => s.trim()),
    subject,
    text,
    html,
    replyTo: data.email,
  });
  if (!sent.ok) return reply(req, { ok: false, status: 502, error: 'Could not send right now', redirect: back });

  return reply(req, { ok: true, redirect: REDIRECTS[type] });
}
