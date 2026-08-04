-- Voer dit eenmalig uit in Supabase > SQL Editor.
-- Iedere gebruiker kan uitsluitend de eigen CRM-administratie lezen en wijzigen.

create table if not exists public.crm_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customers jsonb not null default '[]'::jsonb,
  products jsonb not null default '[]'::jsonb,
  invoices jsonb not null default '[]'::jsonb,
  purchase_invoices jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  costs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_state
  add column if not exists purchase_invoices jsonb not null default '[]'::jsonb;

alter table public.crm_state enable row level security;
alter table public.crm_state force row level security;

revoke all on table public.crm_state from public;
revoke all on table public.crm_state from anon;
grant select, insert, update, delete on table public.crm_state to authenticated;

drop policy if exists "Gebruikers lezen eigen CRM" on public.crm_state;
create policy "Gebruikers lezen eigen CRM"
on public.crm_state for select
to authenticated
using ((select auth.uid()) = user_id);

-- Privé opslag voor originele inkoopfacturen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices',
  'invoices',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Gebruikers lezen eigen facturen" on storage.objects;
create policy "Gebruikers lezen eigen facturen"
on storage.objects for select to authenticated
using (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Gebruikers uploaden eigen facturen" on storage.objects;
create policy "Gebruikers uploaden eigen facturen"
on storage.objects for insert to authenticated
with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Gebruikers verwijderen eigen facturen" on storage.objects;
create policy "Gebruikers verwijderen eigen facturen"
on storage.objects for delete to authenticated
using (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

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
