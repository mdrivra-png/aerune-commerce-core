-- AERUNE COMMERCE CORE V2 — SUPABASE DATABASE
-- Run this entire file once in Supabase: SQL Editor -> New query -> Run.
-- This creates the shared catalog, stock, customer orders, staff roles,
-- secure public checkout RPC, image bucket and live update tables.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- STAFF ROLES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'cashier' check (role in ('owner','manager','cashier')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'cashier')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.app_is_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner','manager','cashier')
  );
$$;

create or replace function public.app_can_manage()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner','manager')
  );
$$;

-- ---------------------------------------------------------------------
-- CORE CATALOG
-- ---------------------------------------------------------------------
create table if not exists public.storefronts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  mark text not null default 'AE',
  domain text not null default '',
  currency text not null default 'NPR',
  theme text not null default 'alpine' check (theme in ('alpine','editorial','noir')),
  status text not null default 'draft' check (status in ('draft','published')),
  announcement text not null default '',
  hero_eyebrow text not null default '',
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_media_url text not null default '',
  primary_cta text not null default 'Explore collection',
  secondary_cta text not null default 'Field notes',
  footer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  name text not null,
  handle text not null,
  description text not null default '',
  cover_url text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collections_storefront_position_idx on public.collections(storefront_id, sort_order);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  handle text not null,
  sku text not null default '',
  barcode text not null default '',
  description text not null default '',
  price_npr numeric(12,2) not null default 0 check (price_npr >= 0),
  compare_at_npr numeric(12,2) not null default 0 check (compare_at_npr >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_at integer not null default 0 check (low_stock_at >= 0),
  status text not null default 'draft' check (status in ('draft','published')),
  image_url text not null default '',
  badges text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_sku_idx on public.products(sku);
create index if not exists products_barcode_idx on public.products(barcode);

create table if not exists public.storefront_products (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  visible boolean not null default true,
  position integer not null default 0,
  price_override_npr numeric(12,2) check (price_override_npr is null or price_override_npr >= 0),
  unique(storefront_id, product_id)
);
create index if not exists storefront_products_storefront_position_idx on public.storefront_products(storefront_id, position);

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  storefront_id uuid not null references public.storefronts(id),
  source text not null default 'online' check (source in ('online','pos')),
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  shipping_address text not null default '',
  note text not null default '',
  payment_method text not null default 'cod',
  payment_status text not null default 'unpaid',
  fulfillment_status text not null default 'new' check (fulfillment_status in ('new','confirmed','packed','dispatched','delivered','cancelled')),
  subtotal_npr numeric(12,2) not null default 0,
  shipping_npr numeric(12,2) not null default 0,
  total_npr numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  sku text not null default '',
  barcode text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price_npr numeric(12,2) not null check (unit_price_npr >= 0),
  line_total_npr numeric(12,2) not null check (line_total_npr >= 0)
);

-- ---------------------------------------------------------------------
-- PUBLIC CHECKOUT: validates catalog visibility, locks stock, creates order,
-- saves immutable item details, and deducts stock in one transaction.
-- Browser code never receives a database service key.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_storefront_slug text,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default 'cod',
  p_note text default '',
  p_source text default 'online'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_storefront public.storefronts%rowtype;
  v_product public.products%rowtype;
  v_link public.storefront_products%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_prefix text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if p_source not in ('online','pos') then
    raise exception 'Unsupported order source.';
  end if;
  if p_source = 'pos' and not public.app_is_staff() then
    raise exception 'A staff sign-in is required for POS checkout.';
  end if;

  select * into v_storefront
  from public.storefronts
  where slug = p_storefront_slug and status = 'published';
  if not found then
    raise exception 'This store is unavailable.';
  end if;

  v_prefix := case when p_source = 'pos' then 'POS' else 'WEB' end;
  v_order_number := v_prefix || '-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(v_order_id::text,'-',''),1,6));

  insert into public.orders (
    id, order_number, storefront_id, source, customer_name, customer_phone,
    customer_email, shipping_address, note, payment_method, payment_status,
    fulfillment_status, subtotal_npr, shipping_npr, total_npr
  ) values (
    v_order_id, v_order_number, v_storefront.id, p_source,
    coalesce(p_customer->>'name',''), coalesce(p_customer->>'phone',''),
    coalesce(p_customer->>'email',''), coalesce(p_customer->>'address',''),
    coalesce(p_note,''), coalesce(p_payment_method,'cod'),
    case when coalesce(p_payment_method,'cod') = 'cod' then 'unpaid' else 'awaiting_confirmation' end,
    'new', 0, 0, 0
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));

    select p into v_product
    from public.products p
    where p.id = v_product_id
      and p.status = 'published'
      and exists (
        select 1 from public.storefront_products sp
        where sp.product_id = p.id and sp.storefront_id = v_storefront.id and sp.visible = true
      )
    for update;

    if not found then
      raise exception 'One product is no longer available.';
    end if;
    select sp into v_link
    from public.storefront_products sp
    where sp.product_id = v_product.id and sp.storefront_id = v_storefront.id and sp.visible = true;
    if v_product.stock_qty < v_qty then
      raise exception '% does not have enough stock.', v_product.title;
    end if;

    v_price := coalesce(v_link.price_override_npr, v_product.price_npr);
    update public.products
    set stock_qty = stock_qty - v_qty, updated_at = now()
    where id = v_product.id;

    insert into public.order_items (order_id, product_id, title, sku, barcode, quantity, unit_price_npr, line_total_npr)
    values (v_order_id, v_product.id, v_product.title, v_product.sku, v_product.barcode, v_qty, v_price, v_price * v_qty);

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  update public.orders
  set subtotal_npr = v_subtotal, total_npr = v_subtotal, updated_at = now()
  where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_npr', v_subtotal, 'fulfillment_status', 'new');
end;
$$;

grant execute on function public.place_order(text,jsonb,jsonb,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.storefronts enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.storefront_products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "profile own read" on public.profiles;
drop policy if exists "profile manager read" on public.profiles;
drop policy if exists "profile own update" on public.profiles;
create policy "profile own read" on public.profiles for select to authenticated using (id = auth.uid() or public.app_can_manage());
create policy "profile manager read" on public.profiles for select to authenticated using (public.app_can_manage());
-- Roles are intentionally changed only in the SQL editor by the owner. This prevents a cashier from promoting their own account in the browser.

drop policy if exists "storefront public read" on public.storefronts;
drop policy if exists "storefront staff manage" on public.storefronts;
create policy "storefront public read" on public.storefronts for select using (status = 'published' or public.app_is_staff());
create policy "storefront staff manage" on public.storefronts for all to authenticated using (public.app_can_manage()) with check (public.app_can_manage());

drop policy if exists "collections public read" on public.collections;
drop policy if exists "collections staff manage" on public.collections;
create policy "collections public read" on public.collections for select using (is_visible = true or public.app_is_staff());
create policy "collections staff manage" on public.collections for all to authenticated using (public.app_can_manage()) with check (public.app_can_manage());

drop policy if exists "products public read" on public.products;
drop policy if exists "products staff manage" on public.products;
create policy "products public read" on public.products for select using (status = 'published' or public.app_is_staff());
create policy "products staff manage" on public.products for all to authenticated using (public.app_can_manage()) with check (public.app_can_manage());

drop policy if exists "storefront products public read" on public.storefront_products;
drop policy if exists "storefront products staff manage" on public.storefront_products;
create policy "storefront products public read" on public.storefront_products for select using (
  visible = true and exists (select 1 from public.storefronts s where s.id = storefront_products.storefront_id and s.status = 'published')
) ;
create policy "storefront products staff manage" on public.storefront_products for all to authenticated using (public.app_can_manage()) with check (public.app_can_manage());

drop policy if exists "orders staff read" on public.orders;
drop policy if exists "orders staff update" on public.orders;
create policy "orders staff read" on public.orders for select to authenticated using (public.app_is_staff());
create policy "orders staff update" on public.orders for update to authenticated using (public.app_is_staff()) with check (public.app_is_staff());

drop policy if exists "order items staff read" on public.order_items;
create policy "order items staff read" on public.order_items for select to authenticated using (public.app_is_staff());

-- ---------------------------------------------------------------------
-- PRODUCT IMAGE STORAGE
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images public read" on storage.objects;
drop policy if exists "product images staff insert" on storage.objects;
drop policy if exists "product images staff update" on storage.objects;
drop policy if exists "product images staff delete" on storage.objects;
create policy "product images public read" on storage.objects for select using (bucket_id = 'product-images');
create policy "product images staff insert" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.app_can_manage());
create policy "product images staff update" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.app_can_manage()) with check (bucket_id = 'product-images' and public.app_can_manage());
create policy "product images staff delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.app_can_manage());

-- ---------------------------------------------------------------------
-- LIVE UPDATES
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['storefronts','collections','products','storefront_products','orders']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- STARTER AERUNE DATA. Safe to run more than once.
-- ---------------------------------------------------------------------
insert into public.storefronts (id, slug, name, mark, theme, status, announcement, hero_eyebrow, hero_title, hero_subtitle, primary_cta, secondary_cta, footer_note)
values ('10000000-0000-0000-0000-000000000001','aerune','Aerune','AE','alpine','published','Designed in Nepal. Built for the long way home.','FIELD-READY TREKKING SYSTEMS','Carry the story, not the strain.','Technical packs and travel companions made for real trails, changing weather, and the work that happens between departures.','Explore the collection','Field notes','Designed in Nepal. Made for the long way home.')
on conflict (slug) do nothing;

insert into public.collections (id, storefront_id, name, handle, description, sort_order, is_visible)
values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Altitude','altitude','Trekking packs for trail and field work.',1,true),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Sera','sera','Light travel and shorter trail movement.',2,true),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Atlas','atlas','Where the trail gets serious.',3,true),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Rainwear','rainwear','Weather layers for people and packs.',4,true)
on conflict (id) do nothing;

insert into public.products (id, title, handle, sku, barcode, description, price_npr, compare_at_npr, stock_qty, low_stock_at, status, badges)
values
  ('30000000-0000-0000-0000-000000000001','Altitude Ridge','altitude-ridge','AER-ALT-0001','2001000000013','A technical trekking pack with protected camera carry, fast access, tripod support, and all-day load stability.',18900,21900,12,4,'published','Trekking, Creator Carry, 45L'),
  ('30000000-0000-0000-0000-000000000002','Sera Air','sera-air','AER-SER-0001','2001000000020','A lighter travel and short-trek daypack with compression-ready organisation and an easy all-day carry.',9800,0,18,5,'published','Travel, Daypack, 24L'),
  ('30000000-0000-0000-0000-000000000003','Atlas Alpine','atlas-alpine','AER-ATL-0001','2001000000037','A high-performance trekking pack for demanding routes, with stable load transfer and serious trail organisation.',21500,0,3,4,'published','Technical, Alpine, 55L'),
  ('30000000-0000-0000-0000-000000000004','Terrain Shell','terrain-shell','AER-RAI-0001','2001000000044','A weather layer that protects both you and your pack when the weather turns.',3600,0,22,6,'published','Rainwear, Pack Cover')
on conflict (id) do nothing;

insert into public.storefront_products (id, storefront_id, product_id, collection_id, visible, position)
values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',true,1),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',true,2),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003',true,3),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004',true,4)
on conflict (storefront_id, product_id) do nothing;

-- AFTER you create your first account in Control Booth, run this line ONCE,
-- replacing the email address with your own. It makes you the owner:
-- update public.profiles set role = 'owner', full_name = 'Your Name' where id = (select id from auth.users where email = 'you@example.com');
