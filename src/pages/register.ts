import { signUp, redirectByRole } from '../lib/auth.js'
import type { UserRole } from '../types.js'

const AUTH_SWITCH_KEY = 'smartmanage-auth-switch-intent'
const iconEye = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>`
const iconEyeOff = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a19.17 19.17 0 01-4.07 5.06"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6.61 6.62A19.03 19.03 0 002 12s3.5 7 10 7a10.9 10.9 0 005.23-1.32"/></svg>`

function mapRegisterError(err: unknown): string {
  const fallback = 'Regjistrimi deshtoi.'
  if (!(err instanceof Error)) return fallback
  const msg = err.message || fallback
  const lower = msg.toLowerCase()

  if (lower.includes('email rate limit exceeded')) {
    return 'Keni bere shume tentativa me email. Prit 1-2 minuta, pastaj provo perseri ose kycu nese llogaria eshte krijuar.'
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'Ky email ekziston. Provo kycjen.'
  }
  return msg
}

function animateAuthSwitch(targetHash: string): void {
  const shell = document.getElementById('auth-shell')
  sessionStorage.setItem(AUTH_SWITCH_KEY, 'to-login')
  if (!shell) {
    window.location.hash = targetHash
    return
  }
  shell.classList.add('auth-switch-to-login')
  shell.classList.add('auth-switching')
  window.setTimeout(() => {
    window.location.hash = targetHash
  }, 300)
}

export function renderRegister(container: HTMLElement): void {
  const switchIntent = sessionStorage.getItem(AUTH_SWITCH_KEY)
  if (switchIntent) sessionStorage.removeItem(AUTH_SWITCH_KEY)
  const enterClass = switchIntent ? `auth-enter auth-enter-to-register` : ''

  container.innerHTML = `
    <div class="auth-neo-page">
      <div id="auth-shell" class="auth-neo-shell auth-neo-shell-register ${enterClass}">
        <section class="auth-neo-form">
          <div class="auth-card auth-neo-form-card">
            <div class="auth-simple-brand">
              <img src="/brand/smartmanage/logo.png" alt="SmartManage" width="34" height="34" class="rounded-full object-cover" />
              <span>SmartManage</span>
            </div>

            <header class="auth-header">
              <h1 class="auth-title">Krijo llogarine</h1>
              <p class="auth-subtitle">Nis me nje hyrje te paster dhe zgjidh rolin me te cilin do te punosh.</p>
              <div class="auth-neo-inline-badges">
                <span>Owner</span>
                <span>Worker</span>
                <span>Bootstrap i kompanise</span>
              </div>
            </header>

            <form id="register-form" class="auth-form">
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="auth-field">
                  <label for="reg-first-name" class="auth-label">Emri</label>
                  <input type="text" id="reg-first-name" name="firstName" required placeholder="Emri" autocomplete="given-name" class="auth-input" />
                </div>
                <div class="auth-field">
                  <label for="reg-last-name" class="auth-label">Mbiemri</label>
                  <input type="text" id="reg-last-name" name="lastName" required placeholder="Mbiemri" autocomplete="family-name" class="auth-input" />
                </div>
              </div>
              <div class="auth-field">
                <label for="reg-email" class="auth-label">Email</label>
                <input type="email" id="reg-email" name="email" required placeholder="Shkruaj email-in" autocomplete="email" class="auth-input" />
              </div>
              <div class="auth-field">
                <label for="reg-password" class="auth-label">Fjalekalim</label>
                <div class="auth-password-wrap">
                  <input type="password" id="reg-password" name="password" required minlength="6" placeholder="Minimum 6 karaktere" autocomplete="new-password" class="auth-input auth-input-password" />
                  <button type="button" id="toggle-register-password" class="auth-password-toggle" aria-label="Shfaq fjalekalimin" title="Shfaq/fshih fjalekalimin">${iconEye}</button>
                </div>
              </div>
              <div class="auth-field">
                <label for="reg-role" class="auth-label">Roli</label>
                <select id="reg-role" name="role" required class="auth-input">
                  <option value="">Zgjidh rolin</option>
                  <option value="WORKER">Puntori</option>
                  <option value="OWNER">Pronari</option>
                </select>
              </div>
              <p id="register-error" class="auth-error" aria-live="polite"></p>
              <button type="submit" id="register-btn" class="auth-primary-button">Krijo llogarine</button>
              <p class="auth-neo-footnote">Pronari bootstrap-on kompanine e pare ne hyrjen e pare; pjesa tjeter e ekipit menaxhohet nga Settings.</p>
              <p class="auth-switch-inline">Ke llogari? <button type="button" id="btn-kycu-inline" class="auth-switch-link">Kycu</button></p>
            </form>
          </div>
        </section>

        <aside class="auth-neo-panel">
          <div class="auth-brand-pill">SETUP I PARE</div>
          <h2 class="auth-neo-panel-title">Krijo hyrjen, cakto rolin dhe vazhdo drejt panelit te duhur</h2>
          <p class="auth-neo-panel-copy auth-neo-panel-copy-min">
            Owner-i vendos bazen e kompanise, worker-i hyn drejt te mungesat, dhe rrjedha e ekipit mbetet e qarte qe ne hapin e pare.
          </p>
          <ul class="auth-neo-panel-notes">
            <li>Pronari merr kompanine e pare automatikisht ne hyrjen e pare ne aplikacion.</li>
            <li>Worker-i ridrejtohet drejt panelit te mungesave pa kaluar ne seksione te panevojshme.</li>
            <li>Ekipi i plote shtohet me vone nga Settings me role dhe akses te ndare.</li>
          </ul>
          <div class="auth-neo-side-art" aria-hidden="true">
            <div class="auth-neo-preview-top"><span></span><span></span><span></span></div>
            <div class="auth-neo-preview-kpis"><div></div><div></div><div></div></div>
            <div class="auth-neo-preview-table">
              <span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div class="auth-neo-panel-metrics">
            <div class="auth-neo-metric-card">
              <strong>Owner</strong>
              <span>Krijon bazen e kompanise dhe shikon panoramen e plote.</span>
            </div>
            <div class="auth-neo-metric-card">
              <strong>Worker</strong>
              <span>Hyn drejt te mungesat me nje UI me te shpejte dhe pa zhurme.</span>
            </div>
            <div class="auth-neo-metric-card">
              <strong>Flow</strong>
              <span>Setup-i fillestar mbetet i lehte, por i sakte per perdorim real.</span>
            </div>
          </div>
          <p class="auth-neo-panel-signature">Qasje e qarte qe ne hyrjen e pare</p>
          <p class="auth-neo-panel-tagline">Role, kompani, ritm pune</p>
          <button type="button" id="btn-kycu" class="auth-neo-panel-btn">Kthehu te kycja</button>
        </aside>
      </div>
    </div>
  `

  const form = document.getElementById('register-form') as HTMLFormElement
  const errorEl = document.getElementById('register-error')!
  const btn = document.getElementById('register-btn') as HTMLButtonElement
  const btnKycu = document.getElementById('btn-kycu')!
  const btnKycuInline = document.getElementById('btn-kycu-inline') as HTMLButtonElement | null
  const passwordInput = document.getElementById('reg-password') as HTMLInputElement | null
  const togglePasswordBtn = document.getElementById('toggle-register-password') as HTMLButtonElement | null
  const emailInput = document.getElementById('reg-email') as HTMLInputElement | null
  const roleInput = document.getElementById('reg-role') as HTMLSelectElement | null
  const shell = document.getElementById('auth-shell')

  const clearInputError = (...inputs: Array<HTMLInputElement | HTMLSelectElement | null>): void => {
    inputs.forEach((input) => input?.classList.remove('auth-input-error'))
  }
  const markInputError = (...inputs: Array<HTMLInputElement | HTMLSelectElement | null>): void => {
    inputs.forEach((input) => input?.classList.add('auth-input-error'))
  }

  if (shell?.classList.contains('auth-enter')) {
    requestAnimationFrame(() => {
      shell.classList.add('auth-enter-active')
    })
  }

  btnKycu.addEventListener('click', () => {
    animateAuthSwitch('#/kycu')
  })
  btnKycuInline?.addEventListener('click', () => {
    animateAuthSwitch('#/kycu')
  })

  togglePasswordBtn?.addEventListener('click', () => {
    if (!passwordInput) return
    const isPassword = passwordInput.type === 'password'
    passwordInput.type = isPassword ? 'text' : 'password'
    togglePasswordBtn.innerHTML = isPassword ? iconEyeOff : iconEye
    togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Fshih fjalekalimin' : 'Shfaq fjalekalimin')
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.textContent = ''
    btn.disabled = true
    const firstNameEl = form.querySelector('[name="firstName"]') as HTMLInputElement | null
    const lastNameEl = form.querySelector('[name="lastName"]') as HTMLInputElement | null
    const emailEl = form.querySelector('[name="email"]') as HTMLInputElement | null
    const passwordEl = form.querySelector('[name="password"]') as HTMLInputElement | null
    const firstName = (firstNameEl?.value ?? '').trim()
    const lastName = (lastNameEl?.value ?? '').trim()
    const email = (emailEl?.value ?? '').trim()
    const password = passwordEl?.value ?? ''
    const roleEl = form.querySelector('[name="role"]') as HTMLSelectElement | null
    const role = (roleEl?.value ?? '') as UserRole
    clearInputError(emailEl, passwordEl, roleEl)
    if (!email.includes('@')) {
      markInputError(emailEl)
      errorEl.textContent = 'Shkruaj nje email valid.'
      btn.disabled = false
      return
    }
    if (!role) {
      markInputError(roleEl)
      errorEl.textContent = 'Zgjidh rolin.'
      btn.disabled = false
      return
    }
    try {
      const result = await signUp(email, password, role, firstName, lastName)
      if (result.emailConfirmationRequired) {
        errorEl.textContent = 'Llogaria u krijua. Verifiko emailin, pastaj kycu.'
        btn.disabled = false
        window.setTimeout(() => {
          window.location.hash = '#/kycu'
        }, 1200)
        return
      }
      redirectByRole(result.role)
    } catch (err) {
      markInputError(emailEl, passwordEl, roleEl)
      errorEl.textContent = mapRegisterError(err)
      btn.disabled = false
    }
  })

  emailInput?.addEventListener('input', () => clearInputError(emailInput))
  passwordInput?.addEventListener('input', () => clearInputError(passwordInput))
  roleInput?.addEventListener('change', () => clearInputError(roleInput))
}
