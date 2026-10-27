/** POST /api/join: "Join the Family" newsletter (email) and optional text signup. */
import { readForm, reply, isEmail, toE164, clientIp, verifyTurnstile } from './http';
import { addSubscriber } from './subscribers';

const CONSENT_TEXT =
  'By checking the box, you agree to receive recurring automated marketing texts from F.Y.C. / N.Y.C. at the number provided. ' +
  'Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help. Consent isn’t a condition of purchase.';

export async function handleJoin(req: Request): Promise<Response> {
  let data: Record<string, string>;
  try {
    data = await readForm(req);
  } catch {
    return reply(req, { ok: false, error: 'Bad request', redirect: '/join/' });
  }
  if (data.company_site) return reply(req, { ok: true, redirect: '/join/thanks/' }); // honeypot

  if (!(await verifyTurnstile(data['cf-turnstile-response'], clientIp(req)))) {
    return reply(req, { ok: false, status: 403, error: 'Spam check failed. Please try again.', redirect: '/join/' });
  }

  const email = (data.email || '').toLowerCase();
  if (!isEmail(email)) return reply(req, { ok: false, error: 'Enter a valid email address', redirect: '/join/' });

  const phone = data.mobile ? toE164(data.mobile) : '';
  if (data.mobile && !phone) return reply(req, { ok: false, error: 'Enter a 10-digit US mobile number', redirect: '/join/' });
  const smsConsent = data.sms_consent === 'yes';
  if (phone && !smsConsent) return reply(req, { ok: false, error: 'Check the box to receive texts, or leave mobile blank', redirect: '/join/' });

  const result = await addSubscriber({
    email,
    phone: phone || undefined,
    smsConsent: Boolean(phone && smsConsent),
    source: (data.source || 'website').slice(0, 40),
    consentText: CONSENT_TEXT,
    ip: clientIp(req),
  });
  if (!result.ok) {
    console.error('[join] provider error', result.detail);
    return reply(req, { ok: false, status: 502, error: 'We couldn’t sign you up right now', redirect: '/join/' });
  }
  return reply(req, { ok: true, redirect: '/join/thanks/' });
}
