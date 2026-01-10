-- Core tables for ListingLaunch AI. Apply these in Supabase as a migration.

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  street text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  status text not null default 'draft',
  sms_keyword text,
  sms_phone_number text,
  estated_raw jsonb,
  property jsonb not null,
  branding jsonb,
  ai_content jsonb,
  wizard_answers jsonb,
  disclosures jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists listings_agent_id_idx on public.listings (agent_id);
create index if not exists listings_slug_idx on public.listings (slug);
create index if not exists listings_sms_keyword_idx on public.listings (sms_keyword);

create or replace function public.set_listings_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at
before update on public.listings
for each row
execute function public.set_listings_updated_at();

-- Track whether a listing has already consumed a credit
alter table if not exists public.listings
  add column if not exists credit_consumed boolean not null default false;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  name text,
  email text,
  phone text not null,
  message text,
  source text not null check (source in ('web', 'sms')),
  opted_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists leads_listing_id_idx on public.leads (listing_id);
create index if not exists leads_phone_idx on public.leads (phone);

-- Agent profiles (1:1 with auth.users)
create table if not exists public.agent_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  brokerage text,
  phone text,
  email text,
  headshot_url text,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_agent_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_agent_profiles_updated_at on public.agent_profiles;
create trigger set_agent_profiles_updated_at
before update on public.agent_profiles
for each row
execute function public.set_agent_profiles_updated_at();

-- Credit ledger: source of truth for per-agent credit balance
create table if not exists public.agent_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles (id) on delete cascade,
  delta integer not null,
  reason text not null,
  listing_id uuid references public.listings (id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists agent_credit_ledger_agent_id_idx on public.agent_credit_ledger (agent_id);

-- Credit packages (for bulk discounts)
create table if not exists public.credit_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  stripe_price_id text
);

-- Credit purchase orders (Stripe integration to be wired later)
create table if not exists public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles (id) on delete cascade,
  package_id uuid not null references public.credit_packages (id) on delete restrict,
  credits integer not null,
  price_cents integer not null,
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists credit_orders_agent_id_idx on public.credit_orders (agent_id);
