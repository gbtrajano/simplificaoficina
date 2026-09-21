-- Bloqueio automatico no vencimento e renovacao da licenca existente.
-- O cliente ainda consegue autenticar depois do vencimento para abrir somente
-- a tela de regularizacao. O restante do aplicativo continua protegido pelo
-- LicenseGate.

drop function if exists public.get_my_license();

create or replace function public.get_my_license()
returns table (
  license_id uuid,
  key text,
  customer_name text,
  customer_email text,
  expires_at timestamptz,
  status text,
  billing_status text,
  next_due_at timestamptz,
  mercadopago_subscription_id text,
  access_role text
)
language plpgsql security definer set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  member_role text;
  account_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null or account_email = '' then
    raise exception 'Faca login com e-mail e senha.';
  end if;

  select * into lic from public.licenses where auth_user_id = auth.uid() limit 1;
  if found then member_role := 'owner'; end if;

  if not found then
    select m.role into member_role
      from public.license_members m
     where m.auth_user_id = auth.uid() and m.active = true limit 1;
    if found then
      select l.* into lic
        from public.licenses l
        join public.license_members m on m.license_id = l.id
       where m.auth_user_id = auth.uid() and m.active = true limit 1;
    end if;
  end if;

  if not found then
    select * into lic from public.licenses
     where lower(trim(customer_email)) = account_email
     order by created_at desc limit 1;
    if not found then raise exception 'Este e-mail nao possui uma licenca cadastrada.'; end if;
    if lic.auth_user_id is not null and lic.auth_user_id <> auth.uid() then
      raise exception 'Esta licenca ja esta vinculada a outra conta.';
    end if;
    update public.licenses set auth_user_id = auth.uid()
     where id = lic.id and auth_user_id is null;
    select * into lic from public.licenses where id = lic.id;
    member_role := 'owner';
  end if;

  -- Retorna tambem licencas vencidas para que o frontend mostre a cobranca.
  return query select lic.id, lic.key, lic.customer_name, lic.customer_email,
    lic.expires_at, lic.status, lic.billing_status, lic.next_due_at,
    lic.mercadopago_subscription_id, member_role;
end;
$$;

revoke all on function public.get_my_license() from public;
grant execute on function public.get_my_license() to authenticated;

create or replace function public.apply_mercadopago_payment(
  p_event_id text, p_event_type text, p_payment_id text, p_subscription_id text,
  p_external_reference text, p_status text, p_status_detail text, p_amount numeric,
  p_payment_date timestamptz, p_payload jsonb default '{}'::jsonb
)
returns json language plpgsql security definer set search_path = public
as $$
declare
  ord public.orders%rowtype;
  lic public.licenses%rowtype;
  base_date timestamptz;
  new_due timestamptz;
  inserted_id bigint;
  new_license_id uuid;
  plan_max_users int;
  normalized_status text := upper(coalesce(p_status, ''));
begin
  if nullif(trim(coalesce(p_event_id, '')), '') is null then raise exception 'event_id obrigatorio'; end if;
  insert into public.mercadopago_webhook_events(event_id, event_type, payment_id, subscription_id, payload)
  values (p_event_id, coalesce(p_event_type, ''), p_payment_id, p_subscription_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_id) do nothing returning id into inserted_id;
  if inserted_id is null then return json_build_object('ok', true, 'duplicate', true); end if;
  if p_payment_id is not null and exists (select 1 from public.orders where mercadopago_payment_id = p_payment_id) then
    return json_build_object('ok', true, 'duplicate', true);
  end if;

  select * into ord from public.orders
   where id::text = nullif(trim(coalesce(p_external_reference, '')), '')
      or mercadopago_subscription_id = nullif(trim(coalesce(p_subscription_id, '')), '')
   order by created_at desc limit 1 for update;
  if ord.id is null then return json_build_object('ok', true, 'matched', false); end if;

  if normalized_status = 'APPROVED' then
    if p_amount is not null and abs(p_amount - ord.amount) > 0.01 then
      update public.orders set status = 'canceled' where id = ord.id;
      return json_build_object('ok', false, 'matched', true, 'reason', 'amount_mismatch');
    end if;

    if ord.license_id is not null then
      select * into lic from public.licenses where id = ord.license_id for update;
    end if;
    base_date := greatest(coalesce(lic.expires_at, ord.expires_at, now()), coalesce(p_payment_date, now()));
    new_due := base_date + interval '1 month';
    plan_max_users := case ord.plan when 'store_10' then 10 else 1 end;

    if ord.license_id is null then
      insert into public.licenses (
        key, customer_name, customer_email, max_machines, max_users, status, expires_at, notes,
        mercadopago_subscription_id, mercadopago_payment_id, billing_status, last_payment_at, next_due_at
      ) values (
        public._new_license_key(), ord.customer_name, ord.customer_email, 1, plan_max_users,
        'active', new_due, 'Plano Loja 10 Caixas - Mercado Pago',
        nullif(trim(coalesce(p_subscription_id, ord.mercadopago_subscription_id)), ''),
        p_payment_id, 'paid', coalesce(p_payment_date, now()), new_due
      ) returning id into new_license_id;
      update public.orders set status = 'paid', mercadopago_payment_id = p_payment_id,
        paid_at = coalesce(p_payment_date, now()), expires_at = new_due,
        license_id = new_license_id where id = ord.id;
    else
      update public.licenses set status = 'active', expires_at = new_due,
        mercadopago_subscription_id = coalesce(nullif(trim(coalesce(p_subscription_id, '')), ''), mercadopago_subscription_id),
        mercadopago_payment_id = p_payment_id, billing_status = 'paid',
        last_payment_at = coalesce(p_payment_date, now()), next_due_at = new_due
       where id = ord.license_id;
      update public.orders set status = 'paid', mercadopago_payment_id = p_payment_id,
        paid_at = coalesce(p_payment_date, now()), expires_at = new_due where id = ord.id;
    end if;
  elsif normalized_status in ('REFUNDED', 'CHARGED_BACK') then
    update public.orders set status = 'canceled' where id = ord.id;
    if ord.license_id is not null then
      update public.licenses set status = 'revoked', billing_status = 'canceled'
       where id = ord.license_id;
    end if;
  elsif normalized_status in ('REJECTED', 'CANCELLED') then
    update public.orders set status = 'canceled' where id = ord.id and license_id is null;
    if ord.license_id is not null then
      update public.licenses set billing_status = 'overdue' where id = ord.license_id;
    end if;
  end if;

  return json_build_object('ok', true, 'matched', true,
    'licenseId', coalesce(ord.license_id, new_license_id));
end;
$$;

revoke all on function public.apply_mercadopago_payment(text, text, text, text, text, text, text, numeric, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_mercadopago_payment(text, text, text, text, text, text, text, numeric, timestamptz, jsonb)
  to service_role;

create or replace function public.apply_mercadopago_subscription(
  p_event_id text, p_event_type text, p_subscription_id text,
  p_external_reference text, p_status text, p_payload jsonb default '{}'::jsonb
)
returns json language plpgsql security definer set search_path = public
as $$
declare
  inserted_id bigint;
  ord public.orders%rowtype;
  normalized_status text := upper(coalesce(p_status, ''));
begin
  insert into public.mercadopago_webhook_events(event_id, event_type, subscription_id, payload)
  values (p_event_id, coalesce(p_event_type, ''), p_subscription_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_id) do nothing returning id into inserted_id;
  if inserted_id is null then return json_build_object('ok', true, 'duplicate', true); end if;

  select * into ord from public.orders
   where mercadopago_subscription_id = p_subscription_id
      or id::text = nullif(trim(coalesce(p_external_reference, '')), '')
   order by created_at desc limit 1 for update;
  if ord.id is null then return json_build_object('ok', true, 'matched', false); end if;

  update public.orders set mercadopago_subscription_id = p_subscription_id where id = ord.id;
  if ord.license_id is not null then
    update public.licenses
       set mercadopago_subscription_id = coalesce(p_subscription_id, mercadopago_subscription_id),
           billing_status = case
             when normalized_status = 'PAUSED' then 'overdue'
             when normalized_status = 'CANCELLED' then 'canceled'
             else billing_status end
     where id = ord.license_id;
  end if;
  return json_build_object('ok', true, 'matched', true);
end;
$$;

revoke all on function public.apply_mercadopago_subscription(text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_mercadopago_subscription(text, text, text, text, text, jsonb)
  to service_role;
