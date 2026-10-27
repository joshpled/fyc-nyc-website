/**
 * Email/SMS provider adapter for "Join the Family". F.Y.C. uses Mailchimp.
 * Pick one with SUBSCRIBER_PROVIDER = klaviyo | mailchimp | email. If it's unset,
 * Mailchimp is used whenever MAILCHIMP_API_KEY is set.
 *
 *   klaviyo    KLAVIYO_API_KEY (private key), KLAVIYO_LIST_ID
 *   mailchimp  MAILCHIMP_API_KEY (ends in -usX), MAILCHIMP_LIST_ID
 *   email      (default) sends each signup to JOIN_TO_EMAIL (or info@) for
 *              manual import, e.g. into Toast Marketing, which has no public
 *              signup API. Needs RESEND_API_KEY like the other forms.
 *
 * NOTE: the Klaviyo adapter follows Klaviyo's documented API but hasn't been
 * run against a live account.
 */
import { createHash } from 'node:crypto';
import { env, sendEmail, emailTable } from './http';

export interface Subscriber {
  email: string;
  phone?: string; // E.164
  smsConsent: boolean;
  source: string;
  consentText: string;
  ip?: string;
}

type Result = { ok: boolean; detail?: string };

async function klaviyo(s: Subscriber): Promise<Result> {
  const key = env.KLAVIYO_API_KEY;
  const list = env.KLAVIYO_LIST_ID;
  if (!key || !list) return { ok: false, detail: 'KLAVIYO_API_KEY / KLAVIYO_LIST_ID missing' };
  const headers = {
    authorization: `Klaviyo-API-Key ${key}`,
    revision: '2024-10-15',
    'content-type': 'application/vnd.api+json',
    accept: 'application/vnd.api+json',
  };
  // 1) Upsert profile with source
  await fetch('https://a.klaviyo.com/api/profile-import', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        type: 'profile',
        attributes: {
          email: s.email,
          ...(s.phone ? { phone_number: s.phone } : {}),
          properties: { signup_source: s.source },
        },
      },
    }),
  });
  // 2) Subscribe with explicit consent per channel
  const subscriptions: Record<string, unknown> = { email: { marketing: { consent: 'SUBSCRIBED' } } };
  if (s.phone && s.smsConsent) subscriptions.sms = { marketing: { consent: 'SUBSCRIBED' } };
  const res = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          custom_source: `Website: ${s.source}`,
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: { email: s.email, ...(s.phone && s.smsConsent ? { phone_number: s.phone } : {}), subscriptions },
              },
            ],
          },
        },
        relationships: { list: { data: { type: 'list', id: list } } },
      },
    }),
  });
  return { ok: res.ok, detail: res.ok ? undefined : `Klaviyo ${res.status}` };
}

/** "+12125551234" → "(212) 555-1234", the format Mailchimp's US phone field accepts */
function usPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

/**
 * Mailchimp: adds or updates the contact in MAILCHIMP_LIST_ID (single opt-in).
 * - Mobile goes in the audience's PHONE field, with the tag "SMS opt-in" and a
 *   note recording when and how the guest agreed to texts. Mailchimp's
 *   members API can't set SMS consent directly, so texting through Mailchimp
 *   SMS means building the SMS audience from that tag (see README).
 * - Every signup is tagged "Website" plus where it came from (home, join_page).
 * - Someone who unsubscribed before is re-added as "pending", so Mailchimp
 *   sends them a confirmation email first (its rule, not ours).
 */
async function mailchimp(s: Subscriber): Promise<Result> {
  const key = env.MAILCHIMP_API_KEY;
  const list = env.MAILCHIMP_LIST_ID;
  if (!key || !list) return { ok: false, detail: 'MAILCHIMP_API_KEY / MAILCHIMP_LIST_ID missing' };
  const dc = key.split('-')[1];
  if (!dc) return { ok: false, detail: 'MAILCHIMP_API_KEY should end in -usX' };
  const base = `https://${dc}.api.mailchimp.com/3.0/lists/${list}/members/${createHash('md5').update(s.email.toLowerCase()).digest('hex')}`;
  const headers = {
    authorization: `Basic ${Buffer.from(`fyc:${key}`).toString('base64')}`,
    'content-type': 'application/json',
  };
  const call = (path: string, method: string, body: unknown) =>
    fetch(`${base}${path}`, { method, headers, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const why = async (res: Response) => {
    const j = (await res.json().catch(() => ({}))) as {
      title?: string;
      detail?: string;
      errors?: { field?: string; message?: string }[];
    };
    const fields = (j.errors ?? []).map((e) => `${e.field ?? '?'}: ${e.message ?? ''}`).join('; ');
    return `Mailchimp ${res.status}: ${j.title ?? ''} ${j.detail ?? ''}${fields ? ` [${fields}]` : ''}`.trim();
  };

  const member = (status: 'subscribed' | 'pending', withPhone: boolean) => ({
    email_address: s.email,
    status_if_new: status,
    ...(status === 'pending' ? { status: 'pending' } : {}),
    ...(withPhone && s.phone ? { merge_fields: { PHONE: usPhone(s.phone) } } : {}),
    ...(s.ip ? { ip_signup: s.ip } : {}),
  });

  // skip_merge_validation: the audience may require fields this form doesn't ask for (e.g. name)
  const put = '?skip_merge_validation=true';
  let res = await call(put, 'PUT', member('subscribed', true));
  if (!res.ok) {
    const detail = await why(res);
    if (/compliance state/i.test(detail)) {
      // Previously unsubscribed: Mailchimp only allows a confirmation email
      res = await call(put, 'PUT', member('pending', true));
    } else if (s.phone && res.status === 400) {
      // Audience Phone field rejected the number: keep the email signup; the number stays in the note
      console.error('[join]', detail);
      res = await call(put, 'PUT', member('subscribed', false));
    } else {
      return { ok: false, detail };
    }
    if (!res.ok) return { ok: false, detail: await why(res) };
  }

  // Tags and the consent note are extras: a failure here doesn't fail the signup
  const tags = [{ name: 'Website', status: 'active' }, { name: `Source: ${s.source}`, status: 'active' }];
  if (s.phone && s.smsConsent) tags.push({ name: 'SMS opt-in', status: 'active' });
  const extras = [call('/tags', 'POST', { tags })];
  if (s.phone && s.smsConsent) {
    extras.push(
      call('/notes', 'POST', {
        note: `SMS opt-in on the website (${s.source}) ${new Date().toISOString()}, mobile ${s.phone}${s.ip ? `, IP ${s.ip}` : ''}. Consent text shown: "${s.consentText}"`,
      }),
    );
  }
  for (const r of await Promise.allSettled(extras)) {
    if (r.status === 'rejected') console.error('[join] Mailchimp extra', r.reason);
    else if (!r.value.ok) console.error('[join]', await why(r.value));
  }
  return { ok: true };
}

async function emailFallback(s: Subscriber): Promise<Result> {
  const rows: [string, string][] = [
    ['Email', s.email],
    ['Mobile', s.phone || ''],
    ['SMS consent', s.smsConsent ? `Yes, ${new Date().toISOString()}` : 'No'],
    ['Source', s.source],
    ['Consent text shown', s.smsConsent ? s.consentText : ''],
  ];
  const r = await sendEmail({
    to: (env.JOIN_TO_EMAIL || 'info@thefycnyc.com').split(',').map((x) => x.trim()),
    subject: `New Join the Family signup: ${s.email}`,
    text: rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: `<p style="font:15px system-ui,sans-serif">Add this guest to the list in your email/SMS tool.</p>${emailTable(rows)}`,
  });
  return { ok: r.ok };
}

export async function addSubscriber(s: Subscriber): Promise<Result> {
  const provider = (env.SUBSCRIBER_PROVIDER || (env.MAILCHIMP_API_KEY ? 'mailchimp' : 'email')).toLowerCase();
  if (provider === 'klaviyo') return klaviyo(s);
  if (provider === 'mailchimp') return mailchimp(s);
  return emailFallback(s);
}
