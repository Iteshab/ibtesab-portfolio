const sb = window.supabaseClient;
if (!sb) {
  throw new Error('Supabase client is not initialized. Check supabase-config.js loading order.');
}

const ADMIN_EMAIL = window.ADMIN_EMAIL;
const BUCKET = 'profile-photo';
const PHOTO_PATH = 'profile/profile-photo.webp';
const LOGO_PATH = 'profile/logo.webp';
const CV_PATH = 'profile/resume.pdf';
const PROJECT_META_MARKER = '\n[PortfolioCMS:v1]';
const EXPERIENCE_META_MARKER = '\n[PortfolioExperience:v1]';

const $ = (id) => document.getElementById(id);
let passwordRecoveryInProgress = false;
let editingLegacyProjectName = '';
let editingLegacyExperienceKey = '';
let editingProjectLegacyAlias = '';
let editingExperienceLegacyAlias = '';
let editingProjectMetadata = {};
let editingExperienceMetadata = {};
let legacyProjectNames = new Set();

function parseTaggedDescription(value, marker) {
  const source = String(value || '');
  const index = source.lastIndexOf(marker);
  if (index < 0) return { text: source, metadata: {} };
  try {
    const metadata = JSON.parse(source.slice(index + marker.length));
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return { text: source.slice(0, index), metadata };
    }
  } catch (error) {
    console.warn('Could not parse portfolio description metadata:', error);
  }
  return { text: source, metadata: {} };
}

function storeTaggedDescription(text, marker, metadata) {
  return String(text || '').trim() + marker + JSON.stringify(metadata);
}

function splitLines(value) {
  const seen = new Set();
  return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(line => {
    const key = line.toLowerCase();
    if (!line || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeHttpUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

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

async function refreshDashboard() {
  const [projectsResult, experienceResult] = await Promise.all([
    sb.from('projects').select('description').neq('project_name', CMS_SETTINGS_PROJECT),
    sb.from('experience').select('description')
  ]);
  const visible = result => (result.data || []).filter(row => parseTaggedDescription(row.description, result === projectsResult ? PROJECT_META_MARKER : EXPERIENCE_META_MARKER).metadata.deleted !== true);
  if (!projectsResult.error && $('countProjects')) $('countProjects').textContent = visible(projectsResult).length;
  if (!experienceResult.error && $('countExperience')) $('countExperience').textContent = visible(experienceResult).length;
  if ($('countSkills')) $('countSkills').textContent = cmsSettings.skills.length;
  if ($('countEducation')) $('countEducation').textContent = cmsSettings.education.length;
  if ($('countPublished') && !projectsResult.error && !experienceResult.error) {
    const projects = visible(projectsResult).filter(row => parseTaggedDescription(row.description, PROJECT_META_MARKER).metadata.published !== false).length;
    const experience = visible(experienceResult).filter(row => parseTaggedDescription(row.description, EXPERIENCE_META_MARKER).metadata.published !== false).length;
    $('countPublished').textContent = projects + experience;
  }
}

async function loadLegacyProjects() {
  try {
    const response = await fetch(new URL('index.html', window.location.href), { cache: 'no-store' });
    if (!response.ok) return [];
    const source = new DOMParser().parseFromString(await response.text(), 'text/html');
    const rows = [...source.querySelectorAll('#projectsList .project')].map((card, index) => {
      const dateParts = (card.querySelector('.date')?.textContent || '').split(/\s*(?:[^\x00-\x7F]|\uFFFD)+\s*/).map(part => part.trim()).filter(Boolean);
      const dates = dateParts.slice(1);
      return {
        id: `legacy-project-${index}`,
        _legacy: true,
        project_name: card.querySelector('h3')?.textContent.trim() || '',
        role: card.querySelector('.company')?.textContent.trim() || '',
        location: dateParts[0] || '',
        start_date: dates[0] || '',
        end_date: dates[1] || '',
        description: card.querySelector('p')?.textContent.trim() || '',
        sort_order: index + 1
      };
    }).filter(row => row.project_name);
    legacyProjectNames = new Set(rows.map(row => row.project_name.toLowerCase()));
    return rows;
  } catch (error) {
    console.warn('Legacy portfolio projects could not be loaded:', error);
    return [];
  }
}

function showContentPreview(title, body) {
  const dialog = $('contentPreview');
  if (!dialog) return;
  $('previewTitle').textContent = title;
  $('previewBody').textContent = body;
  if (!dialog.open) dialog.showModal();
}

function updateMediaPreviews() {
  const profile = cmsSettings.profile || {};
  const publicAsset = path => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('profile/')) return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return path;
  };
  [['photoMediaPreview', profile.photoPath || PHOTO_PATH], ['logoMediaPreview', cmsSettings.logoPath]].forEach(([id, path]) => {
    const image = $(id);
    if (!image) return;
    image.onerror = () => { image.hidden = true; };
    image.onload = () => { image.hidden = false; };
    image.src = publicAsset(path) + (publicAsset(path) ? (publicAsset(path).includes('?') ? '&' : '?') + 'v=' + Date.now() : '');
    image.hidden = !path;
  });
  const cv = $('currentCvLink');
  if (cv) {
    const path = publicAsset(profile.cvPath);
    cv.href = path || '#';
    cv.hidden = !path;
  }
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

  let data;
  let loadWarning = '';
  try {
    const result = await sb
      .from('projects')
      .select('*')
      .neq('project_name', CMS_SETTINGS_PROJECT)
      .order('sort_order', { ascending: true });
    if (result.error) {
      throw result.error;
    }
    const databaseRows = result.data || [];
    const databaseNames = new Set(databaseRows.flatMap(row => {
      const metadata = projectParts(row.description || '').metadata;
      return [String(row.project_name || '').trim().toLowerCase(), String(metadata.legacyProjectName || '').trim().toLowerCase()].filter(Boolean);
    }));
    const hiddenLegacyNames = new Set(cmsSettings.removedProjects || []);
    const legacyRows = await loadLegacyProjects();
    data = [...databaseRows.filter(row => projectParts(row.description || '').metadata.deleted !== true), ...legacyRows.filter(row =>
      !databaseNames.has(row.project_name.toLowerCase()) &&
      !hiddenLegacyNames.has(row.project_name.toLowerCase())
    )];
  } catch (error) {
    data = await loadLegacyProjects();
    loadWarning = `Database projects could not be loaded: ${error.message || 'request failed'}. Showing source portfolio entries.`;
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
          ${escapeHtml(parseProjectCompany(row.description || '') || row.role || '')}
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
          data-project-preview="${row.id}">Preview</button>

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
          button.dataset.projectEdit,
          data
        );
      });
    });

  list.querySelectorAll('[data-project-preview]').forEach(button => {
    button.addEventListener('click', () => {
      const row = data.find(item => String(item.id) === button.dataset.projectPreview);
      const content = projectParts(row?.description || '');
      const metadata = content.metadata || {};
      showContentPreview(row?.project_name || 'Project', [
        row?.role && `Role: ${row.role}`,
        content.company && `Company: ${content.company}`,
        row?.location && `Location: ${row.location}`,
        [row?.start_date, row?.end_date].filter(Boolean).join(' — '),
        content.description,
        metadata.technologies?.length && `Technologies: ${metadata.technologies.join(', ')}`,
        metadata.features?.length && `Features:\n${metadata.features.join('\n')}`,
        metadata.githubUrl && `GitHub: ${metadata.githubUrl}`,
        metadata.liveUrl && `Live demo: ${metadata.liveUrl}`,
        metadata.imageUrl && `Thumbnail: ${metadata.imageUrl}`,
        `Published: ${metadata.published !== false ? 'Yes' : 'No'}`,
        `Featured: ${metadata.featured === true ? 'Yes' : 'No'}`
      ].filter(Boolean).join('\n\n'));
    });
  });

  list.querySelectorAll('[data-project-delete]')
    .forEach(button => {
      button.addEventListener('click', () => {
        deleteProject(
          button.dataset.projectDelete,
          data.find(row => String(row.id) === button.dataset.projectDelete)
        );
      });
    });
  if (loadWarning) msg($('projectListMsg'), loadWarning, 'error');
}


function projectParts(description) {
  const stored = parseTaggedDescription(description, PROJECT_META_MARKER);
  const m = stored.text.match(/^\[Company:\s*([^\]]+)\]\s*/i);
  return {
    company: m ? m[1].trim() : '',
    description: stored.text.replace(/^\[Company:\s*[^\]]+\]\s*/i, '').trim(),
    metadata: stored.metadata
  };
}

function parseProjectCompany(description) {
  const m = projectParts(description).company;
  return m;
}

function cleanProjectDescription(description) {
  return projectParts(description).description;
}

function updateProjectImagePreview() {
  const image = $('projectImagePreview');
  if (!image) return;
  const url = safeHttpUrl($('projectImageUrl').value);
  image.onerror = () => { image.hidden = true; };
  image.onload = () => { image.hidden = false; };
  image.src = url;
  image.hidden = !url;
}

function openProjectEditor(row = null) {
  editingLegacyProjectName = row?._legacy ? row.project_name.toLowerCase() : '';
  const existingProjectMetadata = projectParts(row?.description || '').metadata;
  editingProjectMetadata = { ...existingProjectMetadata };
  editingProjectLegacyAlias = editingLegacyProjectName || String(existingProjectMetadata.legacyProjectName || (legacyProjectNames.has(String(row?.project_name || '').toLowerCase()) ? row.project_name : '')).toLowerCase();

  $('projectEditor').classList.remove('hidden');

  $('projectEditorTitle').textContent =
    row ? 'Edit Project' : 'Add Project';

  $('projectId').value =
    row && !row._legacy ? row.id : '';

  $('projectName').value =
    row?.project_name || '';

  $('projectRole').value =
    row?.role || '';

  const projectData = projectParts(row?.description || '');
  $('projectCompany').value = projectData.company;

  $('projectLocation').value =
    row?.location || '';

  $('projectStartDate').value =
    row?.start_date || '';

  $('projectEndDate').value =
    row?.end_date || '';

  $('projectDescription').value = projectData.description;
  $('projectTechnologies').value = (projectData.metadata.technologies || []).join('\n');
  $('projectFeatures').value = (projectData.metadata.features || []).join('\n');
  $('projectGithub').value = projectData.metadata.githubUrl || '';
  $('projectLiveUrl').value = projectData.metadata.liveUrl || '';
  $('projectImageUrl').value = projectData.metadata.imageUrl || '';
  $('projectPublished').checked = projectData.metadata.published !== false;
  $('projectFeatured').checked = projectData.metadata.featured === true;
  updateProjectImagePreview();

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
    x => String(x.id) === String(id)
  );

  if (row) {
    openProjectEditor(row);
  }
}


function closeProjectEditor() {

  $('projectEditor').classList.add('hidden');

  $('projectForm').reset();

  $('projectId').value = '';
  editingLegacyProjectName = '';
  editingProjectLegacyAlias = '';
  editingProjectMetadata = {};

  $('projectSortOrder').value = 1;
  updateProjectImagePreview();
  msg($('projectSaveMsg'), '');
}


function setupProjectEditor() {
  $('projectImageUrl').addEventListener('input', updateProjectImagePreview);

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
  const projectCompany = $('projectCompany').value.trim();
  const cleanDescription = $('projectDescription').value.trim();
  const existingProject = id && [...$('projectList').querySelectorAll('[data-project-edit]')]
    .find(button => button.dataset.projectEdit === id)?.closest('.item');
  const duplicate = [...$('projectList').querySelectorAll('.item h3')]
    .some(title => title.textContent.trim().toLowerCase() === $('projectName').value.trim().toLowerCase()
      && title.closest('.item')?.querySelector('[data-project-edit]')?.dataset.projectEdit !== id
      && !(editingLegacyProjectName && title.textContent.trim().toLowerCase() === editingLegacyProjectName));
  if (duplicate) {
    msg($('projectSaveMsg'), 'A project with this name already exists.', 'error');
    return;
  }
  const metadata = {
    ...editingProjectMetadata,
    technologies: splitLines($('projectTechnologies').value),
    features: splitLines($('projectFeatures').value),
    githubUrl: safeHttpUrl($('projectGithub').value),
    liveUrl: safeHttpUrl($('projectLiveUrl').value),
    imageUrl: safeHttpUrl($('projectImageUrl').value),
    published: $('projectPublished').checked,
    featured: $('projectFeatured').checked
  };
  if (editingProjectLegacyAlias) metadata.legacyProjectName = editingProjectLegacyAlias;
  const descriptionText = projectCompany ? `[Company: ${projectCompany}] ${cleanDescription}` : cleanDescription;
  const storedDescription = storeTaggedDescription(descriptionText, PROJECT_META_MARKER, metadata);

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
      storedDescription,

    sort_order:
      Number($('projectSortOrder').value) || 1
  };

  msg(
    $('projectSaveMsg'),
    'Saving…'
  );

  let result;

  try {
    if (id) {
      result = await sb
        .from('projects')
        .update(payload)
        .eq('id', id)
        .select('id')
        .maybeSingle();
    } else {
      result = await sb
        .from('projects')
        .insert(payload)
        .select('id')
        .single();
    }
  } catch (error) {
    msg($('projectSaveMsg'), error.message || 'Project could not be saved.', 'error');
    return;
  }

  if (result.error) {

    msg(
      $('projectSaveMsg'),
      result.error.message,
      'error'
    );

    return;
  }
  if (!result.data) {
    msg($('projectSaveMsg'), 'No project was saved. Check the record and database access policies.', 'error');
    return;
  }

  msg(
    $('projectSaveMsg'),
    'Project saved successfully.',
    'ok'
  );

  await loadProjects();
  await refreshDashboard();
  msg($('projectListMsg'), 'Project saved successfully.', 'ok');

  setTimeout(
    closeProjectEditor,
    500
  );
}


async function deleteProject(id, row) {
  if (!confirm('Delete this project?')) {
    return;
  }
  if (!row) return;
  const parts = projectParts(row.description || '');
  const metadata = { ...parts.metadata, published: false, deleted: true };
  if (row._legacy) metadata.legacyProjectName = String(row.project_name || '').trim().toLowerCase();
  const descriptionText = parts.company ? `[Company: ${parts.company}] ${parts.description}` : parts.description;
  const payload = {
    project_name: row.project_name,
    role: row.role || '',
    location: row.location || '',
    start_date: row.start_date || '',
    end_date: row.end_date || '',
    description: storeTaggedDescription(descriptionText, PROJECT_META_MARKER, metadata),
    sort_order: row.sort_order || 1
  };
  let result;
  try {
    result = row._legacy
      ? await sb.from('projects').insert(payload).select('id').single()
      : await sb.from('projects').update({ description: payload.description }).eq('id', id).select('id').maybeSingle();
  } catch (requestError) {
    msg($('projectListMsg'), requestError.message || 'Project could not be hidden.', 'error');
    return;
  }
  if (result.error) {
    msg($('projectListMsg'), result.error.message, 'error');
    return;
  }
  if (!result.data) {
    msg($('projectListMsg'), 'No project was changed. Check the record and database access policies.', 'error');
    return;
  }
  await loadProjects();
  await refreshDashboard();
  msg($('projectListMsg'), 'Project hidden from the portfolio.', 'ok');
}
/* =========================
   Authentication
   ========================= */

async function requireAdmin() {
  // UX gate mirrors the server-controlled claim; RLS remains the write boundary.
  const {
    data: { user },
    error
  } = await sb.auth.getUser();

  if (passwordRecoveryInProgress) {
    showApp(false);
    return false;
  }

  if (error || !user) {
    showApp(false);
    return false;
  }

  if (
    !ADMIN_EMAIL ||
    (user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
    user.app_metadata?.portfolio_role !== 'admin'
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
  msg($('adminLoadMsg'), 'Loading saved portfolio content…');
  try {
    await cmsLoadAll();
    await Promise.all([loadExperiences(), loadProjects(), refreshDashboard()]);
    msg($('adminLoadMsg'), 'Saved portfolio content loaded.', 'ok');
  } catch (loadError) {
    console.error('Admin content load error:', loadError);
    msg($('adminLoadMsg'), 'Some saved content could not be loaded: ' + loadError.message, 'error');
  }
  return true;
}

function reportAuthError(error) {
  console.error('Admin authentication error:', error);
  showApp(false);
  msg($('loginMsg'), error.message || 'Admin authentication could not be completed.', 'error');
}

async function handleLogin(e) {
  e.preventDefault();

  msg($('loginMsg'), 'Signing in…');

  const email = $('email').value.trim();
  const password = $('password').value;

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      msg($('loginMsg'), error.message, 'error');
      return;
    }
    await requireAdmin();
  } catch (error) {
    reportAuthError(error);
  }
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
   Experience
   ========================= */

async function loadExperiences() {
  const list = $('experienceList');
  if (!list) return;
  let data;
  let loadWarning = '';
  const legacyExperiences = () => {
    const removedKeys = new Set(cmsSettings.removedExperience || []);
    return (window.PORTFOLIO_EXPERIENCE_FALLBACK || []).map((row, index) => ({ ...row, id: `legacy-experience-${index}`, _legacy: true }))
      .filter(row => !removedKeys.has(`${row.company.trim().toLowerCase()}|${row.position.trim().toLowerCase()}|${row.start_date.trim().toLowerCase()}`));
  };
  try {
    const result = await sb
      .from('experience')
      .select('*')
      .order('sort_order', { ascending: true });
    if (result.error) {
      throw result.error;
    }
    const databaseRows = result.data || [];
    const existingKeys = new Set(databaseRows.flatMap(row => {
      const metadata = parseTaggedDescription(row.description, EXPERIENCE_META_MARKER).metadata;
      return [`${String(row.company || '').trim().toLowerCase()}|${String(row.position || '').trim().toLowerCase()}|${String(row.start_date || '').trim().toLowerCase()}`, metadata.legacyExperienceKey].filter(Boolean);
    }));
    const legacyRows = legacyExperiences().filter(row => !existingKeys.has(
      `${row.company.trim().toLowerCase()}|${row.position.trim().toLowerCase()}|${row.start_date.trim().toLowerCase()}`
    ));
    data = [...databaseRows.filter(row => parseTaggedDescription(row.description, EXPERIENCE_META_MARKER).metadata.deleted !== true), ...legacyRows];
  } catch (error) {
    data = legacyExperiences();
    loadWarning = `Database experience could not be loaded: ${error.message || 'request failed'}. Showing source portfolio entries.`;
  }

  if (!data || !data.length) {
    list.innerHTML =
      '<div class="msg">No experience added yet. Use “Add Experience”.</div>';
    return;
  }

  list.innerHTML = data.map(row => `
    <article class="item" data-start-date="${escapeHtml(row.start_date || '')}">
      <div>
        <h3>${escapeHtml(row.position || '')}</h3>

        <div class="company">
          ${escapeHtml(row.company || '')}
        </div>

        <div class="date">
          ${escapeHtml(row.start_date || '')} —
          ${escapeHtml(row.end_date || '')}
          ${parseTaggedDescription(row.description, EXPERIENCE_META_MARKER).metadata.location
            ? ' · ' + escapeHtml(parseTaggedDescription(row.description, EXPERIENCE_META_MARKER).metadata.location)
            : ''}
        </div>
      </div>

      <div class="actions">
        <button class="btn" type="button" data-experience-preview="${row.id}">Preview</button>
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
        button.dataset.edit,
        data
      );
    });
  });

  list.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => {
      deleteExperience(
      button.dataset.delete,
      data.find(row => String(row.id) === button.dataset.delete)
      );
    });
  });

  list.querySelectorAll('[data-experience-preview]').forEach(button => {
    button.addEventListener('click', () => {
      const row = data.find(item => String(item.id) === button.dataset.experiencePreview);
      const details = parseTaggedDescription(row?.description, EXPERIENCE_META_MARKER);
      const metadata = details.metadata || {};
      showContentPreview(row?.position || 'Experience', [
        row?.company && `Company: ${row.company}`,
        [row?.start_date, row?.end_date].filter(Boolean).join(' — '),
        metadata.location && `Location: ${metadata.location}`,
        metadata.summary,
        details.text,
        metadata.technologies?.length && `Technologies: ${metadata.technologies.join(', ')}`,
        `Published: ${metadata.published !== false ? 'Yes' : 'No'}`
      ].filter(Boolean).join('\n\n'));
    });
  });
  if (loadWarning) msg($('experienceListMsg'), loadWarning, 'error');
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
  editingLegacyExperienceKey = row?._legacy
    ? `${String(row.company || '').trim().toLowerCase()}|${String(row.position || '').trim().toLowerCase()}|${String(row.start_date || '').trim().toLowerCase()}`
    : '';
  const experienceData = parseTaggedDescription(row?.description, EXPERIENCE_META_MARKER);
  editingExperienceMetadata = { ...experienceData.metadata };
  const rowKey = `${String(row?.company || '').trim().toLowerCase()}|${String(row?.position || '').trim().toLowerCase()}|${String(row?.start_date || '').trim().toLowerCase()}`;
  const fallbackKeys = new Set((window.PORTFOLIO_EXPERIENCE_FALLBACK || []).map(item => `${item.company.trim().toLowerCase()}|${item.position.trim().toLowerCase()}|${item.start_date.trim().toLowerCase()}`));
  editingExperienceLegacyAlias = editingLegacyExperienceKey || String(experienceData.metadata.legacyExperienceKey || (fallbackKeys.has(rowKey) ? rowKey : '')).toLowerCase();
  $('editor').classList.remove('hidden');

  $('editorTitle').textContent =
    row ? 'Edit Experience' : 'Add Experience';

  $('expId').value = row && !row._legacy ? row.id : '';
  $('position').value = row?.position || '';
  $('company').value = row?.company || '';
  $('startDate').value = row?.start_date || '';
  $('endDate').value = row?.end_date || '';
  $('description').value = experienceData.text;
  $('experienceLocation').value = experienceData.metadata.location || '';
  $('experienceSummary').value = experienceData.metadata.summary || '';
  $('experienceTechnologies').value = (experienceData.metadata.technologies || []).join('\n');
  $('experiencePublished').checked = experienceData.metadata.published !== false;
  $('sortOrder').value = row?.sort_order ?? 1;

  msg($('saveMsg'), '');

  window.scrollTo({
    top: $('editor').offsetTop - 20,
    behavior: 'smooth'
  });
}

function editExperience(id, data) {
  const row = data.find(
    x => String(x.id) === String(id)
  );

  if (row) {
    openEditor(row);
  }
}

function closeEditor() {
  $('editor').classList.add('hidden');
  $('experienceForm').reset();
  $('expId').value = '';
  editingLegacyExperienceKey = '';
  editingExperienceLegacyAlias = '';
  editingExperienceMetadata = {};
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
  const existingExperience = id && [...$('experienceList').querySelectorAll('[data-edit]')]
    .find(button => button.dataset.edit === id)?.closest('.item');
  const duplicate = [...$('experienceList').querySelectorAll('.item h3')]
    .some(title => {
      const item = title.closest('.item');
      const editId = item?.querySelector('[data-edit]')?.dataset.edit;
      return title.textContent.trim().toLowerCase() === $('position').value.trim().toLowerCase()
        && item?.querySelector('.company')?.textContent.trim().toLowerCase() === $('company').value.trim().toLowerCase()
        && item?.dataset.startDate === $('startDate').value.trim()
        && editId !== id
        && !(editingLegacyExperienceKey && `${$('company').value.trim().toLowerCase()}|${$('position').value.trim().toLowerCase()}|${$('startDate').value.trim().toLowerCase()}` === editingLegacyExperienceKey);
    });
  if (duplicate) {
    msg($('saveMsg'), 'This role at this company already exists.', 'error');
    return;
  }

  const payload = {
    position: $('position').value.trim(),
    company: $('company').value.trim(),
    start_date: $('startDate').value.trim(),
    end_date: $('endDate').value.trim(),
    description: storeTaggedDescription($('description').value.trim(), EXPERIENCE_META_MARKER, {
      ...editingExperienceMetadata,
      location: $('experienceLocation').value.trim(),
      summary: $('experienceSummary').value.trim(),
      technologies: splitLines($('experienceTechnologies').value),
      published: $('experiencePublished').checked
    }),
    sort_order: Number($('sortOrder').value) || 1
  };
  if (editingExperienceLegacyAlias) {
    const content = parseTaggedDescription(payload.description, EXPERIENCE_META_MARKER);
    payload.description = storeTaggedDescription(content.text, EXPERIENCE_META_MARKER, { ...content.metadata, legacyExperienceKey: editingExperienceLegacyAlias });
  }
  msg($('saveMsg'), 'Saving…');

  let result;
  try {
    if (id) {
      result = await sb
        .from('experience')
        .update(payload)
        .eq('id', id)
        .select('id')
        .maybeSingle();
    } else {
      result = await sb
        .from('experience')
        .insert(payload)
        .select('id')
        .single();
    }
  } catch (error) {
    msg($('saveMsg'), error.message || 'Experience could not be saved.', 'error');
    return;
  }

  if (result.error) {
    msg(
      $('saveMsg'),
      result.error.message,
      'error'
    );
    return;
  }
  if (!result.data) {
    msg($('saveMsg'), 'No experience was saved. Check the record and database access policies.', 'error');
    return;
  }

  msg(
    $('saveMsg'),
    'Saved successfully.',
    'ok'
  );

  await loadExperiences();
  await refreshDashboard();
  msg($('experienceListMsg'), 'Experience saved successfully.', 'ok');

  setTimeout(closeEditor, 500);
}

async function deleteExperience(id, row) {
  if (!confirm('Delete this experience?')) {
    return;
  }
  if (!row) return;
  const current = parseTaggedDescription(row.description, EXPERIENCE_META_MARKER);
  const metadata = { ...current.metadata, published: false, deleted: true };
  if (row._legacy) metadata.legacyExperienceKey = `${String(row.company || '').trim().toLowerCase()}|${String(row.position || '').trim().toLowerCase()}|${String(row.start_date || '').trim().toLowerCase()}`;
  const payload = { description: storeTaggedDescription(current.text, EXPERIENCE_META_MARKER, metadata) };
  let result;
  try {
    result = row._legacy
      ? await sb.from('experience').insert({
          company: row.company, position: row.position, start_date: row.start_date,
          end_date: row.end_date, description: payload.description, sort_order: row.sort_order || 1
        }).select('id').single()
      : await sb.from('experience').update(payload).eq('id', id).select('id').maybeSingle();
  } catch (requestError) {
    msg($('experienceListMsg'), requestError.message || 'Experience could not be hidden.', 'error');
    return;
  }
  if (result.error) {
    msg($('experienceListMsg'), result.error.message, 'error');
    return;
  }
  if (!result.data) {
    msg($('experienceListMsg'), 'No experience was changed. Check the record and database access policies.', 'error');
    return;
  }
  await loadExperiences();
  await refreshDashboard();
  msg($('experienceListMsg'), 'Experience hidden from the portfolio.', 'ok');
}


/* =========================
   FULL PORTFOLIO CMS
   ========================= */

const CMS_SETTINGS_PROJECT='__SITE_SETTINGS__';

const CMS_DEFAULTS={
  profile:{
    name:'Ibtesab Alam',
    role:'Network & IT Infrastructure Engineer',
    eyebrow:'IT Infrastructure & Networking',
    location:'Uttar Pradesh, India',
    email:'ibtesabalam7@gmail.com',
    phone:'+91 99184 12321',
    linkedin:'https://www.linkedin.com/in/ibtesab-alam/',
    github:'',
    heroPrefix:"Hi, I'm",
    heroName:'Ibtesab Alam.',
    heroDescription:'Experienced IT professional with 2+ years of experience in technical support, infrastructure management, networking, Windows Server, virtualization and firewall administration.',
    navAbout:'About',navSkills:'Skills',navExperience:'Experience',navProjects:'Projects',navContact:'Contact',
    photoPath:'',
    aboutTitle:'About Me',
    aboutSubtitle:'Focused on reliable infrastructure, secure networks and business continuity.',
    aboutText:'Experienced IT professional with over 2 years of expertise in technical support, infrastructure management and end-to-end IT operations. Skilled in hardware and networking troubleshooting, Windows Server environments, Hyper-V, firewall administration and network solutions. I have led infrastructure projects and implemented network monitoring solutions while supporting high availability and operational efficiency.',
    skillsTitle:'Technical Skills',
    skillsSubtitle:'Tools and technologies from my professional experience.',
    experienceTitle:'Experience',
    experienceSubtitle:'Professional experience and responsibilities.',
    projectsTitle:'Projects',
    projectsSubtitle:'Selected projects and contributions.',
    educationTitle:'Education & Certification',
    educationSubtitle:'Education, qualifications and certifications.',
    contactTitle:"Let's connect.",
    contactText:'For networking, infrastructure or IT support opportunities, feel free to reach out.',
    contactEmail:'ibtesabalam7@gmail.com',
    contactPhone:'+91 99184 12321',
    cvButtonText:'Download CV',connectButtonText:"Let's Connect",
    contactEmailButtonText:'Email Me',contactPhoneButtonText:'Call Me',contactLinkedinButtonText:'LinkedIn',contactGithubButtonText:'GitHub',
    contactLinkedin:'https://www.linkedin.com/in/ibtesab-alam/',
    contactGithub:'',
    footerText:'Network & IT Infrastructure · India · Last updated via Codex',
    copyrightText:'',
    cvPath:'Ibtesab_Alam_CV.pdf'
  },
  logoPath:'ia-logo.png',
  skills:['Cisco','Zyxel','Fortinet','D-Link','Extreme','Aruba','VLAN','Routing','DHCP','Windows Server 2022','AD DS','DNS','WDS','Hyper-V','VMware','Sophos XG','SonicWall','pfSense','Office 365','Cacti','OP Manager','Wireshark','Zabbix','Linux Fundamentals','Cybersecurity','CCTV'].map((name,i)=>({id:'s'+i,name,order:i+1})),
  education:[
    {id:'e1',title:'Bachelor of Science (B.Sc)',institute:'Siddharth University',year:'Passed: May 2026',result:'67.00%',details:'',order:1},
    {id:'e2',title:'DCC — Diploma in Cloud Computing',institute:'Jetking',year:'2024',result:'',details:'',order:2},
    {id:'e3',title:'Higher Secondary & Secondary',institute:'H.S.C Science',year:'June 2023',result:'58.00%',details:'S.S.C — May 2021 · 78.43%',order:3}
  ],
  appearance:{accent:'#ef476f',accent2:'#19a7a0',bg:'#f4f7f8',card:'#ffffff',text:'#111827',dark:'#0f172a'},
  sections:{about:true,skills:true,experience:true,projects:true,education:true,contact:true},
  seo:{title:'Ibtesab Alam | Network Engineer & IT Infrastructure Engineer',description:'Ibtesab Alam is a Network Engineer and IT Infrastructure professional from India with 2+ years of experience in networking, Windows Server, firewalls, virtualization, Microsoft 365 and network monitoring.',keywords:'Ibtesab Alam, Network Engineer, IT Infrastructure Engineer, Network Engineer India, Cisco, Fortinet, Sophos, Windows Server, Hyper-V, Microsoft 365, Cacti, Zabbix',ogTitle:'Ibtesab Alam | Network Engineer & IT Infrastructure Engineer',ogDescription:'Network Engineer and IT Infrastructure professional from India.',canonicalUrl:'https://ibtesab-alam.vercel.app/'},
  removedProjects:[],
  removedExperience:[]
};

let cmsSettings=JSON.parse(JSON.stringify(CMS_DEFAULTS));
let cmsSettingsId=null;
let cmsSettingsLoadFailed=false;

function cmsMerge(raw){
  const x=JSON.parse(JSON.stringify(CMS_DEFAULTS));
  if(!raw)return x;
  Object.entries(raw.profile||{}).forEach(([key,value])=>{
    if(value!==null&&value!==undefined)x.profile[key]=value;
  });
  if(Array.isArray(raw.skills))x.skills=raw.skills;
  if(Array.isArray(raw.education))x.education=raw.education;
  x.appearance={...x.appearance,...(raw.appearance||{})};
  x.sections={...x.sections,...(raw.sections||{})};
  x.seo={...x.seo,...(raw.seo||{})};
  x.logoPath=raw.logoPath||x.logoPath;
  x.removedProjects=Array.isArray(raw.removedProjects)?raw.removedProjects:[];
  x.removedExperience=Array.isArray(raw.removedExperience)?raw.removedExperience:[];
  return x;
}

async function cmsLoad(){
  cmsSettingsId=null;
  cmsSettingsLoadFailed=false;
  try {
    const {data,error}=await sb.from('projects').select('id,description').eq('project_name',CMS_SETTINGS_PROJECT).maybeSingle();
    if(error)throw error;
    if(data){
      cmsSettingsId=data.id;
      try{cmsSettings=cmsMerge(JSON.parse(data.description||'{}'))}catch(error){console.error('Portfolio CMS settings are invalid:',error);throw new Error('Saved portfolio settings are not valid JSON.')}
    }else{
      cmsSettings=cmsMerge(null);
    }
  } catch(error) {
    cmsSettingsLoadFailed=true;
    throw error;
  }
}

async function cmsSave(){
  if(cmsSettingsLoadFailed)throw new Error('CMS settings could not be read. Reload the Admin Panel before saving to avoid overwriting existing data.');
  const payload={
    project_name:CMS_SETTINGS_PROJECT,
    role:'Portfolio CMS Settings',
    location:'',
    start_date:'',
    end_date:'',
    description:JSON.stringify(cmsSettings),
    sort_order:999999
  };
  let result;
  if(cmsSettingsId) result=await sb.from('projects').update(payload).eq('id',cmsSettingsId).select('id').maybeSingle();
  else{
    result=await sb.from('projects').insert(payload).select('id').single();
    if(!result.error)cmsSettingsId=result.data.id;
  }
  if(result.error)throw result.error;
  if(cmsSettingsId&&!result.data)throw new Error('No CMS settings row was updated. Check the database record and access policies.');
}

function cmsFill(){
  const p=cmsSettings.profile;
  const map={
    siteName:p.name,siteRole:p.role,siteEyebrow:p.eyebrow,siteLocation:p.location,siteEmail:p.email,sitePhone:p.phone,
    siteLinkedin:p.linkedin,siteGithub:p.github,siteHeroPrefix:p.heroPrefix,siteHeroName:p.heroName,siteHeroDescription:p.heroDescription,
    navAboutLabel:p.navAbout,navSkillsLabel:p.navSkills,navExperienceLabel:p.navExperience,navProjectsLabel:p.navProjects,navContactLabel:p.navContact,
    aboutTitle:p.aboutTitle,aboutSubtitle:p.aboutSubtitle,aboutText:p.aboutText,contactTitle:p.contactTitle,contactText:p.contactText,
    skillsTitle:p.skillsTitle,skillsSubtitle:p.skillsSubtitle,experienceTitle:p.experienceTitle,experienceSubtitle:p.experienceSubtitle,projectsTitle:p.projectsTitle,projectsSubtitle:p.projectsSubtitle,educationTitleText:p.educationTitle,educationSubtitle:p.educationSubtitle,
    contactEmail:p.contactEmail,contactPhone:p.contactPhone,contactLinkedin:p.contactLinkedin,contactGithub:p.contactGithub,
    cvButtonText:p.cvButtonText,connectButtonText:p.connectButtonText,contactEmailButtonText:p.contactEmailButtonText,contactPhoneButtonText:p.contactPhoneButtonText,contactLinkedinButtonText:p.contactLinkedinButtonText,contactGithubButtonText:p.contactGithubButtonText,
    footerText:p.footerText,copyrightText:p.copyrightText,cvPath:p.cvPath,seoTitle:cmsSettings.seo.title,seoDescription:cmsSettings.seo.description,
    seoKeywords:cmsSettings.seo.keywords,ogTitle:cmsSettings.seo.ogTitle,ogDescription:cmsSettings.seo.ogDescription,
    twitterTitle:cmsSettings.seo.twitterTitle,twitterDescription:cmsSettings.seo.twitterDescription,canonicalUrl:cmsSettings.seo.canonicalUrl,
    ogImage:cmsSettings.seo.ogImage,twitterImage:cmsSettings.seo.twitterImage,
    accentColor:cmsSettings.appearance.accent,accent2Color:cmsSettings.appearance.accent2,bgColor:cmsSettings.appearance.bg,
    cardColor:cmsSettings.appearance.card,textColor:cmsSettings.appearance.text,darkColor:cmsSettings.appearance.dark
  };
  Object.keys(map).forEach(id=>{if($(id))$(id).value=map[id]||''});
  ['about','skills','experience','projects','education','contact'].forEach(k=>{const id='show'+k.charAt(0).toUpperCase()+k.slice(1);if($(id))$(id).checked=!!cmsSettings.sections[k]});
  cmsRenderSkills();cmsRenderEducation();updateMediaPreviews();
}

async function cmsSaveWebsite(e){
  e.preventDefault();const p=cmsSettings.profile;
  ['name','role','eyebrow','location','email','phone','linkedin','github','heroPrefix','heroName','heroDescription'].forEach(k=>{const id='site'+k.charAt(0).toUpperCase()+k.slice(1);if($(id))p[k]=$(id).value.trim()});
  p.navAbout=$('navAboutLabel').value.trim();p.navSkills=$('navSkillsLabel').value.trim();p.navExperience=$('navExperienceLabel').value.trim();p.navProjects=$('navProjectsLabel').value.trim();p.navContact=$('navContactLabel').value.trim();
  p.aboutTitle=$('aboutTitle').value.trim();p.aboutSubtitle=$('aboutSubtitle').value.trim();p.aboutText=$('aboutText').value.trim();
  p.skillsTitle=$('skillsTitle').value.trim();p.skillsSubtitle=$('skillsSubtitle').value.trim();p.experienceTitle=$('experienceTitle').value.trim();p.experienceSubtitle=$('experienceSubtitle').value.trim();p.projectsTitle=$('projectsTitle').value.trim();p.projectsSubtitle=$('projectsSubtitle').value.trim();p.educationTitle=$('educationTitleText').value.trim();p.educationSubtitle=$('educationSubtitle').value.trim();
  p.contactTitle=$('contactTitle').value.trim();p.contactText=$('contactText').value.trim();
  ['contactEmail','contactPhone','contactLinkedin','contactGithub','contactEmailButtonText','contactPhoneButtonText','contactLinkedinButtonText','contactGithubButtonText','cvButtonText','connectButtonText','footerText','copyrightText','cvPath'].forEach(k=>p[k]=$(k).value.trim());
  try{await cmsSave();msg($('siteMsg'),'Website profile saved.','ok')}catch(e){msg($('siteMsg'),e.message,'error')}
}

function cmsRenderSkills(){
  const list=$('skillsAdminList');if(!list)return;
  const arr=[...cmsSettings.skills].sort((a,b)=>(a.order||1)-(b.order||1));
  list.innerHTML=arr.map(s=>'<article class="item"><div><h3>'+escapeHtml(s.name)+'</h3><div class="date">'+(s.category?escapeHtml(s.category)+' · ':'')+'Order '+(s.order||1)+'</div></div><div class="actions"><button class="btn" type="button" data-cms-sedit="'+escapeHtml(s.id)+'">Edit</button><button class="btn danger" type="button" data-cms-sdelete="'+escapeHtml(s.id)+'">Delete</button></div></article>').join('');
  list.querySelectorAll('[data-cms-sedit]').forEach(b=>b.onclick=()=>cmsOpenSkill(b.dataset.cmsSedit));
  list.querySelectorAll('[data-cms-sdelete]').forEach(b=>b.onclick=()=>cmsDeleteSkill(b.dataset.cmsSdelete));
  arr.forEach(skill=>{
    const item=[...list.querySelectorAll('.item')].find(node=>node.querySelector('[data-cms-sedit]')?.dataset.cmsSedit===skill.id);
    const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Preview';
    button.addEventListener('click',()=>showContentPreview(skill.name,[skill.category&&`Category: ${skill.category}`,`Display order: ${skill.order||1}`].filter(Boolean).join('\n\n')));
    item?.querySelector('.actions')?.prepend(button);
  });
}
function cmsOpenSkill(id){const s=cmsSettings.skills.find(x=>x.id===id);$('skillEditor').classList.remove('hidden');$('skillId').value=s?.id||'';$('skillName').value=s?.name||'';$('skillCategory').value=s?.category||'';$('skillOrder').value=s?.order||cmsSettings.skills.length+1;msg($('skillMsg'),'')}
function cmsCloseSkill(){$('skillEditor').classList.add('hidden');$('skillForm').reset();$('skillOrder').value=1}
async function cmsSaveSkill(e){e.preventDefault();const id=$('skillId').value||'s'+Date.now();const row={id,name:$('skillName').value.trim(),category:$('skillCategory').value.trim(),order:Number($('skillOrder').value)};if(!row.name)return;const duplicate=cmsSettings.skills.some(x=>x.id!==id&&x.name.trim().toLowerCase()===row.name.toLowerCase());if(duplicate){msg($('skillMsg'),'A skill with this name already exists.','error');return}const old=[...cmsSettings.skills];const i=cmsSettings.skills.findIndex(x=>x.id===id);if(i>=0)cmsSettings.skills[i]=row;else cmsSettings.skills.push(row);try{await cmsSave();cmsRenderSkills();cmsCloseSkill();await refreshDashboard();msg($('skillMsg'),'Skill saved.','ok')}catch(e){cmsSettings.skills=old;msg($('skillMsg'),e.message,'error')}}
async function cmsDeleteSkill(id){if(!confirm('Delete this skill?'))return;const old=cmsSettings.skills;cmsSettings.skills=old.filter(x=>x.id!==id);try{await cmsSave();cmsRenderSkills();await refreshDashboard();msg($('skillListMsg'),'Skill deleted.','ok')}catch(e){cmsSettings.skills=old;msg($('skillListMsg'),e.message,'error')}}

function cmsRenderEducation(){
  const list=$('educationAdminList');if(!list)return;const arr=[...cmsSettings.education].sort((a,b)=>(a.order||1)-(b.order||1));
  list.innerHTML=arr.map(e=>'<article class="item"><div><h3>'+escapeHtml(e.title)+'</h3><div class="company">'+escapeHtml(e.institute||'')+'</div><div class="date">'+escapeHtml(e.year||'')+(e.result?' • '+escapeHtml(e.result):'')+'</div></div><div class="actions"><button class="btn" type="button" data-cms-eedit="'+escapeHtml(e.id)+'">Edit</button><button class="btn danger" type="button" data-cms-edelete="'+escapeHtml(e.id)+'">Delete</button></div></article>').join('');
  list.querySelectorAll('[data-cms-eedit]').forEach(b=>b.onclick=()=>cmsOpenEducation(b.dataset.cmsEedit));list.querySelectorAll('[data-cms-edelete]').forEach(b=>b.onclick=()=>cmsDeleteEducation(b.dataset.cmsEdelete));
  arr.forEach(entry=>{
    const item=[...list.querySelectorAll('.item')].find(node=>node.querySelector('[data-cms-eedit]')?.dataset.cmsEedit===entry.id);
    const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Preview';
    button.addEventListener('click',()=>showContentPreview(entry.title,[entry.institute,entry.year,entry.result,entry.details].filter(Boolean).join('\n\n')));
    item?.querySelector('.actions')?.prepend(button);
  });
}
function cmsOpenEducation(id){const e=cmsSettings.education.find(x=>x.id===id);$('educationEditor').classList.remove('hidden');$('educationId').value=e?.id||'';$('educationTitle').value=e?.title||'';$('educationInstitute').value=e?.institute||'';$('educationYear').value=e?.year||'';$('educationResult').value=e?.result||'';$('educationDetails').value=e?.details||'';$('educationOrder').value=e?.order||1;msg($('educationMsg'),'')}
function cmsCloseEducation(){$('educationEditor').classList.add('hidden');$('educationForm').reset();$('educationOrder').value=1}
async function cmsSaveEducation(e){e.preventDefault();const id=$('educationId').value||'e'+Date.now();const row={id,title:$('educationTitle').value.trim(),institute:$('educationInstitute').value.trim(),year:$('educationYear').value.trim(),result:$('educationResult').value.trim(),details:$('educationDetails').value.trim(),order:Number($('educationOrder').value)};const duplicate=cmsSettings.education.some(x=>x.id!==id&&x.title.trim().toLowerCase()===row.title.toLowerCase()&&x.institute.trim().toLowerCase()===row.institute.toLowerCase());if(duplicate){msg($('educationMsg'),'This education entry already exists.','error');return}const old=[...cmsSettings.education];const i=cmsSettings.education.findIndex(x=>x.id===id);if(i>=0)cmsSettings.education[i]=row;else cmsSettings.education.push(row);try{await cmsSave();cmsRenderEducation();cmsCloseEducation();await refreshDashboard();msg($('educationMsg'),'Education saved.','ok')}catch(e){cmsSettings.education=old;msg($('educationMsg'),e.message,'error')}}
async function cmsDeleteEducation(id){if(!confirm('Delete this education item?'))return;const old=cmsSettings.education;cmsSettings.education=old.filter(x=>x.id!==id);try{await cmsSave();cmsRenderEducation();await refreshDashboard();msg($('educationListMsg'),'Education item deleted.','ok')}catch(e){cmsSettings.education=old;msg($('educationListMsg'),e.message,'error')}}

async function cmsSaveAppearance(e){e.preventDefault();cmsSettings.appearance={accent:$('accentColor').value,accent2:$('accent2Color').value,bg:$('bgColor').value,card:$('cardColor').value,text:$('textColor').value,dark:$('darkColor').value};try{await cmsSave();msg($('appearanceMsg'),'Appearance saved.','ok')}catch(e){msg($('appearanceMsg'),e.message,'error')}}
async function cmsSaveSections(e){e.preventDefault();['about','skills','experience','projects','education','contact'].forEach(k=>cmsSettings.sections[k]=$('show'+k.charAt(0).toUpperCase()+k.slice(1)).checked);try{await cmsSave();msg($('sectionsMsg'),'Section settings saved.','ok')}catch(e){msg($('sectionsMsg'),e.message,'error')}}
async function cmsSaveSeo(e){e.preventDefault();cmsSettings.seo={...cmsSettings.seo,title:$('seoTitle').value.trim(),description:$('seoDescription').value.trim(),keywords:$('seoKeywords').value.trim(),ogTitle:$('ogTitle').value.trim(),ogDescription:$('ogDescription').value.trim(),canonicalUrl:$('canonicalUrl').value.trim(),ogImage:$('ogImage').value.trim(),twitterTitle:$('twitterTitle').value.trim(),twitterDescription:$('twitterDescription').value.trim(),twitterImage:$('twitterImage').value.trim()};try{await cmsSave();msg($('seoMsg'),'SEO settings saved.','ok')}catch(e){msg($('seoMsg'),e.message,'error')}}

async function cmsUpload(inputId,path,msgId,label){
  const file=$(inputId)?.files?.[0];if(!file){msg($(msgId),'Choose '+label+' first.','error');return}
  if(file.size>6*1024*1024){msg($(msgId),'Maximum file size is 6 MB.','error');return}
  const allowed=path===CV_PATH?['application/pdf']:['image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type)){msg($(msgId),'Choose a supported '+label+' file.','error');return}
  msg($(msgId),'Uploading…');
  try {
    const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:true,cacheControl:'3600'});
    if(error)throw error;
    const oldProfile={...cmsSettings.profile};
    const oldLogoPath=cmsSettings.logoPath;
    if(path===CV_PATH)cmsSettings.profile.cvPath=CV_PATH;
    if(path===LOGO_PATH)cmsSettings.logoPath=LOGO_PATH;
    if(path===PHOTO_PATH)cmsSettings.profile.photoPath=PHOTO_PATH;
    try{await cmsSave()}catch(error){cmsSettings.profile=oldProfile;cmsSettings.logoPath=oldLogoPath;throw error}
    msg($(msgId),'Uploaded successfully.','ok');
    $(inputId).value='';
    updateMediaPreviews();
  }catch(error){
    console.error('Media upload error:',error);
    msg($(msgId),error.message||'Upload failed.','error');
  }
}

async function cmsLoadAll(){await cmsLoad();cmsFill();await refreshDashboard()}

function cmsSetup(){
  $('closePreview')?.addEventListener('click',()=>$('contentPreview')?.close());
  $('siteForm')?.addEventListener('submit',cmsSaveWebsite);
  $('appearanceForm')?.addEventListener('submit',cmsSaveAppearance);
  $('sectionsForm')?.addEventListener('submit',cmsSaveSections);
  $('seoForm')?.addEventListener('submit',cmsSaveSeo);
  $('newSkill')?.addEventListener('click',()=>cmsOpenSkill(''));$('cancelSkill')?.addEventListener('click',cmsCloseSkill);$('skillForm')?.addEventListener('submit',cmsSaveSkill);
  $('newEducation')?.addEventListener('click',()=>cmsOpenEducation(''));$('cancelEducation')?.addEventListener('click',cmsCloseEducation);$('educationForm')?.addEventListener('submit',cmsSaveEducation);
  $('uploadPhoto')?.addEventListener('click',()=>cmsUpload('photoInput',PHOTO_PATH,'photoMsg','an image'));
  $('uploadLogo')?.addEventListener('click',()=>cmsUpload('logoInput',LOGO_PATH,'logoMsg','a logo image'));
  $('uploadCv')?.addEventListener('click',()=>cmsUpload('cvInput',CV_PATH,'cvMsg','a PDF'));
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
  const requestForm = $('resetRequestForm');
  const resetEmail = $('resetEmail');
  const newPasswordForm = $('newPasswordForm');
  const newPassword = $('newPassword');
  const confirmNewPassword = $('confirmNewPassword');
  const savePassword = $('saveNewPassword');

  if (!forgot || !modal || !requestForm || !resetEmail || !newPasswordForm) {
    return;
  }

  resetEmail.value = ADMIN_EMAIL || '';

  const showRequestForm = () => {
    requestForm.classList.remove('hidden');
    newPasswordForm.classList.add('hidden');
    modal.style.display = 'flex';
  };

  const showPasswordForm = () => {
    passwordRecoveryInProgress = true;
    showApp(false);
    if (close) close.hidden = true;
    requestForm.classList.add('hidden');
    newPasswordForm.classList.remove('hidden');
    modal.style.display = 'flex';
    if (resetMsg) {
      resetMsg.textContent = 'Reset link verified. Choose a new password.';
      resetMsg.className = 'msg';
    }
  };

  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showPasswordForm();
    }
  });

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  if (hashParams.has('error') || hashParams.has('error_code')) {
    const code = hashParams.get('error_code');
    modal.style.display = 'flex';
    if (resetMsg) {
      resetMsg.textContent = code === 'otp_expired'
        ? 'This reset link has expired or was already used. Request a new reset email.'
        : 'This reset link is invalid or expired. Request a new reset email.';
      resetMsg.className = 'msg error';
    }
  }

  forgot.addEventListener('click', e => {
    e.preventDefault();
    showRequestForm();
    if (resetMsg) {
      resetMsg.textContent = '';
      resetMsg.className = 'msg';
    }
  });

  if (close) {
    close.addEventListener('click', () => {
      modal.style.display = 'none';
      if (!passwordRecoveryInProgress) {
        requestForm.reset();
        resetEmail.value = ADMIN_EMAIL || '';
      }
    });
  }

  requestForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (send) send.disabled = true;
    if (resetMsg) {
      resetMsg.textContent = 'Sending reset email...';
      resetMsg.className = 'msg';
    }

    try {
      const redirectTo = new URL('admin.html', window.location.href).href;
      const { error } = await sb.auth.resetPasswordForEmail(
        resetEmail.value.trim(),
        { redirectTo }
      );
      if (error) {
        throw error;
      }
      if (resetMsg) {
        resetMsg.textContent = 'If this account exists and can receive recovery email, a reset link has been sent. Check your inbox and Spam folder.';
        resetMsg.className = 'msg ok';
      }
    } catch (err) {
      console.error('Password reset request failed.');
      if (resetMsg) {
        resetMsg.textContent = 'Could not request a reset email right now. Check the email address and try again later.';
        resetMsg.className = 'msg error';
      }
    } finally {
      if (send) send.disabled = false;
    }
  });

  newPasswordForm.addEventListener('submit', async event => {
    event.preventDefault();
    const password = newPassword.value;
    if (password.length < 8) {
      resetMsg.textContent = 'Use a password with at least 8 characters.';
      resetMsg.className = 'msg error';
      return;
    }
    if (password !== confirmNewPassword.value) {
      resetMsg.textContent = 'The passwords do not match.';
      resetMsg.className = 'msg error';
      confirmNewPassword.focus();
      return;
    }

    if (savePassword) savePassword.disabled = true;
    resetMsg.textContent = 'Updating password...';
    resetMsg.className = 'msg';
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        if (error.status === 401 || /session.*(missing|invalid|expired)|token.*(invalid|expired)/i.test(error.message || '')) {
          throw new Error('RESET_LINK_INVALID');
        }
        throw error;
      }

      const email = resetEmail.value.trim() || $('email')?.value || '';
      const { error: signOutError } = await sb.auth.signOut({ scope: 'local' });
      passwordRecoveryInProgress = false;
      if (close) close.hidden = false;
      modal.style.display = 'none';
      newPasswordForm.reset();
      requestForm.reset();
      resetEmail.value = ADMIN_EMAIL || '';
      if ($('email') && email) $('email').value = email;
      if ($('password')) $('password').value = '';
      showApp(false);
      msg($('loginMsg'), signOutError
        ? 'Password changed. Please sign in again with your new password.'
        : 'Password changed successfully. Sign in with your new password.', 'ok');
    } catch (error) {
      console.error('Password update failed.');
      resetMsg.textContent = error.message === 'RESET_LINK_INVALID'
        ? 'This reset link is invalid, expired, or already used. Request a new reset email.'
        : (error.message || 'Could not update the password. Request a new reset link and try again.');
      resetMsg.className = 'msg error';
    } finally {
      if (savePassword) savePassword.disabled = false;
    }
  });
}

/* =========================
   Start
   ========================= */

function init() {
  setupAuth();
  setupExperienceEditor();
  setupProjectEditor();
  setupPasswordRecovery();
  cmsSetup();
  requireAdmin().catch(reportAuthError);
}

init();
