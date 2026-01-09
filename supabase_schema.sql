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
