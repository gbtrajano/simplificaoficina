-- Login do cliente pelo Supabase Auth.
-- Execute esta migration no SQL Editor uma única vez.
--
-- O e-mail da conta em Authentication > Users precisa ser exatamente o mesmo
-- de licenses.customer_email. Na primeira entrada, esta função vincula a
-- conta à licença automaticamente.

alter table public.licenses
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create or replace function public.get_my_license()
returns table (
  key text,
  customer_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  account_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null or account_email = '' then
    raise exception 'Faça login com e-mail e senha.';
  end if;

  select * into lic
  from public.licenses
  where auth_user_id = auth.uid()
  limit 1;

  if not found then
    select * into lic
    from public.licenses
    where lower(trim(customer_email)) = account_email
    order by created_at desc
    limit 1;

    if not found then
      raise exception 'Este e-mail não possui uma licença cadastrada.';
    end if;

    if lic.auth_user_id is not null and lic.auth_user_id <> auth.uid() then
      raise exception 'Esta licença já está vinculada a outra conta.';
    end if;

    update public.licenses
       set auth_user_id = auth.uid()
     where id = lic.id and auth_user_id is null;

    select * into lic from public.licenses where id = lic.id;
  end if;

  if lic.status <> 'active' then
    raise exception 'A licença desta conta está inativa.';
  end if;

  if lic.expires_at is not null and lic.expires_at <= now() then
    raise exception 'A licença desta conta expirou.';
  end if;

  return query select lic.key, lic.customer_name, lic.expires_at;
end;
$$;

revoke all on function public.get_my_license() from public;
grant execute on function public.get_my_license() to authenticated;
