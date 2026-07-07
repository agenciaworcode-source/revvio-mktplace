do $$
declare n int;
begin
  -- enum tem garagista e vendedor, e NÃO tem mais 'seller'
  select count(*) into n from pg_enum e join pg_type t on t.oid=e.enumtypid
   where t.typname='app_role' and e.enumlabel in ('garagista','vendedor');
  assert n = 2, 'FALHA: enum app_role sem garagista/vendedor';
  select count(*) into n from pg_enum e join pg_type t on t.oid=e.enumtypid
   where t.typname='app_role' and e.enumlabel='seller';
  assert n = 0, 'FALHA: valor seller ainda existe no enum';

  -- colunas novas
  select count(*) into n from information_schema.columns
   where table_name='rv_sellers' and column_name='parent_id';
  assert n = 1, 'FALHA: rv_sellers.parent_id ausente';
  select count(*) into n from information_schema.columns
   where table_name='rv_sales' and column_name='vendedor_id' and is_nullable='NO';
  assert n = 1, 'FALHA: rv_sales.vendedor_id ausente ou nullable';
  select count(*) into n from information_schema.columns
   where table_name='rv_commissions' and column_name='vendedor_id' and is_nullable='NO';
  assert n = 1, 'FALHA: rv_commissions.vendedor_id ausente ou nullable';

  -- slug agora é nullable
  select count(*) into n from information_schema.columns
   where table_name='rv_sellers' and column_name='slug' and is_nullable='YES';
  assert n = 1, 'FALHA: rv_sellers.slug ainda é NOT NULL';

  raise notice '✅ A1 estrutura OK';
end $$;
