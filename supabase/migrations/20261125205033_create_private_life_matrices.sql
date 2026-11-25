-- Private account matrices; version matches the verified test migration.
begin;
create table public.life_matrices (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);
alter table public.life_matrices enable row level security;
revoke all on public.life_matrices from public, anon, authenticated;
grant select, insert on public.life_matrices to authenticated;
grant update (revision, snapshot) on public.life_matrices to authenticated;
create policy matrix_read on public.life_matrices for select to authenticated using (owner_id = (select auth.uid()));
create policy matrix_create on public.life_matrices for insert to authenticated with check (owner_id = (select auth.uid()));
create policy matrix_edit on public.life_matrices for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;
