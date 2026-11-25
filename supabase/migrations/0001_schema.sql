-- =====================================================================
-- 네트워크 판매 시스템 스키마 (Supabase / Postgres)
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 실행하세요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 직급
-- ---------------------------------------------------------------------
create table public.ranks (
  level            int primary key,
  name             text not null,
  min_personal_pv  numeric not null default 0,
  min_group_pv     numeric not null default 0,
  min_direct_count int not null default 0,
  bonus_rate       numeric not null default 0 check (bonus_rate >= 0 and bonus_rate <= 35)
);

insert into public.ranks (level, name, min_personal_pv, min_group_pv, min_direct_count, bonus_rate) values
  (0, '회원',       0,     0,      0, 0),
  (1, '브론즈',   100,  1000,      2, 2),
  (2, '실버',     200,  5000,      3, 4),
  (3, '골드',     300, 20000,      4, 6),
  (4, '다이아몬드', 500, 100000,   5, 8);

-- ---------------------------------------------------------------------
-- 회원
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  name             text not null default '',
  referral_code    text not null unique,
  role             text not null default 'member' check (role in ('member', 'admin')),
  status           text not null default 'active' check (status in ('active', 'suspended')),
  -- 추천(스폰서) 트리: 유니레벨 / 직급 수당 기준
  sponsor_id       uuid references public.profiles(id),
  -- 바이너리 트리
  binary_parent_id uuid references public.profiles(id),
  binary_position  char(1) check (binary_position in ('L', 'R')),
  -- 매트릭스 트리
  matrix_parent_id uuid references public.profiles(id),
  matrix_position  int,
  rank_level       int not null default 0 references public.ranks(level),
  wallet_address   text unique,
  wallet_nonce     text,
  placed           boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (binary_parent_id, binary_position),
  unique (matrix_parent_id, matrix_position)
);
create index profiles_sponsor_idx on public.profiles (sponsor_id);
create index profiles_matrix_parent_idx on public.profiles (matrix_parent_id);

-- 가입 시 프로필 자동 생성 (첫 가입자 = 관리자 겸 최상위 루트)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;
  insert into public.profiles (id, email, name, referral_code, role, placed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    v_code,
    case when v_first then 'admin' else 'member' end,
    v_first
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 수당 플랜 설정 (단일 행)
-- ---------------------------------------------------------------------
create table public.settings (
  id         int primary key default 1 check (id = 1),
  config     jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (id, config) values (1, '{
  "unilevel": { "enabled": true, "rates": [8, 4, 2, 1, 1], "compression": true, "activeMinPv": 0 },
  "binary":   { "enabled": true, "rate": 6, "capPerPeriod": 1000 },
  "matrix":   { "enabled": false, "width": 3, "rates": [1, 1, 1, 1, 1, 1, 1] },
  "rank":     { "enabled": true },
  "payoutCapPercent": 35
}');

-- ---------------------------------------------------------------------
-- 상품 / 주문
-- ---------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  price       numeric(18, 2) not null check (price > 0),
  pv          numeric(18, 2) not null check (pv >= 0),
  image_url   text,
  stock       int check (stock is null or stock >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  member_id             uuid not null references public.profiles(id),
  status                text not null default 'pending'
                        check (status in ('pending', 'paid', 'refunded', 'cancelled')),
  payment_method        text not null check (payment_method in ('crypto', 'manual')),
  total_amount          numeric(18, 2) not null,
  total_pv              numeric(18, 2) not null,
  tx_hash               text unique,
  pay_from              text,
  commissions_processed boolean not null default false,
  paid_at               timestamptz,
  refunded_at           timestamptz,
  created_at            timestamptz not null default now()
);
create index orders_member_idx on public.orders (member_id, status);
create index orders_paid_at_idx on public.orders (paid_at) where status = 'paid';

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  name       text not null,
  qty        int not null check (qty > 0),
  unit_price numeric(18, 2) not null,
  unit_pv    numeric(18, 2) not null
);

-- ---------------------------------------------------------------------
-- 수당 / 바이너리 실적 / 정산 / 출금
-- ---------------------------------------------------------------------
create table public.commissions (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.profiles(id),
  type             text not null check (type in ('unilevel', 'binary', 'matrix', 'rank')),
  level            int not null default 0,
  order_id         uuid references public.orders(id),
  source_member_id uuid references public.profiles(id),
  settlement_id    uuid,
  base_pv          numeric(18, 2) not null default 0,
  rate             numeric(8, 4) not null default 0,
  amount           numeric(18, 2) not null check (amount >= 0),
  status           text not null default 'confirmed' check (status in ('confirmed', 'reversed')),
  created_at       timestamptz not null default now()
);
create index commissions_member_idx on public.commissions (member_id, created_at desc);
create index commissions_order_idx on public.commissions (order_id);

create table public.binary_volumes (
  member_id  uuid primary key references public.profiles(id),
  left_pv    numeric(18, 2) not null default 0,
  right_pv   numeric(18, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.settlements (
  id            uuid primary key default gen_random_uuid(),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  sales_amount  numeric(18, 2) not null default 0,
  order_payouts numeric(18, 2) not null default 0,
  binary_pool   numeric(18, 2) not null default 0,
  binary_paid   numeric(18, 2) not null default 0,
  rank_changes  int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.commissions
  add constraint commissions_settlement_fk foreign key (settlement_id) references public.settlements(id);

create table public.payouts (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.profiles(id),
  amount         numeric(18, 2) not null check (amount > 0),
  wallet_address text not null,
  status         text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  tx_hash        text,
  created_at     timestamptz not null default now(),
  processed_at   timestamptz
);

-- 회원당 처리 대기 출금은 1건만
create unique index payouts_one_pending on public.payouts (member_id) where status = 'requested';

create view public.member_balances
with (security_invoker = true) as
select
  p.id as member_id,
  coalesce((select sum(c.amount) from public.commissions c
            where c.member_id = p.id and c.status = 'confirmed'), 0) as earned,
  coalesce((select sum(w.amount) from public.payouts w
            where w.member_id = p.id and w.status in ('requested', 'paid')), 0) as withdrawn
from public.profiles p;

-- ---------------------------------------------------------------------
-- 트리 조회 함수
-- ---------------------------------------------------------------------

-- 추천 라인 상위 (depth 1 = 직속 스폰서). recent_pv = 최근 30일 개인 PV
create or replace function public.sponsor_upline(p_member uuid, p_max int)
returns table (member_id uuid, depth int, status text, rank_level int, recent_pv numeric)
language sql stable
as $$
  with recursive up as (
    select p.sponsor_id as mid, 1 as d
    from public.profiles p
    where p.id = p_member and p.sponsor_id is not null
    union all
    select p.sponsor_id, up.d + 1
    from up join public.profiles p on p.id = up.mid
    where p.sponsor_id is not null and up.d < p_max
  )
  select up.mid, up.d, pr.status, pr.rank_level,
         coalesce((select sum(o.total_pv) from public.orders o
                   where o.member_id = up.mid and o.status = 'paid'
                     and o.paid_at > now() - interval '30 days'), 0)
  from up join public.profiles pr on pr.id = up.mid
  order by up.d;
$$;

create or replace function public.matrix_upline(p_member uuid, p_max int)
returns table (member_id uuid, depth int, status text, rank_level int, recent_pv numeric)
language sql stable
as $$
  with recursive up as (
    select p.matrix_parent_id as mid, 1 as d
    from public.profiles p
    where p.id = p_member and p.matrix_parent_id is not null
    union all
    select p.matrix_parent_id, up.d + 1
    from up join public.profiles p on p.id = up.mid
    where p.matrix_parent_id is not null and up.d < p_max
  )
  select up.mid, up.d, pr.status, pr.rank_level,
         coalesce((select sum(o.total_pv) from public.orders o
                   where o.member_id = up.mid and o.status = 'paid'
                     and o.paid_at > now() - interval '30 days'), 0)
  from up join public.profiles pr on pr.id = up.mid
  order by up.d;
$$;

-- 바이너리 상위 + 해당 상위자 기준 어느 다리(L/R)에 속하는지
create or replace function public.binary_upline(p_member uuid)
returns table (member_id uuid, side char(1), depth int)
language sql stable
as $$
  with recursive up as (
    select p.binary_parent_id as mid, p.binary_position as s, 1 as d
    from public.profiles p
    where p.id = p_member and p.binary_parent_id is not null
    union all
    select p.binary_parent_id, p.binary_position, up.d + 1
    from up join public.profiles p on p.id = up.mid
    where p.binary_parent_id is not null and up.d < 10000
  )
  select mid, s, d from up order by d;
$$;

-- PV를 바이너리 상위 전체의 해당 다리에 누적 (환불 시 음수)
create or replace function public.add_binary_volume(p_member uuid, p_pv numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select * from public.binary_upline(p_member) loop
    insert into public.binary_volumes (member_id, left_pv, right_pv)
    values (r.member_id,
            case when r.side = 'L' then p_pv else 0 end,
            case when r.side = 'R' then p_pv else 0 end)
    on conflict (member_id) do update
      set left_pv    = public.binary_volumes.left_pv  + excluded.left_pv,
          right_pv   = public.binary_volumes.right_pv + excluded.right_pv,
          updated_at = now();
  end loop;
end;
$$;

-- 하위 조직 조회 (tree: 'sponsor' | 'binary' | 'matrix')
create or replace function public.downline(p_root uuid, p_tree text, p_max int)
returns table (id uuid, parent_id uuid, depth int, name text, referral_code text,
               rank_level int, binary_position char(1), matrix_position int,
               status text, created_at timestamptz)
language sql stable
as $$
  with recursive down as (
    select p.id, null::uuid as parent, 0 as d
    from public.profiles p where p.id = p_root
    union all
    select c.id,
           case p_tree when 'binary' then c.binary_parent_id
                       when 'matrix' then c.matrix_parent_id
                       else c.sponsor_id end,
           down.d + 1
    from down
    join public.profiles c on
      (p_tree = 'sponsor' and c.sponsor_id = down.id) or
      (p_tree = 'binary'  and c.binary_parent_id = down.id) or
      (p_tree = 'matrix'  and c.matrix_parent_id = down.id)
    where down.d < p_max
  )
  select d.id, d.parent, d.d, p.name, p.referral_code, p.rank_level,
         p.binary_position, p.matrix_position, p.status, p.created_at
  from down d join public.profiles p on p.id = d.id
  order by d.d, p.created_at;
$$;

-- 결제 확정 시 재고 차감
create or replace function public.decrement_stock(p_order uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
     set stock = greatest(0, p.stock - i.qty)
    from (select product_id, sum(qty) as qty from public.order_items
          where order_id = p_order group by product_id) i
   where p.id = i.product_id and p.stock is not null;
$$;

-- 트리 함수는 서버(service_role)에서만 호출
revoke execute on function public.sponsor_upline(uuid, int) from public, anon, authenticated;
revoke execute on function public.matrix_upline(uuid, int)  from public, anon, authenticated;
revoke execute on function public.binary_upline(uuid)       from public, anon, authenticated;
revoke execute on function public.add_binary_volume(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.downline(uuid, text, int) from public, anon, authenticated;
grant execute on function public.sponsor_upline(uuid, int) to service_role;
grant execute on function public.matrix_upline(uuid, int)  to service_role;
grant execute on function public.binary_upline(uuid)       to service_role;
grant execute on function public.add_binary_volume(uuid, numeric) to service_role;
grant execute on function public.downline(uuid, text, int) to service_role;
revoke execute on function public.decrement_stock(uuid) from public, anon, authenticated;
grant execute on function public.decrement_stock(uuid) to service_role;

-- ---------------------------------------------------------------------
-- RLS: 회원은 본인 데이터만 읽기. 모든 쓰기는 서버(service_role)에서 처리
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.ranks          enable row level security;
alter table public.settings       enable row level security;
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.commissions    enable row level security;
alter table public.binary_volumes enable row level security;
alter table public.settlements    enable row level security;
alter table public.payouts        enable row level security;

create policy "own profile"      on public.profiles       for select to authenticated using (id = auth.uid());
create policy "ranks readable"   on public.ranks          for select using (true);
create policy "settings read"    on public.settings       for select to authenticated using (true);
create policy "active products"  on public.products       for select using (active);
create policy "own orders"       on public.orders         for select to authenticated using (member_id = auth.uid());
create policy "own order items"  on public.order_items    for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.member_id = auth.uid()));
create policy "own commissions"  on public.commissions    for select to authenticated using (member_id = auth.uid());
create policy "own volumes"      on public.binary_volumes for select to authenticated using (member_id = auth.uid());
create policy "own payouts"      on public.payouts        for select to authenticated using (member_id = auth.uid());
