-- Plano comercial único: R$ 29,99 por mês.
-- A conta que compra é a proprietária. max_users representa apenas as contas
-- de caixa, então o plano libera 1 proprietário + até 10 operadores.

alter table public.orders drop constraint if exists orders_plan_check;
alter table public.orders add constraint orders_plan_check
  check (plan in ('standard', 'premium', 'store_10'));

-- A função de webhook original já valida valor, idempotência e status. Esta
-- versão somente acrescenta max_users ao criar uma licença nova.
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

  if upper(coalesce(p_status, '')) = 'APPROVED' then
    if p_amount is not null and abs(p_amount - ord.amount) > 0.01 then
      update public.orders set status = 'canceled' where id = ord.id;
      return json_build_object('ok', false, 'matched', true, 'reason', 'amount_mismatch');
    end if;
    base_date := greatest(coalesce(ord.expires_at, now()), coalesce(p_payment_date, now()));
    new_due := base_date + interval '1 month';
    plan_max_users := case ord.plan when 'store_10' then 10 else 1 end;
    if ord.license_id is null then
      insert into public.licenses (
        key, customer_name, customer_email, max_machines, max_users, status, expires_at, notes,
        mercadopago_subscription_id, mercadopago_payment_id, billing_status, last_payment_at, next_due_at
      ) values (
        public._new_license_key(), ord.customer_name, ord.customer_email, 1, plan_max_users, 'active', new_due,
        'Plano Loja 10 Caixas - Mercado Pago',
        nullif(trim(coalesce(p_subscription_id, ord.mercadopago_subscription_id)), ''), p_payment_id,
        'paid', coalesce(p_payment_date, now()), new_due
      ) returning id into new_license_id;
      update public.orders set status = 'paid', mercadopago_payment_id = p_payment_id,
        paid_at = coalesce(p_payment_date, now()), expires_at = new_due, license_id = new_license_id where id = ord.id;
    else
      select * into lic from public.licenses where id = ord.license_id for update;
      update public.licenses set status = 'active', expires_at = new_due,
        mercadopago_subscription_id = coalesce(nullif(trim(coalesce(p_subscription_id, '')), ''), mercadopago_subscription_id),
        mercadopago_payment_id = p_payment_id, billing_status = 'paid',
        last_payment_at = coalesce(p_payment_date, now()), next_due_at = new_due where id = ord.license_id;
      update public.orders set status = 'paid', mercadopago_payment_id = p_payment_id,
        paid_at = coalesce(p_payment_date, now()), expires_at = new_due where id = ord.id;
    end if;
  elsif upper(coalesce(p_status, '')) in ('REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK') then
    update public.orders set status = 'canceled' where id = ord.id and license_id is null;
    if ord.license_id is not null then
      update public.licenses set status = 'revoked', billing_status =
        case when upper(coalesce(p_status, '')) in ('REFUNDED', 'CHARGED_BACK') then 'canceled' else 'overdue' end
      where id = ord.license_id;
    end if;
  end if;
  return json_build_object('ok', true, 'matched', true, 'licenseId', coalesce(ord.license_id, new_license_id));
end;
$$;

revoke all on function public.apply_mercadopago_payment(text, text, text, text, text, text, text, numeric, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_mercadopago_payment(text, text, text, text, text, text, text, numeric, timestamptz, jsonb)
  to service_role;
