-- Pedidos de contratacao iniciados pelo cliente.
-- A tabela e privada: somente as Edge Functions usando service_role
-- devem criar ou atualizar pedidos.

create table if not exists public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_name text not null check (length(btrim(customer_name)) >= 2),
  customer_email text not null check (position('@' in customer_email) > 1),
  customer_document text,
  customer_phone text,
  plan text not null check (plan in ('standard', 'premium')),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'canceled')),
  mercadopago_subscription_id text,
  mercadopago_payment_id text,
  license_id uuid references public.licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz
);

-- Atualiza bancos que receberam uma versao anterior desta migration.
alter table public.orders drop column if exists asaas_checkout_id;
alter table public.orders drop column if exists asaas_subscription_id;
alter table public.orders add column if not exists mercadopago_subscription_id text;
alter table public.orders add column if not exists mercadopago_payment_id text;
alter table public.orders add column if not exists license_id uuid references public.licenses(id) on delete set null;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists expires_at timestamptz;

create unique index if not exists orders_mercadopago_subscription_uidx
  on public.orders(mercadopago_subscription_id)
  where mercadopago_subscription_id is not null;
create unique index if not exists orders_mercadopago_payment_uidx
  on public.orders(mercadopago_payment_id)
  where mercadopago_payment_id is not null;
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_customer_email_idx on public.orders(lower(customer_email));
create index if not exists orders_license_id_idx on public.orders(license_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_orders_updated_at();

comment on table public.orders is 'Pedidos de contratacao e assinatura; status atualizado exclusivamente pelo backend/Webhook.';
comment on column public.orders.amount is 'Valor cobrado em BRL, definido e validado pelo backend.';
comment on column public.orders.status is 'pending: aguardando pagamento; paid: confirmado; expired: checkout vencido; canceled: cancelado/estornado.';
comment on column public.orders.mercadopago_subscription_id is 'ID da assinatura recorrente criada no Mercado Pago.';
comment on column public.orders.mercadopago_payment_id is 'ID do ultimo pagamento confirmado no Mercado Pago.';

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
