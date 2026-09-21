-- Administrador do painel de licenças por e-mail autenticado.
-- Execute depois de 20260919_email_auth.sql.

create table if not exists public.license_admins (
  email text primary key check (email = lower(email))
);

-- Troque ou acrescente e-mails com: insert into public.license_admins values ('outro@email.com');
insert into public.license_admins (email)
values ('conversarcomgabriel@gmail.com')
on conflict (email) do nothing;

alter table public.license_admins enable row level security;
revoke all on public.license_admins from anon, authenticated;

create or replace function public.is_license_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.license_admins
    where email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

create or replace function public.require_license_admin()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_license_admin() then
    raise exception 'Esta conta não tem permissão para administrar licenças.';
  end if;
end;
$$;

create or replace function public.admin_list_licenses_for_current_user()
returns json language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_license_admin();
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select l.id, l.key, l.customer_name, l.customer_email, l.max_machines,
             l.status, l.expires_at, l.notes, l.created_at,
             (select count(*) from public.activations a where a.license_id = l.id) as activation_count,
             (select coalesce(json_agg(json_build_object(
               'id', a.id, 'machine_id', a.machine_id, 'machine_name', a.machine_name,
               'activated_at', a.activated_at, 'last_seen_at', a.last_seen_at
             ) order by a.last_seen_at desc), '[]'::json)
              from public.activations a where a.license_id = l.id) as activations
      from public.licenses l
    ) t
  );
end;
$$;

create or replace function public.admin_create_license_for_current_user(
  p_customer_name text, p_customer_email text, p_max_machines int,
  p_expires_at timestamptz, p_notes text
)
returns json language plpgsql security definer set search_path = public
as $$
declare lic public.licenses%rowtype;
begin
  perform public.require_license_admin();
  insert into public.licenses (key, customer_name, customer_email, max_machines, expires_at, notes)
  values (public._new_license_key(), coalesce(p_customer_name, ''), lower(trim(coalesce(p_customer_email, ''))),
          greatest(coalesce(p_max_machines, 1), 1), p_expires_at, coalesce(p_notes, ''))
  returning * into lic;
  return json_build_object('id', lic.id, 'key', lic.key, 'customer_name', lic.customer_name,
    'customer_email', lic.customer_email, 'max_machines', lic.max_machines,
    'expires_at', lic.expires_at, 'status', lic.status, 'notes', lic.notes, 'created_at', lic.created_at);
end;
$$;

create or replace function public.admin_set_license_status_for_current_user(p_license_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_license_admin();
  if p_status not in ('active', 'revoked') then raise exception 'Status inválido'; end if;
  update public.licenses set status = p_status where id = p_license_id;
  if not found then raise exception 'Licença não encontrada'; end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.admin_extend_license_for_current_user(p_license_id uuid, p_expires_at timestamptz)
returns json language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_license_admin();
  update public.licenses set expires_at = p_expires_at where id = p_license_id;
  if not found then raise exception 'Licença não encontrada'; end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.admin_delete_activation_for_current_user(p_activation_id uuid)
returns json language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_license_admin();
  delete from public.activations where id = p_activation_id;
  if not found then raise exception 'Ativação não encontrada'; end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.admin_delete_license_for_current_user(p_license_id uuid)
returns json language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_license_admin();
  delete from public.licenses where id = p_license_id;
  if not found then raise exception 'Licença não encontrada'; end if;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.is_license_admin() from public;
grant execute on function public.is_license_admin() to authenticated;
revoke all on function public.require_license_admin() from public;
grant execute on function public.admin_list_licenses_for_current_user() to authenticated;
grant execute on function public.admin_create_license_for_current_user(text, text, int, timestamptz, text) to authenticated;
grant execute on function public.admin_set_license_status_for_current_user(uuid, text) to authenticated;
grant execute on function public.admin_extend_license_for_current_user(uuid, timestamptz) to authenticated;
grant execute on function public.admin_delete_activation_for_current_user(uuid) to authenticated;
grant execute on function public.admin_delete_license_for_current_user(uuid) to authenticated;
