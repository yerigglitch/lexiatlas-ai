alter table contacts
  add column if not exists address_line text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists country text;
