const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = window.SUPABASE_PUBLISHABLE_KEY;
const portfolioSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function loadPortfolioContent() {
  try {
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
            .map(x => `<li>${escapePortfolioHtml(x)}</li>`).join('');
          return `<article class="job">
            <div class="date">${escapePortfolioHtml(row.start_date || '')} — ${escapePortfolioHtml(row.end_date || '')}</div>
            <div class="jobbox">
              <h3>${escapePortfolioHtml(row.position || '')}</h3>
              <div class="company">${escapePortfolioHtml(row.company || '')}</div>
              ${responsibilities ? `<ul>${responsibilities}</ul>` : ''}
            </div>
          </article>`;
        }).join('') || '<div class="job"><div class="jobbox"><h3>No experience added yet.</h3></div></div>';
      }
    }

    const { data: photo } = portfolioSupabase.storage.from('profile-photo').getPublicUrl('profile/profile-photo.webp');
    const img = document.getElementById('profilePhoto');
    const fallback = document.getElementById('avatarFallback');
    if (img && photo?.publicUrl) {
      img.onload = () => { img.style.display='block'; if(fallback) fallback.style.display='none'; };
      img.onerror = () => { img.style.display='none'; if(fallback) fallback.style.display='flex'; };
      img.src = photo.publicUrl + '?t=' + Date.now();
    }
  } catch (e) {
    console.error('Portfolio CMS load error:', e);
  }
}

function escapePortfolioHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

loadPortfolioContent();
