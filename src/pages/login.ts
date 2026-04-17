import {
  signIn,
  signOut,
  redirectByRole,
  completePasswordRecovery,
  clearPasswordRecoveryPending,
  isPasswordRecoveryPending,
  takeAuthNotice,
} from '../lib/auth.js'

const AUTH_SWITCH_KEY = 'smartmanage-auth-switch-intent'
const REMEMBER_USERNAME_KEY = 'smartmanage_remember_username'
const RESET_SUCCESS_KEY = 'smartmanage_password_reset_success'
const iconEye = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>`
const iconEyeOff = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a19.17 19.17 0 01-4.07 5.06"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6.61 6.62A19.03 19.03 0 002 12s3.5 7 10 7a10.9 10.9 0 005.23-1.32"/></svg>`
const iconMail = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l9 6 9-6"/></svg>`
const iconLock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2" ry="2" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V8a4 4 0 118 0v3"/></svg>`

function mapLoginError(err: unknown): string {
  const fallback = 'Kycja deshtoi.'
  if (!(err instanceof Error)) return fallback
  const msg = err.message || fallback
  const lower = msg.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'Email ose username, ose fjalekalimi, nuk eshte i sakte.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Verifiko emailin para kycjes.'
  }
  if (lower.includes('rate limit')) {
    return 'Shume tentativa. Prit pak dhe provo perseri.'
  }
  return msg
}

export function renderLogin(container: HTMLElement): void {
  const recoveryMode = isPasswordRecoveryPending()
  const switchIntent = sessionStorage.getItem(AUTH_SWITCH_KEY)
  if (switchIntent) sessionStorage.removeItem(AUTH_SWITCH_KEY)
  const enterClass = switchIntent ? `auth-enter auth-enter-to-login` : ''
  const panelTitle = recoveryMode ? 'Rikthe hyrjen pa humbur ritmin e dites' : 'Hyr dhe vazhdo rrjedhen e punes pa nderprerje'
  const panelCopy = recoveryMode
    ? 'Rivendos fjalekalimin dhe kthehu te mungesat, porosite dhe ekipi pa kaluar ne hapa te panevojshem.'
    : 'Mungesat, porosite dhe qasja e ekipit qendrojne te lidhura ne nje panel te vetem, me fokus te qarte ne operimin ditor.'

  container.innerHTML = `
    <div class="auth-neo-page">
      <div id="auth-shell" class="auth-neo-shell auth-neo-shell-login ${enterClass}">
        <section class="auth-neo-form">
          <div class="auth-card auth-neo-form-card">
            <div class="auth-simple-brand">
              <img src="/brand/smartmanage/logo.png" alt="SmartManage" width="34" height="34" class="rounded-full object-cover" />
              <span>SmartManage</span>
            </div>

            <header class="auth-header">
              <h1 class="auth-title">${recoveryMode ? 'Vendos fjalekalim te ri' : 'Kycu ne panel'}</h1>
              <p class="auth-subtitle">${recoveryMode ? 'Zgjidh fjalekalimin e ri per llogarine tende.' : 'Hyr dhe menaxho mungesat e dites pa kaluar ne menu te panevojshme.'}</p>
              <div class="auth-neo-inline-badges">
                ${
                  recoveryMode
                    ? '<span>Rikuperim i sigurt</span><span>Minimum 6 karaktere</span>'
                    : '<span>Realtime</span><span>Role te ndara</span><span>Porosi sipas furnitorit</span>'
                }
              </div>
            </header>

            <form id="login-form" class="auth-form auth-login-form">
              ${
                recoveryMode
                  ? `
              <div class="auth-field">
                <label for="password" class="auth-label">Fjalekalimi i ri</label>
                <div class="auth-password-wrap">
                  <span class="auth-input-icon" aria-hidden="true">${iconLock}</span>
                  <input type="password" id="password" name="password" required minlength="6" placeholder="Minimum 6 karaktere" autocomplete="new-password" class="auth-input auth-input-password auth-input-has-icon" />
                  <button type="button" id="toggle-login-password" class="auth-password-toggle" aria-label="Shfaq fjalekalimin" title="Shfaq/fshih fjalekalimin">${iconEye}</button>
                </div>
              </div>
              <div class="auth-field">
                <label for="password-confirm" class="auth-label">Perserite fjalekalimin</label>
                <div class="auth-input-with-icon">
                  <span class="auth-input-icon" aria-hidden="true">${iconLock}</span>
                  <input type="password" id="password-confirm" name="passwordConfirm" required minlength="6" placeholder="Perserite fjalekalimin" autocomplete="new-password" class="auth-input auth-input-has-icon" />
                </div>
              </div>
              `
                  : `
              <div class="auth-field">
                <label for="username" class="auth-label">Email ose username</label>
                <div class="auth-input-with-icon">
                  <span class="auth-input-icon" aria-hidden="true">${iconMail}</span>
                  <input type="text" id="username" name="username" required placeholder="Shkruaj email ose username" autocomplete="username" class="auth-input auth-input-has-icon" />
                </div>
              </div>
              <div class="auth-field">
                <label for="password" class="auth-label">Fjalekalimi</label>
                <div class="auth-password-wrap">
                  <span class="auth-input-icon" aria-hidden="true">${iconLock}</span>
                  <input type="password" id="password" name="password" required placeholder="••••••••" autocomplete="current-password" class="auth-input auth-input-password auth-input-has-icon" />
                  <button type="button" id="toggle-login-password" class="auth-password-toggle" aria-label="Shfaq fjalekalimin" title="Shfaq/fshih fjalekalimin">${iconEye}</button>
                </div>
              </div>
              <div class="auth-login-options">
                <label class="auth-remember">
                  <input type="checkbox" id="remember-me" />
                  <span>Ruaje username-in ne kete pajisje</span>
                </label>
              </div>
              `
              }
              <p id="login-error" class="auth-error" aria-live="polite"></p>
              <button type="submit" id="login-btn" class="auth-primary-button">${recoveryMode ? 'Ruaj fjalekalimin' : 'Kycu'}</button>
              <p class="auth-neo-footnote">
                ${
                  recoveryMode
                    ? 'Pas ruajtjes do te rikthehesh te faqja e kycjes.'
                    : 'Mund te hysh me email ose username. Nese e aktivizon opsionin siper, ruajme vetem username-in ne kete browser.'
                }
              </p>
            </form>
          </div>
        </section>

        <aside class="auth-neo-panel">
          <div class="auth-brand-pill">OPERIM DITOR</div>
          <h2 class="auth-neo-panel-title">${panelTitle}</h2>
          <p class="auth-neo-panel-copy auth-neo-panel-copy-min">
            ${panelCopy}
          </p>
          <ul class="auth-neo-panel-notes">
            <li>Mungesat shfaqen live dhe kalojne drejt te gjenerimi i porosive pa refresh manual.</li>
            <li>Qasja sipas rolit mban te paster rrjedhen e punes per owner, manager dhe worker.</li>
            <li>Te dhenat ndahen sipas kompanise qe ekipi te punoje pa konfuzion.</li>
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
              <strong>Live</strong>
              <span>Mungesat dhe porosite qendrojne te sinkronizuara ne te njejten rrjedhe.</span>
            </div>
            <div class="auth-neo-metric-card">
              <strong>Te pastra</strong>
              <span>Owner-i sheh panoramen, worker-i hyn drejt te veprimi.</span>
            </div>
            <div class="auth-neo-metric-card">
              <strong>Te ndara</strong>
              <span>Secila kompani sheh vetem te dhenat e veta.</span>
            </div>
          </div>
          <p class="auth-neo-panel-signature">${recoveryMode ? 'Rikuperim i sigurt i aksesit' : 'Projektuar per ritmin e farmacise'}</p>
          <p class="auth-neo-panel-tagline">${recoveryMode ? 'Akses i kthyer, rrjedhe e njejte' : 'Mungesat, porosite, ekipi'}</p>
          <p class="text-xs text-slate-500">${recoveryMode ? '' : 'Llogarite krijohen vetem nga administratori.'}</p>
        </aside>
      </div>
    </div>
  `

  const form = document.getElementById('login-form') as HTMLFormElement
  const errorEl = document.getElementById('login-error')!
  const btn = document.getElementById('login-btn') as HTMLButtonElement
  const usernameInput = document.getElementById('username') as HTMLInputElement | null
  const passwordInput = document.getElementById('password') as HTMLInputElement | null
  const passwordConfirmInput = document.getElementById('password-confirm') as HTMLInputElement | null
  const togglePasswordBtn = document.getElementById('toggle-login-password') as HTMLButtonElement | null
  const rememberMe = document.getElementById('remember-me') as HTMLInputElement | null
  const shell = document.getElementById('auth-shell')
  const authNotice = takeAuthNotice()

  const clearInputError = (...inputs: Array<HTMLInputElement | null>): void => {
    inputs.forEach((input) => input?.classList.remove('auth-input-error'))
  }
  const markInputError = (...inputs: Array<HTMLInputElement | null>): void => {
    inputs.forEach((input) => input?.classList.add('auth-input-error'))
  }
  const setError = (message: string): void => {
    errorEl.classList.remove('auth-error-success')
    errorEl.textContent = message
  }
  const setSuccess = (message: string): void => {
    errorEl.classList.add('auth-error-success')
    errorEl.textContent = message
  }

  if (shell?.classList.contains('auth-enter')) {
    requestAnimationFrame(() => {
      shell.classList.add('auth-enter-active')
    })
  }

  if (recoveryMode) {
    clearPasswordRecoveryPending()
  }

  if (!recoveryMode) {
    try {
      const remembered = localStorage.getItem(REMEMBER_USERNAME_KEY)
      if (remembered && usernameInput) {
        usernameInput.value = remembered
        if (rememberMe) rememberMe.checked = true
      }
    } catch {
    }
  } else {
    try {
      const success = sessionStorage.getItem(RESET_SUCCESS_KEY)
      if (success) {
        sessionStorage.removeItem(RESET_SUCCESS_KEY)
      }
    } catch {
    }
  }

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
    errorEl.classList.remove('auth-error-success')
    const usernameEl = form.querySelector('[name="username"]') as HTMLInputElement | null
    const passwordEl = form.querySelector('[name="password"]') as HTMLInputElement | null
    const passwordConfirmEl = form.querySelector('[name="passwordConfirm"]') as HTMLInputElement | null
    const username = (usernameEl?.value ?? '').trim()
    const password = passwordEl?.value ?? ''
    const passwordConfirm = passwordConfirmEl?.value ?? ''
    clearInputError(usernameEl, passwordEl, passwordConfirmEl)
    if (!recoveryMode && !username) {
      markInputError(usernameEl)
      setError('Shkruaj email ose username.')
      return
    }
    if (!recoveryMode && !username.includes('@') && !/^[a-z0-9._\-]{3,32}$/i.test(username)) {
      markInputError(usernameEl)
      setError('Username duhet te kete 3-32 karaktere dhe vetem a-z, 0-9, ., _, -.')
      return
    }
    if (recoveryMode) {
      if (password.length < 6) {
        markInputError(passwordEl, passwordConfirmEl)
        setError('Fjalekalimi duhet te kete te pakten 6 karaktere.')
        return
      }
      if (password !== passwordConfirm) {
        markInputError(passwordEl, passwordConfirmEl)
        setError('Fjalekalimet nuk perputhen.')
        return
      }
    }
    btn.disabled = true
    btn.classList.add('auth-btn-loading')
    const originalBtnLabel = btn.textContent
    btn.textContent = recoveryMode ? 'Duke ruajtur...' : 'Duke u kycur...'
    try {
      if (recoveryMode) {
        await completePasswordRecovery(password)
        try {
          sessionStorage.setItem(RESET_SUCCESS_KEY, '1')
        } catch {
        }
        await signOut()
        return
      }
      try {
        if (rememberMe?.checked) localStorage.setItem(REMEMBER_USERNAME_KEY, username)
        else localStorage.removeItem(REMEMBER_USERNAME_KEY)
      } catch {
      }
      const profile = await signIn(username, password)
      redirectByRole(profile.role)
    } catch (err) {
      markInputError(recoveryMode ? passwordEl : usernameEl, passwordEl, passwordConfirmEl)
      setError(recoveryMode ? (err instanceof Error ? err.message : 'Ruajtja e fjalekalimit deshtoi.') : mapLoginError(err))
      btn.disabled = false
      btn.textContent = originalBtnLabel
      btn.classList.remove('auth-btn-loading')
    }
  })

  usernameInput?.addEventListener('input', () => {
    clearInputError(usernameInput)
    errorEl.classList.remove('auth-error-success')
  })
  passwordInput?.addEventListener('input', () => {
    clearInputError(passwordInput)
    errorEl.classList.remove('auth-error-success')
  })
  passwordConfirmInput?.addEventListener('input', () => {
    clearInputError(passwordInput, passwordConfirmInput)
    errorEl.classList.remove('auth-error-success')
  })

  if (!recoveryMode) {
    try {
      const resetSuccess = sessionStorage.getItem(RESET_SUCCESS_KEY)
      if (resetSuccess) {
        sessionStorage.removeItem(RESET_SUCCESS_KEY)
        setSuccess('Fjalekalimi u ndryshua. Tani kycu me fjalekalimin e ri.')
      }
    } catch {
    }
    if (authNotice === 'session-conflict') {
      setError('Kjo llogari u hap ne nje pajisje tjeter. Kycu perseri vetem nese do ta perdorish ketu.')
    } else if (authNotice === 'inactive-user') {
      setError('Ky perdorues eshte joaktiv. Kontakto administratorin.')
    }
  }
}
