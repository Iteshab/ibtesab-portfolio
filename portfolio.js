const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = window.SUPABASE_PUBLISHABLE_KEY;

const portfolioSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

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

async function loadExperience() {
  const list = document.getElementById('experienceList');
  if (!list) return;

  const { data, error } = await portfolioSupabase
    .from('experience')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Experience load error:', error);

    list.innerHTML =
      '<div class="job"><div class="jobbox"><h3>Unable to load experience.</h3><div class="company">Please check the Supabase experience table and public read policy.</div></div></div>';

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      '<div class="job"><div class="jobbox"><h3>No experience added yet.</h3></div></div>';

    return;
  }

  list.innerHTML = data.map(row => {

    const responsibilities = String(row.description || '')
      .split(/\n+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => `<li>${escapePortfolioHtml(x)}</li>`)
      .join('');

    return `
      <article class="job">

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

      </article>
    `;

  }).join('');
}


async function loadProjects() {

  const list = document.getElementById('projectsList');

  if (!list) return;

  const { data, error } = await portfolioSupabase
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {

    console.error('Projects load error:', error);

    list.innerHTML =
      '<div class="card project"><h3>Unable to load projects.</h3><p>Please check the Supabase projects table and public read policy.</p></div>';

    return;
  }

  if (!data || data.length === 0) {

    list.innerHTML =
      '<div class="card project"><h3>No projects added yet.</h3><p>Projects will appear here when added from the admin panel.</p></div>';

    return;
  }

  list.innerHTML = data.map((project, index) => {

    const responsibilities = String(project.description || '')
      .split(/\n+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => `<li>${escapePortfolioHtml(x)}</li>`)
      .join('');

    const number = String(index + 1).padStart(2, '0');

    return `
      <article class="card project">

        <div class="num">
          ${number} / PROJECT
        </div>

        <h3>
          ${escapePortfolioHtml(project.project_name || '')}
        </h3>

        ${
          project.role
            ? `
              <div class="company">
                ${escapePortfolioHtml(project.role)}
              </div>
            `
            : ''
        }

        ${
          project.location ||
          project.start_date ||
          project.end_date

            ? `
              <div class="date">

                ${escapePortfolioHtml(project.location || '')}

                ${
                  project.location &&
                  (project.start_date || project.end_date)
                    ? ' • '
                    : ''
                }

                ${escapePortfolioHtml(project.start_date || '')}

                ${
                  project.start_date || project.end_date
                    ? ' — '
                    : ''
                }

                ${escapePortfolioHtml(project.end_date || '')}

              </div>
            `

            : ''
        }

        ${
          responsibilities
            ? `<ul>${responsibilities}</ul>`
            : ''
        }

      </article>
    `;

  }).join('');
}


async function loadProfilePhoto() {

  const img = document.getElementById('profilePhoto');

  const fallback =
    document.getElementById('avatarFallback');

  if (!img) return;

  const { data } =
    portfolioSupabase.storage
      .from('profile-photo')
      .getPublicUrl(
        'profile/profile-photo.webp'
      );

  if (!data?.publicUrl) return;

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
    data.publicUrl +
    '?t=' +
    Date.now();
}


async function loadPhotoSettings() {

  const img =
    document.getElementById('profilePhoto');

  if (!img) return;

  const { data, error } =
    await portfolioSupabase
      .from('profile_settings')
      .select(
        'photo_zoom, photo_x, photo_y'
      )
      .eq('id', 1)
      .maybeSingle();

  if (error || !data) {

    console.warn(
      'Photo settings could not be loaded. Using default position.',
      error
    );

    return;
  }

  const zoom =
    Number(data.photo_zoom) || 1;

  const x =
    Number(data.photo_x) || 50;

  const y =
    Number(data.photo_y) || 50;

  const moveX =
    (x - 50) * 1.5;

  const moveY =
    (y - 50) * 1.5;

  img.style.objectPosition =
    '50% 50%';

  img.style.transform =
    `translate(${moveX}px, ${moveY}px) scale(${zoom})`;
}


async function loadPortfolioContent() {

  await Promise.allSettled([

    loadExperience(),

    loadProjects(),

    loadProfilePhoto(),

    loadPhotoSettings()

  ]);

}


loadPortfolioContent();
