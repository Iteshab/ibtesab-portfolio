const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = window.SUPABASE_PUBLISHABLE_KEY;

const portfolioSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

async function loadProjects() {
  const list = document.getElementById('projectsList');

  if (!list) return;

  const { data, error } = await portfolioSupabase
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Projects load error:', error);
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = data.map(project => {

    const responsibilities = String(project.description || '')
      .split(/\n+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => `<li>${escapePortfolioHtml(x)}</li>`)
      .join('');

    return `
      <article class="card">
        <h3>${escapePortfolioHtml(project.project_name || '')}</h3>

        ${project.role
          ? `<div class="company">${escapePortfolioHtml(project.role)}</div>`
          : ''
        }

        ${project.location || project.start_date || project.end_date
          ? `<div class="date">
              ${escapePortfolioHtml(project.location || '')}
              ${project.location && (project.start_date || project.end_date) ? ' • ' : ''}
              ${escapePortfolioHtml(project.start_date || '')}
              ${project.start_date || project.end_date ? ' — ' : ''}
              ${escapePortfolioHtml(project.end_date || '')}
            </div>`
          : ''
        }

        ${responsibilities ? `<ul>${responsibilities}</ul>` : ''}
      </article>
    `;
  }).join('');
}

    // =========================
    // LOAD EXPERIENCE
    // =========================

    const { data: rows, error } = await portfolioSupabase
      .from('experience')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && rows) {

      const list = document.getElementById('experienceList');

      if (list) {

        list.innerHTML = rows.map(row => {

          const responsibilities = String(row.description || '')
            .split(/\n+/)
            .map(x => x.trim())
            .filter(Boolean)
            .map(x => `<li>${escapePortfolioHtml(x)}</li>`)
            .join('');

          return `<article class="job">

            <div class="date">
              ${escapePortfolioHtml(row.start_date || '')}
              —
              ${escapePortfolioHtml(row.end_date || '')}
            </div>

            <div class="jobbox">

              <h3>
                ${escapePortfolioHtml(row.position || '')}
              </h3>

              <div class="company">
                ${escapePortfolioHtml(row.company || '')}
              </div>

              ${
                responsibilities
                  ? `<ul>${responsibilities}</ul>`
                  : ''
              }

            </div>

          </article>`;

        }).join('') ||
        '<div class="job"><div class="jobbox"><h3>No experience added yet.</h3></div></div>';
      }
    }


    // =========================
    // LOAD PROFILE PHOTO
    // =========================

    const {
      data: photo
    } = portfolioSupabase.storage
      .from('profile-photo')
      .getPublicUrl('profile/profile-photo.webp');


    const img = document.getElementById('profilePhoto');
    const fallback = document.getElementById('avatarFallback');


    // =========================
    // LOAD PHOTO SETTINGS
    // =========================

    const {
      data: photoSettings,
      error: settingsError
    } = await portfolioSupabase
      .from('profile_settings')
      .select('photo_zoom, photo_x, photo_y')
      .eq('id', 1)
      .maybeSingle();


    if (settingsError) {
      console.error(
        'Could not load photo settings:',
        settingsError
      );
    }


    // =========================
    // APPLY PHOTO POSITION
    // =========================

    if (img) {

      const zoom =
        Number(photoSettings?.photo_zoom) || 1;

      const x =
        Number(photoSettings?.photo_x) || 50;

      const y =
        Number(photoSettings?.photo_y) || 50;


      // Convert slider values into movement.
      const moveX = (x - 50) * 1.5;
      const moveY = (y - 50) * 1.5;


      img.style.objectPosition = '50% 50%';

      img.style.transform =
        `translate(${moveX}px, ${moveY}px) scale(${zoom})`;
    }


    // =========================
    // SHOW PROFILE PHOTO
    // =========================

    if (img && photo?.publicUrl) {

      img.onload = () => {

        img.style.display = 'block';

        if (fallback) {
          fallback.style.display = 'none';
        }

      };


      img.onerror = () => {

        img.style.display = 'none';

        if (fallback) {
          fallback.style.display = 'flex';
        }

      };


      img.src =
        photo.publicUrl +
        '?t=' +
        Date.now();
    }


  } catch (e) {

    console.error(
      'Portfolio CMS load error:',
      e
    );

  }
}


// =========================
// HTML ESCAPE
// =========================

function escapePortfolioHtml(value) {

  return String(value ?? '').replace(
    /[&<>"']/g,

    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

}


loadPortfolioContent();
loadProjects();
