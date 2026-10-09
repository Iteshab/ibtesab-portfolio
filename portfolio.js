const SUPABASE_URL=window.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY=window.SUPABASE_PUBLISHABLE_KEY;
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const CMS='__SITE_SETTINGS__';
const D={profile:{name:'Ibtesab Alam',role:'Network & IT Infrastructure Engineer',eyebrow:'IT Infrastructure & Networking',location:'Uttar Pradesh, India',email:'ibtesabalam7@gmail.com',phone:'+91 99184 12321',linkedin:'https://www.linkedin.com/in/ibtesab-alam/',github:'',heroPrefix:"Hi, I'm",heroName:'Ibtesab Alam.',heroDescription:'Experienced IT professional with 2+ years of experience in technical support, infrastructure management, networking, Windows Server, virtualization and firewall administration.',cvButtonText:'Download CV',connectButtonText:"Let's Connect",photoPath:'',aboutTitle:'About Me',aboutSubtitle:'Focused on reliable infrastructure, secure networks and business continuity.',aboutText:'Experienced IT professional with over 2 years of expertise in technical support, infrastructure management and end-to-end IT operations. Skilled in hardware and networking troubleshooting, Windows Server environments, Hyper-V, firewall administration and network solutions. I have led infrastructure projects and implemented network monitoring solutions while supporting high availability and operational efficiency.',skillsTitle:'Technical Skills',experienceTitle:'Experience',projectsTitle:'Projects',educationTitle:'Education & Certification',contactTitle:"Let's connect.",contactText:'For networking, infrastructure or IT support opportunities, feel free to reach out.',contactEmail:'ibtesabalam7@gmail.com',contactPhone:'+91 99184 12321',contactEmailButtonText:'Email Me',contactPhoneButtonText:'Call Me',contactLinkedinButtonText:'LinkedIn',contactGithubButtonText:'GitHub',contactLinkedin:'https://www.linkedin.com/in/ibtesab-alam/',contactGithub:'',footerText:'Network & IT Infrastructure · India · Last updated via Codex',copyrightText:'',cvPath:'Ibtesab_Alam_CV.pdf'},logoPath:'ia-logo.png',skills:[],education:[],appearance:{accent:'#ef476f',accent2:'#19a7a0',bg:'#f4f7f8',card:'#ffffff',text:'#111827',dark:'#0f172a'},sections:{about:true,skills:true,experience:true,projects:true,education:true,contact:true},seo:{},fallbackProjectNames:null,fallbackExperienceKeys:null};
D.skills=['Cisco','Zyxel','Fortinet','D-Link','Extreme','Aruba','VLAN','Routing','DHCP','Windows Server 2022','AD DS','DNS','WDS','Hyper-V','VMware','Sophos XG','SonicWall','pfSense','Office 365','Cacti','OP Manager','Wireshark','Zabbix','Linux Fundamentals','Cybersecurity','CCTV'].map((name,i)=>({id:'s'+i,name,order:i+1}));
D.education=[
 {id:'e1',title:'Bachelor of Science (B.Sc)',institute:'Siddharth University',year:'Passed: May 2026',result:'67.00%',details:'',order:1},
 {id:'e2',title:'DCC — Diploma in Cloud Computing',institute:'Jetking',year:'2024',result:'',details:'',order:2},
 {id:'e3',title:'Higher Secondary & Secondary',institute:'H.S.C Science',year:'June 2023',result:'58.00%',details:'S.S.C — May 2021 · 78.43%',order:3}
];
let S=JSON.parse(JSON.stringify(D));
let publicSettingsLoaded=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SETTINGS_BUCKET='profile-photo';
const PROJECT_META_MARKER='\n[PortfolioCMS:v1]';
const EXPERIENCE_META_MARKER='\n[PortfolioExperience:v1]';
function mergeValues(defaults,values){const result={...defaults};Object.entries(values||{}).forEach(([key,value])=>{if(value!==null&&value!==undefined)result[key]=value});return result}
function merge(r){const x=JSON.parse(JSON.stringify(D));if(!r||typeof r!=='object')return x;x.profile=mergeValues(x.profile,r.profile);x.skills=Array.isArray(r.skills)?r.skills:x.skills;x.education=Array.isArray(r.education)?r.education:x.education;x.appearance=mergeValues(x.appearance,r.appearance);x.sections={...x.sections,...(r.sections||{})};x.seo=mergeValues(x.seo,r.seo);x.logoPath=r.logoPath||x.logoPath;x.fallbackProjectNames=Array.isArray(r.fallbackProjectNames)?r.fallbackProjectNames:x.fallbackProjectNames;x.fallbackExperienceKeys=Array.isArray(r.fallbackExperienceKeys)?r.fallbackExperienceKeys:x.fallbackExperienceKeys;return x}
async function loadSettings(){const {data,error}=await sb.rpc('get_portfolio_public_settings');if(error)throw error;if(!data||typeof data!=='object'||Array.isArray(data)||!Array.isArray(data.fallbackProjectNames)||!Array.isArray(data.fallbackExperienceKeys))throw new Error('The public settings RPC returned no valid fallback visibility allowlist.');S=merge(data);publicSettingsLoaded=true}
const setText=(e,v)=>{if(e&&v!==null&&v!==undefined)e.textContent=String(v)};
function safeUrl(value){const text=String(value||'').trim();if(!text)return '';try{const url=new URL(text);return(url.protocol==='https:'||url.protocol==='http:')&&!url.username&&!url.password?url.href:''}catch{return ''}}
function assetUrl(path,fallback=''){const value=String(path||'').trim();if(!value)return fallback;const direct=safeUrl(value);if(direct)return direct;if(/^[a-z][a-z\d+.-]*:/i.test(value)||value.startsWith('//'))return fallback;if(value.startsWith('profile/'))return sb.storage.from(SETTINGS_BUCKET).getPublicUrl(value).data.publicUrl+'?v='+Date.now();return value}
function taggedDescription(value,marker){const source=String(value||'');const index=source.lastIndexOf(marker);if(index<0)return{text:source,metadata:{}};try{const metadata=JSON.parse(source.slice(index+marker.length));if(metadata&&typeof metadata==='object'&&!Array.isArray(metadata))return{text:source.slice(0,index),metadata}}catch(error){console.warn('Could not parse portfolio content metadata:',error)}return{text:source,metadata:{}}}
function splitLines(value){return String(value||'').replace(/\\n/g,'\n').split(/\r?\n+/).map(line=>line.trim()).filter(Boolean)}
function updateImage(img,path,fallback,placeholder){if(!img)return;if(!path){img.removeAttribute('src');img.style.display='none';if(placeholder)placeholder.style.display='';return}img.onload=()=>{img.style.display='block';if(placeholder)placeholder.style.display='none'};img.onerror=()=>{img.style.display='none';if(placeholder)placeholder.style.display=''};img.src=assetUrl(path,fallback)}
function setImageMeta(selector,attribute,value){const url=safeUrl(value);if(!url)return;let meta=document.querySelector(selector);if(!meta){meta=document.createElement('meta');meta.setAttribute(attribute.name,attribute.value);document.head.appendChild(meta)}meta.content=url}
function apply(){
 const p=S.profile;
 const hero=document.querySelector('.hero');
 if(hero){const eyebrow=hero.querySelector('.eyebrow');if(eyebrow)eyebrow.innerHTML='<span class="dot"></span> '+esc(p.eyebrow);const h=hero.querySelector('h1');if(h){h.innerHTML='<span class="cmsHeroPrefix"></span> <span class="gradient cmsHeroName"></span>';setText(h.querySelector('.cmsHeroPrefix'),p.heroPrefix);setText(h.querySelector('.cmsHeroName'),p.heroName)}setText(hero.querySelector('.hero p'),p.heroDescription);setText(hero.querySelector('.profile-card h2'),p.name);setText(hero.querySelector('.profile-card .role'),p.role);const contact=hero.querySelector('.contact');if(contact){const d=contact.querySelectorAll('div');if(d[0])d[0].innerHTML='<strong>Location</strong> '+esc(p.location);if(d[1])d[1].innerHTML='<strong>Email</strong> '+esc(p.email);if(d[2])d[2].innerHTML='<strong>Phone</strong> '+esc(p.phone)}const links=hero.querySelectorAll('.socials a');if(links[0])links[0].href='mailto:'+p.email;if(links[1])links[1].href='tel:'+String(p.phone||'').replace(/[^+\d]/g,'');if(links[2]){const linkedin=safeUrl(p.linkedin);links[2].href=linkedin||'#';links[2].style.display=linkedin?'grid':'none'}const github=document.getElementById('heroGithub');if(github){const url=safeUrl(p.github);github.href=url||'#';github.style.display=url?'grid':'none'}const cv=document.getElementById('cvDownloadLink');if(cv){cv.href=assetUrl(p.cvPath,'Ibtesab_Alam_CV.pdf');setText(cv,p.cvButtonText||'Download CV')}const connect=document.getElementById('connectCtaLink');if(connect)setText(connect,p.connectButtonText||"Let's Connect");const photo=document.getElementById('profilePhoto');if(photo)photo.alt=p.name+' - '+p.role;const initials=document.getElementById('avatarFallback');if(initials){const name=String(p.name||'').trim().split(/\s+/).filter(Boolean);setText(initials,name.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'IA')}updateImage(photo,p.photoPath,'',initials)}
 const about=document.getElementById('about');if(about){setText(about.querySelector('.section-title'),p.aboutTitle);setText(about.querySelector('.section-sub'),p.aboutSubtitle);setText(about.querySelector('.card p'),p.aboutText)}
 [['skills','skillsSubtitle'],['experience','experienceSubtitle'],['projects','projectsSubtitle'],['education','educationSubtitle']].forEach(([sectionId,key])=>{const node=document.querySelector('#'+sectionId+' .section-sub');if(node)setText(node,p[key])});
 [['navAbout','mobileNavAbout','navAbout'],['navSkills','mobileNavSkills','navSkills'],['navExperience','mobileNavExperience','navExperience'],['navProjects','mobileNavProjects','navProjects'],['navContact','mobileNavContact','navContact']].forEach(([desktop,mobile,key])=>{setText(document.getElementById(desktop),p[key]);setText(document.getElementById(mobile),p[key])});
 setText(document.getElementById('skillsTitle'),p.skillsTitle);setText(document.getElementById('experienceTitle'),p.experienceTitle);setText(document.getElementById('projectsTitle'),p.projectsTitle);setText(document.getElementById('educationTitle'),p.educationTitle);
 const contactSection=document.getElementById('contact');if(contactSection){setText(contactSection.querySelector('h2'),p.contactTitle);setText(contactSection.querySelector('p'),p.contactText);const email=p.contactEmail||p.email,phone=p.contactPhone||p.phone;const emailLink=document.getElementById('contactEmailLink'),phoneLink=document.getElementById('contactPhoneLink');if(emailLink){emailLink.href='mailto:'+email;setText(emailLink,p.contactEmailButtonText||'Email Me')}if(phoneLink){phoneLink.href='tel:'+String(phone||'').replace(/[^+\d]/g,'');setText(phoneLink,p.contactPhoneButtonText||'Call Me')}[['contactLinkedinLink',p.contactLinkedin||p.linkedin,p.contactLinkedinButtonText||'LinkedIn'],['contactGithubLink',p.contactGithub||p.github,p.contactGithubButtonText||'GitHub']].forEach(([id,value,label])=>{const link=document.getElementById(id);if(link){const url=safeUrl(value);link.href=url||'#';link.style.display=url?'':'none';setText(link,label)}})}
 const copyright=p.copyrightText||'© {year} {name}';const year=String(new Date().getFullYear());const footerText=copyright.replace(/\{year\}/g,year).replace(/\{name\}/g,p.name);const foot=document.querySelector('footer');if(foot)foot.textContent=[footerText,p.footerText].filter(Boolean).join(' · ');
 const logo=document.getElementById('siteLogo');if(logo){logo.onerror=()=>{logo.onerror=null;logo.src='ia-logo.png'};logo.alt=p.name+' logo';logo.src=assetUrl(S.logoPath,'ia-logo.png')}
 const root=document.documentElement,a=S.appearance;Object.entries({accent:a.accent,accent2:a.accent2,bg:a.bg,card:a.card,text:a.text,dark:a.dark}).forEach(([k,v])=>root.style.setProperty('--'+k,v));
 const map={about:'about',skills:'skills',experience:'experience',projects:'projects',education:'education',contact:'contact'};Object.keys(map).forEach(k=>{const section=document.getElementById(map[k]);if(section)section.style.display=S.sections[k]?'':'none'});
 document.title=S.seo.title||p.name+' | '+p.role;const md=document.querySelector('meta[name="description"]');if(md&&S.seo.description)md.content=S.seo.description;const mk=document.querySelector('meta[name="keywords"]');if(mk&&S.seo.keywords)mk.content=S.seo.keywords;const canonical=safeUrl(S.seo.canonicalUrl);if(canonical){const link=document.querySelector('link[rel="canonical"]');if(link)link.href=canonical;const ogUrl=document.querySelector('meta[property="og:url"]');if(ogUrl)ogUrl.content=canonical}const og=document.querySelector('meta[property="og:title"]');if(og)og.content=S.seo.ogTitle||document.title;const od=document.querySelector('meta[property="og:description"]');if(od)od.content=S.seo.ogDescription||S.seo.description||'';setImageMeta('meta[property="og:image"]',{name:'property',value:'og:image'},S.seo.ogImage);const tt=document.querySelector('meta[name="twitter:title"]');if(tt)tt.content=S.seo.twitterTitle||S.seo.ogTitle||document.title;const td=document.querySelector('meta[name="twitter:description"]');if(td)td.content=S.seo.twitterDescription||S.seo.ogDescription||S.seo.description||'';setImageMeta('meta[name="twitter:image"]',{name:'name',value:'twitter:image'},S.seo.twitterImage);updateStructuredData(p);
}
function updateStructuredData(profile){const script=document.querySelector('script[type="application/ld+json"]');if(!script)return;try{const data=JSON.parse(script.textContent);const graph=data['@graph']||[];const person=graph.find(item=>item['@type']==='Person');const profilePage=graph.find(item=>item['@type']==='ProfilePage');const website=graph.find(item=>item['@type']==='WebSite');if(person){person.name=profile.name;person.jobTitle=profile.role;person.description=profile.heroDescription;person.email=profile.email?'mailto:'+profile.email:'';person.telephone=profile.phone;person.sameAs=[profile.linkedin,profile.github].filter(value=>safeUrl(value))}if(profilePage)profilePage.name=document.title;if(website)website.name=profile.name;script.textContent=JSON.stringify(data)}catch(error){console.warn('Could not update structured metadata:',error)}}
function renderSkills(){const box=document.querySelector('#skills .card.skill');const skills=S.skills.filter(item=>item&&String(item.name||'').trim());if(!box)return;box.innerHTML=skills.length?[...skills].sort((a,b)=>(a.order||1)-(b.order||1)).map(x=>'<span class="tag"'+(x.category?' title="'+esc(x.category)+'"':'')+'>'+esc(x.name)+'</span>').join(''):'<p class="section-sub">No skills added yet.</p>'}
function renderEducation(){const section=document.getElementById('education');const entries=S.education.filter(item=>item&&String(item.title||'').trim());if(!section)return;let grid=section.querySelector('.grid');if(!grid){grid=document.createElement('div');grid.className='grid';section.appendChild(grid)}grid.innerHTML=entries.length?[...entries].sort((a,b)=>(a.order||1)-(b.order||1)).map(x=>'<div class="card"><h3>'+esc(x.title)+'</h3><p>'+esc(x.institute||'')+(x.year?'<br>'+esc(x.year):'')+(x.result?' · '+esc(x.result):'')+(x.details?'<br>'+esc(x.details):'')+'</p></div>').join(''):'<p class="section-sub">No education entries added yet.</p>'}
const EXPERIENCE_FALLBACK = window.PORTFOLIO_EXPERIENCE_FALLBACK || [];

async function renderExperience() {
  const list = document.getElementById('experienceList');
  if (!list) return;
  const visibleFallbacks = new Set(
    Array.isArray(S.fallbackExperienceKeys)
      ? S.fallbackExperienceKeys.map(key => String(key).toLowerCase())
      : []
  );
  const keyForFallback = row => `${row.company.trim().toLowerCase()}|${row.position.trim().toLowerCase()}|${row.start_date.trim().toLowerCase()}`;
  const renderSafeFallbacks = () => render(publicSettingsLoaded ? EXPERIENCE_FALLBACK.filter(row => visibleFallbacks.has(keyForFallback(row))) : []);

  const render = rows => {
    list.innerHTML = rows.map(r => {
      const content = taggedDescription(r.description, EXPERIENCE_META_MARKER);
      const bullets = splitLines(content.text).map(x => '<li>' + esc(x) + '</li>').join('');
      const technologies = Array.isArray(content.metadata.technologies) ? content.metadata.technologies : [];
      const key = `${String(r.company||'').trim().toLowerCase()}|${String(r.position||'').trim().toLowerCase()}|${String(r.start_date||'').trim().toLowerCase()}`;
      const dates = [r.start_date, r.end_date || 'Present'].filter(Boolean).join(' — ');
      const dateLine = [dates, content.metadata.location].filter(Boolean).join(' · ');
      return '<article class="job">' +
        '<div class="date">' + esc(dateLine) + '</div>' +
        '<div class="jobbox">' +
          '<h3>' + esc(r.position || '') + '</h3>' +
          '<div class="company">' + esc(r.company || '') + '</div>' +
          (content.metadata.summary ? '<p>' + esc(content.metadata.summary) + '</p>' : '') +
          (bullets ? '<ul>' + bullets + '</ul>' : '') +
          (technologies.length ? '<div class="skill experienceSkills">' + technologies.map(x=>'<span class="tag">'+esc(x)+'</span>').join('') + '</div>' : '') +
        '</div>' +
      '</article>';
    }).join('');
  };

  try {
    const {data,error}=await sb.from('experience')
      .select('id,company,position,start_date,end_date,description,sort_order')
      .order('sort_order',{ascending:true})
      .order('id',{ascending:true});

    if(error){
      console.error('Experience database load error:',error);
      renderSafeFallbacks();
      return;
    }
    const allDbRows=Array.isArray(data)?data.filter(row=>String(row.position||'').trim()&&String(row.company||'').trim()):[];
    const keyFor=row=>`${String(row.company||'').trim().toLowerCase()}|${String(row.position||'').trim().toLowerCase()}|${String(row.start_date||'').trim().toLowerCase()}`;
    const existing=new Set(allDbRows.flatMap(row=>[keyFor(row),taggedDescription(row.description,EXPERIENCE_META_MARKER).metadata.legacyExperienceKey].filter(Boolean)));
    const dbRows=allDbRows.filter(row=>{const metadata=taggedDescription(row.description,EXPERIENCE_META_MARKER).metadata;return metadata.published!==false&&metadata.deleted!==true});
    const fallbacks=EXPERIENCE_FALLBACK.filter(row=>{
      const key=keyForFallback(row);
      return !existing.has(key)&&visibleFallbacks.has(key);
    });
    const rows=[...dbRows,...fallbacks];
    render(rows);
  }catch(error){
    console.error('Experience load error:',error);
    renderSafeFallbacks();
  }
}

function projectParts(row){const stored=taggedDescription(row?.description,PROJECT_META_MARKER);const match=stored.text.match(/^\[Company:\s*([^\]]+)\]\s*/i);return{company:match?match[1].trim():'',description:stored.text.replace(/^\[Company:\s*[^\]]+\]\s*/i,'').trim(),metadata:stored.metadata}}

async function renderProjects(){
  const section=document.getElementById('projects');
  const grid=document.getElementById('projectsList') || section?.querySelector('.grid');
  if(!grid)return;
  const fallbackCards=new Map([...grid.querySelectorAll('.project')].map(card=>[
    card.querySelector('h3')?.textContent.trim().toLowerCase(),
    card.outerHTML
  ]).filter(([name])=>name));
  const visibleFallbacks=new Set(Array.isArray(S.fallbackProjectNames)?S.fallbackProjectNames.map(name=>String(name).trim().toLowerCase()):[]);
  const fallbackHtml=[...fallbackCards];
  const hasResumeCards=fallbackCards.size>0;
  const renderCards=cards=>'<div class="projectGroup"><div class="grid">'+cards.join('')+'</div></div>';

  try{
    const {data,error}=await sb
      .from('projects')
      .select('*')
      .neq('project_name',CMS)
      .order('sort_order',{ascending:true})
      .order('id',{ascending:true});

    if(error){
      console.error('Projects database load error:',error);
      const safeFallbacks=publicSettingsLoaded?fallbackHtml.filter(([name])=>visibleFallbacks.has(name)):[];
      if(hasResumeCards)grid.innerHTML=safeFallbacks.length?renderCards(safeFallbacks.map(([,card])=>card)):'<p class="section-sub">No projects added yet.</p>';
      else if(!hasResumeCards)grid.innerHTML='<p class="section-sub">Projects could not be loaded.</p>';
      return;
    }

    const allRows=Array.isArray(data)?data.filter(row=>String(row.project_name||'').trim()):[];
    const allDatabaseNames=new Set(allRows.flatMap(row=>{
      const metadata=projectParts(row).metadata;
      return [String(row.project_name||'').trim().toLowerCase(),String(metadata.legacyProjectName||'').trim().toLowerCase()].filter(Boolean);
    }));
    const rows=allRows.filter(row=>{const metadata=projectParts(row).metadata;return metadata.published!==false&&metadata.deleted!==true});
    const availableFallbacks=fallbackHtml.filter(([name])=>visibleFallbacks.has(name)&&!allDatabaseNames.has(name));
    if(!rows.length){
      if(availableFallbacks.length)grid.innerHTML=renderCards(availableFallbacks.map(([,card])=>card));
      else grid.innerHTML='<p class="section-sub">No projects added yet.</p>';
      return;
    }
    const renderedResumeProjects=new Set();
    const projectCards=rows.map((r,i)=>{
      const name=String(r.project_name||'').trim().toLowerCase();
      if(!name||renderedResumeProjects.has(name))return '';
      renderedResumeProjects.add(name);
      const content=projectParts(r);
      const metadata=content.metadata||{};
      const technologies=Array.isArray(metadata.technologies)?metadata.technologies:[];
      const features=Array.isArray(metadata.features)?metadata.features:[];
      const company=content.company||'';
      const liveUrl=safeUrl(metadata.liveUrl),githubUrl=safeUrl(metadata.githubUrl),imageUrl=safeUrl(metadata.imageUrl);
      return '<article class="card project">'+
        '<div class="num">'+String(renderedResumeProjects.size).padStart(2,'0')+' / PROJECT</div>'+
        '<h3>'+esc(r.project_name||'')+'</h3>'+
        (company||r.role?'<div class="company">'+esc(company||r.role)+(company&&r.role?' · '+esc(r.role):'')+'</div>':'')+
        (r.location||r.start_date||r.end_date?
          '<div class="date">'+esc(r.location||'')+
          (r.location&&(r.start_date||r.end_date)?' • ':'')+
          esc(r.start_date||'')+
          (r.start_date||r.end_date?' — ':'')+
          esc(r.end_date||'')+'</div>':'')+
        (imageUrl?'<img class="projectImage" src="'+esc(imageUrl)+'" alt="'+esc(r.project_name||'')+' thumbnail" loading="lazy">':'')+
        (content.description?'<p>'+splitLines(content.description).map(esc).join('<br>')+'</p>':'')+
        (technologies.length?'<div class="skill projectTechnologies">'+technologies.map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'</div>':'')+
        (features.length?'<ul class="projectFeatures">'+features.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
        (liveUrl||githubUrl?'<div class="projectLinks">'+(liveUrl?'<a class="btn" href="'+esc(liveUrl)+'" target="_blank" rel="noopener noreferrer">Live Demo</a>':'')+(githubUrl?'<a class="btn" href="'+esc(githubUrl)+'" target="_blank" rel="noopener noreferrer">GitHub</a>':'')+'</div>':'')+
        '</article>';
    }).filter(Boolean);
    for(const [name,card] of availableFallbacks){
      if(!renderedResumeProjects.has(name)){
        renderedResumeProjects.add(name);
        projectCards.push(card);
      }
    }
    if(!projectCards.length){grid.innerHTML='<p class="section-sub">No projects added yet.</p>';return}
    grid.innerHTML=renderCards(projectCards);
    grid.querySelectorAll('.projectImage').forEach(image=>{image.onerror=()=>image.remove()});
  }catch(error){
    console.error('Projects load error:',error);
    const safeFallbacks=publicSettingsLoaded?fallbackHtml.filter(([name])=>visibleFallbacks.has(name)):[];
    if(hasResumeCards)grid.innerHTML=safeFallbacks.length?renderCards(safeFallbacks.map(([,card])=>card)):'<p class="section-sub">No projects added yet.</p>';
    else if(!hasResumeCards)grid.innerHTML='<p class="section-sub">Projects could not be loaded.</p>';
  }
}

async function main() {
  try {
    await loadSettings();
  } catch (error) {
    console.error('CMS settings error:', error);
    // Until the public RPC is deployed, keep the server-rendered profile,
    // skills, education, and appearance intact. Let the public content queries
    // reconcile projects and experience against database tombstones so deleted
    // legacy entries do not reappear. If those reads fail, fail closed.
    S.fallbackProjectNames = [...document.querySelectorAll('#projectsList .project h3')]
      .map(node => node.textContent.trim()).filter(Boolean);
    S.fallbackExperienceKeys = EXPERIENCE_FALLBACK.map(row =>
      `${row.company.trim()}|${row.position.trim()}|${row.start_date.trim()}`
    );
    await Promise.allSettled([renderExperience(), renderProjects()]);
    return;
  }
  apply();
  renderSkills();
  renderEducation();
  await Promise.allSettled([
    renderExperience(),
    renderProjects()
  ]);
}

main();
