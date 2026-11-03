-- Same access rules, but "who is signed in" checks (auth.uid(), is_admin(), current_app_user_id() and the other
-- no-argument helpers) run once per query instead of once per row, by wrapping each in (select ...).
set lock_timeout = '4s';
do $$
declare r record; u text; c text; sql text;
  pat constant text := '(?<!select )\m((auth\.uid|auth\.role|auth\.jwt|is_admin|is_super_admin|current_app_user_id|current_user_role|public\.is_admin|public\.is_super_admin|public\.current_app_user_id|public\.current_user_role)\(\))';
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    u := regexp_replace(r.qual, pat, '(select \1)', 'g');
    c := regexp_replace(r.with_check, pat, '(select \1)', 'g');
    if u is distinct from r.qual or c is distinct from r.with_check then
      sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if u is not null then sql := sql || ' using (' || u || ')'; end if;
      if c is not null then sql := sql || ' with check (' || c || ')'; end if;
      execute sql;
    end if;
  end loop;
end $$;
