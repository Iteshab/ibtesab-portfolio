const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
const ADMIN_EMAIL = window.ADMIN_EMAIL;
const BUCKET = 'profile-photo';
const PHOTO_PATH = 'profile/profile-photo.webp';

const $ = (id) => document.getElementById(id);
const loginPanel = $('loginPanel'), app = $('app'), logoutBtn = $('logoutBtn');

function msg(el, text, type='') {
  el.textContent = text || '';
  el.className = 'msg ' + type;
}

function showApp(show) {
  loginPanel.classList.toggle('hidden', show);
  app.classList.toggle('hidden', !show);
  logoutBtn.classList.toggle('hidden', !show);
}

async function requireAdmin() {
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) { showApp(false); return false; }
  if ((user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await sb.auth.signOut();
    showApp(false);
    msg($('loginMsg'), 'This account is not authorized as the portfolio admin.', 'error');
    return false;
  }
  showApp(true);
  await loadPhoto();
  await loadExperiences();
  return true;
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg($('loginMsg'), 'Signing in…');
  const { error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });
  if (error) { msg($('loginMsg'), error.message, 'error'); return; }
  msg($('loginMsg'), '');
  await requireAdmin();
});

logoutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
  showApp(false);
  $('loginForm').reset();
});

async function loadPhoto() {
  const { data } = sb.storage.from(BUCKET).getPublicUrl(PHOTO_PATH);
  const img = $('photoPreview');
  img.onload = () => { img.style.display = 'block'; $('photoFallback').style.display='none'; };
  img.onerror = () => { img.style.display='none'; $('photoFallback').style.display='grid'; };
  img.src = data.publicUrl + '?t=' + Date.now();
}

$('uploadPhoto').addEventListener('click', async () => {
  const file = $('photoInput').files[0];
  if (!file) { msg($('photoMsg'), 'Please choose a JPG, PNG or WebP image first.', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { msg($('photoMsg'), 'Maximum photo size is 5 MB.', 'error'); return; }
  msg($('photoMsg'), 'Uploading…');
  const { error } = await sb.storage.from(BUCKET).upload(PHOTO_PATH, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600'
  });
  if (error) { msg($('photoMsg'), error.message, 'error'); return; }
  msg($('photoMsg'), 'Photo updated successfully.', 'ok');
  $('photoInput').value = '';
  await loadPhoto();
});

async function loadExperiences() {
  const { data, error } = await sb.from('experience').select('*').order('sort_order', { ascending:true });
  if (error) { $('experienceList').innerHTML = '<div class="msg error">' + escapeHtml(error.message) + '</div>'; return; }
  const list = $('experienceList');
  if (!data?.length) { list.innerHTML = '<div class="msg">No experience added yet. Use “Add Experience”.</div>'; return; }
  list.innerHTML = data.map(row => `
    <article class="item">
      <div>
        <h3>${escapeHtml(row.position || '')}</h3>
        <div class="company">${escapeHtml(row.company || '')}</div>
        <div class="date">${escapeHtml(row.start_date || '')} — ${escapeHtml(row.end_date || '')}</div>
      </div>
      <div class="actions">
        <button class="btn" data-edit="${row.id}">Edit</button>
        <button class="btn danger" data-delete="${row.id}">Delete</button>
      </div>
    </article>`).join('');
  list.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editExperience(Number(b.dataset.edit), data)));
  list.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteExperience(Number(b.dataset.delete))));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function openEditor(row=null) {
  $('editor').classList.remove('hidden');
  $('editorTitle').textContent = row ? 'Edit Experience' : 'Add Experience';
  $('expId').value = row?.id || '';
  $('position').value = row?.position || '';
  $('company').value = row?.company || '';
  $('startDate').value = row?.start_date || '';
  $('endDate').value = row?.end_date || '';
  $('description').value = row?.description || '';
  $('sortOrder').value = row?.sort_order ?? 1;
  $('saveMsg').textContent = '';
  window.scrollTo({top:$('editor').offsetTop-20, behavior:'smooth'});
}

function editExperience(id, data) {
  const row = data.find(x => Number(x.id) === id);
  if (row) openEditor(row);
}

function closeEditor() {
  $('editor').classList.add('hidden');
  $('experienceForm').reset();
  $('expId').value = '';
  $('sortOrder').value = 1;
}

$('newExperience').addEventListener('click', () => openEditor());
$('cancelEdit').addEventListener('click', closeEditor);
$('cancelEdit2').addEventListener('click', closeEditor);

$('experienceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('expId').value;
  const payload = {
    position: $('position').value.trim(),
    company: $('company').value.trim(),
    start_date: $('startDate').value.trim(),
    end_date: $('endDate').value.trim(),
    description: $('description').value.trim(),
    sort_order: Number($('sortOrder').value) || 1
  };
  msg($('saveMsg'), 'Saving…');
  let result;
  if (id) result = await sb.from('experience').update(payload).eq('id', id);
  else result = await sb.from('experience').insert(payload);
  if (result.error) { msg($('saveMsg'), result.error.message, 'error'); return; }
  msg($('saveMsg'), 'Saved successfully.', 'ok');
  await loadExperiences();
  setTimeout(closeEditor, 500);
});

async function deleteExperience(id) {
  if (!confirm('Delete this experience?')) return;
  const { error } = await sb.from('experience').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  await loadExperiences();
}

sb.auth.onAuthStateChange((_event, _session) => requireAdmin());
requireAdmin();
