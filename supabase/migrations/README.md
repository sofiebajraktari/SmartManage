# Supabase Migrations Guide

Ky folder mban migrimet SQL te SmartManage ne rend kronologjik.

## Si te lexohen

- emri fillon me timestamp
- migrimet duhet te aplikohen ne rend rrites
- migrimet me te vona shpesh zevendesojne versione me te hershme te te njejtit RPC

## Grupet kryesore

### Schema bazike

- `20260316000100_smartmanage_mvp_schema.sql`
- `20250314000000_create_products.sql`
- `20260316000200_add_mungesat_rpc.sql`

Keto krijojne bazen e tabelave, mungesave dhe funksioneve fillestare.

### Multi-tenancy dhe company scoping

- `20260326190000_multi_company_tenancy.sql`
- `20260328170000_global_team_users_consistency.sql`
- `20260328180000_fix_rls_multi_tenancy.sql`
- `20260324120000_rls_worker_orders_read.sql`

Keto migrime kontrollojne ndarjen e te dhenave sipas kompanise dhe RLS.

### Company details dhe metadata

- `20260326170000_company_details.sql`
- `20260326171000_company_details_accent_color.sql`
- `20260326172000_company_details_branch_business.sql`
- `20260326180000_company_details_restructure.sql`

### Products, suppliers dhe performance

- `20260326160000_product_supplier_preferences.sql`
- `20260326182000_products_supplier_offer_fields.sql`
- `20260326183000_performance_indexes.sql`

### Auth, login dhe team management

Per frontend-in aktual, keto jane migrimet me kritike:

- `20260326150000_username_manager_login.sql`
- `20260326200000_bootstrap_company_owner_rpc.sql`
- `20260327110000_admin_create_user_and_login_lookup_fix.sql`
- `20260328190000_admin_create_user_login_stability.sql`
- `20260328190000_fix_user_creation_direct_sql.sql`
- `20260329221000_email_first_admin_create_user_fix.sql`
- `20260329224500_admin_create_user_email_rpc.sql`
- `20260331170000_admin_create_user_auth_schema_fix.sql`
- `20260331193000_admin_update_user_password_rpc.sql`

Shenim:

- migrimet me te reja te `admin_create_user*` mbajne versionin qe duhet frontend-i sot
- nese sheh gabime per RPC qe mungon, zakonisht mungon nje nga migrimet e ketij grupi

### Session management

- `20260331190000_single_device_active_session.sql`

Ky migrim lidhet me menaxhimin e sesionit aktiv.

### Test helpers

- `00_TEST_SETUP_create_companies.sql`

Ky eshte helper per seed te kompanive testuese bosh; nuk krijon user-a auth.

## Kur frontend jep gabim per RPC qe mungon

Kontrollo fillimisht nese jane aplikuar:

- `20260326200000_bootstrap_company_owner_rpc.sql`
- `20260329224500_admin_create_user_email_rpc.sql`
- `20260331170000_admin_create_user_auth_schema_fix.sql`
- `20260331193000_admin_update_user_password_rpc.sql`

Pastaj ekzekuto:

```sql
notify pgrst, 'reload schema';
```
