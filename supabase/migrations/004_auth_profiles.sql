-- 004_auth_profiles.sql
-- Profiles table backed by auth.users + helper functions for RLS

-- 1. Profiles table (replaces custom users table)
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  name         text not null,
  role         text not null check (role in ('Developer','Super Admin','Admin','Wali Kelas','Viewer')),
  access_level text check (access_level in ('TK','MI')),
  student_id   text references students(id) on delete cascade,
  assigned_class text,
  demo_mode    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- 2. Helper functions (SECURITY DEFINER STABLE) for RLS policies
-- These avoid recursive subqueries in policies

create or replace function auth_role()
  returns text
  language sql
  stable
  security definer
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_access_level()
  returns text
  language sql
  stable
  security definer
as $$
  select access_level from profiles where id = auth.uid()
$$;

create or replace function auth_student_id()
  returns text
  language sql
  stable
  security definer
as $$
  select student_id from profiles where id = auth.uid()
$$;

create or replace function auth_is_demo()
  returns boolean
  language sql
  stable
  security definer
as $$
  select coalesce(demo_mode, false) from profiles where id = auth.uid()
$$;

create or replace function auth_rank()
  returns int
  language sql
  stable
  security definer
as $$
  select case auth_role()
    when 'Developer' then 4
    when 'Super Admin' then 3
    when 'Admin' then 2
    when 'Wali Kelas' then 1
    else 0
  end
$$;

-- 3. Anti-escalation trigger: prevent users from elevating their own role
create or replace function prevent_self_escalation()
  returns trigger
  language plpgsql
security definer
as $$
begin
  if NEW.id = auth.uid() then
    if NEW.role is distinct from OLD.role then
      raise exception 'Cannot change your own role';
    end if;
    if NEW.access_level is distinct from OLD.access_level then
      raise exception 'Cannot change your own access level';
    end if;
    if NEW.demo_mode is distinct from OLD.demo_mode then
      raise exception 'Cannot change your own demo mode';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger trigger_prevent_self_escalation
  before update on profiles
  for each row
  execute function prevent_self_escalation();

-- 4. Enable RLS (policies added in 006_rls_real.sql)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
