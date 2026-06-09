# SmartManage - Kërkesa Funksionale dhe Jo-Funksionale

## 1. KËRKESA FUNKSIONALE (FR)

### 1.1 Autentifikimi dhe Autorizimi

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-1.1.1 | Sistemi duhet të lejojë login të përdoruesve me email dhe fjalëkalim | A |
| FR-1.1.2 | Sistemi duhet të mbështesë tre role të ndryshme: OWNER, MANAGER, WORKER | A |
| FR-1.1.3 | Sistemi duhet të parandalojë aksesin e përdoruesve të paautentifikuar në rute të mbrojtura | A |
| FR-1.1.4 | Sistemi duhet të lejojë logout të përdoruesve | A |
| FR-1.1.5 | Sistemi duhet të mbajë sesionin aktiv ndaj rifreskimit të faqes | A |
| FR-1.1.6 | OWNER duhet të mund të regjistrojë përdorues të rinj dhe t'u caktojë role | A |
| FR-1.1.7 | Sistemi duhet të lejojë ndryshim të fjalëkalimit sipas profilelit të përdoruesit | B |

### 1.2 Menaxhimi i Mungesave

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-2.1.1 | WORKER duhet të mund të kërkojë produkte me fytyrën e kërkimit të fuzzy | A |
| FR-2.1.2 | WORKER duhet të mund të shto mungesa për produkte të kërkuara | A |
| FR-2.1.3 | OWNER/MANAGER duhet të shohë listën e të gjitha mungesave të filtruara sipas furnitorit | A |
| FR-2.1.4 | Sistemi duhet të grupojë mungesat sipas furnitorit për gjenerim porosish | A |
| FR-2.1.5 | Mungesat duhet të hiqen automatikisht kur të korrigjohen stoket | B |
| FR-2.1.6 | OWNER duhet të mund të shfaqë parashikimin e mungesave në vijim bazuar në të dhënat historike | B |
| FR-2.1.7 | Sistemi duhet të zbulojë anomali në mungesa (mungesë jashtëzakonshme ose e papritur) | B |
| FR-2.1.8 | Mungesat duhet të ruhen në database dhe t'u jepet mundësia të jenë në kohë reale përmes Supabase Realtime | A |

### 1.3 Menaxhimi i Porosive

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-3.1.1 | Sistemi duhet të gjenerojë porosi automatike bazuar në mungesat e grupuara | A |
| FR-3.1.2 | OWNER duhet të mund të shohë të gjitha porosite e gjeneruara | A |
| FR-3.1.3 | OWNER duhet të mund të kopjojë porosi | B |
| FR-3.1.4 | OWNER duhet të mund të shkarkojë porosi si PDF | A |
| FR-3.1.5 | OWNER duhet të mund të shënojë porosi si "SENT" | A |
| FR-3.1.6 | Porositë duhet të përfshijnë informacionin e furnitorit, produktit dhe sasisë | A |
| FR-3.1.7 | Sistemi duhet të kalkulojë sasi të sugjeruar bazuar në të dhëna historike 30-ditore | B |
| FR-3.1.8 | Sistemi duhet të sugjerojë furnitor alternativ me AI bazuar në ngjashmeri produkti dhe preferencat e OWNER-it | B |
| FR-3.1.9 | Sistemi duhet të optimizojë ri-porosi me parametrat: priority, coverage days, estimated cost, lead time | B |

### 1.4 Menaxhimi i Produkteve dhe Furnitorëve

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-4.1.1 | OWNER duhet të mund të dalet produktet e kompanisë | A |
| FR-4.1.2 | OWNER duhet të mund të përditësojë informacionin e produktit (emër, kod, kategori) | B |
| FR-4.1.3 | OWNER duhet të mund të menaxhojë furnitorët e produkteve | B |
| FR-4.1.4 | OWNER duhet të mund të përcaktojë preferencat e furnitorit për secilin produkt | B |
| FR-4.1.5 | Sistemi duhet të sugjerojë furnitorin optimal bazuar në: çmim, lead time, prioritet ofertes | B |
| FR-4.1.6 | Sistemi duhet të kalkulojë stock AI bazuar në parashikimin e mungesave dhe trupin e kërkesës | B |

### 1.5 Import të Të Dhënave

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-5.1.1 | OWNER duhet të mund të importojë produkte përmes Excel/CSV | A |
| FR-5.1.2 | Sistemi duhet të validojë të dhënat e importuara para ruajtjes | B |
| FR-5.1.3 | Sistemi duhet të shfaqë raportin e gabimeve gjatë importit | B |
| FR-5.1.4 | Sistemi duhet të lejojë importin manual të mungesave | B |

### 1.6 Menaxhimi i Kompanisë

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-6.1.1 | OWNER duhet të mund të përditësojë detajet e kompanisë (emër, adresë, kontakt) | B |
| FR-6.1.2 | OWNER duhet të mund të përcaktojë ngjyrën e theksit të kompanisë (branding) | B |
| FR-6.1.3 | OWNER duhet të mund të përcaktojë degët e biznesit (shërbimet që ofrohen) | B |
| FR-6.1.4 | Sistemi duhet të izolojë të dhënat sipas kompanisë (multi-tenancy) | A |

### 1.7 Menaxhimi i Ekipit

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-7.1.1 | OWNER duhet të mund të listojë të gjithë anëtarët e ekipit | A |
| FR-7.1.2 | OWNER duhet të mund të fshijë anëtarë ekipi | B |
| FR-7.1.3 | Sistemi duhet të shfaqë metrikat e aktivitetit të çdo përdoruesi | B |
| FR-7.1.4 | OWNER duhet të mund të deaktivizojë përdorues pa i fshirë | B |

### 1.8 Dashboard dhe Raportim

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-8.1.1 | OWNER/MANAGER duhet të mund të shohë dashboard-in me metrikat kryesore | A |
| FR-8.1.2 | Dashboard-i duhet të shfaqë numrin e mungesave të shpejta | B |
| FR-8.1.3 | Dashboard-i duhet të shfaqë numrin e porosive të pambyllura | B |
| FR-8.1.4 | Dashboard-i duhet të shfaqë parashikimin e mungesave për 7 ditët e ardhshme | B |
| FR-8.1.5 | Dashboard-i duhet të shfaqë produktet me prioritet të lartë për ri-porosi | B |

### 1.9 Profili i Përdoruesit

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-9.1.1 | Përdoruesi duhet të mund të shohë informacionin e profilit të tij | B |
| FR-9.1.2 | Përdoruesi duhet të mund të ndryshojë fjalëkalimin e tij | B |
| FR-9.1.3 | Sistemi duhet të ruajë preferencat e temës (dritë/errësirë) në localStorage | B |

### 1.10 Orientimi dhe Nawigimi

| ID | Përshkrimi | Prioritet |
|---|---|---|
| FR-10.1.1 | Sistemi duhet të lejojë navigimin ndërmjet faqeve duke përdorur hash routing | A |
| FR-10.1.2 | MANAGER nuk duhet të ketë akses në rute: #/produktet, #/import, #/kompania, #/ekipa, #/settings | A |
| FR-10.1.3 | WORKER duhet të redirejohet automatikisht në #/mungesat | A |
| FR-10.1.4 | Sistemi duhet të ruajë rrugën e fundit të vizituar dhe të kthehet në të pas login-it | B |

---

## 2. KËRKESA JO-FUNKSIONALE (NFR)

### 2.1 Performanca

| ID | Përshkrimi | Prioritet | Meta |
|---|---|---|---|
| NFR-1.1.1 | Koha e ngarkim të faqes duhet të jetë < 3 sekonda | A | First Contentful Paint |
| NFR-1.1.2 | Koha e përgjigjeje e kërkimit të produkteve duhet të jetë < 200ms | A | Fuzzy search latency |
| NFR-1.1.3 | Operacionet e CRUD duhet të përgjigjen në < 500ms | B | Database latency |
| NFR-1.1.4 | Ngarkesa në Realtime për mungesat duhet të ndodhë në < 1 sekondë | A | Real-time latency |
| NFR-1.1.5 | Optimizimi i imazheve dhe asseteve të statikës | B | Bundle size < 500KB |

### 2.2 Skalabilitet

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-2.1.1 | Sistemi duhet të mbështesë të paktën 1000 përdorues të njëkohshëm | B |
| NFR-2.1.2 | Sistemi duhet të mbështesë të paktën 100,000 regjistrime të mungesave | B |
| NFR-2.1.3 | Sistemi duhet të ketë kapacitetin për të shtuar nënë kompani pa ri-implementim | B |
| NFR-2.1.4 | Sistemi duhet të lejojë shkalimin horizontal të serverit (stateless design) | B |

### 2.3 Siguria

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-3.1.1 | Të gjithë të dhënat në transito duhet të jenë të enkriptuar me HTTPS | A |
| NFR-3.1.2 | Të dhënat e ndjeshme (fjalëkalime, tokens) duhet të hiqen nga localStorage për secilin logout | A |
| NFR-3.1.3 | Sistemi duhet të implementojë Row Level Security (RLS) në Supabase | A |
| NFR-3.1.4 | Përdoruesi nuk duhet të mund të akcesojë të dhënat e kompanisë tjetër | A |
| NFR-3.1.5 | JWT tokens duhet të jenë me kohëzgjatje të kufizuar (15-30 minuta) | A |
| NFR-3.1.6 | Sistemi duhet të validojë të gjithë inputet nga ana e serverit | B |
| NFR-3.1.7 | Sistemi duhet të bëjë rate limiting për login dhe operacione të ndjeshme | B |
| NFR-3.1.8 | Të dhënat duhet të hiqen në mënyrë të sigurt kur fshihet përdoruesi | B |

### 2.4 Disponueshmëria

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-4.1.1 | Aplikacioni duhet të punojë offline me sinkronizim të atuhshëm kur lidhet interneti | A |
| NFR-4.1.2 | PWA duhet të lejoni instalim në pajisje mobile | A |
| NFR-4.1.3 | Sistemi duhet të ketë uptime >= 99.9% | B |
| NFR-4.1.4 | Sistemi duhet të ketë backup ditor të të dhënave | B |
| NFR-4.1.5 | Recovery time objective (RTO) duhet të jetë <= 1 orë | B |

### 2.5 Kompatibilitet

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-5.1.1 | Aplikacioni duhet të funksionojë në Chrome, Firefox, Safari dhe Edge | A |
| NFR-5.1.2 | Aplikacioni duhet të punojë në iOS 12+ dhe Android 8+ | B |
| NFR-5.1.3 | Aplikacioni duhet të jetë responsive për ekrane 320px - 1920px gjerësi | A |
| NFR-5.1.4 | Sistemi duhet të mbështesë gjuhën Shqipe dhe Anglisht | B |

### 2.6 Manutenabilitet

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-6.1.1 | Kodi duhet të ndjekë konvencionet TypeScript | B |
| NFR-6.1.2 | Duhet të ketë dokumentim i kodit për funksionet komplekse | B |
| NFR-6.1.3 | Sistemi duhet të ketë njësi teste me përqindje mbarimi >= 80% | B |
| NFR-6.1.4 | Sistemi duhet të ketë CI/CD pipeline për deploy automatik | B |
| NFR-6.1.5 | Të gjithë secret-et duhet të menaxhohen përmes variablave të mjedisit | A |
| NFR-6.1.6 | Duhet të jetë i lehtë për shtim të veçorish të reja pa ndryshime të mëdha | B |

### 2.7 Besueshmëri (Reliability)

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-7.1.1 | Sistemi nuk duhet të humbasë të dhëna në rast të ndërprerjeje të internetit | A |
| NFR-7.1.2 | Sistemi duhet të ketë mekanizëm retry për operacione të dështuara | B |
| NFR-7.1.3 | Sistemi duhet të logjojë të gjitha gabimet dhe përjashtuat | B |
| NFR-7.1.4 | Sistemi duhet të ketë error boundaries për parandalimin e white screen crashes | B |

### 2.8 Përdorshmëria (Usability)

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-8.1.1 | Interface-i duhet të jetë intuitiv për përdoruesit jo-teknologjik | B |
| NFR-8.1.2 | Aplikacioni duhet të ketë mbajtje të eceve (tour/onboarding) për përdoruesit e rinj | C |
| NFR-8.1.3 | Sistemi duhet të ofrojë mesazhe gabimi të qarta dhe të dobishme | B |
| NFR-8.1.4 | Sistemi duhet të ketë aftësin e undo/redo për operacione kritike | C |
| NFR-8.1.5 | Koha e nxënies duhet të jetë <= 30 minuta për përdorues mesatar | B |
| NFR-8.1.6 | Sistemi duhet të ketë accessibility score >= 90 (WCAG 2.1) | B |

### 2.9 Kostoja

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-9.1.1 | Sistemi duhet të përdorë shërbime open-source ose me lincë free/favorable | B |
| NFR-9.1.2 | Kostoja e hosting-ut duhet të jetë < $100/muaj për të ardhurat e kompanisë | B |

### 2.10 Ligjore dhe Pajtueshmëri

| ID | Përshkrimi | Prioritet |
|---|---|---|
| NFR-10.1.1 | Sistemi duhet të respektojë GDPR për të dhënat personale | A |
| NFR-10.1.2 | Sistemi duhet të ketë politikë të privatësisë të qartë | A |
| NFR-10.1.3 | Sistemi duhet të mbajë logje të auditimit për aksese dhe modifikime të dhënash | B |

---

## 3. MATRICË PRIORITETI

```
A = КРИТИЧЕН (Must have) - Duhet në version 1.0
B = ВАЖЕН (Should have) - Duhet në version 1.1-1.2
C = NICE TO HAVE (Nice to have) - Ardhje në versioner më të vonshme
```

---

## 4. PËRVETËSIM

| Data | Version | Përgjegjës | Përshkrimi |
|---|---|---|---|
| 2026-05-15 | 1.0 | SmartManage Team | Versioni fillestar i kërkesave |

