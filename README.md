# Ibtesab Alam Portfolio — Supabase GUI Admin

## What this version does
- `index.html`: public portfolio
- `admin.html`: login-protected admin panel
- `portfolio.js`: public Supabase content loading and rendering, with the existing HTML as fallback
- `portfolio-fallbacks.js`: shared existing experience records used by the public site and Admin Panel
- Profile, About, skills, experience, projects, education, contact, footer, appearance, visibility and SEO: editable in the admin panel
- Profile photo, logo and CV: upload/replace from the admin panel
- Experience and projects: existing database rows load directly; legacy source entries are also listed and prefilled, and saving one creates a database row without duplicating the public entry
- Supabase project is connected through `supabase-config.js`
- Admin password recovery uses Supabase Auth email recovery; the browser does not store passwords or create reset tokens.

## Admin password recovery
- The Admin Panel requests a Supabase Auth recovery email and returns a generic confirmation to avoid account enumeration.
- In Supabase Dashboard → Authentication → URL Configuration, allow the deployed Admin Panel URL (for example, `https://ibtesab-alam.vercel.app/admin.html`) as a Redirect URL. Set the Site URL to the deployed site origin. Add a localhost redirect only if testing from a local web server; opening the page as `file://` is not a supported recovery redirect.
- Configure Supabase Auth email delivery (custom SMTP is recommended for reliable production delivery), sender details, rate limits and the password recovery email template in the Dashboard. The reset email must link back to the requested redirect URL.
- The recipient opens the one-time, expiring recovery link, chooses and confirms a new password in `admin.html`, and Supabase Auth verifies the recovery session and updates the password using its server-side password hashing. No reset token or password is stored by portfolio code.
- Reset email delivery and token expiry are controlled by Supabase Auth settings; no email-service credentials or reset secrets are required in frontend configuration.

## CMS storage format
- CMS profile, skills, education, appearance, visibility and SEO settings are stored as JSON in the existing `projects` row with `project_name='__SITE_SETTINGS__'`.
- The Admin Panel reads and writes that complete settings object. The public site calls `get_portfolio_public_settings()` and receives only the explicit public-field projection defined in `supabase/rls-hardening.sql`; it never selects the sentinel row directly.
- Project data continues to use the existing `projects` columns. Optional company, technologies, features, links and thumbnail metadata are serialized at the end of `description` using the `[PortfolioCMS:v1]` marker.
- Experience data continues to use the existing `experience` columns. Optional location, summary and technologies are serialized at the end of `description` using the `[PortfolioExperience:v1]` marker.
- These formats require no new tables or columns. Existing plain-text descriptions remain readable and are only wrapped with metadata when edited in the Admin Panel.
- Empty CMS skills or education arrays render an empty-state message; they do not restore stale HTML content.
- Projects and experience use database entries when present and retain the original static fallback content when corresponding database rows are missing. Admin deletion marks database rows as unpublished and deleted; deleting a legacy-only entry creates a matching hidden marker row. Public rendering checks all database rows, including hidden rows, before considering static fallbacks, so a deleted entry stays hidden after refresh while the database is reachable. The public RPC returns only the allowlisted identifiers of static fallback entries that may still be shown; it does not return internal `removedProjects` or `removedExperience` arrays.
- Project and experience publication state and project featured state are stored in the existing description metadata marker and require no schema change.
- Keep the fallback identifiers in `supabase/rls-hardening.sql` synchronized with the static fallback entries in `index.html` and `portfolio.js`. Unknown tombstones and all future CMS fields remain private by default.

## Supabase setup already completed
- Project created
- `experience` table created
- `profile-photo` public bucket created
- Supabase Auth admin user created
- The live projects, experience, profile settings, and four Storage policy names were reviewed against the hardening migration; recheck their definitions immediately before applying it

## Important
The browser uses the Supabase **publishable** key. Do NOT put an `sb_secret_...` key in this repository.
The Admin Panel checks both the configured email and Supabase's server-controlled `user.app_metadata.portfolio_role` claim as a user-interface gate. These client checks are not the security boundary. Database writes must be authorized by Supabase RLS using only `auth.jwt() -> 'app_metadata' ->> 'portfolio_role' = 'admin'`. The SQL migration intentionally does not use `user_metadata`, add Storage DELETE access, or put claim-setting logic in browser code.

### Assigning the single trusted admin claim

Assign `app_metadata.portfolio_role = "admin"` to exactly one intended Supabase Auth user through the Supabase Auth Admin API from a trusted server-side environment or secured administrative workstation:

1. In the Supabase Dashboard, open **Authentication → Users** and identify the intended account's Auth user UUID. Do not use or copy user data into this repository.
2. Run the following short-lived Node.js script in a trusted environment. It uses only the Supabase Auth Admin API, preserves existing `app_metadata`, and verifies only the role claim. Do not save this script in the repository or run it in a browser:

   ```js
   const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
   const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
   const userId = process.env.SUPABASE_ADMIN_USER_ID;
   if (!baseUrl || !serviceKey || !userId) {
     throw new Error("Required trusted environment variables are missing.");
   }

   const endpoint = `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
   const headers = {
     apikey: serviceKey,
     authorization: `Bearer ${serviceKey}`,
     "content-type": "application/json",
   };
   const currentResponse = await fetch(endpoint, { headers });
   if (!currentResponse.ok) {
     throw new Error(`Could not read the target Auth user (HTTP ${currentResponse.status}).`);
   }
   const currentUser = await currentResponse.json();
   const appMetadata = {
     ...(currentUser.app_metadata || {}),
     portfolio_role: "admin",
   };
   const updateResponse = await fetch(endpoint, {
     method: "PATCH",
     headers,
     body: JSON.stringify({ app_metadata: appMetadata }),
   });
   if (!updateResponse.ok) {
     throw new Error(`Could not update the target Auth user (HTTP ${updateResponse.status}).`);
   }
   const updatedUser = await updateResponse.json();
   if (updatedUser.app_metadata?.portfolio_role !== "admin") {
     throw new Error("The trusted admin claim was not confirmed.");
   }
   console.log("The trusted portfolio admin claim was set and verified.");
   ```

   Run the snippet with a trusted Node.js runtime that supports `fetch`. Obtain all three environment variables from a trusted secret manager or secure temporary process environment; do not place their values in command arguments, shell history, a source file, logs, or the repository.
3. Sign out the admin's existing browser sessions and sign back in so the new access token contains the refreshed `app_metadata` claim. The policy checks the claim in the JWT; changing user-editable metadata does not grant access.

**Never set this claim from the browser. Never expose, paste, commit, or log a service-role key. Never put the claim-setting mechanism or service-role credentials in frontend code, `supabase-config.js`, Vercel client-side environment variables, or a checked-in script.** Do not set `user_metadata.portfolio_role`; it is not trusted for authorization.

The sanitized policy export showed broad authenticated-user write access. The migration replaces the exported policies with claim-gated writes and public-only read policies, adds a narrowly scoped public settings RPC, and never trusts a frontend admin flag. The RPC exposes only fields already rendered by the portfolio plus skills, education, appearance, visibility and SEO. The code files are local and **have not been applied**. Review the live schema and all policies before deployment: permissive policies combine with OR, so an additional broad policy could still grant access. Until deployment, public rendering falls back to static profile, skills and education defaults; CMS profile, appearance, SEO and section edits cannot reach the public page.

The previous SQL Editor attempt failed with `must be owner of table objects` because the SQL session role owns the portfolio tables but not Supabase-managed `storage.objects`. Supabase documents that Storage schema objects are owned by `supabase_storage_admin` ([ownership/permissions](https://supabase.com/docs/guides/platform/permissions)). The core migration now excludes all Storage table ownership and policy DDL. Storage policies are in a separate owner-only script; it requires `current_user` to be the verified Storage table owner and never attempts `SET ROLE`, changes ownership, or grants role membership. The reported post-failure checks found `portfolio_security` and the RPC absent; recheck the policies before retrying.

### Applying the RLS and public settings migration

This workspace has no `supabase/config.toml`; the timestamped migration is applied manually in SQL Editor. `supabase/migrations/20261009161000_portfolio_rls_and_public_settings.sql` is the core migration; `supabase/rls-hardening.sql` mirrors it for direct review. `supabase/storage-policies-admin-only.sql` handles only Storage policies, and `supabase/activate-public-settings-rpc.sql` grants RPC execution only after its owner and access are verified.

1. In the Supabase SQL Editor, verify the required tables and columns exist before running any migration:

   ```sql
   select table_name, column_name, data_type
   from information_schema.columns
   where table_schema = 'public'
     and table_name in ('projects', 'experience', 'profile_settings')
   order by table_name, ordinal_position;

   select c.relname as table_name,
          pg_get_userbyid(c.relowner) as table_owner,
          c.relrowsecurity as rls_enabled,
          c.relforcerowsecurity as force_rls
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('projects', 'experience', 'profile_settings')
   order by c.relname;

   select id, name, public
   from storage.buckets
   where id = 'profile-photo';

   select nspname, pg_get_userbyid(nspowner) as schema_owner
   from pg_catalog.pg_namespace
   where nspname = 'portfolio_security';

   select pg_get_userbyid(c.relowner) as storage_objects_owner,
          c.relrowsecurity as storage_rls_enabled,
          current_user as sql_editor_role
   from pg_catalog.pg_class c
   where c.oid = 'storage.objects'::regclass;
   ```

   The application expects the column lists documented below, and the `profile-photo` bucket must already exist and remain public. Supabase documents `supabase_storage_admin` as the owner of Storage schema objects, but confirm the actual owner. The core migration does not alter `storage.objects`; the separate Storage policy file must be run as the actual owner. If `portfolio_security` already exists, inspect it before proceeding. Stop if the live schema differs; do not create or drop columns as part of this migration.
2. Inspect every policy on the protected tables and Storage objects:

   ```sql
   select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
   from pg_policies
   where (schemaname = 'public' and tablename in ('projects', 'experience', 'profile_settings'))
      or (schemaname = 'storage' and tablename = 'objects')
   order by schemaname, tablename, policyname;
   ```

   Compare projects, experience, and profile settings with the core migration. Compare Storage with `supabase/storage-policies-admin-only.sql`, including `Authenticated can upload profile photo zhjthq_0` (INSERT), `Profile Photo upload permission zhjthq_0` (INSERT), `_1` (UPDATE), and `_2` (SELECT). Both SQL files abort if an unrecognized policy name exists on their respective tables; inspect `qual` and `with_check` too. Do not proceed while any permissive policy is unexplained.
3. Confirm the settings row has the exact sentinel spelling and count:

   ```sql
   select count(*) as settings_rows
   from public.projects
   where project_name = '__SITE_SETTINGS__';

   ```

   It must return exactly `1`. The migration repeats this check inside a transaction and aborts without retaining changes if the row is missing or duplicated. If your sanitized query used a different sentinel spelling, stop and resolve that before deployment.
4. After checking schema, policies, table ownership, and the exact settings count, apply only `supabase/migrations/20261009161000_portfolio_rls_and_public_settings.sql` in SQL Editor as a role that owns all three application tables (the migration checks this before DDL). It is transactional, changes functions and policies only on the public portfolio tables, and does not update or delete portfolio rows. It does not alter or create policies on `storage.objects`. It stops if an earlier attempt left `portfolio_security` or the RPC behind; inspect and reconcile that state instead of rerunning blindly.
5. Verify the function owner and database-role access before granting execution:

   ```sql
   select r.rolname as function_owner,
          r.rolbypassrls as owner_bypasses_rls,
          p.prosecdef as security_definer,
          p.proconfig as function_settings,
          has_table_privilege(r.rolname, 'public.projects', 'SELECT') as can_select_projects,
          has_table_privilege(r.rolname, 'public.experience', 'SELECT') as can_select_experience,
          p.proowner = (select relowner from pg_class where oid = 'public.projects'::regclass) as owns_projects,
          p.proowner = (select relowner from pg_class where oid = 'public.experience'::regclass) as owns_experience,
          coalesce((select relrowsecurity from pg_class where oid = 'public.projects'::regclass), false) as projects_rls_enabled,
          coalesce((select relrowsecurity from pg_class where oid = 'public.experience'::regclass), false) as experience_rls_enabled,
          coalesce((select relforcerowsecurity from pg_class where oid = 'public.projects'::regclass), false) as projects_force_rls,
          coalesce((select relforcerowsecurity from pg_class where oid = 'public.experience'::regclass), false) as experience_force_rls
   from pg_proc p
   join pg_roles r on r.oid = p.proowner
   where p.oid = 'public.get_portfolio_public_settings()'::regprocedure;

   select count(*) as settings_rows
   from public.projects
   where project_name = '__SITE_SETTINGS__';

   select has_table_privilege('anon', 'public.projects', 'SELECT') as anon_reads_projects,
          has_table_privilege('anon', 'public.experience', 'SELECT') as anon_reads_experience,
          has_table_privilege('authenticated', 'public.projects', 'INSERT') as auth_can_insert_projects,
          has_table_privilege('authenticated', 'public.projects', 'UPDATE') as auth_can_update_projects,
          has_table_privilege('authenticated', 'public.projects', 'DELETE') as auth_can_delete_projects,
          has_table_privilege('authenticated', 'public.experience', 'INSERT') as auth_can_insert_experience,
          has_table_privilege('authenticated', 'public.experience', 'UPDATE') as auth_can_update_experience,
          has_table_privilege('authenticated', 'public.experience', 'DELETE') as auth_can_delete_experience,
          has_table_privilege('authenticated', 'public.profile_settings', 'SELECT') as auth_reads_photo_settings,
          has_table_privilege('authenticated', 'public.profile_settings', 'INSERT') as auth_can_insert_photo_settings,
          has_table_privilege('authenticated', 'public.profile_settings', 'UPDATE') as auth_can_update_photo_settings;
   ```

   The owner must be a trusted database role, not `anon` or `authenticated`, must have SELECT on both tables, and must bypass RLS (either the role has `rolbypassrls=true`, or it owns each table while FORCE RLS is off). Confirm the settings row count is exactly one and every `has_table_privilege` result above is true. These table grants do not bypass RLS; the claim-gated policies remain the row-level write boundary. If ownership or RLS access cannot be verified, stop and ask a Supabase database administrator to configure it. Keep `portfolio_security` out of Supabase's exposed API schemas; its helper functions are granted only for policy evaluation.
6. Apply `supabase/storage-policies-admin-only.sql` only in an authorized SQL session where `current_user` is the verified owner of `storage.objects`. Supabase's managed owner is normally `supabase_storage_admin`; this file refuses to run under `postgres` unless it actually owns the table. It checks the bucket, policy names, and helper-function privileges; it does not modify RLS or ownership, preserves public media reads, and replaces upload/update policies with trusted-claim rules. If you cannot open a SQL session as the actual owner, have a Supabase database administrator apply this one file; do not grant role membership or transfer ownership.
7. Only after verifying the RPC owner and access, run `supabase/activate-public-settings-rpc.sql`. It grants execute on the read-only function to `anon` and `authenticated`, and grants no table write privileges. Verify the grant:

   ```sql
   select has_function_privilege('anon', 'public.get_portfolio_public_settings()', 'EXECUTE') as anon_can_call,
          has_function_privilege('authenticated', 'public.get_portfolio_public_settings()', 'EXECUTE') as authenticated_can_call;
   ```

   Both should be true. Confirm `security_definer` is true and `function_settings` includes `search_path=""`. From a public client, call `get_portfolio_public_settings()` and confirm it returns the allowlisted JSON object; direct anonymous reads of `__SITE_SETTINGS__` must return no rows. Re-run the policy query and confirm public project/experience reads filter unpublished/deleted markers, the settings sentinel is excluded, table writes require the claim helper, Storage reads remain available, and Storage insert/update require the claim helper.
8. Assign the single admin `app_metadata.portfolio_role` claim using the trusted procedure above, then sign out and sign back in. Verify an admin can read/write portfolio content and upload/replace media. Use a separate authenticated non-admin account to verify writes and uploads fail; the client claim check in `admin.js` is only a UI gate and RLS is the authorization boundary. Never put a service-role key in frontend configuration.
9. Load the public portfolio and verify projects/experience visibility and the settings RPC. Edit one low-risk CMS field, save, refresh both pages, and confirm the persisted value appears publicly. Also verify that an unpublished or deleted legacy item is absent after refresh. Do not call synchronization enabled until these live checks pass.

## Admin URL after Vercel deployment
`https://ibtesab-alam.vercel.app/admin.html`

## Existing database columns used
- `projects`: `id`, `project_name`, `role`, `location`, `start_date`, `end_date`, `description`, `sort_order`
- `experience`: `id`, `company`, `position`, `start_date`, `end_date`, `description`, `sort_order`
- `profile_settings`: `id`, `photo_zoom`, `photo_x`, `photo_y`

## Storage
Bucket: `profile-photo`
Fixed file path used by the app: `profile/profile-photo.webp`

The Admin Panel also uses `profile/logo.webp` and `profile/resume.pdf` in the same bucket. After applying the hardening migration, uploads and replacements for all media paths in `profile-photo` require the trusted admin claim; public visitors receive read-only access to the bucket.

If the portfolio shows old content after a photo change, refresh the page once.
