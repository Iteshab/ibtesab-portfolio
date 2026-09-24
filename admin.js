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
  if (loginPanel) {
    loginPanel.classList.toggle('hidden', show);
  }

  if (app) {
    app.classList.toggle('hidden', !show);
  }

  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', !show);
  }
}


/* =========================
   PHOTO ADJUSTMENT SETTINGS
   ========================= */

let photoSettings = {
  zoom: 1,
  x: 50,
  y: 50
};

function applyPhotoSettings() {
  const img = $('photoPreview');

  if (!img) return;

  img.style.objectPosition =
    `${photoSettings.x}% ${photoSettings.y}%`;

  img.style.transform =
    `scale(${photoSettings.zoom})`;
}

async function loadPhotoSettings() {
  const { data, error } = await sb
    .from('profile_settings')
    .select('photo_zoom, photo_x, photo_y')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error(
      'Could not load photo settings:',
      error
    );
    return;
  }

  if (data) {
    photoSettings.zoom =
      Number(data.photo_zoom) || 1;

    photoSettings.x =
      Number(data.photo_x) || 50;

    photoSettings.y =
      Number(data.photo_y) || 50;
  }

  if ($('photoZoom')) {
    $('photoZoom').value =
      photoSettings.zoom;
  }

  if ($('photoX')) {
    $('photoX').value =
      photoSettings.x;
  }

  if ($('photoY')) {
    $('photoY').value =
      photoSettings.y;
  }

  applyPhotoSettings();
}

async function savePhotoSettings() {
  const zoom =
    Number($('photoZoom').value);

  const x =
    Number($('photoX').value);

  const y =
    Number($('photoY').value);

  const { error } = await sb
    .from('profile_settings')
    .upsert({
      id: 1,
      photo_zoom: zoom,
      photo_x: x,
      photo_y: y
    });

  if (error) {
    msg(
      $('photoAdjustMsg'),
      error.message,
      'error'
    );
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
      photoSettings.zoom =
        Number(zoom.value);

      applyPhotoSettings();
    });
  }

  if (x) {
    x.addEventListener('input', () => {
      photoSettings.x =
        Number(x.value);

      applyPhotoSettings();
    });
  }

  if (y) {
    y.addEventListener('input', () => {
      photoSettings.y =
        Number(y.value);

      applyPhotoSettings();
    });
  }

  if (save) {
    save.addEventListener(
      'click',
      savePhotoSettings
    );
  }
}


/* =========================
   ADMIN LOGIN
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
    (user.email || '').toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
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

  return true;
}

async function handleLogin(e) {
  e.preventDefault();

  msg(
    $('loginMsg'),
    'Signing in…'
  );

  const email =
    $('email').value.trim();

  const password =
    $('password').value;

  const { error } =
    await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

  if (error) {
    msg(
      $('loginMsg'),
      error.message,
      'error'
    );
    return;
  }

  await requireAdmin();
}

async function handleLogout() {
  await sb.auth.signOut();

  showApp(false);

  if ($('loginForm')) {
    $('loginForm').reset();
  }
}

function setupAuth() {
  const loginForm =
    $('loginForm');

  if (loginForm) {
    loginForm.addEventListener(
      'submit',
      handleLogin
    );
  }

  if (logoutBtn) {
    logoutBtn.addEventListener(
      'click',
      handleLogout
    );
  }
}
/* =========================
   PROFILE PHOTO
   ========================= */

async function loadPhoto() {
  const img = $('photoPreview');
  const fallback = $('photoFallback');

  if (!img) return;

  const {
    data: { publicUrl }
  } = sb.storage
    .from(BUCKET)
    .getPublicUrl(PHOTO_PATH);

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

  img.src =
    publicUrl + '?t=' + Date.now();
}


async function uploadPhoto() {
  const input = $('photoInput');
  const file = input?.files?.[0];

  if (!file) {
    msg(
      $('photoMsg'),
      'Please select a photo first.',
      'error'
    );
    return;
  }

  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    msg(
      $('photoMsg'),
      'Only PNG, JPG/JPEG or WebP images are allowed.',
      'error'
    );
    return;
  }

  msg(
    $('photoMsg'),
    'Uploading photo…'
  );

  const { error } =
    await sb.storage
      .from(BUCKET)
      .upload(
        PHOTO_PATH,
        file,
        {
          cacheControl: '3600',
          contentType: file.type,
          upsert: true
        }
      );

  if (error) {
    console.error(error);

    msg(
      $('photoMsg'),
      error.message,
      'error'
    );

    return;
  }

  msg(
    $('photoMsg'),
    'Photo uploaded successfully.',
    'ok'
  );

  await loadPhoto();

  input.value = '';
}


function setupPhotoUpload() {
  const button =
    $('uploadPhoto');

  if (button) {
    button.addEventListener(
      'click',
      uploadPhoto
    );
  }
}


/* =========================
   EXPERIENCE
   ========================= */

async function loadExperiences() {
  const list =
    $('experienceList');

  if (!list) return;

  list.innerHTML =
    '<div class="muted">Loading experience…</div>';

  const {
    data,
    error
  } = await sb
    .from('experience')
    .select('*')
    .order('sort_order', {
      ascending: true
    });

  if (error) {
    console.error(error);

    list.innerHTML =
      '<div class="msg error">' +
      error.message +
      '</div>';

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      '<div class="muted">No experience added yet.</div>';

    return;
  }

  list.innerHTML =
    data.map(renderExperience).join('');
}


function renderExperience(item) {
  const responsibilities =
    item.description
      ? item.description
          .split('\n')
          .filter(Boolean)
          .map(line =>
            `<li>${escapeHtml(line)}</li>`
          )
          .join('')
      : '';

  return `
    <div class="item">
      <div>
        <h3>
          ${escapeHtml(item.position || '')}
        </h3>

        <div class="company">
          ${escapeHtml(item.company || '')}
        </div>

        <div class="date">
          ${escapeHtml(item.start_date || '')}
          -
          ${escapeHtml(item.end_date || '')}
        </div>

        ${
          responsibilities
            ? `<ul>${responsibilities}</ul>`
            : ''
        }
      </div>

      <div class="actions">
        <button
          class="btn"
          type="button"
          data-edit="${item.id}"
        >
          Edit
        </button>

        <button
          class="btn danger"
          type="button"
          data-delete="${item.id}"
        >
          Delete
        </button>
      </div>
    </div>
  `;
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function setupExperienceList() {
  const list =
    $('experienceList');

  if (!list) return;

  list.addEventListener(
    'click',
    async (e) => {

      const editButton =
        e.target.closest('[data-edit]');

      const deleteButton =
        e.target.closest('[data-delete]');

      if (editButton) {
        const id =
          editButton.dataset.edit;

        await editExperience(id);
        return;
      }

      if (deleteButton) {
        const id =
          deleteButton.dataset.delete;

        await deleteExperience(id);
      }
    }
  );
}


async function editExperience(id) {
  const {
    data,
    error
  } = await sb
    .from('experience')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    msg(
      $('saveMsg'),
      error.message,
      'error'
    );
    return;
  }

  $('editor').classList.remove('hidden');

  $('editorTitle').textContent =
    'Edit Experience';

  $('expId').value =
    data.id || '';

  $('position').value =
    data.position || '';

  $('company').value =
    data.company || '';

  $('startDate').value =
    data.start_date || '';

  $('endDate').value =
    data.end_date || '';

  $('description').value =
    data.description || '';

  $('sortOrder').value =
    data.sort_order || 1;

  $('editor').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


async function deleteExperience(id) {
  const confirmed =
    confirm(
      'Are you sure you want to delete this experience?'
    );

  if (!confirmed) return;

  const { error } =
    await sb
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
   EXPERIENCE EDITOR
   ========================= */

function openNewExperience() {
  $('editor').classList.remove('hidden');

  $('editorTitle').textContent =
    'Add Experience';

  $('expId').value = '';
  $('position').value = '';
  $('company').value = '';
  $('startDate').value = '';
  $('endDate').value = 'Present';
  $('description').value = '';
  $('sortOrder').value = 1;

  msg($('saveMsg'), '');

  $('editor').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


function closeEditor() {
  $('editor').classList.add('hidden');

  if ($('experienceForm')) {
    $('experienceForm').reset();
  }

  $('expId').value = '';

  msg($('saveMsg'), '');
}


async function saveExperience(e) {
  e.preventDefault();

  msg(
    $('saveMsg'),
    'Saving…'
  );

  const id =
    $('expId').value.trim();

  const payload = {
    position:
      $('position').value.trim(),

    company:
      $('company').value.trim(),

    start_date:
      $('startDate').value.trim(),

    end_date:
      $('endDate').value.trim(),

    description:
      $('description').value.trim(),

    sort_order:
      Number($('sortOrder').value) || 1
  };

  let error;

  if (id) {
    const result =
      await sb
        .from('experience')
        .update(payload)
        .eq('id', id);

    error = result.error;

  } else {
    const result =
      await sb
        .from('experience')
        .insert(payload);

    error = result.error;
  }

  if (error) {
    console.error(error);

    msg(
      $('saveMsg'),
      error.message,
      'error'
    );

    return;
  }

  msg(
    $('saveMsg'),
    'Experience saved successfully.',
    'ok'
  );

  await loadExperiences();

  setTimeout(() => {
    closeEditor();
  }, 500);
}


function setupExperienceEditor() {
  const newButton =
    $('newExperience');

  const cancelButton =
    $('cancelEdit');

  const cancelButton2 =
    $('cancelEdit2');

  const form =
    $('experienceForm');

  if (newButton) {
    newButton.addEventListener(
      'click',
      openNewExperience
    );
  }

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      closeEditor
    );
  }

  if (cancelButton2) {
    cancelButton2.addEventListener(
      'click',
      closeEditor
    );
  }

  if (form) {
    form.addEventListener(
      'submit',
      saveExperience
    );
  }
}


/* =========================
   FORGOT PASSWORD
   ========================= */

function setupPasswordRecovery() {
  const forgot =
    $('forgotPassword');

  const modal =
    $('forgotModal');

  const close =
    $('closeForgot');

  const send =
    $('sendReset');

  if (forgot) {
    forgot.addEventListener(
      'click',
      (e) => {
        e.preventDefault();

        if (modal) {
          modal.style.display = 'flex';
        }
      }
    );
  }

  if (close) {
    close.addEventListener(
      'click',
      () => {
        if (modal) {
          modal.style.display = 'none';
        }
      }
    );
  }

  if (send) {
    send.addEventListener(
      'click',
      sendPasswordReset
    );
  }
}


async function sendPasswordReset() {
  const resetMsg =
    $('resetMsg');

  if (!ADMIN_EMAIL) {
    if (resetMsg) {
      resetMsg.textContent =
        'Admin email is not configured.';
    }

    return;
  }

  if (resetMsg) {
    resetMsg.textContent =
      'Sending reset email…';
  }

  const redirectTo =
    window.location.origin +
    '/admin.html';

  const { error } =
    await sb.auth.resetPasswordForEmail(
      ADMIN_EMAIL,
      {
        redirectTo: redirectTo
      }
    );

  if (error) {
    console.error(error);

    if (resetMsg) {
      resetMsg.textContent =
        error.message;
    }

    return;
  }

  if (resetMsg) {
    resetMsg.textContent =
      'Reset email sent. Please check your inbox and spam folder.';
  }
}


/* =========================
   PASSWORD RECOVERY SESSION
   ========================= */

async function handlePasswordRecovery() {
  const url =
    new URL(window.location.href);

  const type =
    url.searchParams.get('type');

  if (type !== 'recovery') {
    return;
  }

  const newPassword =
    prompt(
      'Enter your new admin password:'
    );

  if (!newPassword) {
    return;
  }

  const { error } =
    await sb.auth.updateUser({
      password: newPassword
    });

  if (error) {
    alert(
      'Password update failed: ' +
      error.message
    );

    return;
  }

  alert(
    'Password updated successfully.'
  );

  window.history.replaceState(
    {},
    document.title,
    window.location.pathname
  );
}


/* =========================
   INITIALIZE ADMIN PANEL
   ========================= */

async function init() {
  setupPhotoControls();
  setupPhotoUpload();
  setupExperienceList();
  setupExperienceEditor();
  setupPasswordRecovery();

  await handlePasswordRecovery();

  await requireAdmin();
}

init();
