# SmartManage + Supabase Setup

Ky dokument mbulon setup-in minimal qe aplikacioni te punoje lokalisht me Supabase.

## 1. Krijo ose zgjidh nje projekt ne Supabase

Te duhen:

- `Project URL`
- `anon` ose `publishable` key per frontend

Mos perdor:

- `service_role`
- `sb_secret_...`

## 2. Konfiguro `.env`

Ne root te projektit krijo `.env` nga `.env.example`:

```bash
cp .env.example .env
```

Vendos vlerat:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

`src/lib/supabase.ts` i lexon keto vlera ne runtime.

## 3. Apliko migrimet SQL

Aplikacioni pret skemen dhe RPC-te qe gjenden te:

- `supabase/migrations/`

Per flow-in aktual te auth/team management, sigurohu qe jane aplikuar edhe migrimet e meposhtme:

- `20260326150000_username_manager_login.sql`
- `20260326200000_bootstrap_company_owner_rpc.sql`
- `20260329224500_admin_create_user_email_rpc.sql`
- `20260331170000_admin_create_user_auth_schema_fix.sql`
- `20260331193000_admin_update_user_password_rpc.sql`

Nese perdor Supabase CLI ose nje pipeline te migrimeve, aplikoji sipas renditjes ne emer.

## 4. Nise aplikacionin

```bash
npm ci
npm run dev
```

Per verifikim lokal para deploy:

```bash
npm run verify
```

## 5. Bootstrap i kompanise se pare

Flow-i aktual nuk pret qe kompania e pare te krijohet manualisht me SQL.

Bej kete:

1. hape `#/register`
2. regjistro nje user me rol `OWNER`
3. pas login-it te pare, aplikacioni therras `bootstrap_company_owner`

Rezultati i pritur:

- krijohet nje rekord ne `public.companies`
- `profiles.company_id` plotesohet per owner-in
- `profiles.role` mbetet `OWNER`

## 6. Krijimi i anetareve te ekipit

Pasi owner-i hyn ne aplikacion:

1. shko te `#/settings`
2. krijo `WORKER` ose `MANAGER`

Frontend-i perdor RPC:

- `admin_create_user_email`
- `admin_update_user_password`

Nese Settings jep gabim qe RPC mungon, kontrollo migrimet e fundit dhe ekzekuto:

```sql
notify pgrst, 'reload schema';
```

## 7. Login me email ose username

SmartManage mbeshtet:

- login me email
- login me username nepermjet `lookup_login_email`

Nese username login nuk punon, zakonisht mungon migrimi qe krijon RPC-ne `lookup_login_email`.

## 8. Realtime dhe tabela kryesore

Repo-ja pret qe:

- `public.mungesat` te jete aktive per Realtime
- `profiles.role` te jete nje nga `OWNER`, `MANAGER`, `WORKER`
- `profiles.company_id` te jete i plotesuar per user-at e kompanive reale

## 9. Verifikim i shpejte ne SQL Editor

```sql
select id, name, code
from public.companies
order by created_at desc;

select id, email, username, role, company_id, is_active
from public.profiles
order by created_at desc;
```

## Troubleshooting

### App hapet por nuk kycet

Kontrollo:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- nese projekti i duhur ne Supabase ka migrimet e ketij repo-je

### Owner regjistrohet por nuk i krijohet kompania

Kontrollo migrimin:

- `20260326200000_bootstrap_company_owner_rpc.sql`

### User creation nga Settings deshton

Kontrollo migrimet:

- `20260329224500_admin_create_user_email_rpc.sql`
- `20260331170000_admin_create_user_auth_schema_fix.sql`

### Password update deshton

Kontrollo migrimin:

- `20260331193000_admin_update_user_password_rpc.sql`
