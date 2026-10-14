/**
 * Email/SMS provider adapter for "Join the Family" (open question Q7).
 * Pick one with SUBSCRIBER_PROVIDER = klaviyo | mailchimp | email
 *
 *   klaviyo    KLAVIYO_API_KEY (private key), KLAVIYO_LIST_ID
 *   mailchimp  MAILCHIMP_API_KEY (ends in -usX), MAILCHIMP_LIST_ID
 *   email      (default) sends each signup to JOIN_TO_EMAIL (or info@) for
 *              manual import, e.g. into Toast Marketing, which has no public
 *              signup API. Needs RESEND_API_KEY like the other forms.
 *
 * NOTE: the Klaviyo and Mailchimp adapters follow their documented APIs but
 * haven't been run against live accounts yet. Test with a real key before launch.
 */
import { createHash } from 'node:crypto';
import { env, sendEmail, emailTable } from './http';

export interface Subscriber {
  email: string;
  phone?: string; // E.164
  smsConsent: boolean;
  birthday?: string; // MM/DD
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
  // 1) Upsert profile with birthday + source
  await fetch('https://a.klaviyo.com/api/profile-import', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        type: 'profile',
        attributes: {
          email: s.email,
          ...(s.phone ? { phone_number: s.phone } : {}),
          properties: { birthday_mmdd: s.birthday || undefined, signup_source: s.source },
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

async function mailchimp(s: Subscriber): Promise<Result> {
  const key = env.MAILCHIMP_API_KEY;
  const list = env.MAILCHIMP_LIST_ID;
  if (!key || !list) return { ok: false, detail: 'MAILCHIMP_API_KEY / MAILCHIMP_LIST_ID missing' };
  const dc = key.split('-')[1];
  const hash = createHash('md5').update(s.email.toLowerCase()).digest('hex');
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${list}/members/${hash}`, {
    method: 'PUT',
    headers: {
      authorization: `Basic ${Buffer.from(`fyc:${key}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email_address: s.email,
      status_if_new: 'subscribed',
      merge_fields: {
        ...(s.birthday ? { BIRTHDAY: s.birthday } : {}),
        ...(s.phone ? { PHONE: s.phone } : {}),
      },
      ...(s.ip ? { ip_signup: s.ip } : {}),
      tags: [`source:${s.source}`, ...(s.smsConsent ? ['sms-consent'] : [])],
    }),
  });
  return { ok: res.ok, detail: res.ok ? undefined : `Mailchimp ${res.status}` };
}

async function emailFallback(s: Subscriber): Promise<Result> {
  const rows: [string, string][] = [
    ['Email', s.email],
    ['Mobile', s.phone || ''],
    ['SMS consent', s.smsConsent ? `Yes, ${new Date().toISOString()}` : 'No'],
    ['Birthday', s.birthday || ''],
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
  const provider = (env.SUBSCRIBER_PROVIDER || 'email').toLowerCase();
  if (provider === 'klaviyo') return klaviyo(s);
  if (provider === 'mailchimp') return mailchimp(s);
  return emailFallback(s);
}
