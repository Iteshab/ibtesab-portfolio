-- NOT APPLIED. This file is separate because Supabase-managed storage.objects
-- is owned by supabase_storage_admin, not by the application-table owner.
-- Run only in an authorized SQL session where current_user is the actual
-- storage.objects owner. Do not transfer ownership or assume role blindly.
-- Requires the core portfolio migration first, for portfolio_security helpers.

begin;

do $storage_preflight$
declare
  actual_owner name;
  rls_enabled boolean;
  public_bucket boolean;
  unknown_policies text;
begin
  select pg_get_userbyid(c.relowner)::name, c.relrowsecurity
  into actual_owner, rls_enabled
  from pg_catalog.pg_class as c
  where c.oid = 'storage.objects'::regclass;

  if actual_owner is distinct from current_user::name then
    raise exception 'Storage policy update stopped: current_user % does not own storage.objects (owner is %). Run as the verified table owner; do not change ownership.', current_user, actual_owner;
  end if;

  if rls_enabled is distinct from true then
    raise exception 'Storage policy update stopped: RLS is not already enabled on storage.objects; this file will not change the managed table RLS state';
  end if;

  select b.public into public_bucket
  from storage.buckets as b
  where b.id = 'profile-photo';

  if public_bucket is distinct from true then
    raise exception 'Storage policy update stopped: profile-photo bucket must exist and remain public';
  end if;

  if not exists (
       select 1 from pg_catalog.pg_namespace where nspname = 'portfolio_security'
     )
     or to_regprocedure('portfolio_security.is_portfolio_admin()') is null then
    raise exception 'Storage policy update stopped: apply the core portfolio migration before this file';
  end if;

  if not has_schema_privilege(current_user, 'portfolio_security', 'USAGE')
     or not has_function_privilege(current_user, 'portfolio_security.is_portfolio_admin()', 'EXECUTE') then
    raise exception 'Storage policy update stopped: run the core portfolio migration first and verify portfolio_security access for the Storage owner';
  end if;

  select string_agg(
    format('%I: %s (roles=%s)', policyname, cmd, roles),
    E'\n' order by policyname
  )
  into unknown_policies
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname::text <> all (array[
      'Authenticated can upload profile photo zhjthq_0',
      'Profile Photo upload permission zhjthq_0',
      'Profile Photo upload permission zhjthq_1',
      'Profile Photo upload permission zhjthq_2',
      'Public can read portfolio media',
      'Portfolio admin can upload portfolio media',
      'Portfolio admin can update portfolio media'
    ]::text[]);

  if unknown_policies is not null then
    raise exception 'Storage policy update stopped before changes. Review these unrecognized policies:%', E'\n' || unknown_policies;
  end if;
end;
$storage_preflight$;

drop policy if exists "Authenticated can upload profile photo zhjthq_0" on storage.objects;
drop policy if exists "Profile Photo upload permission zhjthq_0" on storage.objects;
drop policy if exists "Profile Photo upload permission zhjthq_1" on storage.objects;
drop policy if exists "Profile Photo upload permission zhjthq_2" on storage.objects;
drop policy if exists "Public can read portfolio media" on storage.objects;
drop policy if exists "Portfolio admin can upload portfolio media" on storage.objects;
drop policy if exists "Portfolio admin can update portfolio media" on storage.objects;

create policy "Public can read portfolio media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'profile-photo');

create policy "Portfolio admin can upload portfolio media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photo'
  and portfolio_security.is_portfolio_admin()
);

create policy "Portfolio admin can update portfolio media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photo'
  and portfolio_security.is_portfolio_admin()
)
with check (
  bucket_id = 'profile-photo'
  and portfolio_security.is_portfolio_admin()
);

commit;
