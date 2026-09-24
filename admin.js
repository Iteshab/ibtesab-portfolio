const sb = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

const ADMIN_EMAIL = window.ADMIN_EMAIL;
const BUCKET = 'profile-photo';
const PHOTO_PATH = 'profile/profile-photo.webp';

const $ = (id) => document.getElementById(id);

const loginPanel = $('loginPanel');
const app = $('app');
const logoutBtn = $('logoutBtn');

function msg(el, text, type = '') {
  if (!el) return;
  el.textContent = text || '';
  el.className = 'msg ' + type;
}

function showApp(show) {
  if (loginPanel) loginPanel.classList.toggle('hidden', show);
  if (app) app.classList.toggle('hidden', !show);
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !show);
}

/* =========================
   Photo adjustment settings
   ========================= */
/* =========================
   Projects
   ========================= */

async function loadProjects() {
  const list = $('projectList');

  if (!list) {
    return;
  }

  const { data, error } = await sb
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    msg(list, error.message, 'error');
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      '<div class="item"><div><h3>No projects added yet.</h3></div></div>';
    return;
  }

  list.innerHTML = data.map(row => `
    <article class="item">

      <div>
        <h3>${escapeHtml(row.project_name || '')}</h3>

        <div class="company">
          ${escapeHtml(row.role || '')}
        </div>

        <div class="date">
          ${escapeHtml(row.location || '')}
          ${row.start_date || row.end_date ? ' • ' : ''}
          ${escapeHtml(row.start_date || '')}
          ${row.start_date || row.end_date ? ' — ' : ''}
          ${escapeHtml(row.end_date || '')}
        </div>
      </div>

      <div class="actions">

        <button
          class="btn"
          type="button"
          data-project-edit="${row.id}">
          Edit
        </button>

        <button
          class="btn danger"
          type="button"
          data-project-delete="${row.id}">
          Delete
        </button>

      </div>

    </article>
  `).join('');

  list.querySelectorAll('[data-project-edit]')
    .forEach(button => {
      button.addEventListener('click', () => {
        editProject(
          Number(button.dataset.projectEdit),
          data
        );
      });
    });

  list.querySelectorAll('[data-project-delete]')
    .forEach(button => {
      button.addEventListener('click', () => {
        deleteProject(
          Number(button.dataset.projectDelete)
        );
      });
    });
}


function openProjectEditor(row = null) {

  $('projectEditor').classList.remove('hidden');

  $('projectEditorTitle').textContent =
    row ? 'Edit Project' : 'Add Project';

  $('projectId').value =
    row?.id || '';

  $('projectName').value =
    row?.project_name || '';

  $('projectRole').value =
    row?.role || '';

  $('projectLocation').value =
    row?.location || '';

  $('projectStartDate').value =
    row?.start_date || '';

  $('projectEndDate').value =
    row?.end_date || '';

  $('projectDescription').value =
    row?.description || '';

  $('projectSortOrder').value =
    row?.sort_order ?? 1;

  msg($('projectSaveMsg'), '');

  window.scrollTo({
    top: $('projectEditor').offsetTop - 20,
    behavior: 'smooth'
  });
}


function editProject(id, data) {

  const row = data.find(
    x => Number(x.id) === id
  );

  if (row) {
    openProjectEditor(row);
  }
}


function closeProjectEditor() {

  $('projectEditor').classList.add('hidden');

  $('projectForm').reset();

  $('projectId').value = '';

  $('projectSortOrder').value = 1;
}


function setupProjectEditor() {

  $('newProject').addEventListener(
    'click',
    () => openProjectEditor()
  );

  $('cancelProjectEdit').addEventListener(
    'click',
    closeProjectEditor
  );

  $('cancelProjectEdit2').addEventListener(
    'click',
    closeProjectEditor
  );

  $('projectForm').addEventListener(
    'submit',
    saveProject
  );
}


async function saveProject(e) {

  e.preventDefault();

  const id = $('projectId').value;

  const payload = {

    project_name:
      $('projectName').value.trim(),

    role:
      $('projectRole').value.trim(),

    location:
      $('projectLocation').value.trim(),

    start_date:
      $('projectStartDate').value.trim(),

    end_date:
      $('projectEndDate').value.trim(),

    description:
      $('projectDescription').value.trim(),

    sort_order:
      Number($('projectSortOrder').value) || 1
  };

  msg(
    $('projectSaveMsg'),
    'Saving…'
  );

  let result;

  if (id) {

    result = await sb
      .from('projects')
      .update(payload)
      .eq('id', id);

  } else {

    result = await sb
      .from('projects')
      .insert(payload);

  }

  if (result.error) {

    msg(
      $('projectSaveMsg'),
      result.error.message,
      'error'
    );

    return;
  }

  msg(
    $('projectSaveMsg'),
    'Project saved successfully.',
    'ok'
  );

  await loadProjects();

  setTimeout(
    closeProjectEditor,
    500
  );
}


async function deleteProject(id) {

  if (!confirm('Delete this project?')) {
    return;
  }

  const { error } = await sb
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {

    alert(error.message);

    return;
  }

  await loadProjects();
}
let photoSettings = {
  zoom: 1,
  x: 50,
  y: 50
};

function applyPhotoSettings() {
  const img = $('photoPreview');
  if (!img) return;

  const zoom = Number(photoSettings.zoom) || 1;
  const x = Number(photoSettings.x) || 50;
  const y = Number(photoSettings.y) || 50;

  const moveX = (x - 50) * 1.5;
  const moveY = (y - 50) * 1.5;

  img.style.objectPosition = '50% 50%';
  img.style.transform =
    `translate(${moveX}px, ${moveY}px) scale(${zoom})`;
}

async function loadPhotoSettings() {
  const { data, error } = await sb
    .from('profile_settings')
    .select('photo_zoom, photo_x, photo_y')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Could not load photo settings:', error);
    return;
  }

  if (data) {
    photoSettings.zoom = Number(data.photo_zoom) || 1;
    photoSettings.x = Number(data.photo_x) || 50;
    photoSettings.y = Number(data.photo_y) || 50;
  }

  if ($('photoZoom')) $('photoZoom').value = photoSettings.zoom;
  if ($('photoX')) $('photoX').value = photoSettings.x;
  if ($('photoY')) $('photoY').value = photoSettings.y;

  applyPhotoSettings();
}

async function savePhotoSettings() {
  const zoom = Number($('photoZoom').value);
  const x = Number($('photoX').value);
  const y = Number($('photoY').value);

  const { error } = await sb
    .from('profile_settings')
    .upsert({
      id: 1,
      photo_zoom: zoom,
      photo_x: x,
      photo_y: y
    });

  if (error) {
    msg($('photoAdjustMsg'), error.message, 'error');
    return;
  }

  photoSettings.zoom = zoom;
  photoSettings.x = x;
  photoSettings.y = y;

  applyPhotoSettings();

  msg(
    $('photoAdjustMsg'),
    'Photo position saved successfully.',
    'ok'
  );
}

function setupPhotoControls() {
  const zoom = $('photoZoom');
  const x = $('photoX');
  const y = $('photoY');
  const save = $('savePhotoPosition');

  if (zoom) {
    zoom.addEventListener('input', () => {
      photoSettings.zoom = Number(zoom.value);
      applyPhotoSettings();
    });
  }

  if (x) {
    x.addEventListener('input', () => {
      photoSettings.x = Number(x.value);
      applyPhotoSettings();
    });
  }

  if (y) {
    y.addEventListener('input', () => {
      photoSettings.y = Number(y.value);
      applyPhotoSettings();
    });
  }

  if (save) {
    save.addEventListener('click', savePhotoSettings);
  }
}

/* =========================
   Authentication
   ========================= */

async function requireAdmin() {
  const {
    data: { user },
    error
  } = await sb.auth.getUser();

  if (error || !user) {
    showApp(false);
    return false;
  }

  if (
    !ADMIN_EMAIL ||
    (user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()
  ) {
    await sb.auth.signOut();
    showApp(false);

    msg(
      $('loginMsg'),
      'This account is not authorized as the portfolio admin.',
      'error'
    );

    return false;
  }

  showApp(true);

  await loadPhoto();
  await loadPhotoSettings();
  await loadExperiences();
  await loadProjects();
  return true;
}

async function handleLogin(e) {
  e.preventDefault();

  msg($('loginMsg'), 'Signing in…');

  const email = $('email').value.trim();
  const password = $('password').value;

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg($('loginMsg'), error.message, 'error');
    return;
  }

  await requireAdmin();
}

async function handleLogout() {
  await sb.auth.signOut();
  showApp(false);
  $('loginForm').reset();
}

function setupAuth() {
  const loginForm = $('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

/* =========================
   Profile photo
   ========================= */

async function loadPhoto() {
  const { data } = sb.storage
    .from(BUCKET)
    .getPublicUrl(PHOTO_PATH);

  const img = $('photoPreview');
  const fallback = $('photoFallback');

  if (!img) return;

  img.onload = () => {
    img.style.display = 'block';

    if (fallback) {
      fallback.style.display = 'none';
    }

    applyPhotoSettings();
  };

  img.onerror = () => {
    img.style.display = 'none';

    if (fallback) {
      fallback.style.display = 'grid';
    }
  };

  img.src = data.publicUrl + '?t=' + Date.now();
}

async function uploadPhoto() {
  const file = $('photoInput').files[0];

  if (!file) {
    msg(
      $('photoMsg'),
      'Please choose a JPG, PNG or WebP image first.',
      'error'
    );
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    msg(
      $('photoMsg'),
      'Maximum photo size is 5 MB.',
      'error'
    );
    return;
  }

  msg($('photoMsg'), 'Uploading…');

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(PHOTO_PATH, file, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600'
    });

  if (error) {
    msg($('photoMsg'), error.message, 'error');
    return;
  }

  msg(
    $('photoMsg'),
    'Photo updated successfully.',
    'ok'
  );

  $('photoInput').value = '';

  await loadPhoto();
}

function setupPhotoUpload() {
  const button = $('uploadPhoto');

  if (button) {
    button.addEventListener('click', uploadPhoto);
  }
}

/* =========================
   Experience
   ========================= */

async function loadExperiences() {
  const { data, error } = await sb
    .from('experience')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    $('experienceList').innerHTML =
      '<div class="msg error">' +
      escapeHtml(error.message) +
      '</div>';
    return;
  }

  const list = $('experienceList');

  if (!data || !data.length) {
    list.innerHTML =
      '<div class="msg">No experience added yet. Use “Add Experience”.</div>';
    return;
  }

  list.innerHTML = data.map(row => `
    <article class="item">
      <div>
        <h3>${escapeHtml(row.position || '')}</h3>

        <div class="company">
          ${escapeHtml(row.company || '')}
        </div>

        <div class="date">
          ${escapeHtml(row.start_date || '')} —
          ${escapeHtml(row.end_date || '')}
        </div>
      </div>

      <div class="actions">
        <button class="btn" data-edit="${row.id}">
          Edit
        </button>

        <button class="btn danger" data-delete="${row.id}">
          Delete
        </button>
      </div>
    </article>
  `).join('');

  list.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => {
      editExperience(
        Number(button.dataset.edit),
        data
      );
    });
  });

  list.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => {
      deleteExperience(
        Number(button.dataset.delete)
      );
    });
  });
}

function escapeHtml(value) {
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

function openEditor(row = null) {
  $('editor').classList.remove('hidden');

  $('editorTitle').textContent =
    row ? 'Edit Experience' : 'Add Experience';

  $('expId').value = row?.id || '';
  $('position').value = row?.position || '';
  $('company').value = row?.company || '';
  $('startDate').value = row?.start_date || '';
  $('endDate').value = row?.end_date || '';
  $('description').value = row?.description || '';
  $('sortOrder').value = row?.sort_order ?? 1;

  msg($('saveMsg'), '');

  window.scrollTo({
    top: $('editor').offsetTop - 20,
    behavior: 'smooth'
  });
}

function editExperience(id, data) {
  const row = data.find(
    x => Number(x.id) === id
  );

  if (row) {
    openEditor(row);
  }
}

function closeEditor() {
  $('editor').classList.add('hidden');
  $('experienceForm').reset();
  $('expId').value = '';
  $('sortOrder').value = 1;
}

function setupExperienceEditor() {
  $('newExperience').addEventListener(
    'click',
    () => openEditor()
  );

  $('cancelEdit').addEventListener(
    'click',
    closeEditor
  );

  $('cancelEdit2').addEventListener(
    'click',
    closeEditor
  );

  $('experienceForm').addEventListener(
    'submit',
    saveExperience
  );
}

async function saveExperience(e) {
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

  if (id) {
    result = await sb
      .from('experience')
      .update(payload)
      .eq('id', id);
  } else {
    result = await sb
      .from('experience')
      .insert(payload);
  }

  if (result.error) {
    msg(
      $('saveMsg'),
      result.error.message,
      'error'
    );
    return;
  }

  msg(
    $('saveMsg'),
    'Saved successfully.',
    'ok'
  );

  await loadExperiences();

  setTimeout(closeEditor, 500);
}

async function deleteExperience(id) {
  if (!confirm('Delete this experience?')) {
    return;
  }

  const { error } = await sb
    .from('experience')
    .delete()
    .eq('id', id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadExperiences();
}

/* =========================
   Password recovery
   ========================= */

function setupPasswordRecovery() {
  const forgot = $('forgotPassword');
  const modal = $('forgotModal');
  const close = $('closeForgot');
  const send = $('sendReset');
  const resetMsg = $('resetMsg');

  if (!forgot || !modal || !send) {
    return;
  }

  forgot.addEventListener('click', e => {
    e.preventDefault();

    modal.style.display = 'flex';

    if (resetMsg) {
      resetMsg.textContent = '';
    }
  });

  if (close) {
    close.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  send.addEventListener('click', async () => {
    send.disabled = true;

    if (resetMsg) {
      resetMsg.textContent =
        'Sending reset email...';
    }

    try {
      const redirectTo =
        window.location.origin + '/admin.html';

      const { error } =
        await sb.auth.resetPasswordForEmail(
          ADMIN_EMAIL,
          { redirectTo }
        );

      if (error) {
        throw error;
      }

      if (resetMsg) {
        resetMsg.textContent =
          'Reset email sent. Check your inbox and Spam folder.';
      }
    } catch (err) {
      console.error(
        'Password reset error:',
        err
      );

      if (resetMsg) {
        resetMsg.textContent =
          err?.message ||
          'Could not send reset email.';
      }
    } finally {
      send.disabled = false;
    }
  });
}

/* =========================
   Start
   ========================= */

function init() {
  setupAuth();
  setupPhotoControls();
  setupPhotoUpload();
  setupExperienceEditor();
  setupProjectEditor();
  setupPasswordRecovery();

  requireAdmin();
}

init();
