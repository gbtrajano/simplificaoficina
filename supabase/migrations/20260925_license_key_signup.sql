-- Primeiro acesso do comprador: valida a chave antes de criar a conta e,
-- depois da autenticação, vincula a licença ao usuário proprietário.

create or replace function public.validate_license_signup(p_key text, p_email text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if nullif(trim(coalesce(p_key, '')), '') is null or normalized_email = '' then
    raise exception 'Informe a chave e o e-mail cadastrados na licença.';
  end if;

  select * into lic
    from public.licenses
   where upper(trim(key)) = upper(trim(p_key))
   limit 1;

  if not found then raise exception 'Chave de licença inválida.'; end if;
  if lic.status = 'revoked' then raise exception 'Esta licença foi revogada.'; end if;
  if lic.auth_user_id is not null then
    raise exception 'Esta licença já possui uma conta. Use a opção Entrar.';
  end if;

  -- O vendedor cadastra somente o nome e entrega a chave. O primeiro acesso
  -- escolhe o e-mail que passará a identificar o proprietário da licença.
  update public.licenses
     set customer_email = normalized_email
   where id = lic.id and auth_user_id is null;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.validate_license_signup(text, text) from public;
grant execute on function public.validate_license_signup(text, text) to anon, authenticated;

create or replace function public.claim_license_by_key(p_key text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  account_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null or account_email = '' then
    raise exception 'Faça login para vincular a licença.';
  end if;

  select * into lic
    from public.licenses
   where upper(trim(key)) = upper(trim(p_key))
   limit 1 for update;

  if not found then raise exception 'Chave de licença inválida.'; end if;
  if lower(trim(coalesce(lic.customer_email, ''))) <> account_email then
    raise exception 'O e-mail da conta não corresponde ao cadastro desta licença.';
  end if;
  if lic.auth_user_id is not null and lic.auth_user_id <> auth.uid() then
    raise exception 'Esta licença já está vinculada a outra conta.';
  end if;

  update public.licenses
     set auth_user_id = auth.uid()
   where id = lic.id and auth_user_id is null;

  return json_build_object('ok', true, 'licenseId', lic.id);
end;
$$;

revoke all on function public.claim_license_by_key(text) from public;
grant execute on function public.claim_license_by_key(text) to authenticated;

notify pgrst, 'reload schema';
