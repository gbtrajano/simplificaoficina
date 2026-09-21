-- Schema-base para um projeto Supabase novo do Simplifica Oficina.
-- As migrations posteriores evoluem estas estruturas sem depender do PDV.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.licenses (
  id uuid primary key default extensions.gen_random_uuid(),
  key text unique not null,
  customer_name text not null default '',
  customer_email text not null default '',
  max_machines int not null default 1 check (max_machines >= 1),
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.activations (
  id uuid primary key default extensions.gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  machine_id text not null,
  machine_name text not null default '',
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (license_id, machine_id)
);

create table if not exists public.seller_settings (
  id int primary key default 1 check (id = 1),
  password_hash text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.seller_settings (id) values (1) on conflict (id) do nothing;

alter table public.licenses enable row level security;
alter table public.activations enable row level security;
alter table public.seller_settings enable row level security;
revoke all on public.licenses, public.activations, public.seller_settings from anon, authenticated;

create or replace function public._new_license_key()
returns text
language sql
set search_path = public, extensions
as $$
  select upper(
    substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 4)
  );
$$;

create or replace function public.set_seller_password(p_current text, p_new text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare stored text;
begin
  if p_new is null or length(p_new) < 4 then
    raise exception 'A senha deve ter pelo menos 4 caracteres';
  end if;
  select password_hash into stored from public.seller_settings where id = 1 for update;
  if stored is not null and stored <> '' and
     (p_current is null or extensions.crypt(p_current, stored) <> stored) then
    raise exception 'Senha atual incorreta';
  end if;
  update public.seller_settings
     set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), updated_at = now()
   where id = 1;
  return true;
end;
$$;

create or replace function public.seller_password_set()
returns boolean
language sql security definer set search_path = public
as $$
  select coalesce(password_hash, '') <> '' from public.seller_settings where id = 1;
$$;

create or replace function public.activate_license(p_key text, p_machine_id text, p_machine_name text)
returns json
language plpgsql security definer set search_path = public
as $$
declare lic public.licenses%rowtype; registered boolean; count_machines int;
begin
  select * into lic from public.licenses where key = upper(trim(p_key));
  if not found then return json_build_object('status', 'invalid'); end if;
  if lic.status = 'revoked' then return json_build_object('status', 'revoked'); end if;
  if lic.expires_at is not null and lic.expires_at <= now() then return json_build_object('status', 'expired'); end if;
  select exists(select 1 from public.activations where license_id = lic.id and machine_id = p_machine_id) into registered;
  if registered then
    update public.activations set last_seen_at = now(), machine_name = coalesce(nullif(p_machine_name, ''), machine_name)
     where license_id = lic.id and machine_id = p_machine_id;
  else
    select count(*) into count_machines from public.activations where license_id = lic.id;
    if count_machines >= lic.max_machines then return json_build_object('status', 'limit'); end if;
    insert into public.activations(license_id, machine_id, machine_name) values (lic.id, p_machine_id, coalesce(p_machine_name, ''));
  end if;
  return json_build_object('status', 'ok', 'customerName', lic.customer_name, 'expiresAt', lic.expires_at, 'maxMachines', lic.max_machines);
end;
$$;

create or replace function public.check_license(p_key text, p_machine_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare lic public.licenses%rowtype; registered boolean;
begin
  select * into lic from public.licenses where key = upper(trim(p_key));
  if not found then return json_build_object('status', 'invalid'); end if;
  if lic.status = 'revoked' then return json_build_object('status', 'revoked'); end if;
  if lic.expires_at is not null and lic.expires_at <= now() then return json_build_object('status', 'expired'); end if;
  select exists(select 1 from public.activations where license_id = lic.id and machine_id = p_machine_id) into registered;
  if registered then update public.activations set last_seen_at = now() where license_id = lic.id and machine_id = p_machine_id; end if;
  return json_build_object('status', 'ok', 'registered', registered, 'customerName', lic.customer_name, 'expiresAt', lic.expires_at);
end;
$$;

revoke all on function public.set_seller_password(text, text) from public, anon, authenticated;
grant execute on function public.set_seller_password(text, text) to service_role;
grant execute on function public.seller_password_set() to anon;
grant execute on function public.activate_license(text, text, text) to anon;
grant execute on function public.check_license(text, text) to anon;
