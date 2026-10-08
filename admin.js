const sb = window.supabaseClient;
if (!sb) {
  throw new Error('Supabase client is not initialized. Check supabase-config.js loading order.');
}

const ADMIN_EMAIL = window.ADMIN_EMAIL;
const BUCKET = 'profile-photo';
const PHOTO_PATH = 'profile/profile-photo.webp';

const $ = (id) => document.getElementById(id);
let passwordRecoveryInProgress = false;

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
    .neq('project_name', CMS_SETTINGS_PROJECT)
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


function parseProjectCompany(description) {
  const m = String(description || '').match(/^\[Company:\s*([^\]]+)\]\s*/i);
  return m ? m[1].trim() : '';
}

function cleanProjectDescription(description) {
  return String(description || '').replace(/^\[Company:\s*[^\]]+\]\s*/i, '').trim();
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

  $('projectCompany').value = parseProjectCompany(row?.description || '');

  $('projectLocation').value =
    row?.location || '';

  $('projectStartDate').value =
    row?.start_date || '';

  $('projectEndDate').value =
    row?.end_date || '';

  $('projectDescription').value = cleanProjectDescription(row?.description || '');

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
  const projectCompany = $('projectCompany').value.trim();
  const cleanDescription = $('projectDescription').value.trim();
  const storedDescription = projectCompany ? `[Company: ${projectCompany}] ${cleanDescription}` : cleanDescription;

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
  await cmsLoadAll();
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
    aboutTitle:'About Me',
    aboutSubtitle:'Focused on reliable infrastructure, secure networks and business continuity.',
    aboutText:'Experienced IT professional with over 2 years of expertise in technical support, infrastructure management and end-to-end IT operations. Skilled in hardware and networking troubleshooting, Windows Server environments, Hyper-V, firewall administration and network solutions. I have led infrastructure projects and implemented network monitoring solutions while supporting high availability and operational efficiency.',
    contactTitle:"Let's connect.",
    contactText:'For networking, infrastructure or IT support opportunities, feel free to reach out.',
    footerText:'Network & IT Infrastructure · India',
    cvPath:'Ibtesab_Alam_CV.pdf'
  },
  skills:['Cisco','Zyxel','Fortinet','D-Link','Extreme','Aruba','VLAN','Routing','DHCP','Windows Server 2022','AD DS','DNS','WDS','Hyper-V','VMware','Sophos XG','SonicWall','pfSense','Office 365','Cacti','OP Manager','Wireshark','Zabbix','Linux Fundamentals','Cybersecurity','CCTV'].map((name,i)=>({id:'s'+i,name,order:i+1})),
  education:[
    {id:'e1',title:'Bachelor of Science (B.Sc)',institute:'Siddharth University',year:'May 2026',result:'67.00%',details:'',order:1},
    {id:'e2',title:'DCC — Diploma in Cloud Computing',institute:'Jetking',year:'2024',result:'',details:'',order:2},
    {id:'e3',title:'Higher Secondary & Secondary',institute:'H.S.C Science / S.S.C',year:'June 2023 / May 2021',result:'58.00% / 78.43%',details:'',order:3}
  ],
  appearance:{accent:'#ef476f',accent2:'#19a7a0',bg:'#f4f7f8',card:'#ffffff',text:'#111827',dark:'#0f172a'},
  sections:{about:true,skills:true,experience:true,projects:true,education:true,contact:true},
  seo:{title:'Ibtesab Alam | Network Engineer & IT Infrastructure Engineer',description:'Ibtesab Alam is a Network Engineer and IT Infrastructure professional from India with 2+ years of experience in networking, Windows Server, firewalls, virtualization, Microsoft 365 and network monitoring.',keywords:'Ibtesab Alam, Network Engineer, IT Infrastructure Engineer, Network Engineer India, Cisco, Fortinet, Sophos, Windows Server, Hyper-V, Microsoft 365, Cacti, Zabbix',ogTitle:'Ibtesab Alam | Network Engineer & IT Infrastructure Engineer',ogDescription:'Network Engineer and IT Infrastructure professional from India.'}
};

let cmsSettings=JSON.parse(JSON.stringify(CMS_DEFAULTS));
let cmsSettingsId=null;

function cmsMerge(raw){
  const x=JSON.parse(JSON.stringify(CMS_DEFAULTS));
  if(!raw)return x;
  x.profile={...x.profile,...(raw.profile||{})};
  if(Array.isArray(raw.skills))x.skills=raw.skills;
  if(Array.isArray(raw.education))x.education=raw.education;
  x.appearance={...x.appearance,...(raw.appearance||{})};
  x.sections={...x.sections,...(raw.sections||{})};
  x.seo={...x.seo,...(raw.seo||{})};
  return x;
}

async function cmsLoad(){
  const {data,error}=await sb.from('projects').select('id,description').eq('project_name',CMS_SETTINGS_PROJECT).maybeSingle();
  if(error)throw error;
  if(data){
    cmsSettingsId=data.id;
    try{cmsSettings=cmsMerge(JSON.parse(data.description||'{}'))}catch(_){cmsSettings=cmsMerge(null)}
  }else{
    cmsSettings=cmsMerge(null);
    await cmsSave();
  }
}

async function cmsSave(){
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
  if(cmsSettingsId) result=await sb.from('projects').update(payload).eq('id',cmsSettingsId);
  else{
    result=await sb.from('projects').insert(payload).select('id').single();
    if(!result.error)cmsSettingsId=result.data.id;
  }
  if(result.error)throw result.error;
}

function cmsFill(){
  const p=cmsSettings.profile;
  const map={
    siteName:p.name,siteRole:p.role,siteEyebrow:p.eyebrow,siteLocation:p.location,siteEmail:p.email,sitePhone:p.phone,
    siteLinkedin:p.linkedin,siteGithub:p.github,siteHeroPrefix:p.heroPrefix,siteHeroName:p.heroName,siteHeroDescription:p.heroDescription,
    aboutTitle:p.aboutTitle,aboutSubtitle:p.aboutSubtitle,aboutText:p.aboutText,contactTitle:p.contactTitle,contactText:p.contactText,
    footerText:p.footerText,cvPath:p.cvPath,seoTitle:cmsSettings.seo.title,seoDescription:cmsSettings.seo.description,
    seoKeywords:cmsSettings.seo.keywords,ogTitle:cmsSettings.seo.ogTitle,ogDescription:cmsSettings.seo.ogDescription,
    accentColor:cmsSettings.appearance.accent,accent2Color:cmsSettings.appearance.accent2,bgColor:cmsSettings.appearance.bg,
    cardColor:cmsSettings.appearance.card,textColor:cmsSettings.appearance.text,darkColor:cmsSettings.appearance.dark
  };
  Object.keys(map).forEach(id=>{if($(id))$(id).value=map[id]||''});
  ['about','skills','experience','projects','education','contact'].forEach(k=>{const id='show'+k.charAt(0).toUpperCase()+k.slice(1);if($(id))$(id).checked=!!cmsSettings.sections[k]});
  cmsRenderSkills();cmsRenderEducation();
}

async function cmsSaveWebsite(e){
  e.preventDefault();const p=cmsSettings.profile;
  ['name','role','eyebrow','location','email','phone','linkedin','github','heroPrefix','heroName','heroDescription'].forEach(k=>{const id='site'+k.charAt(0).toUpperCase()+k.slice(1);if($(id))p[k]=$(id).value.trim()});
  p.aboutTitle=$('aboutTitle').value.trim();p.aboutSubtitle=$('aboutSubtitle').value.trim();p.aboutText=$('aboutText').value.trim();
  p.contactTitle=$('contactTitle').value.trim();p.contactText=$('contactText').value.trim();p.footerText=$('footerText').value.trim();p.cvPath=$('cvPath').value.trim();
  try{await cmsSave();msg($('siteMsg'),'Website profile saved.','ok')}catch(e){msg($('siteMsg'),e.message,'error')}
}

function cmsRenderSkills(){
  const list=$('skillsAdminList');if(!list)return;
  const arr=[...cmsSettings.skills].sort((a,b)=>(a.order||1)-(b.order||1));
  list.innerHTML=arr.map(s=>'<article class="item"><div><h3>'+escapeHtml(s.name)+'</h3><div class="date">Order '+(s.order||1)+'</div></div><div class="actions"><button class="btn" type="button" data-cms-sedit="'+s.id+'">Edit</button><button class="btn danger" type="button" data-cms-sdelete="'+s.id+'">Delete</button></div></article>').join('');
  list.querySelectorAll('[data-cms-sedit]').forEach(b=>b.onclick=()=>cmsOpenSkill(b.dataset.cmsSedit));
  list.querySelectorAll('[data-cms-sdelete]').forEach(b=>b.onclick=()=>cmsDeleteSkill(b.dataset.cmsSdelete));
}
function cmsOpenSkill(id){const s=cmsSettings.skills.find(x=>x.id===id);$('skillEditor').classList.remove('hidden');$('skillId').value=s?.id||'';$('skillName').value=s?.name||'';$('skillOrder').value=s?.order||cmsSettings.skills.length+1}
function cmsCloseSkill(){$('skillEditor').classList.add('hidden');$('skillEditor').reset();$('skillOrder').value=1}
async function cmsSaveSkill(e){e.preventDefault();const id=$('skillId').value||'s'+Date.now();const row={id,name:$('skillName').value.trim(),order:Number($('skillOrder').value)||1};if(!row.name)return;const i=cmsSettings.skills.findIndex(x=>x.id===id);if(i>=0)cmsSettings.skills[i]=row;else cmsSettings.skills.push(row);try{await cmsSave();cmsRenderSkills();cmsCloseSkill();msg($('skillMsg'),'Skill saved.','ok')}catch(e){msg($('skillMsg'),e.message,'error')}}
async function cmsDeleteSkill(id){if(!confirm('Delete this skill?'))return;cmsSettings.skills=cmsSettings.skills.filter(x=>x.id!==id);try{await cmsSave();cmsRenderSkills()}catch(e){msg($('skillMsg'),e.message,'error')}}

function cmsRenderEducation(){
  const list=$('educationAdminList');if(!list)return;const arr=[...cmsSettings.education].sort((a,b)=>(a.order||1)-(b.order||1));
  list.innerHTML=arr.map(e=>'<article class="item"><div><h3>'+escapeHtml(e.title)+'</h3><div class="company">'+escapeHtml(e.institute||'')+'</div><div class="date">'+escapeHtml(e.year||'')+(e.result?' • '+escapeHtml(e.result):'')+'</div></div><div class="actions"><button class="btn" type="button" data-cms-eedit="'+e.id+'">Edit</button><button class="btn danger" type="button" data-cms-edelete="'+e.id+'">Delete</button></div></article>').join('');
  list.querySelectorAll('[data-cms-eedit]').forEach(b=>b.onclick=()=>cmsOpenEducation(b.dataset.cmsEedit));list.querySelectorAll('[data-cms-edelete]').forEach(b=>b.onclick=()=>cmsDeleteEducation(b.dataset.cmsEdelete));
}
function cmsOpenEducation(id){const e=cmsSettings.education.find(x=>x.id===id);$('educationEditor').classList.remove('hidden');$('educationId').value=e?.id||'';$('educationTitle').value=e?.title||'';$('educationInstitute').value=e?.institute||'';$('educationYear').value=e?.year||'';$('educationResult').value=e?.result||'';$('educationDetails').value=e?.details||'';$('educationOrder').value=e?.order||1}
function cmsCloseEducation(){$('educationEditor').classList.add('hidden');$('educationEditor').reset();$('educationOrder').value=1}
async function cmsSaveEducation(e){e.preventDefault();const id=$('educationId').value||'e'+Date.now();const row={id,title:$('educationTitle').value.trim(),institute:$('educationInstitute').value.trim(),year:$('educationYear').value.trim(),result:$('educationResult').value.trim(),details:$('educationDetails').value.trim(),order:Number($('educationOrder').value)||1};const i=cmsSettings.education.findIndex(x=>x.id===id);if(i>=0)cmsSettings.education[i]=row;else cmsSettings.education.push(row);try{await cmsSave();cmsRenderEducation();cmsCloseEducation();msg($('educationMsg'),'Education saved.','ok')}catch(e){msg($('educationMsg'),e.message,'error')}}
async function cmsDeleteEducation(id){if(!confirm('Delete this education item?'))return;cmsSettings.education=cmsSettings.education.filter(x=>x.id!==id);try{await cmsSave();cmsRenderEducation()}catch(e){msg($('educationMsg'),e.message,'error')}}

async function cmsSaveAppearance(e){e.preventDefault();cmsSettings.appearance={accent:$('accentColor').value,accent2:$('accent2Color').value,bg:$('bgColor').value,card:$('cardColor').value,text:$('textColor').value,dark:$('darkColor').value};try{await cmsSave();msg($('appearanceMsg'),'Appearance saved.','ok')}catch(e){msg($('appearanceMsg'),e.message,'error')}}
async function cmsSaveSections(e){e.preventDefault();['about','skills','experience','projects','education','contact'].forEach(k=>cmsSettings.sections[k]=$('show'+k.charAt(0).toUpperCase()+k.slice(1)).checked);try{await cmsSave();msg($('sectionsMsg'),'Section settings saved.','ok')}catch(e){msg($('sectionsMsg'),e.message,'error')}}
async function cmsSaveSeo(e){e.preventDefault();cmsSettings.seo={title:$('seoTitle').value.trim(),description:$('seoDescription').value.trim(),keywords:$('seoKeywords').value.trim(),ogTitle:$('ogTitle').value.trim(),ogDescription:$('ogDescription').value.trim()};try{await cmsSave();msg($('seoMsg'),'SEO settings saved.','ok')}catch(e){msg($('seoMsg'),e.message,'error')}}

async function cmsUpload(inputId,path,msgId,label){
  const file=$(inputId)?.files?.[0];if(!file){msg($(msgId),'Choose '+label+' first.','error');return}
  if(file.size>6*1024*1024){msg($(msgId),'Maximum file size is 6 MB.','error');return}
  msg($(msgId),'Uploading…');
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:true,cacheControl:'3600'});
  if(error){msg($(msgId),error.message,'error');return}
  if(path===CV_PATH){cmsSettings.profile.cvPath=CV_PATH;await cmsSave()}
  if(path===LOGO_PATH){cmsSettings.logoPath=LOGO_PATH;await cmsSave()}
  msg($(msgId),'Uploaded successfully.','ok');$(inputId).value='';if(path===PHOTO_PATH)await loadPhoto();
}

async function cmsLoadAll(){await cmsLoad();cmsFill()}

function cmsSetup(){
  $('siteForm')?.addEventListener('submit',cmsSaveWebsite);
  $('appearanceForm')?.addEventListener('submit',cmsSaveAppearance);
  $('sectionsForm')?.addEventListener('submit',cmsSaveSections);
  $('seoForm')?.addEventListener('submit',cmsSaveSeo);
  $('newSkill')?.addEventListener('click',()=>cmsOpenSkill(''));$('cancelSkill')?.addEventListener('click',cmsCloseSkill);$('skillEditor')?.addEventListener('submit',cmsSaveSkill);
  $('newEducation')?.addEventListener('click',()=>cmsOpenEducation(''));$('cancelEducation')?.addEventListener('click',cmsCloseEducation);$('educationEditor')?.addEventListener('submit',cmsSaveEducation);
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
  setupPhotoControls();
  setupPhotoUpload();
  setupExperienceEditor();
  setupProjectEditor();
  setupPasswordRecovery();
  cmsSetup();
  requireAdmin();
}

init();
