-- NOT APPLIED. Review this migration and all existing policies before running
-- it manually in the Supabase SQL Editor.
-- This file defines RLS and creates the public RPC without granting clients
-- permission to execute it. Verify the RPC owner, then run
-- supabase/activate-public-settings-rpc.sql as a separate step.
-- Storage policy changes are separate and require its managed table owner;
-- see supabase/storage-policies-admin-only.sql.
--
-- Permissive RLS policies are combined with OR. This script drops the policy
-- names present in the supplied sanitized export; any additional permissive
-- policies must be reviewed and removed separately before this is applied.

begin;

-- The public RPC expects exactly one settings record. Fail before changing
-- policies or functions if the live sentinel is missing or duplicated.
do $settings_preflight$
declare
  settings_rows bigint;
  settings_value jsonb;
begin
  select count(*) into settings_rows
  from public.projects
  where project_name = '__SITE_SETTINGS__'::text;

  if settings_rows <> 1 then
    raise exception 'Portfolio RLS migration stopped: expected exactly one projects row named __SITE_SETTINGS__, found %', settings_rows;
  end if;

  select p.description::jsonb into settings_value
  from public.projects as p
  where p.project_name = '__SITE_SETTINGS__'::text;

  if jsonb_typeof(settings_value) is distinct from 'object' then
    raise exception 'Portfolio RLS migration stopped: __SITE_SETTINGS__ description must contain a JSON object';
  end if;
end;
$settings_preflight$;

-- ALTER TABLE and policy replacement require each public table owner. Do not
-- attempt to assume roles or alter ownership; stop before any writes otherwise.
do $public_owner_preflight$
declare
  owner_mismatches text;
  current_role_is_superuser boolean;
  expected_tables integer;
begin
  if not has_schema_privilege(current_user, 'public', 'CREATE') then
    raise exception 'Portfolio RLS migration stopped: SQL role % lacks CREATE privilege on public schema', current_user;
  end if;

  select r.rolsuper into current_role_is_superuser
  from pg_catalog.pg_roles as r
  where r.rolname = current_user;

  select count(*)::integer into expected_tables
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('projects', 'experience', 'profile_settings')
    and c.relkind in ('r', 'p');

  if expected_tables <> 3 then
    raise exception 'Portfolio RLS migration stopped: expected all three public portfolio tables, found %', expected_tables;
  end if;

  select string_agg(
    format('%I.%I owner=%I', n.nspname, c.relname, pg_get_userbyid(c.relowner)),
    E'\n' order by c.relname
  )
  into owner_mismatches
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('projects', 'experience', 'profile_settings')
    and c.relkind in ('r', 'p')
    and c.relowner <> (select r.oid from pg_catalog.pg_roles r where r.rolname = current_user)
    and not coalesce(current_role_is_superuser, false);

  if owner_mismatches is not null then
    raise exception 'Portfolio RLS migration stopped: SQL role % does not own these tables:%', current_user, E'\n' || owner_mismatches;
  end if;
end;
$public_owner_preflight$;

-- This is a one-time migration. Refuse to overwrite or adopt partial helper
-- state; inspect and reconcile it explicitly if an earlier attempt committed.
do $partial_state_preflight$
begin
  if exists (
    select 1 from pg_catalog.pg_namespace
    where nspname = 'portfolio_security'
  ) then
    raise exception 'Portfolio RLS migration stopped: portfolio_security already exists; inspect its owner, grants, and functions before continuing';
  end if;

  if to_regprocedure('public.get_portfolio_public_settings()') is not null then
    raise exception 'Portfolio RLS migration stopped: public.get_portfolio_public_settings() already exists; inspect its owner, definition, and grants before continuing';
  end if;
end;
$partial_state_preflight$;

-- Stop before changing anything if an unreviewed policy exists. In particular,
-- this prevents a differently named authenticated write policy from surviving
-- alongside the hardened policies below.
do $policy_preflight$
declare
  unreviewed_policies text;
begin
  select string_agg(
    format('%I.%I: %I (command=%s, roles=%s)', schemaname, tablename, policyname, cmd, roles),
    E'\n' order by schemaname, tablename, policyname
  )
  into unreviewed_policies
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('projects', 'experience', 'profile_settings')
    and policyname::text <> all (array[
      'Admin can delete projects',
      'Admin can insert projects',
      'Admin can update projects',
      'Public can read projects',
      'Public can read CMS settings',
      'Portfolio admin can read CMS settings',
      'Portfolio admin can insert projects',
      'Portfolio admin can update projects',
      'Portfolio admin can delete projects',
      'Portfolio admin can read projects',
      'Admin can delete experience',
      'Enable insert for authenticated users only',
      'Enable read access for all users',
      'Public can read experience',
      'admin can delete experience',
      'admin can update experience',
      'Portfolio admin can read experience',
      'Portfolio admin can insert experience',
      'Portfolio admin can update experience',
      'Portfolio admin can delete experience',
      'Admin can insert photo settings',
      'Admin can read photo settings',
      'Admin can update photo settings',
      'Portfolio admin can read photo settings',
      'Portfolio admin can insert photo settings',
      'Portfolio admin can update photo settings'
    ]::text[]);

  if unreviewed_policies is not null then
    raise exception 'Portfolio RLS migration stopped before changes. Review these policies first:%',
      E'\n' || unreviewed_policies;
  end if;
end;
$policy_preflight$;

-- A dedicated schema avoids changing ACLs on a possibly existing `private`
-- schema. CREATE SCHEMA intentionally fails if this name is already in use;
-- inspect that schema before adapting the migration in that case.
create schema portfolio_security;
revoke all on schema portfolio_security from public, anon, authenticated;
grant usage on schema portfolio_security to anon, authenticated;

create or replace function portfolio_security.is_portfolio_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'portfolio_role') = 'admin',
    false
  );
$$;

revoke all on function portfolio_security.is_portfolio_admin() from public, anon, authenticated;
grant execute on function portfolio_security.is_portfolio_admin() to authenticated;

-- Safely parse the app's trailing JSON marker. Invalid marker content is
-- returned as NULL so public visibility checks can fail closed.
create or replace function portfolio_security.portfolio_content_metadata(
  content_description text,
  content_marker text
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  marker_position integer;
  parsed_metadata jsonb;
begin
  marker_position := strpos(coalesce(content_description, ''), content_marker);
  if marker_position = 0 then
    return '{}'::jsonb;
  end if;

  begin
    parsed_metadata := substring(
      content_description from marker_position + char_length(content_marker)
    )::jsonb;
  exception when others then
    return null;
  end;

  if jsonb_typeof(parsed_metadata) <> 'object' then
    return null;
  end if;
  return parsed_metadata;
end;
$function$;

create or replace function portfolio_security.is_portfolio_content_public(
  content_description text,
  content_marker text
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  parsed_metadata jsonb;
begin
  if strpos(coalesce(content_description, ''), content_marker) = 0 then
    return true;
  end if;

  parsed_metadata := portfolio_security.portfolio_content_metadata(content_description, content_marker);
  if parsed_metadata is null then
    return false;
  end if;
  return parsed_metadata ->> 'published' is distinct from 'false'
    and parsed_metadata ->> 'deleted' is distinct from 'true';
end;
$function$;

revoke all on function portfolio_security.portfolio_content_metadata(text, text) from public, anon, authenticated;
revoke all on function portfolio_security.is_portfolio_content_public(text, text) from public, anon, authenticated;
grant execute on function portfolio_security.portfolio_content_metadata(text, text) to anon, authenticated;
grant execute on function portfolio_security.is_portfolio_content_public(text, text) to anon, authenticated;

-- The separate Storage policy file runs as the managed table owner. Grant only
-- the helper access needed to resolve its RLS expressions; do not grant role
-- membership or alter any Storage object ownership.
do $storage_helper_grants$
declare
  storage_owner name;
begin
  select pg_get_userbyid(c.relowner)::name
  into storage_owner
  from pg_catalog.pg_class as c
  where c.oid = 'storage.objects'::regclass;

  if storage_owner is null then
    raise exception 'Portfolio migration stopped: storage.objects was not found while granting helper access';
  end if;

  execute format('grant usage on schema portfolio_security to %I', storage_owner);
  execute format('grant execute on function portfolio_security.is_portfolio_admin() to %I', storage_owner);
  execute format('grant execute on function portfolio_security.portfolio_content_metadata(text, text) to %I', storage_owner);
  execute format('grant execute on function portfolio_security.is_portfolio_content_public(text, text) to %I', storage_owner);
end;
$storage_helper_grants$;

alter table public.projects enable row level security;
alter table public.experience enable row level security;
alter table public.profile_settings enable row level security;

drop policy if exists "Admin can delete projects" on public.projects;
drop policy if exists "Admin can insert projects" on public.projects;
drop policy if exists "Admin can update projects" on public.projects;
drop policy if exists "Public can read projects" on public.projects;
drop policy if exists "Public can read CMS settings" on public.projects;
drop policy if exists "Portfolio admin can read CMS settings" on public.projects;
drop policy if exists "Portfolio admin can insert projects" on public.projects;
drop policy if exists "Portfolio admin can update projects" on public.projects;
drop policy if exists "Portfolio admin can delete projects" on public.projects;

create policy "Public can read projects"
on public.projects
for select
to anon, authenticated
using (
  project_name <> '__SITE_SETTINGS__'::text
  and portfolio_security.is_portfolio_content_public(description, E'\n[PortfolioCMS:v1]')
);

drop policy if exists "Portfolio admin can read projects" on public.projects;
create policy "Portfolio admin can read projects"
on public.projects
for select
to authenticated
using (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can insert projects"
on public.projects
for insert
to authenticated
with check (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can update projects"
on public.projects
for update
to authenticated
using (portfolio_security.is_portfolio_admin())
with check (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can delete projects"
on public.projects
for delete
to authenticated
using (
  project_name <> '__SITE_SETTINGS__'::text
  and portfolio_security.is_portfolio_admin()
);

drop policy if exists "Admin can delete experience" on public.experience;
drop policy if exists "Enable insert for authenticated users only" on public.experience;
drop policy if exists "Enable read access for all users" on public.experience;
drop policy if exists "Public can read experience" on public.experience;
drop policy if exists "admin can delete experience" on public.experience;
drop policy if exists "admin can update experience" on public.experience;
drop policy if exists "Portfolio admin can read experience" on public.experience;
drop policy if exists "Portfolio admin can insert experience" on public.experience;
drop policy if exists "Portfolio admin can update experience" on public.experience;
drop policy if exists "Portfolio admin can delete experience" on public.experience;

create policy "Public can read experience"
on public.experience
for select
to anon, authenticated
using (portfolio_security.is_portfolio_content_public(description, E'\n[PortfolioExperience:v1]'));

drop policy if exists "Portfolio admin can read experience" on public.experience;
create policy "Portfolio admin can read experience"
on public.experience
for select
to authenticated
using (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can insert experience"
on public.experience
for insert
to authenticated
with check (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can update experience"
on public.experience
for update
to authenticated
using (portfolio_security.is_portfolio_admin())
with check (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can delete experience"
on public.experience
for delete
to authenticated
using (portfolio_security.is_portfolio_admin());

drop policy if exists "Admin can insert photo settings" on public.profile_settings;
drop policy if exists "Admin can read photo settings" on public.profile_settings;
drop policy if exists "Admin can update photo settings" on public.profile_settings;
drop policy if exists "Portfolio admin can read photo settings" on public.profile_settings;
drop policy if exists "Portfolio admin can insert photo settings" on public.profile_settings;
drop policy if exists "Portfolio admin can update photo settings" on public.profile_settings;

create policy "Portfolio admin can read photo settings"
on public.profile_settings
for select
to authenticated
using (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can insert photo settings"
on public.profile_settings
for insert
to authenticated
with check (portfolio_security.is_portfolio_admin());

create policy "Portfolio admin can update photo settings"
on public.profile_settings
for update
to authenticated
using (portfolio_security.is_portfolio_admin())
with check (portfolio_security.is_portfolio_admin());

-- Table privileges enable the Data API operations; the RLS policies above
-- remain the authorization boundary for every row and write operation.
grant select on public.projects, public.experience to anon, authenticated;
grant insert, update, delete on public.projects, public.experience to authenticated;
grant select, insert, update on public.profile_settings to authenticated;

-- MANUAL PREREQUISITE: create this function while using a trusted database
-- owner authorized for SECURITY DEFINER access to public.projects and
-- public.experience under their RLS configuration. Do not use anon/authenticated or assume a role
-- such as postgres without verifying the project's trusted owner locally.
-- Stop after the function definition and verify its owner before running the
-- REVOKE/GRANT statements below. The owner must remain a trusted server/
-- database role, never a client role. If RLS is not forced, the table owner
-- can read through RLS; otherwise the trusted owner must have appropriate
-- BYPASSRLS privileges, which must be verified for this project.
--
-- SECURITY DEFINER lets the verified trusted owner read the admin-only
-- settings row and legacy fallback identifiers while returning only this
-- explicit projection.
-- The scalar subquery intentionally has no LIMIT: duplicate sentinel rows
-- raise PostgreSQL's "more than one row returned" error instead of choosing one.
create or replace function public.get_portfolio_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select jsonb_build_object(
      'profile', jsonb_build_object(
        'name', settings -> 'profile' -> 'name',
        'role', settings -> 'profile' -> 'role',
        'eyebrow', settings -> 'profile' -> 'eyebrow',
        'location', settings -> 'profile' -> 'location',
        'email', settings -> 'profile' -> 'email',
        'phone', settings -> 'profile' -> 'phone',
        'linkedin', settings -> 'profile' -> 'linkedin',
        'github', settings -> 'profile' -> 'github',
        'heroPrefix', settings -> 'profile' -> 'heroPrefix',
        'heroName', settings -> 'profile' -> 'heroName',
        'heroDescription', settings -> 'profile' -> 'heroDescription',
        'cvButtonText', settings -> 'profile' -> 'cvButtonText',
        'connectButtonText', settings -> 'profile' -> 'connectButtonText',
        'navAbout', settings -> 'profile' -> 'navAbout',
        'navSkills', settings -> 'profile' -> 'navSkills',
        'navExperience', settings -> 'profile' -> 'navExperience',
        'navProjects', settings -> 'profile' -> 'navProjects',
        'navContact', settings -> 'profile' -> 'navContact',
        'photoPath', settings -> 'profile' -> 'photoPath',
        'aboutTitle', settings -> 'profile' -> 'aboutTitle',
        'aboutSubtitle', settings -> 'profile' -> 'aboutSubtitle',
        'aboutText', settings -> 'profile' -> 'aboutText',
        'skillsTitle', settings -> 'profile' -> 'skillsTitle',
        'skillsSubtitle', settings -> 'profile' -> 'skillsSubtitle',
        'experienceTitle', settings -> 'profile' -> 'experienceTitle',
        'experienceSubtitle', settings -> 'profile' -> 'experienceSubtitle',
        'projectsTitle', settings -> 'profile' -> 'projectsTitle',
        'projectsSubtitle', settings -> 'profile' -> 'projectsSubtitle',
        'educationTitle', settings -> 'profile' -> 'educationTitle',
        'educationSubtitle', settings -> 'profile' -> 'educationSubtitle',
        'contactTitle', settings -> 'profile' -> 'contactTitle',
        'contactText', settings -> 'profile' -> 'contactText',
        'contactEmail', settings -> 'profile' -> 'contactEmail',
        'contactPhone', settings -> 'profile' -> 'contactPhone',
        'contactEmailButtonText', settings -> 'profile' -> 'contactEmailButtonText',
        'contactPhoneButtonText', settings -> 'profile' -> 'contactPhoneButtonText',
        'contactLinkedinButtonText', settings -> 'profile' -> 'contactLinkedinButtonText',
        'contactGithubButtonText', settings -> 'profile' -> 'contactGithubButtonText',
        'contactLinkedin', settings -> 'profile' -> 'contactLinkedin',
        'contactGithub', settings -> 'profile' -> 'contactGithub',
        'footerText', settings -> 'profile' -> 'footerText',
        'copyrightText', settings -> 'profile' -> 'copyrightText',
        'cvPath', settings -> 'profile' -> 'cvPath'
      ),
      'logoPath', settings -> 'logoPath',
      'skills', coalesce(
        (
          select jsonb_agg(jsonb_build_object(
            'name', skill -> 'name',
            'category', skill -> 'category',
            'order', skill -> 'order'
          ))
          from jsonb_array_elements(
            case
              when jsonb_typeof(settings -> 'skills') = 'array'
                then settings -> 'skills'
              else '[]'::jsonb
            end
          ) as skills(skill)
          where jsonb_typeof(skill) = 'object'
        ),
        '[]'::jsonb
      ),
      'education', coalesce(
        (
          select jsonb_agg(jsonb_build_object(
            'title', education -> 'title',
            'institute', education -> 'institute',
            'year', education -> 'year',
            'result', education -> 'result',
            'details', education -> 'details',
            'order', education -> 'order'
          ))
          from jsonb_array_elements(
            case
              when jsonb_typeof(settings -> 'education') = 'array'
                then settings -> 'education'
              else '[]'::jsonb
            end
          ) as education_entries(education)
          where jsonb_typeof(education) = 'object'
        ),
        '[]'::jsonb
      ),
      'fallbackProjectNames', coalesce(
        (
          select jsonb_agg(to_jsonb(fallback.project_name) order by fallback.ordinal)
          from (
            values
              (1, 'LD College of Engineering'::text),
              (2, 'SEFORGE Limited (Suzlon Group)'::text),
              (3, 'Bioaltus Pharmaceuticals Pvt Ltd'::text)
          ) as fallback(ordinal, project_name)
          where not (
            coalesce(
              settings -> 'removedProjects',
              '[]'::jsonb
            ) @> jsonb_build_array(lower(fallback.project_name))
          )
          and not exists (
            select 1
            from public.projects as existing_project
            where (
              lower(existing_project.project_name) = lower(fallback.project_name)
              or lower(
                portfolio_security.portfolio_content_metadata(
                  existing_project.description,
                  E'\n[PortfolioCMS:v1]'
                ) ->> 'legacyProjectName'
              ) = lower(fallback.project_name)
            )
          )
        ),
        '[]'::jsonb
      ),
      'fallbackExperienceKeys', coalesce(
        (
          select jsonb_agg(to_jsonb(fallback.experience_key) order by fallback.ordinal)
          from (
            values
              (
                1,
                'Ofis Square|Network Engineer|September 2026'::text
              ),
              (
                2,
                'Aspire Techno Global Pvt. Ltd.|Network Engineer|June 2024'::text
              )
          ) as fallback(ordinal, experience_key)
          where not (
            coalesce(
              settings -> 'removedExperience',
              '[]'::jsonb
            ) @> jsonb_build_array(lower(fallback.experience_key))
          )
          and not exists (
            select 1
            from public.experience as existing_experience
            where (
              lower(
                existing_experience.company || '|' ||
                existing_experience.position || '|' ||
                existing_experience.start_date
              ) = lower(fallback.experience_key)
              or lower(
                portfolio_security.portfolio_content_metadata(
                  existing_experience.description,
                  E'\n[PortfolioExperience:v1]'
                ) ->> 'legacyExperienceKey'
              ) = lower(fallback.experience_key)
            )
          )
        ),
        '[]'::jsonb
      ),
      'appearance', jsonb_build_object(
        'accent', settings -> 'appearance' -> 'accent',
        'accent2', settings -> 'appearance' -> 'accent2',
        'bg', settings -> 'appearance' -> 'bg',
        'card', settings -> 'appearance' -> 'card',
        'text', settings -> 'appearance' -> 'text',
        'dark', settings -> 'appearance' -> 'dark'
      ),
      'sections', jsonb_build_object(
        'about', settings -> 'sections' -> 'about',
        'skills', settings -> 'sections' -> 'skills',
        'experience', settings -> 'sections' -> 'experience',
        'projects', settings -> 'sections' -> 'projects',
        'education', settings -> 'sections' -> 'education',
        'contact', settings -> 'sections' -> 'contact'
      ),
      'seo', jsonb_build_object(
        'title', settings -> 'seo' -> 'title',
        'description', settings -> 'seo' -> 'description',
        'keywords', settings -> 'seo' -> 'keywords',
        'ogTitle', settings -> 'seo' -> 'ogTitle',
        'ogDescription', settings -> 'seo' -> 'ogDescription',
        'canonicalUrl', settings -> 'seo' -> 'canonicalUrl',
        'ogImage', settings -> 'seo' -> 'ogImage',
        'twitterTitle', settings -> 'seo' -> 'twitterTitle',
        'twitterDescription', settings -> 'seo' -> 'twitterDescription',
        'twitterImage', settings -> 'seo' -> 'twitterImage'
      )
    )
    from (
      select p.description::jsonb as settings
      from public.projects as p
      where p.project_name = '__SITE_SETTINGS__'::text
    ) as source
  );
$$;

-- Ownership verification query to run before continuing:
-- select r.rolname as function_owner
-- from pg_proc p
-- join pg_roles r on r.oid = p.proowner
-- where p.oid = 'public.get_portfolio_public_settings()'::regprocedure;

revoke all on function public.get_portfolio_public_settings() from public, anon, authenticated;

commit;
