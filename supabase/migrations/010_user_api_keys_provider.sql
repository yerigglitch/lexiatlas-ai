-- Allow multiple providers per user (composite primary key)

alter table user_api_keys drop constraint if exists user_api_keys_pkey;

update user_api_keys
set provider = coalesce(provider, 'mistral');

alter table user_api_keys
  add constraint user_api_keys_pkey primary key (user_id, provider);
