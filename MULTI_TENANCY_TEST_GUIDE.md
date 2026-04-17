# Multi-Tenancy Test Guide - SmartManage

Ky udhezues ndjek flow-in aktual te aplikacionit:

- `OWNER` krijohet nga UI me `signUp`
- kompania bootstrap-ohet automatikisht me RPC `bootstrap_company_owner`
- anetaret e ekipit krijohen nga `OWNER` me RPC `admin_create_user_email`

## Para se te fillosh

Sigurohu qe migrimet e Supabase jane aplikuar deri te te fundit, sidomos:

- `20260326200000_bootstrap_company_owner_rpc.sql`
- `20260329224500_admin_create_user_email_rpc.sql`
- `20260331170000_admin_create_user_auth_schema_fix.sql`
- `20260331193000_admin_update_user_password_rpc.sql`

Nese do vetem kompani testuese bosh, mund te perdoresh edhe:

- `supabase/migrations/00_TEST_SETUP_create_companies.sql`

## Step 1: Krijo Owner-in e pare nga UI

1. Nise aplikacionin me `npm run dev`.
2. Hape `#/register`.
3. Regjistro nje perdorues te ri me rol `OWNER`.
4. Perdore nje email real ose testues, p.sh. `owner1@example.com`.

Shenim:

- ne login-in e pare aplikacioni therras `bootstrap_company_owner`
- nese user metadata nuk ka `company_name` ose `company_code`, aplikacioni gjeneron vlera fallback nga username/email

## Step 2: Verifiko bootstrap-in e kompanise se pare

Ne Supabase SQL Editor, ekzekuto:

```sql
select id, name, code
from public.companies
order by created_at desc;

select id, email, username, role, company_id, is_active
from public.profiles
where role = 'OWNER'
order by created_at desc;
```

Duhet te shohesh:

- nje kompani te re
- nje profil `OWNER` me `company_id` te plotesuar

## Step 3: Krijo Owner-in e dyte ne kompani tjeter

Per testim me dy kompani, perdor nje sesion te ndare browser-i:

1. Hap nje dritare incognito ose browser tjeter.
2. Regjistro nje `OWNER` te dyte, p.sh. `owner2@example.com`.
3. Ky user duhet te bootstrap-oje nje kompani te dyte, te ndare nga e para.

Verifikim i shpejte:

```sql
select id, name, code
from public.companies
where code is not null
order by created_at desc;
```

Duhet te ekzistojne dy kompani te ndryshme.

## Step 4: Krijo user-a te ekipit nga Settings

Duke qene i kycur si `owner1`:

1. Shko te `#/settings`.
2. Krijo nje `WORKER`, p.sh. `worker1@example.com`.
3. Krijo nje `MANAGER`, p.sh. `manager1@example.com`.

Perserite te njejtin proces si `owner2`:

1. Krijo `worker2@example.com`
2. Krijo `manager2@example.com`

Kjo rruge perdor RPC `admin_create_user_email`, jo SQL manual ne dashboard.

## Step 5: Krijo te dhena ne secilen kompani

Si `owner1`:

1. Shto nje furnitor, p.sh. `Furnitor Kompania 1`
2. Shto nje produkt, p.sh. `Produkt Test 1`
3. Shto nje mungese per ate produkt

Si `owner2`:

1. Shto nje furnitor, p.sh. `Furnitor Kompania 2`
2. Shto nje produkt, p.sh. `Produkt Test 2`
3. Shto nje mungese per ate produkt

## Step 6: Verifiko izolimin e te dhenave

Testet minimale qe duhen kaluar:

- `owner1` sheh vetem produktet, mungesat dhe ekipin e kompanise 1
- `owner2` sheh vetem produktet, mungesat dhe ekipin e kompanise 2
- `manager1` nuk duhet te shohe te dhenat e kompanise 2
- `worker1` mund te shtoje mungesa, por jo te krijoje produkte ose te administroje ekipin

Kontroll SQL per profilet:

```sql
select email, username, role, company_id, is_active
from public.profiles
order by company_id, role, email;
```

Kontroll SQL per produktet:

```sql
select id, name, company_id
from public.products
order by created_at desc;
```

## Step 7: Testo login me email dhe username

Per shkak se aplikacioni mbeshtet edhe login me username:

1. Kycu si nje user me email te plote.
2. Dil nga llogaria.
3. Kycu perseri me username, nese ai user ka username te ruajtur ne `profiles`.

Nese kjo deshton, kontrollo nese ekziston RPC:

```sql
select public.lookup_login_email('owner1@example.com');
```

## Step 8: Testo ndryshimin e password-it nga OWNER

Si `OWNER`, provo te ndryshosh password-in e nje user-i te kompanise tende nga UI.

Nese do te verifikosh qe RPC ekziston:

```sql
select proname
from pg_proc
where proname in (
  'bootstrap_company_owner',
  'admin_create_user_email',
  'admin_update_user_password',
  'lookup_login_email'
)
order by proname;
```

## Troubleshooting

### Owner regjistrohet por nuk merr kompani

Kontrollo:

```sql
select id, email, role, company_id
from public.profiles
order by created_at desc;
```

Nese `company_id` mbetet bosh, verifiko migrimin:

- `20260326200000_bootstrap_company_owner_rpc.sql`

### Krijimi i user-it nga Settings deshton

RPC-ja e pritur nga frontend eshte:

- `admin_create_user_email`

Nese mungon, apliko:

- `20260329224500_admin_create_user_email_rpc.sql`
- `20260331170000_admin_create_user_auth_schema_fix.sql`

Pastaj ekzekuto:

```sql
notify pgrst, 'reload schema';
```

### Login me username deshton

Kontrollo nese ekziston:

- `lookup_login_email`

Nese mungon, apliko migrimet me te reja te auth/login flow.

## Rezultati i pritur

Multi-tenancy konsiderohet ne rregull kur:

- cdo kompani sheh vetem te dhenat e veta
- `OWNER` krijon user-at vetem brenda kompanise se vet
- `MANAGER` dhe `WORKER` nuk kalojne kufijte e kompanise
- login me email ose username funksionon per user-at aktiv
