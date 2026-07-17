create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournaments (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  format text not null check (format in ('league', 'knockout', 'hybrid')),
  status text not null check (status in ('active', 'completed')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_members (
  tournament_id text not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create table public.tournament_invites (
  id bigint generated always as identity primary key,
  tournament_id text not null references public.tournaments (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);

-- A claim is intentionally never persisted. The before-insert trigger validates
-- the hashed code and creates the membership atomically.
create table public.invite_claims (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index tournaments_owner_id_idx on public.tournaments (owner_id);
create index tournaments_updated_at_idx on public.tournaments (updated_at desc);
create index tournament_members_user_id_idx on public.tournament_members (user_id);
create index tournament_invites_tournament_id_idx on public.tournament_invites (tournament_id);
create index tournament_invites_created_by_idx on public.tournament_invites (created_by);
create index tournament_invites_accepted_by_idx on public.tournament_invites (accepted_by);
create index tournament_invites_active_idx
  on public.tournament_invites (token_hash)
  where accepted_at is null and revoked_at is null;
create index invite_claims_user_id_idx on public.invite_claims (user_id);

create or replace function private.is_tournament_member(p_tournament_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tournament_members member
      where member.tournament_id = p_tournament_id
        and member.user_id = (select auth.uid())
    );
$$;

create or replace function private.can_edit_tournament(p_tournament_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tournament_members member
      where member.tournament_id = p_tournament_id
        and member.user_id = (select auth.uid())
        and member.role in ('owner', 'editor')
    );
$$;

create or replace function private.is_tournament_owner(p_tournament_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tournaments tournament
      where tournament.id = p_tournament_id
        and tournament.owner_id = (select auth.uid())
    );
$$;

create or replace function private.shares_tournament(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tournament_members mine
      join public.tournament_members theirs
        on theirs.tournament_id = mine.tournament_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = p_other_user_id
    );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Giocatore'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.prepare_tournament()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := coalesce(nullif(trim(new.data ->> 'name'), ''), new.name);
  new.format := coalesce(nullif(new.data ->> 'format', ''), new.format);
  new.status := coalesce(nullif(new.data ->> 'status', ''), new.status);
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

create trigger prepare_tournament_before_write
  before insert or update on public.tournaments
  for each row execute function private.prepare_tournament();

create or replace function private.add_tournament_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tournament_members (tournament_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger add_tournament_owner_after_insert
  after insert on public.tournaments
  for each row execute function private.add_tournament_owner();

create or replace function private.protect_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tournament_owner uuid;
begin
  select tournament.owner_id
    into tournament_owner
  from public.tournaments tournament
  where tournament.id = old.tournament_id;

  if old.user_id = tournament_owner then
    raise exception 'The tournament owner membership cannot be changed or removed.';
  end if;

  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.tournament_id <> old.tournament_id) then
    raise exception 'Membership identity cannot be changed.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_owner_membership_before_write
  before update or delete on public.tournament_members
  for each row execute function private.protect_owner_membership();

create or replace function private.claim_tournament_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.tournament_invites%rowtype;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'Authentication required.';
  end if;

  select candidate.*
    into invite
  from public.tournament_invites candidate
  where candidate.token_hash = new.token_hash
    and candidate.accepted_at is null
    and candidate.revoked_at is null
    and candidate.expires_at > now()
  for update;

  if not found then
    raise exception 'Invite invalid, expired, or already used.';
  end if;

  insert into public.tournament_members (tournament_id, user_id, role)
  values (invite.tournament_id, new.user_id, invite.role)
  on conflict (tournament_id, user_id) do update
    set role = case
      when public.tournament_members.role = 'owner' then 'owner'
      else excluded.role
    end;

  update public.tournament_invites
  set accepted_at = now(), accepted_by = new.user_id
  where id = invite.id;

  -- Returning null makes this a command table: the sensitive claim hash is
  -- consumed by the trigger and never stored.
  return null;
end;
$$;

create trigger claim_tournament_invite_before_insert
  before insert on public.invite_claims
  for each row execute function private.claim_tournament_invite();

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_members enable row level security;
alter table public.tournament_invites enable row level security;
alter table public.invite_claims enable row level security;

create policy profiles_select_collaborators
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.shares_tournament(id))
  );

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy tournaments_select_members
  on public.tournaments for select
  to authenticated
  using ((select private.is_tournament_member(id)));

create policy tournaments_insert_owner
  on public.tournaments for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy tournaments_update_editors
  on public.tournaments for update
  to authenticated
  using ((select private.can_edit_tournament(id)))
  with check ((select private.can_edit_tournament(id)));

create policy tournaments_delete_owner
  on public.tournaments for delete
  to authenticated
  using ((select private.is_tournament_owner(id)));

create policy tournament_members_select_members
  on public.tournament_members for select
  to authenticated
  using ((select private.is_tournament_member(tournament_id)));

create policy tournament_members_update_owner
  on public.tournament_members for update
  to authenticated
  using ((select private.is_tournament_owner(tournament_id)))
  with check (
    (select private.is_tournament_owner(tournament_id))
    and role in ('editor', 'viewer')
  );

create policy tournament_members_delete_owner_or_self
  on public.tournament_members for delete
  to authenticated
  using (
    (select private.is_tournament_owner(tournament_id))
    or user_id = (select auth.uid())
  );

create policy tournament_invites_select_owner
  on public.tournament_invites for select
  to authenticated
  using ((select private.is_tournament_owner(tournament_id)));

create policy tournament_invites_insert_owner
  on public.tournament_invites for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_tournament_owner(tournament_id))
  );

create policy tournament_invites_update_owner
  on public.tournament_invites for update
  to authenticated
  using ((select private.is_tournament_owner(tournament_id)))
  with check ((select private.is_tournament_owner(tournament_id)));

create policy tournament_invites_delete_owner
  on public.tournament_invites for delete
  to authenticated
  using ((select private.is_tournament_owner(tournament_id)));

create policy invite_claims_insert_self
  on public.invite_claims for insert
  to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
revoke all on public.tournaments from anon, authenticated;
revoke all on public.tournament_members from anon, authenticated;
revoke all on public.tournament_invites from anon, authenticated;
revoke all on public.invite_claims from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

grant select, delete on public.tournaments to authenticated;
grant insert (id, owner_id, name, format, status, data) on public.tournaments to authenticated;
grant update (name, format, status, data, updated_at) on public.tournaments to authenticated;

grant select on public.tournament_members to authenticated;
grant update (role) on public.tournament_members to authenticated;
grant delete on public.tournament_members to authenticated;

grant select, delete on public.tournament_invites to authenticated;
grant insert (tournament_id, token_hash, role, expires_at) on public.tournament_invites to authenticated;
grant usage, select on sequence public.tournament_invites_id_seq to authenticated;

grant insert (user_id, token_hash) on public.invite_claims to authenticated;
grant usage, select on sequence public.invite_claims_id_seq to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_tournament_member(text) to authenticated;
grant execute on function private.can_edit_tournament(text) to authenticated;
grant execute on function private.is_tournament_owner(text) to authenticated;
grant execute on function private.shares_tournament(uuid) to authenticated;

alter table public.tournaments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournaments'
  ) then
    alter publication supabase_realtime add table public.tournaments;
  end if;
end;
$$;
