-- Voer dit eenmalig uit in Supabase > SQL Editor.
-- Iedere gebruiker kan uitsluitend de eigen CRM-administratie lezen en wijzigen.

create table if not exists public.crm_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customers jsonb not null default '[]'::jsonb,
  products jsonb not null default '[]'::jsonb,
  invoices jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  costs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_state enable row level security;

revoke all on table public.crm_state from anon;
grant select, insert, update, delete on table public.crm_state to authenticated;

drop policy if exists "Gebruikers lezen eigen CRM" on public.crm_state;
create policy "Gebruikers lezen eigen CRM"
on public.crm_state for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Gebruikers maken eigen CRM" on public.crm_state;
create policy "Gebruikers maken eigen CRM"
on public.crm_state for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Gebruikers wijzigen eigen CRM" on public.crm_state;
create policy "Gebruikers wijzigen eigen CRM"
on public.crm_state for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Gebruikers verwijderen eigen CRM" on public.crm_state;
create policy "Gebruikers verwijderen eigen CRM"
on public.crm_state for delete
to authenticated
using ((select auth.uid()) = user_id);

