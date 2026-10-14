/**
 * Progressive enhancement for forms marked [data-enhance].
 * Without JS the form posts normally to its action (the serverless function
 * redirects back with ?sent=1). With JS: inline errors, multi-step, fetch submit.
 *
 * Markup contract:
 *   <div class="field"> <label for="x"> <input id="x" aria-describedby="x-error"> </div>
 *   <span class="field-error" id="x-error"></span>
 *   [data-step] wrappers for multi-step forms; [data-next] / [data-back] buttons
 *   [data-form-status] role="alert" region; [data-success] panel (hidden)
 */
import { track } from './analytics';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const MSG = {
  required: (f: Field) => f.dataset.msgRequired || 'This one is required.',
  email: 'That email doesn’t look quite right. Try name@example.com.',
  tel: 'Enter a 10-digit phone number.',
  pattern: (f: Field) => f.dataset.msgPattern || 'Check the format.',
};

function errorEl(f: Field) {
  const id = f.getAttribute('aria-describedby')?.split(' ').find((x) => x.endsWith('-error'));
  return id ? document.getElementById(id) : null;
}

function setError(f: Field, msg: string) {
  const box = f.closest('.field, .choice-group') as HTMLElement | null;
  const err = errorEl(f);
  if (msg) {
    f.setAttribute('aria-invalid', 'true');
    box?.setAttribute('data-invalid', '');
  } else {
    f.removeAttribute('aria-invalid');
    box?.removeAttribute('data-invalid');
  }
  if (err) err.textContent = msg;
}

function validateField(f: Field, form: HTMLFormElement): string {
  if (f.disabled || f.type === 'hidden' || f.closest('.hp')) return '';
  const v = (f.value || '').trim();

  // Checkbox groups (e.g. occasion chips) handled via data-group-required on the first input
  if (f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio')) {
    if (f.dataset.groupRequired !== undefined) {
      const any = form.querySelectorAll<HTMLInputElement>(`input[name="${f.name}"]:checked`).length > 0;
      return any ? '' : MSG.required(f);
    }
    if (f.required && !f.checked) return MSG.required(f);
    return '';
  }

  if (f.required && !v) return MSG.required(f);
  if (!v) return '';
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return MSG.email;
  if (f.type === 'tel' && v.replace(/\D/g, '').replace(/^1/, '').length !== 10) return MSG.tel;
  if (f instanceof HTMLInputElement && f.pattern && !new RegExp(`^(?:${f.pattern})$`).test(v)) return MSG.pattern(f);
  return '';
}

/** Join-specific rule: texts need both a number and the consent box */
function smsRule(form: HTMLFormElement): [Field, string] | null {
  const mobile = form.querySelector<HTMLInputElement>('[data-sms-number]');
  const consent = form.querySelector<HTMLInputElement>('[data-sms-consent]');
  if (!mobile || !consent) return null;
  if (mobile.value.trim() && !consent.checked) return [consent, 'Tick the box to get texts, or leave your mobile number blank.'];
  if (consent.checked && !mobile.value.trim()) return [mobile, 'Add your mobile number to get texts.'];
  return null;
}

function validateScope(scope: HTMLElement, form: HTMLFormElement): Field[] {
  const bad: Field[] = [];
  const seenGroups = new Set<string>();
  scope.querySelectorAll<Field>('input, select, textarea').forEach((f) => {
    if (f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio') && f.dataset.groupRequired === undefined) {
      if (seenGroups.has(f.name) && !f.required) return;
    }
    if (f instanceof HTMLInputElement && f.dataset.groupRequired !== undefined) seenGroups.add(f.name);
    const msg = validateField(f, form);
    if (!(f instanceof HTMLInputElement && f.type === 'checkbox' && f.dataset.smsConsent !== undefined)) setError(f, msg);
    if (msg) bad.push(f);
  });
  const sms = scope.contains(form.querySelector('[data-sms-number]')) ? smsRule(form) : null;
  const consent = form.querySelector<HTMLInputElement>('[data-sms-consent]');
  if (consent && scope.contains(consent)) setError(consent, '');
  if (sms) {
    setError(sms[0], sms[1]);
    bad.push(sms[0]);
  }
  return bad;
}

function showStep(form: HTMLFormElement, index: number) {
  const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')];
  steps.forEach((s, i) => {
    s.hidden = i !== index;
  });
  form.dataset.currentStep = String(index);
  form.querySelectorAll<HTMLElement>('[data-step-label]').forEach((el) => {
    el.textContent = `Step ${index + 1} of ${steps.length}`;
  });
  const heading = steps[index]?.querySelector<HTMLElement>('[data-step-heading]');
  heading?.focus();
}

async function submit(form: HTMLFormElement) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]:not([hidden])');
  const success = form.dataset.success ? document.getElementById(form.dataset.success) : null;
  const done = () => {
    track(form.dataset.trackSubmit || 'form_submit', { form: form.id });
    if (success) {
      form.hidden = true;
      success.hidden = false;
      success.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
    } else if (status) {
      status.textContent = 'Thanks! You’re on the list.';
    }
  };

  // Honeypot: bots get a quiet "success"
  const hp = form.querySelector<HTMLInputElement>('.hp input');
  if (hp && hp.value) return done();

  if (btn) {
    btn.disabled = true;
    btn.dataset.label = btn.textContent || '';
    btn.textContent = 'Sending…';
  }
  if (status) status.textContent = '';
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Request failed');
    done();
  } catch (err) {
    if (status) {
      const fallback = form.dataset.fallback || '';
      status.textContent = `Sorry, that didn’t go through. Please try again${fallback ? `, or ${fallback}` : ''}.`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || 'Send';
    }
  }
}

export function initForms(root: ParentNode = document) {
  const serverError = new URLSearchParams(location.search).get('error');
  root.querySelectorAll<HTMLFormElement>('form[data-enhance]').forEach((form) => {
    if (form.dataset.ready) return;
    form.dataset.ready = '1';
    form.noValidate = true;
    // Coming back from a no-JS post that failed (?error=...)
    if (serverError && form.matches('#inquiry, #join-page, #catering')) {
      const st = form.querySelector<HTMLElement>('[data-form-status]');
      if (st) st.textContent = serverError;
    }

    const steps = form.querySelectorAll<HTMLElement>('[data-step]');
    if (steps.length > 1) showStepSilently(form);

    // Clear an error as soon as it's fixed
    form.addEventListener('input', (e) => {
      const f = e.target as Field;
      if (f.getAttribute('aria-invalid') === 'true' && !validateField(f, form)) setError(f, '');
    });
    form.addEventListener('change', (e) => {
      let f = e.target as Field;
      // Radio/checkbox groups keep their error on the first input of the group
      if (f instanceof HTMLInputElement && (f.type === 'radio' || f.type === 'checkbox')) {
        f = form.querySelector<HTMLInputElement>(`input[name="${f.name}"][data-group-required]`) ?? f;
      }
      if (f.getAttribute('aria-invalid') === 'true' && !validateField(f, form)) setError(f, '');
    });

    form.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const next = t.closest('[data-next]');
      const back = t.closest('[data-back]');
      const cur = Number(form.dataset.currentStep || 0);
      if (next) {
        e.preventDefault();
        const bad = validateScope(steps[cur], form);
        if (bad.length) return bad[0].focus();
        showStep(form, cur + 1);
      } else if (back) {
        e.preventDefault();
        showStep(form, cur - 1);
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = validateScope(form, form);
      if (bad.length) {
        // On a multi-step form, jump to the step holding the first error
        const stepEl = bad[0].closest<HTMLElement>('[data-step]');
        if (stepEl && stepEl.hidden) showStep(form, [...steps].indexOf(stepEl));
        bad[0].focus();
        return;
      }
      submit(form);
    });
  });
}

function showStepSilently(form: HTMLFormElement) {
  const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')];
  steps.forEach((s, i) => (s.hidden = i !== 0));
  form.dataset.currentStep = '0';
}
