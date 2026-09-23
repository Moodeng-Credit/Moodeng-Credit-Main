-- compute_risk_score appended factor names with `factors_x || 'some_factor'`. Postgres resolves an
-- untyped literal next to text[] as another array, so every call failed with
-- `malformed array literal: "no_google_id"` and the daily recompute scored nobody. Cast each
-- literal to text so `||` appends one element. Logic is otherwise unchanged.
do $$
declare
  def   text := pg_get_functiondef('public.compute_risk_score(uuid)'::regprocedure);
  fixed text;
begin
  fixed := regexp_replace(def, '(factors_[a-z] := factors_[a-z] \|\| )''([^'']*)''', '\1''\2''::text', 'g');
  if fixed <> def then
    execute fixed;
  end if;
end $$;
