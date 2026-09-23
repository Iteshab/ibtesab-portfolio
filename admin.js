const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
const ADMIN_EMAIL = window.ADMIN_EMAIL;
const BUCKET = 'profile-photo';
const PHOTO_PATH = 'profile/profile-photo.webp';
// Photo adjustment settings
let photoSettings = {
  zoom: 1,
  x: 50,
  y: 50
};

function applyPhotoSettings() {
  const img = $('photoPreview');
  if (!img) return;

  img.style.objectPosition = `${photoSettings.x}% ${photoSettings.y}%`;
  img.style.transform = `scale(${photoSettings.zoom})`;
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

  $('photoZoom').value = photoSettings.zoom;
  $('photoX').value = photoSettings.x;
  $('photoY').value = photoSettings.y;

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

  msg($('photoAdjustMsg'), 'Photo position saved successfully.', 'ok');
}

// Live preview while moving sliders
$('photoZoom').addEventListener('input', () => {
  photoSettings.zoom = Number($('photoZoom').value);
  applyPhotoSettings();
});

$('photoX').addEventListener('input', () => {
  photoSettings.x = Number($('photoX').value);
  applyPhotoSettings();
});

$('photoY').addEventListener('input', () => {
  photoSettings.y = Number($('photoY').value);
  applyPhotoSettings();
});

$('savePhotoPosition').addEventListener('click', savePhotoSettings);

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
await loadPhotoSettings();
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
  img.onload = () => { img.style.display = 'block'; $('photoFallback').style.display='none';applyPhotoSettings();};
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


// Password recovery flow
document.addEventListener("DOMContentLoaded",()=>{
 const forgot=document.getElementById("forgotPassword"), modal=document.getElementById("forgotModal"), close=document.getElementById("closeForgot"), send=document.getElementById("sendReset"), msg=document.getElementById("resetMsg");
 if(!forgot||!modal||!send)return;
 forgot.onclick=(e)=>{e.preventDefault();modal.style.display="flex";};
 if(close) close.onclick=()=>modal.style.display="none";
 send.onclick=async()=>{send.disabled=true;msg.textContent="Sending reset email...";try{const {error}=await supabase.auth.resetPasswordForEmail("ibtesabalam7@gmail.com",{redirectTo:window.location.origin+"/admin.html"});if(error)throw error;msg.textContent="Reset email sent. Check inbox/spam.";}catch(e){msg.textContent=e.message||"Could not send reset email.";}finally{send.disabled=false;}};
 supabase.auth.onAuthStateChange(async(event,session)=>{if(event==="PASSWORD_RECOVERY"&&session){const p=prompt("Enter new admin password (minimum 6 characters):");if(!p)return;if(p.length<6){alert("Password must be at least 6 characters.");return;}const {error}=await supabase.auth.updateUser({password:p});if(error)alert("Password update failed: "+error.message);else{alert("Password updated successfully.");location.href=location.origin+"/admin.html";}}});
});

// Forgot password / recovery flow
document.addEventListener("DOMContentLoaded", function () {
  const forgot = document.getElementById("forgotPassword");
  const modal = document.getElementById("forgotModal");
  const close = document.getElementById("closeForgot");
  const send = document.getElementById("sendReset");
  const msg = document.getElementById("resetMsg");

  if (!forgot || !modal || !send) return;

  forgot.addEventListener("click", function (e) {
    e.preventDefault();
    modal.style.display = "flex";
    if (msg) msg.textContent = "";
  });

  if (close) {
    close.addEventListener("click", function () {
      modal.style.display = "none";
    });
  }

  send.addEventListener("click", async function () {
    const client = window.supabaseClient;

    if (!client || !client.auth) {
      if (msg) msg.textContent = "Supabase client is not loaded. Please refresh the page.";
      return;
    }

    send.disabled = true;
    if (msg) msg.textContent = "Sending reset email...";

    try {
      const email = "ibtesabalam7@gmail.com";
      const redirectTo = window.location.origin + "/admin.html";

      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo
      });

      if (error) throw error;

      if (msg) msg.textContent = "Reset email sent. Check your inbox and Spam folder.";
    } catch (err) {
      console.error("Password reset error:", err);
      if (msg) msg.textContent = err && err.message ? err.message : "Could not send reset email.";
    } finally {
      send.disabled = false;
    }
  });

  if (window.supabaseClient && window.supabaseClient.auth) {
    window.supabaseClient.auth.onAuthStateChange(async function (event, session) {
      if (event !== "PASSWORD_RECOVERY" || !session) return;

      const newPassword = prompt("Enter your new admin password (minimum 6 characters):");
      if (!newPassword) return;

      if (newPassword.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
      }

      const { error } = await window.supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (error) {
        alert("Password update failed: " + error.message);
      } else {
        alert("Password updated successfully. You can now log in.");
        window.location.href = window.location.origin + "/admin.html";
      }
    });
  }
});
