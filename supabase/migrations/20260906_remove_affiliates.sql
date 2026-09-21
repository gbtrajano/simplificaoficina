-- Remove o sistema de afiliações legado.
drop function if exists affiliate_register(text, text, text);
drop function if exists affiliate_public_info();
drop function if exists admin_list_affiliates(text);
drop function if exists admin_update_affiliate(text, uuid, numeric, boolean);
drop function if exists admin_get_affiliate_settings(text);
drop function if exists admin_save_affiliate_settings(text, text, text, text, numeric);
drop table if exists affiliates cascade;
drop table if exists affiliate_settings cascade;
