const SUPABASE_URL=window.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY=window.SUPABASE_PUBLISHABLE_KEY;
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const CMS='__SITE_SETTINGS__';
const D={profile:{name:'Ibtesab Alam',role:'Network & IT Infrastructure Engineer',eyebrow:'IT Infrastructure & Networking',location:'Uttar Pradesh, India',email:'ibtesabalam7@gmail.com',phone:'+91 99184 12321',linkedin:'https://www.linkedin.com/in/ibtesab-alam/',github:'',heroPrefix:"Hi, I'm",heroName:'Ibtesab Alam.',heroDescription:'Experienced IT professional with 2+ years of experience in technical support, infrastructure management, networking, Windows Server, virtualization and firewall administration.',aboutTitle:'About Me',aboutSubtitle:'Focused on reliable infrastructure, secure networks and business continuity.',aboutText:'Experienced IT professional with over 2 years of expertise in technical support, infrastructure management and end-to-end IT operations.',contactTitle:"Let's connect.",contactText:'For networking, infrastructure or IT support opportunities, feel free to reach out.',footerText:'Network & IT Infrastructure · India',cvPath:'Ibtesab_Alam_CV.pdf'},skills:[],education:[],appearance:{accent:'#ef476f',accent2:'#19a7a0',bg:'#f4f7f8',card:'#ffffff',text:'#111827',dark:'#0f172a'},sections:{about:true,skills:true,experience:true,projects:true,education:true,contact:true},seo:{}};
let S=JSON.parse(JSON.stringify(D));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function merge(r){const x=JSON.parse(JSON.stringify(D));if(!r)return x;x.profile={...x.profile,...(r.profile||{})};x.skills=Array.isArray(r.skills)?r.skills:x.skills;x.education=Array.isArray(r.education)?r.education:x.education;x.appearance={...x.appearance,...(r.appearance||{})};x.sections={...x.sections,...(r.sections||{})};x.seo={...x.seo,...(r.seo||{})};x.logoPath=r.logoPath||'';return x}
async function loadSettings(){const {data,error}=await sb.from('projects').select('description').eq('project_name',CMS).maybeSingle();if(!error&&data)try{S=merge(JSON.parse(data.description||'{}'))}catch(_){}}
const sections=()=>[...document.querySelectorAll('section')];
const sectionByTitle=t=>sections().find(s=>(s.querySelector('.section-title')?.textContent||'').trim().toLowerCase().includes(t));
const setText=(e,v)=>{if(e)e.textContent=v||''};
function apply(){
 const p=S.profile;
 const hero=document.querySelector('.hero');
 if(hero){setText(hero.querySelector('.eyebrow'),p.eyebrow);const h=hero.querySelector('h1');if(h){h.innerHTML='<span class="cmsHeroPrefix"></span> <span class="gradient cmsHeroName"></span>';setText(h.querySelector('.cmsHeroPrefix'),p.heroPrefix);setText(h.querySelector('.cmsHeroName'),p.heroName)}setText(hero.querySelector('.hero p'),p.heroDescription);setText(hero.querySelector('.profile-card h2'),p.name);setText(hero.querySelector('.profile-card .role'),p.role);const contact=hero.querySelector('.contact');if(contact){const d=contact.querySelectorAll('div');if(d[0])d[0].innerHTML='<strong>Location</strong> '+esc(p.location);if(d[1])d[1].innerHTML='<strong>Email</strong> '+esc(p.email);if(d[2])d[2].innerHTML='<strong>Phone</strong> '+esc(p.phone)}const links=hero.querySelectorAll('.socials a');if(links[0])links[0].href='mailto:'+p.email;if(links[1])links[1].href='tel:'+p.phone.replace(/[^+\d]/g,'');if(links[2]){links[2].href=p.linkedin||'#';links[2].style.display=p.linkedin?'grid':'none'}if(links[3]){links[3].href=p.github||'#';links[3].style.display=p.github?'grid':'none'}const cv=hero.querySelector('.btn.primary');if(cv)cv.href=p.cvPath||'Ibtesab_Alam_CV.pdf'}}
 const about=sectionByTitle('about');if(about){setText(about.querySelector('.section-title'),p.aboutTitle);setText(about.querySelector('.section-sub'),p.aboutSubtitle);setText(about.querySelector('.card p'),p.aboutText)}
 const contact=sectionByTitle('connect');if(contact){setText(contact.querySelector('h2'),p.contactTitle);setText(contact.querySelector('p'),p.contactText)}
 const foot=document.querySelector('footer');if(foot)foot.innerHTML='© <span id="year">'+new Date().getFullYear()+'</span> '+esc(p.name)+' · '+esc(p.footerText);
 const root=document.documentElement,a=S.appearance;Object.entries({accent:a.accent,accent2:a.accent2,bg:a.bg,card:a.card,text:a.text,dark:a.dark}).forEach(([k,v])=>root.style.setProperty('--'+k,v));
 const map={about:'about',skills:'skills',experience:'experience',projects:'projects',education:'education',contact:'connect'};Object.keys(map).forEach(k=>{const s=sectionByTitle(map[k]);if(s)s.style.display=S.sections[k]?'':'none'});
 document.title=S.seo.title||p.name+' | '+p.role;const md=document.querySelector('meta[name="description"]');if(md&&S.seo.description)md.content=S.seo.description;const mk=document.querySelector('meta[name="keywords"]');if(mk&&S.seo.keywords)mk.content=S.seo.keywords;const og=document.querySelector('meta[property="og:title"]');if(og)og.content=S.seo.ogTitle||document.title;const od=document.querySelector('meta[property="og:description"]');if(od)od.content=S.seo.ogDescription||S.seo.description||''
}
function renderSkills(){const s=sectionByTitle('skills'),box=s?.querySelector('.card.skill');if(!box)return;box.innerHTML=[...S.skills].sort((a,b)=>(a.order||1)-(b.order||1)).map(x=>'<span class="tag">'+esc(x.name)+'</span>').join('')}
function renderEducation(){const s=sections().find(x=>(x.textContent||'').includes('Education & Certification'));if(!s)return;let grid=s.querySelector('.grid');if(!grid){grid=document.createElement('div');grid.className='grid';s.appendChild(grid)}grid.innerHTML=[...S.education].sort((a,b)=>(a.order||1)-(b.order||1)).map(x=>'<div class="card"><h3>'+esc(x.title)+'</h3><p>'+esc(x.institute||'')+(x.year?'<br>'+esc(x.year):'')+(x.result?' · '+esc(x.result):'')+(x.details?'<br>'+esc(x.details):'')+'</p></div>').join('')}
const EXPERIENCE_FALLBACK = [
  {
    position: 'L2 Support Engineer IT',
    company: 'Bioaltus Pharmaceuticals Pvt Ltd',
    location: 'Angam (Vapi), INDIA',
    start_date: 'May 2026',
    end_date: 'Present',
    description: 'Currently leading end-to-end Greenfield IT infrastructure setup for a new pharmaceutical facility, managing requirement gathering and solution architecture design.\\nMicrosoft 365 Administrator.\\nBOQ finalization, vendor coordination, procurement, Server, Firewall and Network deployment.',
    sort_order: 1
  },
  {
    position: 'L2 Support Engineer IT',
    company: 'SEFORGE LIMITED (Suzlon Group)',
    location: 'VADODARA, INDIA',
    start_date: 'Jan 2026',
    end_date: 'May 2026',
    description: 'Led and executed infrastructure projects involving Windows Server environments (2019-2025), Hyper-V virtualization, and enterprise network configurations.\\nManaged and optimized firewall solutions SonicWall to ensure network security and compliance.\\nDelivered end-user support for Windows OS environments (7, 10, 11) and managed Office 365 administration tasks.\\nMicrosoft 365 Administrator.\\nCoordinated vendor management and resolved technical issues promptly.\\nDelivered high system uptime (99%) and reduced IT costs by bringing outsourced contracts in-house through operational improvement.',
    sort_order: 2
  },
  {
    position: 'Senior Network Engineer',
    company: 'LD College of Engineering',
    location: 'AHEMDABAD, INDIA',
    start_date: 'June 2024',
    end_date: 'Dec 2025',
    description: 'Designed networks, troubleshoot connectivity, and configured routers/switches to support campus infrastructure reliability.\\nNetworking – Cisco / Zyxel / Fortinet / D-Link / Extreme and Aruba Switches configuration, VLAN/IP configuration, Static/Dynamic Routing/Telnet/DHCP.\\nSecurity & Firewalls – Sophos/Fortinet/PF-Sense management, RIP/RIPv2/IPv6, Network troubleshooting.\\nMonitoring & Tools - Cacti/OP Manager, Wireshark, Zabbix.\\nServers & Virtualization - Windows Server 2022 (ADDS/DHCP/WDS), Hyper-V/VMware, MS Office 365, Hardware troubleshooting, OS installation (Windows/Linux).',
    sort_order: 3
  }
];

async function renderExperience() {
  const list = document.getElementById('experienceList');
  if (!list) return;

  const render = rows => {
    list.innerHTML = rows.map(r => {
      const bullets = String(r.description || '')
        .replace(/\\\\n/g, '\\n')
        .split(/\\r?\\n+/)
        .map(x => x.trim())
        .filter(Boolean)
        .map(x => '<li>' + esc(x) + '</li>')
        .join('');

      return '<article class="job">' +
        '<div class="date">' + esc(r.start_date || '') + ' — ' + esc(r.end_date || 'Present') + '</div>' +
        '<div class="jobbox">' +
          '<h3>' + esc(r.position || '') + '</h3>' +
          '<div class="company">' + esc(r.company || '') + (r.location ? ' · ' + esc(r.location) : '') + '</div>' +
          (bullets ? '<ul>' + bullets + '</ul>' : '') +
        '</div>' +
      '</article>';
    }).join('');
  };

  // Render the built-in experience immediately. This prevents a Supabase
  // connection/RLS/network problem from leaving the public section blank.
  render(EXPERIENCE_FALLBACK);

  try {
    const { data, error } = await sb
      .from('experience')
      .select('id,company,position,start_date,end_date,description,sort_order')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Experience database load error:', error);
      return;
    }

    // Replace the fallback only when Supabase successfully returns rows.
    if (Array.isArray(data) && data.length) render(data);
  } catch (error) {
    console.error('Experience load error:', error);
  }
}

const PROJECTS_FALLBACK=[
  {project_name:'IT Infrastructure Setup',role:'GREENFIELD',location:'Pharmaceutical Facility',start_date:'2026',end_date:'Present',description:'End-to-end Greenfield infrastructure setup for a new pharmaceutical facility, including requirements, architecture, BOQ, vendor coordination and server/firewall/network deployment.',sort_order:1},
  {project_name:'Enterprise Network Management',role:'Network Engineer',location:'Enterprise Environments',start_date:'2024',end_date:'Present',description:'Network design, router and switch configuration, VLAN/IP configuration, routing, connectivity troubleshooting and firewall management across enterprise environments.',sort_order:2},
  {project_name:'Network Monitoring',role:'Network Engineer',location:'Enterprise Infrastructure',start_date:'2024',end_date:'Present',description:'Implementation and operational use of Cacti, OP Manager, Wireshark and Zabbix for monitoring and troubleshooting network infrastructure.',sort_order:3},
  {project_name:'Windows Server & Virtualization',role:'IT Infrastructure Engineer',location:'Server Infrastructure',start_date:'2024',end_date:'Present',description:'Windows Server 2022 administration including AD DS, DNS, DHCP and WDS, along with Hyper-V/VMware virtualization support.',sort_order:4}
];

async function renderProjects(){
  const section=document.getElementById('projects');
  const grid=document.getElementById('projectsList') || section?.querySelector('.grid');
  if(!grid)return;
  const render=rows=>{
    const safe=Array.isArray(rows)?rows:[];
    grid.innerHTML=safe.map((r,i)=>'<article class="card project"><div class="num">'+String(i+1).padStart(2,'0')+' / PROJECT</div><h3>'+esc(r.project_name||'')+'</h3>'+(r.role?'<div class="company">'+esc(r.role)+'</div>':'')+(r.location||r.start_date||r.end_date?'<div class="date">'+esc(r.location||'')+(r.location&&(r.start_date||r.end_date)?' • ':'')+esc(r.start_date||'')+(r.start_date||r.end_date?' — ':'')+esc(r.end_date||'')+'</div>':'')+'<ul>'+String(r.description||'').split(/\n+/).filter(Boolean).map(x=>'<li>'+esc(x.trim())+'</li>').join('')+'</ul></article>').join('');
  };
  // Never blank the public section because of a database/RLS failure.
  render(PROJECTS_FALLBACK);
  try{
    const {data,error}=await sb.from('projects').select('project_name,role,location,start_date,end_date,description,sort_order').neq('project_name',CMS).order('sort_order',{ascending:true});
    if(error){console.error('Projects database load error:',error);return}
    if(Array.isArray(data)&&data.length)render(data);
  }catch(error){console.error('Projects load error:',error)}
}
async function media(){const img=document.getElementById('profilePhoto');if(img){const {data}=sb.storage.from('profile-photo').getPublicUrl('profile/profile-photo.webp');img.onload=()=>{img.style.display='block';document.getElementById('avatarFallback')?.style.setProperty('display','none')};img.onerror=()=>{img.style.display='none'};img.src=data.publicUrl+'?t='+Date.now();const {data:s}=await sb.from('profile_settings').select('photo_zoom,photo_x,photo_y').eq('id',1).maybeSingle();if(s)img.style.transform='translate('+((Number(s.photo_x||50)-50)*1.5)+'px,'+((Number(s.photo_y||50)-50)*1.5)+'px) scale('+(Number(s.photo_zoom)||1)+')'}const logo=document.querySelector('.brand img');if(logo&&S.logoPath){const {data}=sb.storage.from('profile-photo').getPublicUrl(S.logoPath);if(data?.publicUrl)logo.src=data.publicUrl+'?t='+Date.now()}}
async function main() {
  // Load the public database sections independently so one CMS/SEO issue
  // cannot prevent Experience or Projects from rendering.
  await Promise.allSettled([
    renderExperience(),
    renderProjects(),
    media()
  ]);

  try {
    await loadSettings();
    apply();
    renderSkills();
    renderEducation();
  } catch (error) {
    console.error('CMS settings error:', error);
  }
}

main();
