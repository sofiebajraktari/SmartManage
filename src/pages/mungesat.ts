import { getProfile, signOut } from '../lib/auth.js'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import {
  addMungese,
  getProducts,
  getTodayShortages,
  type ProductView,
  type ShortageView,
} from '../lib/data.js'
import { rankProductsForWorkerSearch } from '../lib/fuzzyProductSearch.js'

const iconLogout = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>`
const iconSearch = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 117.5-7.5 7.5 7.5 0 01-7.5 7.5z" /></svg>`
const iconMenu = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>`

type WorkerSection = 'mungesat'

function compareWorkerText(a: string, b: string): number {
  return a.localeCompare(b, 'sq-AL', { sensitivity: 'base', numeric: true })
}

function renderResults(results: ProductView[]): string {
  if (!results.length) {
    return `<div class="premium-empty">
      <div class="premium-empty-title">Nuk u gjet asnje produkt</div>
      <p class="premium-empty-copy">Kontrollo drejtshkrimin ose provo me nje emer alternativ.</p>
    </div>`
  }

  return `
    <div class="worker-results-list">
      ${results
        .map(
          (p) => `
        <button type="button" class="worker-result-card select-product" data-id="${p.id}">
          <div class="worker-result-copy">
            <div class="worker-result-title">${p.name}</div>
            <div class="worker-result-subtitle">${p.supplierName || 'Pa furnitor te lidhur'}</div>
          </div>
          <div class="worker-result-meta">
            <span class="worker-result-pill">${p.category === 'barna' ? 'Barna' : 'Front'}</span>
            <span class="worker-result-action">Shto</span>
          </div>
        </button>`
        )
        .join('')}
    </div>
  `
}

function renderMissingList(missingItems: ShortageView[]): string {
  if (!missingItems.length) {
    return `<div class="premium-empty">
      <div class="premium-empty-title">Nuk ka mungesa per sot</div>
      <p class="premium-empty-copy">Gjendja eshte e stabilizuar per momentin. Kur te shtosh nje mungese, do ta shohesh menjehere ketu.</p>
    </div>`
  }

  const orderedItems = [...missingItems].sort((a, b) => {
    const urgentDiff = Number(b.urgent) - Number(a.urgent)
    if (urgentDiff !== 0) return urgentDiff
    return compareWorkerText(String(a.productName ?? ''), String(b.productName ?? ''))
  })

  return `
    <div class="worker-missing-stack">
      ${orderedItems
        .map(
          (item) => `
        <article class="worker-missing-card">
          <div class="worker-missing-card-main">
            <div class="worker-missing-card-top">
              <div>
                <h3 class="worker-missing-product">${item.productName}</h3>
                <p class="worker-missing-supplier">${item.supplierName || 'Pa furnitor te caktuar'}</p>
              </div>
              ${
                item.urgent
                  ? '<span class="worker-missing-status worker-missing-status-urgent">Urgjent</span>'
                  : '<span class="worker-missing-status worker-missing-status-normal">Normal</span>'
              }
            </div>
            <p class="worker-missing-note ${item.note ? '' : 'worker-missing-note-muted'}">${item.note || 'Pa shenim shtese.'}</p>
          </div>
          <div class="worker-missing-meta">
            <span class="worker-missing-pill">x${item.addedCount}</span>
            <span class="worker-missing-chip">Sot</span>
          </div>
        </article>`
        )
        .join('')}
    </div>
  `
}

export function renderMungesat(container: HTMLElement, _routeSection = 'mungesat'): void {
  const section: WorkerSection = 'mungesat'
  const active = (key: WorkerSection): string => (section === key ? 'premium-nav-link active' : 'premium-nav-link')
  let allProducts: ProductView[] = []
  let currentMatches: ProductView[] = []
  let currentUserId = ''

  function showToast(message: string): void {
    const existing = document.getElementById('worker-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'worker-toast'
    toast.className =
      'fixed bottom-4 right-4 z-50 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg'
    toast.textContent = message
    document.body.appendChild(toast)
    window.setTimeout(() => toast.remove(), 1600)
  }

  container.innerHTML = `
    <div id="worker-shell" class="premium-shell">
      <aside id="worker-sidebar" class="premium-sidebar premium-drawer flex flex-col justify-between px-4 py-5">
        <div>
          <div class="mb-6 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="w-9 h-9 rounded-2xl bg-white flex items-center justify-center shadow">
                <img src="/brand/smartmanage/logo.png" alt="SmartManage logo" class="w-7 h-7 rounded-full object-cover" />
              </div>
              <span class="text-sm font-semibold text-slate-900">SmartManage</span>
            </div>
            <button type="button" id="worker-nav-toggle" class="premium-nav-toggle worker-nav-toggle-btn shrink-0" aria-label="Hap menune" aria-expanded="true">
              ${iconMenu}
            </button>
          </div>
          <nav class="space-y-1 text-sm">
            <a href="#/mungesat" class="${active('mungesat')}"><span class="premium-nav-dot"></span>Mungesat</a>
          </nav>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
          <div id="worker-account-initial" class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">P</div>
          <div class="text-xs">
            <div id="worker-account-name" class="text-slate-900 font-medium">Perdorues</div>
            <div id="worker-account-role" class="text-slate-500 text-[11px]">Llogari</div>
          </div>
        </div>
      </aside>
      <div id="worker-sidebar-backdrop" class="premium-sidebar-backdrop hidden"></div>
      <button
        type="button"
        id="worker-logo-reopen"
        class="worker-logo-reopen hidden"
        aria-label="Hap menune"
        title="Hap menune"
      >
        <img src="/brand/smartmanage/logo.png" alt="SmartManage" class="h-6 w-6 rounded-full object-cover" />
      </button>

      <main class="premium-main worker-main px-4 py-4 md:px-6 md:py-5">
        <header class="premium-header worker-page-header mb-5">
          <div class="worker-header-layout flex flex-wrap items-start justify-between gap-3">
            <div class="worker-header-title flex min-w-0 items-center gap-3">
              <div class="min-w-0">
                <p class="text-xs uppercase tracking-wide text-slate-500">Paneli i dites</p>
                <h1 class="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Regjistro mungesat pa humbur ritmin</h1>
                <p class="mt-1 text-sm text-slate-600">Kerkimi, urgjenca dhe lista e sotme jane ne nje rrjedhe te vetme, me fokus te qarte te veprimi.</p>
              </div>
            </div>
            <div class="worker-header-actions flex items-center gap-2">
              <button type="button" data-theme-toggle="1" class="theme-toggle-chip rounded-full px-2.5 py-1 text-[11px] font-semibold"></button>
              <button type="button" id="btn-signout" class="premium-btn-ghost inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
                ${iconLogout}
                Dil
              </button>
            </div>
          </div>
        </header>

        <section class="premium-hero worker-stage mb-4">
          <div>
            <p class="premium-hero-kicker">Rrjedha e ekipit</p>
            <h2 class="premium-hero-title">Nga kerkimi te shtimi me nje klik</h2>
            <p class="premium-hero-copy">Kliko nga sugjerimet per shtim te menjehershem. Nese del vetem nje rezultat, mund te shtosh edhe me Enter.</p>
          </div>
          <div class="premium-hero-chips">
            <span class="premium-chip">Sugjerime live</span>
            <span class="premium-chip">Urgjente ne fokus</span>
            <span class="premium-chip">Te dhena per kompani</span>
          </div>
        </section>

        <section class="${section === 'mungesat' ? '' : 'hidden '}premium-card worker-composer-card mb-4 p-5">
          <div class="worker-composer-grid">
            <div class="worker-composer-main">
              <div class="worker-section-heading">
                <span class="worker-section-eyebrow">Hapi 1</span>
                <h2 class="worker-section-title">Kerko dhe shto produktin</h2>
                <p class="worker-section-copy">Shkruaj emrin e produktit, vendos nese eshte urgjent dhe zgjidhe direkt nga rezultatet me poshte.</p>
              </div>

              <div class="space-y-3">
                <div>
                  <label for="search-bar" class="sr-only">Kerko produktin</label>
                  <div class="premium-top-search worker-top-search">
                    <span class="premium-top-search-icon">${iconSearch}</span>
                    <input id="search-bar" type="text" autocomplete="off" placeholder="Kerko barin ose emrin alternativ..." class="premium-top-search-input" aria-label="Kerko produktin" />
                  </div>
                </div>

                <div class="worker-entry-controls worker-entry-strip">
                  <label class="worker-urgent-toggle">
                    <input id="urgent-toggle" type="checkbox" class="h-4 w-4 rounded border-slate-300 bg-white text-red-500 focus:ring-blue-500" />
                    <span>Urgjent</span>
                  </label>
                  <input id="note-input" type="text" placeholder="Shto nje shenim te shkurter (opsionale)" class="premium-input worker-note-input" aria-label="Shenim opsional" />
                </div>

                <p class="worker-inline-hint">Sugjerimet shfaqen menjehere. Kliko kartelen e produktit per ta shtuar ne listen e sotme.</p>
                <div id="search-results"></div>
              </div>
            </div>

            <aside class="worker-summary-panel">
              <span class="worker-section-eyebrow">Pamja e dites</span>
              <div class="worker-stat-grid">
                <article class="worker-stat-card">
                  <span class="worker-stat-label">Mungesa sot</span>
                  <strong id="worker-stat-total" class="worker-stat-value">0</strong>
                  <p class="worker-stat-copy">Mungesat e shtuara nga llogaria jote sot.</p>
                </article>
                <article class="worker-stat-card">
                  <span class="worker-stat-label">Katalogu</span>
                  <strong id="worker-stat-products" class="worker-stat-value">0</strong>
                  <p class="worker-stat-copy">Produkte te disponueshme per kerkimin e shpejte.</p>
                </article>
                <article class="worker-stat-card worker-stat-card-alert">
                  <span class="worker-stat-label">Urgjente</span>
                  <strong id="worker-stat-urgent" class="worker-stat-value">0</strong>
                  <p class="worker-stat-copy">Raste qe duhen trajtuar me perparesi ne panel.</p>
                </article>
              </div>
              <div class="worker-summary-tip">
                Pas shtimit, lista e sotme rifreskohet automatikisht dhe urgjentet dalin lart per t'u pare me shpejt.
              </div>
            </aside>
          </div>
        </section>

        <section class="${section === 'mungesat' ? '' : 'hidden '}premium-card p-5">
          <div class="worker-list-head">
            <div>
              <span class="worker-section-eyebrow">Hapi 2</span>
              <h2 class="text-base font-semibold text-slate-900">Lista e mungesave per sot</h2>
              <p class="mt-1 text-sm text-slate-600">Urgjentet shfaqen lart, qe te mos humbin ne liste.</p>
            </div>
            <span class="worker-list-date">${new Date().toLocaleDateString('sq-AL')}</span>
          </div>
          <div id="missing-list">
            ${renderMissingList([])}
          </div>
        </section>
      </main>
    </div>
  `

  document.getElementById('btn-signout')!.addEventListener('click', () => signOut())
  const navToggle = document.getElementById('worker-nav-toggle') as HTMLButtonElement | null
  const navLogoReopen = document.getElementById('worker-logo-reopen') as HTMLButtonElement | null
  const shell = document.getElementById('worker-shell') as HTMLElement | null
  const sidebar = document.getElementById('worker-sidebar') as HTMLElement | null
  const sidebarBackdrop = document.getElementById('worker-sidebar-backdrop') as HTMLDivElement | null

  const syncNavReopenVisibility = (): void => {
    if (!shell || !sidebar || !navLogoReopen) return
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    const sidebarOpen = isDesktop
      ? !shell.classList.contains('sidebar-collapsed')
      : sidebar.classList.contains('drawer-open')
    navLogoReopen.classList.toggle('hidden', sidebarOpen)
    navLogoReopen.setAttribute('aria-expanded', sidebarOpen ? 'true' : 'false')
  }

  const setSidebarOpen = (open: boolean): void => {
    if (!sidebar || !sidebarBackdrop || !shell) return
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) {
      shell.classList.toggle('sidebar-collapsed', !open)
      sidebar.classList.remove('drawer-open')
      sidebarBackdrop.classList.add('hidden')
      document.body.classList.remove('overflow-hidden')
      navToggle?.setAttribute('aria-expanded', open ? 'true' : 'false')
      syncNavReopenVisibility()
      return
    }
    sidebar.classList.toggle('drawer-open', open)
    sidebarBackdrop.classList.toggle('hidden', !open)
    document.body.classList.toggle('overflow-hidden', open)
    navToggle?.setAttribute('aria-expanded', open ? 'true' : 'false')
    syncNavReopenVisibility()
  }

  const closeSidebarOnMobile = (): void => {
    if (!window.matchMedia('(min-width: 768px)').matches) {
      setSidebarOpen(false)
    }
  }

  const sidebarNavLinks = Array.from(sidebar?.querySelectorAll<HTMLAnchorElement>('a[href^="#/"]') ?? [])
  sidebarNavLinks.forEach((link) => {
    link.addEventListener('click', closeSidebarOnMobile)
  })

  navToggle?.addEventListener('click', () => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    const currentlyOpen = isDesktop
      ? !Boolean(shell?.classList.contains('sidebar-collapsed'))
      : Boolean(sidebar?.classList.contains('drawer-open'))
    setSidebarOpen(!currentlyOpen)
  })
  navLogoReopen?.addEventListener('click', () => setSidebarOpen(true))
  sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false))
  window.addEventListener('resize', () => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) {
      sidebar?.classList.remove('drawer-open')
      sidebarBackdrop?.classList.add('hidden')
      document.body.classList.remove('overflow-hidden')
    }
    syncNavReopenVisibility()
  })
  syncNavReopenVisibility()

  const searchInput = document.getElementById('search-bar') as HTMLInputElement
  const urgentToggle = document.getElementById('urgent-toggle') as HTMLInputElement
  const noteInput = document.getElementById('note-input') as HTMLInputElement
  const resultsDiv = document.getElementById('search-results') as HTMLDivElement
  const missingListDiv = document.getElementById('missing-list') as HTMLDivElement
  const statTotal = document.getElementById('worker-stat-total') as HTMLParagraphElement | null
  const statProducts = document.getElementById('worker-stat-products') as HTMLParagraphElement | null
  const statUrgent = document.getElementById('worker-stat-urgent') as HTMLParagraphElement | null
  const accountInitial = document.getElementById('worker-account-initial') as HTMLDivElement | null
  const accountName = document.getElementById('worker-account-name') as HTMLDivElement | null
  const accountRole = document.getElementById('worker-account-role') as HTMLDivElement | null

  const applyAccountInfo = (name: string, roleLabel: string): void => {
    if (accountName) accountName.textContent = name
    if (accountRole) accountRole.textContent = roleLabel
    if (accountInitial) {
      const first = (name || roleLabel).trim().charAt(0).toUpperCase()
      accountInitial.textContent = first || 'P'
    }
  }

  async function loadAccountInfo(): Promise<void> {
    if (!isSupabaseConfigured) {
      applyAccountInfo('Perdorues', 'Demo')
      return
    }

    try {
      const [{ data: sessionData }, profile] = await Promise.all([supabase.auth.getSession(), getProfile()])
      const user = sessionData.session?.user
      currentUserId = String(user?.id ?? '').trim()
      const firstName = String(user?.user_metadata?.first_name ?? '').trim()
      const lastName = String(user?.user_metadata?.last_name ?? '').trim()
      const email = String(user?.email ?? '').trim()
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
      const usernameMeta = String(user?.user_metadata?.username ?? '').trim()
      let profileUsername = ''
      if (user?.id) {
        const profileRes = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
        if (!profileRes.error && profileRes.data) {
          profileUsername = String((profileRes.data as { username?: unknown }).username ?? '').trim()
        }
      }
      const usernameFromEmail = email.includes('@') ? email.split('@')[0]?.trim() ?? '' : ''
      const visibleUsername = profileUsername || usernameMeta || usernameFromEmail
      const roleLabel = profile?.role === 'OWNER' ? 'Pronari' : 'Puntori'
      applyAccountInfo(visibleUsername || fullName || roleLabel, roleLabel)
    } catch {
      applyAccountInfo('Perdorues', 'Llogari')
    }
  }

  async function refreshMissingList(): Promise<void> {
    const items = await getTodayShortages()
    let visibleItems = items
    if (isSupabaseConfigured) {
      let userId = currentUserId
      if (!userId) {
        const sessionRes = await supabase.auth.getSession()
        userId = String(sessionRes.data.session?.user?.id ?? '').trim()
        currentUserId = userId
      }
      if (userId) {
        visibleItems = items.filter((row) => String(row.createdById ?? '').trim() === userId)
      }
    }
    missingListDiv.innerHTML = renderMissingList(visibleItems)
    if (statTotal) statTotal.textContent = String(visibleItems.length)
    if (statUrgent) statUrgent.textContent = String(visibleItems.filter((row) => row.urgent).length)
  }

  async function addSelectedProduct(productId: string): Promise<void> {
    const incomingNote = noteInput.value.trim()
    const incomingUrgent = urgentToggle.checked

    try {
      await addMungese(productId, incomingUrgent, incomingNote)
    } catch {
      showToast('Shtimi deshtoi.')
      return
    }

    searchInput.value = ''
    urgentToggle.checked = false
    noteInput.value = ''
    currentMatches = []
    resultsDiv.innerHTML = ''
    await refreshMissingList()
    showToast('Mungesa u shtua.')
  }

  function updateResults(): void {
    const query = searchInput.value.trim()
    if (!query) {
      currentMatches = []
      resultsDiv.innerHTML = ''
      return
    }

    currentMatches = rankProductsForWorkerSearch(allProducts, query, 8)
    resultsDiv.innerHTML = renderResults(currentMatches)

    const buttons = resultsDiv.querySelectorAll<HTMLButtonElement>('button.select-product')
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (!id) return
        void addSelectedProduct(id)
      })
    })
  }

  const handleSearchEnter = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return
    if (currentMatches.length === 1) {
      event.preventDefault()
      void addSelectedProduct(currentMatches[0].id)
      return
    }
    if (currentMatches.length > 1) {
      event.preventDefault()
      showToast('Ka disa rezultate. Zgjidh njerin nga sugjerimet.')
    }
  }

  searchInput.addEventListener('input', updateResults)
  searchInput.addEventListener('keydown', handleSearchEnter)

  getProducts().then((products) => {
    allProducts = products
    if (statProducts) statProducts.textContent = String(products.length)
    updateResults()
  })

  void loadAccountInfo()
  void refreshMissingList()
}
