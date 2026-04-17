alter table public.products
  add column if not exists min_stock integer default 0,
  add column if not exists reorder_point integer default 0;

update public.products
set
  min_stock = greatest(coalesce(min_stock, 0), 0),
  reorder_point = greatest(coalesce(reorder_point, 0), 0)
where min_stock is null
   or reorder_point is null
   or min_stock < 0
   or reorder_point < 0;

alter table public.products
  alter column min_stock set default 0,
  alter column min_stock set not null,
  alter column reorder_point set default 0,
  alter column reorder_point set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_min_stock_nonnegative'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_min_stock_nonnegative check (min_stock >= 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_reorder_point_nonnegative'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_reorder_point_nonnegative check (reorder_point >= 0);
  end if;
end
$$;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_delta integer not null check (quantity_delta <> 0),
  movement_type text not null check (
    movement_type in ('INITIAL_COUNT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'MANUAL_CORRECTION')
  ),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_company_product_idx
  on public.inventory_movements (company_id, product_id, created_at desc);

create index if not exists inventory_movements_product_created_idx
  on public.inventory_movements (product_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists "inventory_movements_select_company" on public.inventory_movements;
create policy "inventory_movements_select_company"
  on public.inventory_movements for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "inventory_movements_write_owner_company" on public.inventory_movements;
create policy "inventory_movements_write_owner_company"
  on public.inventory_movements for insert
  to authenticated
  with check (
    public.is_owner()
    and company_id = public.current_company_id()
    and (created_by is null or created_by = auth.uid())
  );

create or replace function public.current_stock_by_product()
returns table (
  product_id uuid,
  current_stock bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    im.product_id,
    coalesce(sum(im.quantity_delta), 0)::bigint as current_stock
  from public.inventory_movements im
  where im.company_id = public.current_company_id()
  group by im.product_id;
$$;

revoke all on function public.current_stock_by_product() from public;
grant execute on function public.current_stock_by_product() to authenticated;

create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_quantity_delta integer,
  p_movement_type text default 'MANUAL_CORRECTION',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_user_id uuid := auth.uid();
  v_movement_type text := upper(btrim(coalesce(p_movement_type, 'MANUAL_CORRECTION')));
  v_movement_id uuid;
begin
  if v_company_id is null then
    raise exception 'company_not_found' using errcode = '22023';
  end if;

  if coalesce(p_quantity_delta, 0) = 0 then
    raise exception 'quantity_delta_required' using errcode = '22023';
  end if;

  if v_movement_type not in ('INITIAL_COUNT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'MANUAL_CORRECTION') then
    raise exception 'invalid_movement_type' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.company_id = v_company_id
  ) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  insert into public.inventory_movements (
    company_id,
    product_id,
    quantity_delta,
    movement_type,
    note,
    created_by
  )
  values (
    v_company_id,
    p_product_id,
    p_quantity_delta,
    v_movement_type,
    coalesce(btrim(p_note), ''),
    v_user_id
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

revoke all on function public.adjust_product_stock(uuid, integer, text, text) from public;
grant execute on function public.adjust_product_stock(uuid, integer, text, text) to authenticated;

comment on table public.inventory_movements is
  'Levizjet e stokut per produktet e kompanise: fillim, korrigjime dhe hyrje/dalje manuale.';

comment on function public.current_stock_by_product() is
  'Kthen stokun aktual per cdo produkt ne kompanine aktive.';

comment on function public.adjust_product_stock(uuid, integer, text, text) is
  'Shton nje levizje stoku per produktin ne kompanine aktive.';
