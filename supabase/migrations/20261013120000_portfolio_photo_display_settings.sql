-- Safely extend the existing public settings RPC with the allowlisted photo display options.
-- Run after the original portfolio RLS migration, as its verified function owner.
begin;
do $photo_rpc_owner$
declare
  function_owner name;
  function_security_definer boolean;
begin
  select pg_get_userbyid(p.proowner)::name, p.prosecdef
  into function_owner, function_security_definer
  from pg_catalog.pg_proc p
  where p.oid = to_regprocedure('public.get_portfolio_public_settings()');

  if function_owner is null then
    raise exception 'Photo settings migration stopped: public settings RPC does not exist';
  end if;
  if function_owner is distinct from current_user::name
     and not (select rolsuper from pg_catalog.pg_roles where rolname = current_user) then
    raise exception 'Photo settings migration stopped: run as RPC owner %, current role is %', function_owner, current_user;
  end if;
  if function_security_definer is distinct from true then
    raise exception 'Photo settings migration stopped: the existing public settings RPC must remain SECURITY DEFINER';
  end if;
end;
$photo_rpc_owner$;
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
        'photoDisplay', jsonb_build_object(
          'x', settings -> 'profile' -> 'photoDisplay' -> 'x',
          'y', settings -> 'profile' -> 'photoDisplay' -> 'y',
          'zoom', settings -> 'profile' -> 'photoDisplay' -> 'zoom',
          'fit', settings -> 'profile' -> 'photoDisplay' -> 'fit',
          'radius', settings -> 'profile' -> 'photoDisplay' -> 'radius',
          'framed', settings -> 'profile' -> 'photoDisplay' -> 'framed'
        ),
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


commit;
