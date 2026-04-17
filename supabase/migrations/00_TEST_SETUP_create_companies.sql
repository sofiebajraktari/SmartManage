-- TEST DATA: seed two companies only.
-- This helper does not create auth users, profiles, or team members.
-- For the current app flow:
--   1. create the first OWNER from `#/register`
--   2. let `bootstrap_company_owner` create that owner's company automatically
--   3. create team members from Settings via `admin_create_user_email`
--
-- Use this script only when you want pre-created company rows for SQL-level testing.

insert into public.companies (name, code)
values
  ('Kompania Test 1', 'test-company-1'),
  ('Kompania Test 2', 'test-company-2')
on conflict (code) do nothing;

-- Review the seeded companies:
select id, name, code
from public.companies
where code like 'test-company%'
order by created_at desc;
