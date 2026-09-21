-- Subcontas da loja: o proprietário da licença pode criar operadores para os caixas.
-- max_users representa o número de subcontas permitidas (não máquinas).

alter table public.licenses add column if not exists max_users int not null default 1 check (max_users >= 1);
update public.licenses set max_users = greatest(coalesce(max_machines, 1), 1) where max_users = 1;

-- Mantém compatibilidade com o formulário antigo: o campo que antes era
-- “máx. máquinas” passa a definir a quantidade de subcontas do plano.
create or replace function public.admin_create_license_for_current_user(
  p_customer_name text, p_customer_email text, p_max_machines int,
  p_expires_at timestamptz, p_notes text
)
returns json language plpgsql security definer set search_path = public
as $$
declare lic public.licenses%rowtype;
begin
  perform public.require_license_admin();
  insert into public.licenses (key, customer_name, customer_email, max_machines, max_users, expires_at, notes)
  values (public._new_license_key(), coalesce(p_customer_name, ''), lower(trim(coalesce(p_customer_email, ''))),
          greatest(coalesce(p_max_machines, 1), 1), greatest(coalesce(p_max_machines, 1), 1),
          p_expires_at, coalesce(p_notes, ''))
  returning * into lic;
  return json_build_object('id', lic.id, 'key', lic.key, 'customer_name', lic.customer_name,
    'customer_email', lic.customer_email, 'max_users', lic.max_users,
    'expires_at', lic.expires_at, 'status', lic.status, 'notes', lic.notes, 'created_at', lic.created_at);
end;
$$;

create table if not exists public.license_members (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'operator' check (role in ('operator', 'manager')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (license_id, email)
);
alter table public.license_members enable row level security;
revoke all on public.license_members from anon, authenticated;

-- A versão anterior retornava três colunas; PostgreSQL exige removê-la antes
-- de criar a assinatura nova com access_role.
drop function if exists public.get_my_license();

create or replace function public.get_my_license()
returns table (key text, customer_name text, expires_at timestamptz, access_role text)
language plpgsql security definer set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  member_role text;
  account_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null or account_email = '' then raise exception 'Faça login com e-mail e senha.'; end if;

  select * into lic from public.licenses where auth_user_id = auth.uid() limit 1;
  if found then member_role := 'owner'; end if;

  if not found then
    select m.role into member_role
    from public.license_members m
    where m.auth_user_id = auth.uid() and m.active = true limit 1;
    if found then
      select l.* into lic
      from public.licenses l join public.license_members m on m.license_id = l.id
      where m.auth_user_id = auth.uid() and m.active = true limit 1;
    end if;
  end if;

  if not found then
    select * into lic from public.licenses where lower(trim(customer_email)) = account_email order by created_at desc limit 1;
    if not found then raise exception 'Este e-mail não possui uma licença cadastrada.'; end if;
    update public.licenses set auth_user_id = auth.uid() where id = lic.id and auth_user_id is null;
    select * into lic from public.licenses where id = lic.id;
    member_role := 'owner';
  end if;

  if lic.status <> 'active' then raise exception 'A licença desta conta está inativa.'; end if;
  if lic.expires_at is not null and lic.expires_at <= now() then raise exception 'A licença desta conta expirou.'; end if;
  return query select lic.key, lic.customer_name, lic.expires_at, member_role;
end;
$$;

revoke all on function public.get_my_license() from public;
grant execute on function public.get_my_license() to authenticated;
