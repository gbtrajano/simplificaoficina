-- ============================================================
-- SimplificaPDV â€” Schema de Licenciamento (Supabase)
-- Rode este script no SQL Editor do seu projeto Supabase.
-- Depois defina a senha do vendedor:
--   select set_seller_password('', 'SUA_SENHA_AQUI');
-- ============================================================

-- Habilita pgcrypto (bcrypt) â€” no Supabase a extensÃ£o fica no schema "extensions".
-- Se este comando falhar porque a extensÃ£o jÃ¡ existe em outro schema, tudo bem;
-- apenas garanta que ela esteja habilitada (Database > Extensions no painel).
create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabelas ----------

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  customer_name text not null default '',
  customer_email text not null default '',
  max_machines int not null default 1,
  status text not null default 'active',      -- active | revoked
  expires_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  machine_id text not null,
  machine_name text not null default '',
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (license_id, machine_id)
);

create table if not exists seller_settings (
  id int primary key default 1 check (id = 1),
  password_hash text not null default '',
  updated_at timestamptz not null default now()
);

insert into seller_settings (id) values (1) on conflict (id) do nothing;

-- ---------- SeguranÃ§a: nada acessÃ­vel diretamente pela API ----------
alter table licenses enable row level security;
alter table activations enable row level security;
alter table seller_settings enable row level security;

-- Revoga acesso direto (anon e autenticado sÃ³ usam as funÃ§Ãµes abaixo)
revoke all on licenses, activations, seller_settings from anon, authenticated;

-- ---------- Senha do vendedor ----------

-- Define/atualiza a senha somente via SQL Editor ou service_role (nunca pelo app).
-- Na primeira vez, p_current deve ser ''.
-- Usa pgcrypto (extensions.crypt / extensions.gen_salt) explicitamente.
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

revoke all on function set_seller_password(text, text) from public, anon, authenticated;
grant execute on function set_seller_password(text, text) to service_role;

-- Verifica se a senha do vendedor jÃ¡ foi definida (usado pela tela de ativaÃ§Ã£o inicial)
create or replace function seller_password_set()
returns boolean
language sql security definer set search_path = public
as $$
  select coalesce(password_hash, '') <> '' from seller_settings where id = 1;
$$;

grant execute on function seller_password_set() to anon;

-- ---------- AtivaÃ§Ã£o / validaÃ§Ã£o da licenÃ§a (usada pelo app do cliente) ----------

-- Idempotente: ativa a mÃ¡quina ou retorna o estado atual da licenÃ§a.
create or replace function activate_license(
  p_key text,
  p_machine_id text,
  p_machine_name text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  lic licenses%rowtype;
  registered boolean;
  cnt int;
begin
  select * into lic from licenses where key = upper(trim(p_key));
  if lic.id is null then
    return json_build_object('status', 'invalid');
  end if;

  if lic.status = 'revoked' then
    return json_build_object('status', 'revoked', 'message', 'LicenÃ§a revogada pelo vendedor');
  end if;

  if lic.expires_at is not null and lic.expires_at < now() then
    return json_build_object('status', 'expired', 'message', 'LicenÃ§a expirada');
  end if;

  select exists(
    select 1 from activations a
    where a.license_id = lic.id and a.machine_id = p_machine_id
  ) into registered;

  if registered then
    update activations
       set last_seen_at = now(), machine_name = coalesce(nullif(p_machine_name, ''), machine_name)
     where license_id = lic.id and machine_id = p_machine_id;
  else
    select count(*) into cnt from activations where license_id = lic.id;
    if cnt >= lic.max_machines then
      return json_build_object(
        'status', 'limit',
        'message', 'Limite de mÃ¡quinas atingido para esta licenÃ§a'
      );
    end if;
    insert into activations (license_id, machine_id, machine_name)
    values (lic.id, p_machine_id, p_machine_name);
  end if;

  return json_build_object(
    'status', 'ok',
    'customerName', lic.customer_name,
    'expiresAt', lic.expires_at,
    'maxMachines', lic.max_machines
  );
end $$;

grant execute on function activate_license(text, text, text) to anon;

-- VerificaÃ§Ã£o periÃ³dica do app (nÃ£o registra mÃ¡quina nova, apenas informa estado)
create or replace function check_license(p_key text, p_machine_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  lic licenses%rowtype;
  registered boolean;
begin
  select * into lic from licenses where key = upper(trim(p_key));
  if lic.id is null then
    return json_build_object('status', 'invalid');
  end if;

  if lic.status = 'revoked' then
    return json_build_object('status', 'revoked', 'message', 'LicenÃ§a revogada pelo vendedor');
  end if;

  if lic.expires_at is not null and lic.expires_at < now() then
    return json_build_object('status', 'expired', 'message', 'LicenÃ§a expirada');
  end if;

  select exists(
    select 1 from activations a
    where a.license_id = lic.id and a.machine_id = p_machine_id
  ) into registered;

  if registered then
    update activations
       set last_seen_at = now()
     where license_id = lic.id and machine_id = p_machine_id;
  end if;

  return json_build_object(
    'status', 'ok',
    'registered', registered,
    'customerName', lic.customer_name,
    'expiresAt', lic.expires_at,
    'maxMachines', lic.max_machines
  );
end $$;

grant execute on function check_license(text, text) to anon;

-- ---------- FunÃ§Ãµes administrativas (vendedor) ----------
-- Todas exigem a senha do vendedor no primeiro parÃ¢metro.

-- Gera uma chave: XXXX-XXXX-XXXX-XXXX
create or replace function _new_license_key()
returns text
language sql
as $$
  select upper(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)
  );
$$;

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
    raise exception 'Senha do vendedor invÃ¡lida';
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

grant execute on function admin_create_license(text, text, text, int, timestamptz, text) to anon;

create or replace function admin_list_licenses(p_seller_password text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  stored text;
begin
  select password_hash into stored from seller_settings where id = 1;
  if stored is null or stored = '' or p_seller_password is null or p_seller_password = '' or extensions.crypt(p_seller_password, stored) is distinct from stored then
    raise exception 'Senha do vendedor invÃ¡lida';
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

grant execute on function admin_list_licenses(text) to anon;

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
    raise exception 'Senha do vendedor invÃ¡lida';
  end if;
  if p_status not in ('active', 'revoked') then
    raise exception 'Status invÃ¡lido';
  end if;
  update licenses set status = p_status where id = p_license_id returning * into lic;
  if lic.id is null then
    raise exception 'LicenÃ§a nÃ£o encontrada';
  end if;
  return json_build_object('ok', true, 'status', lic.status);
end $$;

grant execute on function admin_set_license_status(text, uuid, text) to anon;

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
    raise exception 'Senha do vendedor invÃ¡lida';
  end if;
  update licenses set expires_at = p_expires_at where id = p_license_id returning * into lic;
  if lic.id is null then
    raise exception 'LicenÃ§a nÃ£o encontrada';
  end if;
  return json_build_object('ok', true, 'expiresAt', lic.expires_at);
end $$;

grant execute on function admin_extend_license(text, uuid, timestamptz) to anon;

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
    raise exception 'Senha do vendedor invÃ¡lida';
  end if;
  delete from activations where id = p_activation_id;
  return json_build_object('ok', true);
end $$;

grant execute on function admin_delete_activation(text, uuid) to anon;

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
    raise exception 'Senha do vendedor invÃ¡lida';
  end if;
  delete from licenses where id = p_license_id;
  return json_build_object('ok', true);
end $$;

grant execute on function admin_delete_license(text, uuid) to anon;

-- ============================================================
-- Exemplo rÃ¡pido (rode no SQL Editor apÃ³s criar a senha):
--   select admin_create_license('SUA_SENHA', 'Padaria do JoÃ£o',
--     'joao@email.com', 1, now() + interval '1 year', '');
--   select admin_list_licenses('SUA_SENHA');
-- ============================================================
