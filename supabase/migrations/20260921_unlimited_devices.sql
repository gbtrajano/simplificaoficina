-- Licenças vinculadas à conta: computadores são apenas registrados para auditoria,
-- nunca bloqueiam a entrada. Execute no SQL Editor após as migrations anteriores.

create or replace function public.activate_license(
  p_key text,
  p_machine_id text,
  p_machine_name text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  registered boolean;
begin
  select * into lic from public.licenses where key = upper(trim(p_key));
  if lic.id is null then return json_build_object('status', 'invalid'); end if;
  if lic.status = 'revoked' then return json_build_object('status', 'revoked', 'message', 'Licença revogada pelo vendedor'); end if;
  if lic.expires_at is not null and lic.expires_at < now() then return json_build_object('status', 'expired', 'message', 'Licença expirada'); end if;

  select exists(select 1 from public.activations a where a.license_id = lic.id and a.machine_id = p_machine_id)
  into registered;
  if registered then
    update public.activations set last_seen_at = now(), machine_name = coalesce(nullif(p_machine_name, ''), machine_name)
    where license_id = lic.id and machine_id = p_machine_id;
  else
    insert into public.activations (license_id, machine_id, machine_name)
    values (lic.id, p_machine_id, p_machine_name);
  end if;

  return json_build_object('status', 'ok', 'customerName', lic.customer_name, 'expiresAt', lic.expires_at);
end;
$$;

grant execute on function public.activate_license(text, text, text) to anon;
