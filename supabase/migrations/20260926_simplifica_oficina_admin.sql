-- Consolidação do painel master do Simplifica Oficina.
-- O acesso administrativo é determinado exclusivamente pelo e-mail do JWT.

create table if not exists public.license_admins (
  email text primary key check (email = lower(email))
);

insert into public.license_admins (email)
values ('conversarcomgabriel@gmail.com')
on conflict (email) do nothing;

-- Remove administradores herdados de instalações anteriores. Este projeto é
-- exclusivo do Simplifica Oficina e possui apenas o titular abaixo.
delete from public.license_admins
where email <> 'conversarcomgabriel@gmail.com';

alter table public.license_admins enable row level security;
revoke all on public.license_admins from public, anon, authenticated;

create or replace function public.is_license_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.license_admins
    where email = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

create or replace function public.require_license_admin()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_license_admin() then
    raise exception 'Esta conta não tem permissão para administrar licenças.';
  end if;
end;
$$;

-- Redefinida após as migrations de cobrança para incluir todos os campos que
-- o painel precisa, mantendo as tabelas inacessíveis diretamente pelo cliente.
create or replace function public.admin_list_licenses_for_current_user()
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_license_admin();
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select l.id, l.key, l.customer_name, l.customer_email,
             l.max_machines, l.max_users, l.status, l.expires_at,
             l.mercadopago_subscription_id, l.mercadopago_payment_id,
             l.billing_status, l.last_payment_at, l.next_due_at,
             l.notes, l.created_at,
             (select count(*) from public.activations a where a.license_id = l.id) as activation_count,
             (select coalesce(json_agg(json_build_object(
               'id', a.id,
               'machine_id', a.machine_id,
               'machine_name', a.machine_name,
               'activated_at', a.activated_at,
               'last_seen_at', a.last_seen_at
             ) order by a.last_seen_at desc), '[]'::json)
              from public.activations a where a.license_id = l.id) as activations
      from public.licenses l
    ) t
  );
end;
$$;

create or replace function public.admin_license_dashboard()
returns json
language plpgsql stable security definer set search_path = public
as $$
declare result json;
begin
  perform public.require_license_admin();
  select json_build_object(
    'total', count(*),
    'active', count(*) filter (where status = 'active' and (expires_at is null or expires_at > now())),
    'expired', count(*) filter (where expires_at is not null and expires_at <= now()),
    'revoked', count(*) filter (where status = 'revoked'),
    'paid', count(*) filter (where billing_status = 'paid'),
    'overdue', count(*) filter (where billing_status = 'overdue'),
    'pending', count(*) filter (where billing_status = 'pending'),
    'monthly_revenue', coalesce(count(*) filter (
      where billing_status = 'paid'
        and last_payment_at >= date_trunc('month', now())
    ) * 29.99, 0)
  ) into result
  from public.licenses;
  return result;
end;
$$;

revoke all on function public.is_license_admin() from public, anon;
grant execute on function public.is_license_admin() to authenticated;
revoke all on function public.require_license_admin() from public, anon, authenticated;
revoke all on function public.admin_list_licenses_for_current_user() from public, anon;
grant execute on function public.admin_list_licenses_for_current_user() to authenticated;
revoke all on function public.admin_license_dashboard() from public, anon;
grant execute on function public.admin_license_dashboard() to authenticated;

-- Atualiza descrições comerciais legadas sem mudar o identificador interno do
-- plano, preservando a compatibilidade do webhook e das assinaturas.
update public.licenses
set notes = replace(notes, 'Plano Loja 10 Caixas', 'Simplifica Oficina Completa')
where notes like '%Plano Loja 10 Caixas%';

notify pgrst, 'reload schema';
