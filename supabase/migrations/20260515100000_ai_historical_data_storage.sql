-- AI Historical Data Storage (6-month retention + Supplier Performance)
-- Miraton historikun e mungesave për forecasting më të mirë

-- ===== 1) SHORTAGE_HISTORY: Ruajtje e puntos te mungesave per forecast =====
create table if not exists public.shortage_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  shortage_date date not null,
  -- Burimi i mungesës (worker_entry, auto_forecast, manual_input)
  source text not null default 'worker_entry' check (source in ('worker_entry', 'auto_forecast', 'manual_input')),
  -- Sasia e mungesës (sa njësi u kërkuan)
  shortage_qty integer not null default 1 check (shortage_qty >= 1),
  -- A u plotësua në këtë ditë?
  fulfilled boolean not null default false,
  fulfilled_date date,
  fulfilled_qty integer,
  -- Urgjenca e detektuar
  urgency_level text default 'LOW' check (urgency_level in ('LOW', 'MEDIUM', 'HIGH')),
  urgency_score integer default 0 check (urgency_score >= 0 and urgency_score <= 99),
  -- Shënimet e nxjerra
  notes text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shortage_history_company_date_idx
  on public.shortage_history (company_id, shortage_date desc);

create index if not exists shortage_history_product_date_idx
  on public.shortage_history (product_id, shortage_date desc);

-- ===== 2) SUPPLIER_PERFORMANCE: Tracking supplier reliability =====
create table if not exists public.supplier_performance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  -- Lead time në ditë
  actual_lead_time_days integer,
  expected_lead_time_days integer default 3,
  -- Cilësia e furnizimit
  on_time_delivery boolean default true,
  received_qty integer,
  ordered_qty integer,
  -- Çmimi i aktual vs i pritur
  unit_price numeric(10, 2),
  price_variance_percent numeric(5, 2) default 0,
  -- Çertifikimi dhe dokumentet
  has_cert boolean default false,
  notes text default '',
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_performance_company_supplier_idx
  on public.supplier_performance (company_id, supplier_id);

create index if not exists supplier_performance_product_idx
  on public.supplier_performance (product_id, created_at desc);

-- ===== 3) DEMAND_FORECAST_ARCHIVE: Ruajtje e forecasts =====
create table if not exists public.demand_forecast_archive (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  forecast_date date not null,
  forecast_7_days integer not null,
  forecast_per_day numeric(10, 2),
  confidence_percent integer,
  risk_score integer,
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  anomaly_score integer,
  -- Actual vs Forecast comparison
  actual_7_days integer,
  accuracy_percent integer,
  created_at timestamptz not null default now()
);

create index if not exists demand_forecast_company_product_idx
  on public.demand_forecast_archive (company_id, product_id, forecast_date desc);

-- ===== 4) Enable RLS =====
alter table public.shortage_history enable row level security;
alter table public.supplier_performance enable row level security;
alter table public.demand_forecast_archive enable row level security;

-- ===== 5) RLS Policies =====
-- shortage_history
drop policy if exists "shortage_history_select_company" on public.shortage_history;
create policy "shortage_history_select_company"
  on public.shortage_history for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "shortage_history_insert_company" on public.shortage_history;
create policy "shortage_history_insert_company"
  on public.shortage_history for insert
  to authenticated
  with check (company_id = public.current_company_id());

drop policy if exists "shortage_history_update_owner" on public.shortage_history;
create policy "shortage_history_update_owner"
  on public.shortage_history for update
  to authenticated
  using (public.is_owner() and company_id = public.current_company_id())
  with check (public.is_owner() and company_id = public.current_company_id());

-- supplier_performance
drop policy if exists "supplier_performance_select_company" on public.supplier_performance;
create policy "supplier_performance_select_company"
  on public.supplier_performance for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "supplier_performance_insert_owner" on public.supplier_performance;
create policy "supplier_performance_insert_owner"
  on public.supplier_performance for insert
  to authenticated
  with check (public.is_owner() and company_id = public.current_company_id());

drop policy if exists "supplier_performance_update_owner" on public.supplier_performance;
create policy "supplier_performance_update_owner"
  on public.supplier_performance for update
  to authenticated
  using (public.is_owner() and company_id = public.current_company_id())
  with check (public.is_owner() and company_id = public.current_company_id());

-- demand_forecast_archive
drop policy if exists "demand_forecast_select_company" on public.demand_forecast_archive;
create policy "demand_forecast_select_company"
  on public.demand_forecast_archive for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "demand_forecast_insert_authenticated" on public.demand_forecast_archive;
create policy "demand_forecast_insert_authenticated"
  on public.demand_forecast_archive for insert
  to authenticated
  with check (company_id = public.current_company_id());

-- ===== 6) Helper functions =====

-- Merr historikun e mungesave për product (6 muaj)
create or replace function public.get_shortage_history(
  p_company_id uuid,
  p_product_id uuid,
  p_days_back integer default 180
)
returns table (
  shortage_date date,
  shortage_qty integer,
  urgency_level text,
  fulfilled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sh.shortage_date,
    sh.shortage_qty,
    sh.urgency_level,
    sh.fulfilled
  from public.shortage_history sh
  where sh.company_id = p_company_id
    and sh.product_id = p_product_id
    and sh.shortage_date >= current_date - interval '1 day' * p_days_back
  order by sh.shortage_date asc;
$$;

-- Merr supplier performance metrics
create or replace function public.get_supplier_metrics(
  p_company_id uuid,
  p_supplier_id uuid,
  p_days_back integer default 180
)
returns table (
  avg_lead_time numeric,
  on_time_percent numeric,
  price_variance_avg numeric,
  total_orders integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    round(avg((sp.actual_lead_time_days)::numeric), 1) as avg_lead_time,
    round(
      (sum(case when sp.on_time_delivery then 1 else 0 end)::numeric / 
       nullif(count(*), 0) * 100)::numeric, 1
    ) as on_time_percent,
    round(avg(sp.price_variance_percent), 2) as price_variance_avg,
    count(*)::integer as total_orders
  from public.supplier_performance sp
  where sp.company_id = p_company_id
    and sp.supplier_id = p_supplier_id
    and sp.created_at >= now() - interval '1 day' * p_days_back;
$$;

-- Archival: Delete shortage_history older than 180 days
-- Run nightly via pg_cron or from application
create or replace function public.archive_and_clean_old_data()
returns table (
  shortage_records_deleted bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count bigint;
begin
  delete from public.shortage_history
  where shortage_date < current_date - interval '180 days'
    and fulfilled = true;
  
  get diagnostics v_deleted_count = row_count;
  
  return query select v_deleted_count;
end;
$$;

comment on table public.shortage_history is 'Historiku i mungesave per 6 muaj (per forecasting)';
comment on table public.supplier_performance is 'Metriks performance per furnitor';
comment on table public.demand_forecast_archive is 'Arkivi i forecasts per comparison actual vs expected';
