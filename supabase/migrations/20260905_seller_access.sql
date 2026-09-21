-- Execute no SQL Editor do mesmo projeto Supabase antes de distribuir a nova versao.
-- Preserva a senha master, as licencas e as ativacoes existentes.
begin;

create or replace function set_seller_password(p_current text, p_new text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare
  stored text;
begin
  if p_new is null or length(p_new) < 4 then
    raise exception 'A senha deve ter pelo menos 4 caracteres';
  end if;
  select password_hash into stored from seller_settings where id = 1 for update;
  if stored is not null and stored <> '' then
    if p_current is null or extensions.crypt(p_current, stored) <> stored then
      raise exception 'Senha atual incorreta';
    end if;
  end if;
  update seller_settings
     set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where id = 1;
  return true;
end $$;

create or replace function admin_create_license(
  p_seller_password text,
  p_customer_name text,
  p_customer_email text,
  p_max_machines int,
  p_expires_at timestamptz,
  p_notes text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  stored text;
  new_key text;
  lic licenses%rowtype;
begin
  select password_hash into stored from seller_settings where id = 1;
  if stored is null or stored = '' or p_seller_password is null or p_seller_password = '' or extensions.crypt(p_seller_password, stored) is distinct from stored then
    raise exception 'Senha do vendedor inválida';
  end if;
  new_key := _new_license_key();
  insert into licenses (key, customer_name, customer_email, max_machines, expires_at, notes)
  values (new_key,
          coalesce(p_customer_name, ''),
          coalesce(p_customer_email, ''),
          coalesce(p_max_machines, 1),
          p_expires_at,
          coalesce(p_notes, ''))
  returning * into lic;
  return json_build_object(
    'id', lic.id, 'key', lic.key, 'customerName', lic.customer_name,
    'customerEmail', lic.customer_email, 'maxMachines', lic.max_machines,
    'expiresAt', lic.expires_at, 'status', lic.status, 'notes', lic.notes,
    'createdAt', lic.created_at
  );
end $$;

create or replace function admin_list_licenses(p_seller_password text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  stored text;
begin
  select password_hash into stored from seller_settings where id = 1;
  if stored is null or stored = '' or p_seller_password is null or p_seller_password = '' or extensions.crypt(p_seller_password, stored) is distinct from stored then
    raise exception 'Senha do vendedor inválida';
  end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select l.id, l.key, l.customer_name, l.customer_email, l.max_machines,
             l.status, l.expires_at, l.notes, l.created_at,
             (select count(*) from activations a where a.license_id = l.id) as activation_count,
             (select coalesce(json_agg(json_build_object(
                'id', a.id, 'machineId', a.machine_id, 'machineName', a.machine_name,
                'activatedAt', a.activated_at, 'lastSeenAt', a.last_seen_at
              ) order by a.last_seen_at desc), '[]'::json)
              from activations a where a.license_id = l.id) as activations
      from licenses l
    ) t
  );
end $$;

create or replace function admin_set_license_status(
  p_seller_password text,
  p_license_id uuid,
  p_status text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  stored text;
  lic licenses%rowtype;
begin
  select password_hash into stored from seller_settings where id = 1;
  if stored is null or stored = '' or p_seller_password is null or p_seller_password = '' or extensions.crypt(p_seller_password, stored) is distinct from stored then
    raise exception 'Senha do vendedor inválida';
  end if;
  if p_status not in ('active', 'revoked') then
    raise exception 'Status inválido';
  end if;
  update licenses set status = p_status where id = p_license_id returning * into lic;
  if lic.id is null then
    raise exception 'Licença não encontrada';
  end if;
  return json_build_object('ok', true, 'status', lic.status);
end $$;

create or replace function admin_extend_license(
  p_seller_password text,
  p_license_id uuid,
  p_expires_at timestamptz
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  stored text;
  lic licenses%rowtype;
begin
  select password_hash into stored from seller_settings where id = 1;
  if stored is null or stored = '' or p_seller_password is null or p_seller_password = '' or extensions.crypt(p_seller_password, stored) is distinct from stored then
    raise exception 'Senha do vendedor inválida';
  end if;
  update licenses set expires_at = p_expires_at where id = p_license_id returning * into lic;
  if lic.id is null then
    raise exception 'Licença não encontrada';
  end if;
  return json_build_object('ok', true, 'expiresAt', lic.expires_at);
end $$;

create or replace function admin_delete_activation(
  p_seller_password text,
  p_activation_id uuid
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  stored text;
begin
  select password_hash into stored from seller_settings where id = 1;
  if stored is null or stored = '' or p_seller_password is null or p_seller_password = '' or extensions.crypt(p_seller_password, stored) is distinct from stored then
    raise exception 'Senha do vendedor inválida';
  end if;
  delete from activations where id = p_activation_id;
  return json_build_object('ok', true);
end $$;

create or replace function admin_delete_license(
  p_seller_password text,
  p_license_id uuid
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  stored text;
begin
  select password_hash into stored from seller_settings where id = 1;
  if stored is null or stored = '' or p_seller_password is null or p_seller_password = '' or extensions.crypt(p_seller_password, stored) is distinct from stored then
    raise exception 'Senha do vendedor inválida';
  end if;
  delete from licenses where id = p_license_id;
  return json_build_object('ok', true);
end $$;

revoke all on function set_seller_password(text, text) from public, anon, authenticated;
grant execute on function set_seller_password(text, text) to service_role;

commit;
