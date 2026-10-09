-- NOT APPLIED. Run only after the core migration and after this preflight
-- confirms the function owner, SECURITY DEFINER settings, RLS access, and
-- exactly one CMS sentinel row. This grants RPC execution only; no table writes.

begin;

do $rpc_grant_preflight$
declare
  owner_name name;
  owner_bypasses_rls boolean;
  owns_projects boolean;
  owns_experience boolean;
  projects_force_rls boolean;
  experience_force_rls boolean;
  can_select_projects boolean;
  can_select_experience boolean;
  security_definer boolean;
  function_settings text[];
  settings_rows bigint;
begin
  select r.rolname,
         r.rolbypassrls,
         p.proowner = projects.relowner,
         p.proowner = experience.relowner,
         projects.relforcerowsecurity,
         experience.relforcerowsecurity,
         has_table_privilege(r.rolname, projects.oid, 'SELECT'),
         has_table_privilege(r.rolname, experience.oid, 'SELECT'),
         p.prosecdef,
         p.proconfig
  into owner_name,
       owner_bypasses_rls,
       owns_projects,
       owns_experience,
       projects_force_rls,
       experience_force_rls,
       can_select_projects,
       can_select_experience,
       security_definer,
       function_settings
  from pg_catalog.pg_proc p
  join pg_catalog.pg_roles r on r.oid = p.proowner
  join pg_catalog.pg_class projects on projects.oid = 'public.projects'::regclass
  join pg_catalog.pg_class experience on experience.oid = 'public.experience'::regclass
  where p.oid = to_regprocedure('public.get_portfolio_public_settings()');

  if not found then
    raise exception 'RPC grant stopped: public.get_portfolio_public_settings() does not exist';
  end if;

  if owner_name in ('anon', 'authenticated') then
    raise exception 'RPC grant stopped: function owner % is a client role', owner_name;
  end if;

  if security_definer is distinct from true then
    raise exception 'RPC grant stopped: the settings function is not SECURITY DEFINER';
  end if;

  if not coalesce(function_settings @> array['search_path=""']::text[], false) then
    raise exception 'RPC grant stopped: the settings function must have an empty search_path';
  end if;

  if not coalesce(can_select_projects, false)
     or not coalesce(can_select_experience, false) then
    raise exception 'RPC grant stopped: function owner % lacks SELECT on projects or experience', owner_name;
  end if;

  if not coalesce(owner_bypasses_rls, false)
     and not (
       coalesce(owns_projects, false)
       and coalesce(owns_experience, false)
       and not coalesce(projects_force_rls, true)
       and not coalesce(experience_force_rls, true)
     ) then
    raise exception 'RPC grant stopped: function owner % cannot read both tables through RLS', owner_name;
  end if;

  select count(*) into settings_rows
  from public.projects
  where project_name = '__SITE_SETTINGS__'::text;

  if settings_rows <> 1 then
    raise exception 'RPC grant stopped: expected exactly one __SITE_SETTINGS__ row, found %', settings_rows;
  end if;
end;
$rpc_grant_preflight$;

revoke all on function public.get_portfolio_public_settings() from public, anon, authenticated;
grant execute on function public.get_portfolio_public_settings() to anon, authenticated;

commit;
