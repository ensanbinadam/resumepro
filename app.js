/* Resume Builder — PRO Logic
 * - Premium UI State Management
 * - Toast Notifications
 * - Strict Sanitization
 */

const STORAGE_KEY = "resume_builder_pro_v2_premium";

const defaultOptions = {
  outputLanguage: "ar",
  templateStyle: "clean",
  atsStrictMode: true,
  maxPages: 1,
  emphasis: "experience",
  anonymize: false,
  keywordStrategy: "balanced",
  includePhoto: false
};

// ---------- State Management ----------

function emptyState(){
  return {
    options: {...defaultOptions},
    jobDesc: "",
    resume: {
      meta: {
        language: "ar",
        targetRole: "",
        targetLocation: "",
        seniority: "",
        keywords: [],
        lastUpdated: new Date().toISOString().slice(0,10)
      },
      basics: {
        name: "",
        headline: "",
        email: "",
        phone: "",
        location: "",
        photo: "",
        links: []
      },
      summary: "",
      skills: { core: [], tools: [], soft: [], domains: [] },
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      languages: [],
      coverLetter: { company:"", role:"", hiringManager:"", tone:"professional", custom:"" }
    }
  };
}

function deepMerge(base, patch){
  if (Array.isArray(base)) return Array.isArray(patch) ? patch : base;
  if (base && typeof base === "object") {
    const out = {...base};
    const p = (patch && typeof patch === "object") ? patch : {};
    for (const k of Object.keys(out)) out[k] = deepMerge(out[k], p[k]);
    for (const k of Object.keys(p)) if (!(k in out)) out[k] = p[k];
    return out;
  }
  return (patch === undefined ? base : patch);
}

function normalizeState(maybe){
  const base = emptyState();
  const merged = deepMerge(base, (maybe && typeof maybe === "object") ? maybe : {});
  // Enforce arrays
  const r = merged.resume;
  r.basics.links = Array.isArray(r.basics.links) ? r.basics.links : [];
  r.experience = Array.isArray(r.experience) ? r.experience : [];
  r.projects = Array.isArray(r.projects) ? r.projects : [];
  r.education = Array.isArray(r.education) ? r.education : [];
  r.certifications = Array.isArray(r.certifications) ? r.certifications : [];
  r.languages = Array.isArray(r.languages) ? r.languages : [];
  r.meta.keywords = Array.isArray(r.meta.keywords) ? r.meta.keywords : [];
  return merged;
}

// ---------- Utils ----------
const el = (id) => document.getElementById(id);
const val = (id, v) => { const e = el(id); if(e) e.value = v; }; // Safe setter
const safe = (s) => (s ?? "").toString().trim();
const splitCSV = (s) => (s||"").split(/[,،]+/).map(x=>x.trim()).filter(Boolean);
const uniq = (arr) => [...new Set((arr||[]).map(safe).filter(Boolean))];

function htmlEscape(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function setDirAndLang(lang){
  const isAr = (lang === "ar");
  document.documentElement.lang = isAr ? "ar" : "en";
  document.documentElement.dir = isAr ? "rtl" : "ltr";
}

function downloadFile(filename, content, mime="text/html;charset=utf-8"){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameSafe(name){
  return (name || "candidate")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

// Notification System (Toast)
function showToast(msg, type="info"){
  const container = el("toastContainer");
  if(!container) return;
  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.innerHTML = `
    <span>${type === "success" ? "✅" : (type==="error" ? "❌" : "ℹ️")}</span>
    <span>${htmlEscape(msg)}</span>
  `;
  container.appendChild(div);
  setTimeout(()=>div.remove(), 4000);
}

// ---------- App State ----------
let STATE = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));

function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- UI Logic ----------

function wireTabs(){
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      navItems.forEach(t=>t.classList.remove("active"));
      btn.classList.add("active");
      const name = btn.dataset.tab;
      document.querySelectorAll(".tabpane").forEach(p=>p.classList.remove("show"));
      const target = el("tab-"+name);
      if(target) {
        target.classList.add("show");
        // Scroll to top of editor
        el("tab-"+name).closest(".editor-section").scrollTop = 0;
      }
    });
  });
}

function cardTemplate(title, delAct, idx, innerHTML, moveActPrefix=null){
  const move = moveActPrefix ? `
    <div class="card-actions">
      <button class="btn btn-sm btn-icon" data-act="${moveActPrefix}Up" data-idx="${idx}" title="نقل لأعلى">↑</button>
      <button class="btn btn-sm btn-icon" data-act="${moveActPrefix}Down" data-idx="${idx}" title="نقل لأسفل">↓</button>
    </div>
  ` : "";
  
  return `
    <div class="card-item">
      <div class="card-header">
        <div class="card-title">${title}</div>
        <div class="card-actions">
          ${move}
          <button class="btn btn-sm btn-danger" data-act="${delAct}" data-idx="${idx}">🗑️ حذف</button>
        </div>
      </div>
      ${innerHTML}
    </div>
  `;
}

// Bind Repeatables
function renderLinks(){
  const list = el("linksList");
  const items = STATE.resume.basics.links || [];
  list.innerHTML = items.map((l, idx)=>cardTemplate(`رابط #${idx+1}`, "delLink", idx, `
    <div class="grid-2">
      <div class="field"><label>عنوان الرابط</label><input data-bind="linkLabel" data-idx="${idx}" value="${htmlEscape(l.label||"")}" placeholder="LinkedIn, GitHub..."></div>
      <div class="field"><label>الرابط (URL)</label><input data-bind="linkUrl" data-idx="${idx}" value="${htmlEscape(l.url||"")}" placeholder="https://..."></div>
    </div>
  `)).join("");
}

function renderExperience(){
  const list = el("experienceList");
  const items = STATE.resume.experience || [];
  list.innerHTML = items.map((x, idx)=>cardTemplate(`خبرة #${idx+1}`, "delExp", idx, `
    <div class="grid-2">
      <div class="field"><label>الشركة</label><input data-bind="expCompany" data-idx="${idx}" value="${htmlEscape(x.company||"")}"></div>
      <div class="field"><label>المسمى الوظيفي</label><input data-bind="expRole" data-idx="${idx}" value="${htmlEscape(x.role||"")}"></div>
    </div>
    <div class="grid-2">
       <div class="field"><label>تاريخ البدء</label><input data-bind="expStart" data-idx="${idx}" placeholder="YYYY-MM" value="${htmlEscape(x.startDate||"")}"></div>
       <div class="field"><label>تاريخ الانتهاء</label><input data-bind="expEnd" data-idx="${idx}" placeholder="Present" value="${htmlEscape(x.endDate||"")}"></div>
    </div>
    <div class="field"><label>التقنيات (مفصولة بفواصل)</label><input data-bind="expTech" data-idx="${idx}" value="${htmlEscape((x.tech||[]).join(", "))}"></div>
    <div class="field"><label>الإنجازات (كل سطر نقطة)</label><textarea rows="5" data-bind="expHighlights" data-idx="${idx}">${htmlEscape((x.highlights||[]).join("\n"))}</textarea></div>
  `, "moveExp", idx)).join("");
}

function renderProjects(){
  const list = el("projectsList");
  const items = STATE.resume.projects || [];
  list.innerHTML = items.map((p, idx)=>cardTemplate(`مشروع #${idx+1}`, "delProj", idx, `
    <div class="grid-2">
      <div class="field"><label>اسم المشروع</label><input data-bind="projName" data-idx="${idx}" value="${htmlEscape(p.name||"")}"></div>
      <div class="field"><label>رابط المشروع</label><input data-bind="projLink" data-idx="${idx}" value="${htmlEscape(p.link||"")}"></div>
    </div>
    <div class="field"><label>وصف مختصر (Context)</label><input data-bind="projContext" data-idx="${idx}" value="${htmlEscape(p.context||"")}"></div>
    <div class="field"><label>التقنيات</label><input data-bind="projTech" data-idx="${idx}" value="${htmlEscape((p.tech||[]).join(", "))}"></div>
    <div class="field"><label>التفاصيل (كل سطر نقطة)</label><textarea rows="4" data-bind="projHighlights" data-idx="${idx}">${htmlEscape((p.highlights||[]).join("\n"))}</textarea></div>
  `, "moveProj", idx)).join("");
}

function renderEducation(){
  const list = el("educationList");
  const items = STATE.resume.education || [];
  list.innerHTML = items.map((e, idx)=>cardTemplate(`تعليم #${idx+1}`, "delEdu", idx, `
    <div class="grid-2">
      <div class="field"><label>المؤسسة/الجامعة</label><input data-bind="eduInst" data-idx="${idx}" value="${htmlEscape(e.institution||"")}"></div>
      <div class="field"><label>الدرجة العلمية</label><input data-bind="eduDegree" data-idx="${idx}" value="${htmlEscape(e.degree||"")}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>التخصص</label><input data-bind="eduField" data-idx="${idx}" value="${htmlEscape(e.field||"")}"></div>
      <div class="field"><label>التواريخ</label><input data-bind="eduStart" data-idx="${idx}" placeholder="2018 - 2022" value="${htmlEscape(e.startDate||"")}"></div>
    </div>
    <div class="field"><label>تفاصيل إضافية</label><textarea rows="3" data-bind="eduDetails" data-idx="${idx}">${htmlEscape((e.details||[]).join("\n"))}</textarea></div>
  `)).join("");
}

function renderCerts(){
  const list = el("certsList");
  const items = STATE.resume.certifications || [];
  list.innerHTML = items.map((c, idx)=>cardTemplate(`شهادة #${idx+1}`, "delCert", idx, `
    <div class="grid-2">
      <div class="field"><label>اسم الشهادة</label><input data-bind="certName" data-idx="${idx}" value="${htmlEscape(c.name||"")}"></div>
      <div class="field"><label>الجهة المانحة</label><input data-bind="certIssuer" data-idx="${idx}" value="${htmlEscape(c.issuer||"")}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>التاريخ</label><input data-bind="certDate" data-idx="${idx}" value="${htmlEscape(c.date||"")}"></div>
      <div class="field"><label>الرابط</label><input data-bind="certUrl" data-idx="${idx}" value="${htmlEscape(c.url||"")}"></div>
    </div>
  `)).join("");
}

function renderLangs(){
  const list = el("langsList");
  const items = STATE.resume.languages || [];
  list.innerHTML = items.map((l, idx)=>cardTemplate(`لغة #${idx+1}`, "delLang", idx, `
    <div class="grid-2">
      <div class="field"><label>اللغة</label><input data-bind="langName" data-idx="${idx}" value="${htmlEscape(l.name||"")}" placeholder="English"></div>
      <div class="field"><label>المستوى</label><input data-bind="langLevel" data-idx="${idx}" value="${htmlEscape(l.level||"")}" placeholder="Native / Professional"></div>
    </div>
  `)).join("");
}

function renderAll(){
  renderLinks();
  renderExperience();
  renderProjects();
  renderEducation();
  renderCerts();
  renderLangs();
  renderKeywordChips();
}

function onRepeatableInput(e){
  const t = e.target;
  if (!t || !t.dataset || !t.dataset.bind) return;
  const idx = Number(t.dataset.idx);
  const bind = t.dataset.bind;
  const r = STATE.resume;

  if (bind==="linkLabel") r.basics.links[idx].label = safe(t.value);
  if (bind==="linkUrl") r.basics.links[idx].url = safe(t.value);

  if (bind==="expCompany") r.experience[idx].company = safe(t.value);
  if (bind==="expRole") r.experience[idx].role = safe(t.value);
  if (bind==="expStart") r.experience[idx].startDate = safe(t.value);
  if (bind==="expEnd") r.experience[idx].endDate = safe(t.value);
  if (bind==="expTech") r.experience[idx].tech = splitCSV(t.value);
  if (bind==="expHighlights") r.experience[idx].highlights = (t.value||"").split("\n").map(x=>x.trim()).filter(Boolean);

  if (bind==="projName") r.projects[idx].name = safe(t.value);
  if (bind==="projLink") r.projects[idx].link = safe(t.value);
  if (bind==="projContext") r.projects[idx].context = safe(t.value);
  if (bind==="projTech") r.projects[idx].tech = splitCSV(t.value);
  if (bind==="projHighlights") r.projects[idx].highlights = (t.value||"").split("\n").map(x=>x.trim()).filter(Boolean);

  if (bind==="eduInst") r.education[idx].institution = safe(t.value);
  if (bind==="eduDegree") r.education[idx].degree = safe(t.value);
  if (bind==="eduField") r.education[idx].field = safe(t.value);
  if (bind==="eduStart") r.education[idx].startDate = safe(t.value);
  if (bind==="eduDetails") r.education[idx].details = (t.value||"").split("\n").map(x=>x.trim()).filter(Boolean);

  if (bind==="certName") r.certifications[idx].name = safe(t.value);
  if (bind==="certIssuer") r.certifications[idx].issuer = safe(t.value);
  if (bind==="certDate") r.certifications[idx].date = safe(t.value);
  if (bind==="certUrl") r.certifications[idx].url = safe(t.value);

  if (bind==="langName") r.languages[idx].name = safe(t.value);
  if (bind==="langLevel") r.languages[idx].level = safe(t.value);

  saveState(STATE);
}

function moveItem(arr, from, to){
  if (to < 0 || to >= arr.length) return;
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
}

function onRepeatableClick(e){
  const btn = e.target.closest("button");
  if (!btn || !btn.dataset || !btn.dataset.act) return;
  const idx = Number(btn.dataset.idx);
  const act = btn.dataset.act;
  const r = STATE.resume;

  const refresh = () => { saveState(STATE); renderAll(); };

  if (act==="delLink") { r.basics.links.splice(idx,1); refresh(); return; }
  if (act==="delExp") { r.experience.splice(idx,1); refresh(); return; }
  if (act==="delProj") { r.projects.splice(idx,1); refresh(); return; }
  if (act==="delEdu") { r.education.splice(idx,1); refresh(); return; }
  if (act==="delCert") { r.certifications.splice(idx,1); refresh(); return; }
  if (act==="delLang") { r.languages.splice(idx,1); refresh(); return; }

  // Moves
  if (act==="moveExpUp") { moveItem(r.experience, idx, idx-1); refresh(); return; }
  if (act==="moveExpDown") { moveItem(r.experience, idx, idx+1); refresh(); return; }
  if (act==="moveProjUp") { moveItem(r.projects, idx, idx-1); refresh(); return; }
  if (act==="moveProjDown") { moveItem(r.projects, idx, idx+1); refresh(); return; }
}


// ---------- Main Form Sync ----------
function fillUI(){
  const o = STATE.options;
  const r = STATE.resume;

  val("optLanguage", o.outputLanguage);
  val("optTemplateStyle", o.templateStyle);
  val("optATSStrict", String(o.atsStrictMode));
  val("optMaxPages", String(o.maxPages));
  val("optEmphasis", o.emphasis);
  val("optAnonymize", String(o.anonymize));
  val("optKeywordStrategy", o.keywordStrategy);
  val("optIncludePhoto", String(o.includePhoto));
  
  el("jobDesc").value = STATE.jobDesc || "";

  el("inName").value = r.basics.name || "";
  el("inHeadline").value = r.basics.headline || "";
  el("inEmail").value = r.basics.email || "";
  el("inPhone").value = r.basics.phone || "";
  el("inLocation").value = r.basics.location || "";
  el("inTargetRole").value = r.meta.targetRole || "";
  el("inSummary").value = r.summary || "";

  el("inSkillsCore").value = (r.skills.core||[]).join(", ");
  el("inSkillsTools").value = (r.skills.tools||[]).join(", ");
  el("inSkillsSoft").value = (r.skills.soft||[]).join(", ");
  el("inSkillsDomains").value = (r.skills.domains||[]).join(", ");

  el("clCompany").value = r.coverLetter.company || "";
  el("clRole").value = r.coverLetter.role || "";
  el("clHiringManager").value = r.coverLetter.hiringManager || "";
  el("clTone").value = r.coverLetter.tone || "professional";
  el("clCustom").value = r.coverLetter.custom || "";

  setDirAndLang(o.outputLanguage);
  renderAll();
}

function collectFromUI(){
  // Gather non-repeatable inputs
  STATE.options.outputLanguage = el("optLanguage")?.value || "ar";
  STATE.options.templateStyle = el("optTemplateStyle")?.value || "clean";
  STATE.options.atsStrictMode = el("optATSStrict")?.value === "true";
  STATE.options.maxPages = Number(el("optMaxPages")?.value || 1);
  STATE.options.emphasis = el("optEmphasis")?.value || "experience";
  STATE.options.anonymize = el("optAnonymize")?.value === "true";
  STATE.options.keywordStrategy = el("optKeywordStrategy")?.value || "balanced";
  STATE.options.includePhoto = el("optIncludePhoto")?.value === "true";
  
  STATE.jobDesc = el("jobDesc").value;

  const r = STATE.resume;
  r.meta.language = STATE.options.outputLanguage;
  r.meta.targetRole = safe(el("inTargetRole").value);
  
  r.basics.name = safe(el("inName").value);
  r.basics.headline = safe(el("inHeadline").value);
  r.basics.email = safe(el("inEmail").value);
  r.basics.phone = safe(el("inPhone").value);
  r.basics.location = safe(el("inLocation").value);
  r.summary = safe(el("inSummary").value);

  r.skills.core = splitCSV(el("inSkillsCore").value);
  r.skills.tools = splitCSV(el("inSkillsTools").value);
  r.skills.soft = splitCSV(el("inSkillsSoft").value);
  r.skills.domains = splitCSV(el("inSkillsDomains").value);

  r.coverLetter.company = safe(el("clCompany").value);
  r.coverLetter.role = safe(el("clRole").value);
  r.coverLetter.hiringManager = safe(el("clHiringManager").value);
  r.coverLetter.tone = el("clTone").value;
  r.coverLetter.custom = safe(el("clCustom").value);

  saveState(STATE);
  renderKeywordChips();
}

// ---------- ATS & Analysis ----------
function extractKeywords(text){
  const t=(text||"").toLowerCase();
  const raw=t.replace(/[^\p{L}\p{N}\s+#.-]/gu," ").split(/\s+/).map(x=>x.trim()).filter(x=>x.length>=3);
  const stop=new Set(["the","and","for","with","you","your","are","our","from","that","this","will","have","can","skills","work","team","join","year","years",
    "من","في","عن","على","الى","إلى","مع","هذا","ان","أن","لا","ما","هو","هي","هم"]);
  const freq=new Map();
  raw.forEach(w=>{
    if(!stop.has(w) && !/^\d+$/.test(w)) freq.set(w, (freq.get(w)||0)+1);
  });
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,35);
}

function renderKeywordChips(){
  const host = el("kwChips");
  if(!host) return;
  host.innerHTML = "";
  (STATE.resume.meta.keywords||[]).forEach(k=>{
    const span=document.createElement("span");
    span.className="chip";
    span.textContent=k;
    host.appendChild(span);
  });
}

function computeATSReport(r, jobDesc){
  let score = 100;
  const warn = [];
  
  if(!r.basics.name) { score-=10; warn.push("الاسم الكامل مفقود"); }
  if(!r.basics.email) { score-=5; warn.push("البريد الإلكتروني مفقود"); }
  if(!r.summary || r.summary.length<50) { score-=10; warn.push("الملخص قصير جداً أو مفقود"); }
  if(!r.experience.length) { score-=20; warn.push("لا توجد خبرات مسجلة"); }
  
  const skillsCount = r.skills.core.length + r.skills.tools.length + r.skills.soft.length + r.skills.domains.length;
  if(skillsCount<5) { score-=10; warn.push("المهارات المسجلة قليلة جداً"); }

  // Job Match
  if(jobDesc && jobDesc.length>20){
     const jdWords = extractKeywords(jobDesc);
     const resumeText = JSON.stringify(r).toLowerCase();
     let match = 0;
     jdWords.forEach(w=>{
       if(resumeText.includes(w)) match++;
     });
     const ratio = match / Math.max(1, jdWords.length);
     if(ratio < 0.3) { score-=15; warn.push("تطابق الكلمات المفتاحية ضعيف مع الوصف الوظيفي"); }
  }

  score = Math.max(0, score);
  return {score, warn};
}

function updateATSPanel(){
  const rep = computeATSReport(STATE.resume, STATE.jobDesc);
  const host = el("atsReport");
  if(!host) return;
  
  const level = rep.score >= 80 ? "score-good" : (rep.score >= 50 ? "score-warn" : "score-bad");
  
  let html = `<div style="display:flex; justify-content:space-between; align-items:center;">
    <span class="score-badge ${level}">ATS Score: ${rep.score}/100</span>
  </div>`;
  
  if(rep.warn.length){
    html += `<ul style="margin:10px 0 0; padding-inline-start:20px; color:var(--text-muted); font-size:13px;">
      ${rep.warn.map(w=>`<li>${w}</li>`).join("")}
    </ul>`;
  } else {
    html += `<div style="margin-top:10px; font-size:13px; color:var(--success);">✅ السيرة الذاتية تبدو ممتازة!</div>`;
  }
  
  host.innerHTML = html;
}


// ---------- Preview Generators (Simplified Injection) ----------
// Using the same printing logic but cleaner injection

function buildHTML(type, state){
  const {resume, options} = state;
  // This function would contain the massive CSS/HTML generation logic
  // For brevity in this artifact, I will call the logic "Standard"
  // In a real app we would have modular generators. 
  // I will re-implement a robust generator here.
  
  const isAr = options.outputLanguage === "ar";
  const dir = isAr ? "rtl" : "ltr";
  
  // Choose Colors based on template
  let accent = "#4f46e5";
  if(options.templateStyle === "modern") accent = "#8b5cf6";
  if(options.templateStyle === "minimal") accent = "#334155";

  // Shared CSS
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600&display=swap');
    :root { --accent: ${accent}; --text: #1f2937; --muted: #6b7280; --line: #e5e7eb; }
    body { font-family: 'Inter', 'Cairo', sans-serif; color: var(--text); padding: 0; margin: 0; background: #fff; line-height: 1.5; }
    a { text-decoration: none; color: var(--accent); }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 28px; margin: 0; color: var(--accent); }
    h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); border-bottom: 2px solid var(--line); padding-bottom: 6px; margin: 24px 0 12px; }
    .job-title { font-size: 14px; font-weight: 600; margin-top: 4px; color: var(--muted); }
    .row { display: flex; justify-content: space-between; align-items: baseline; }
    .meta { font-size: 12px; color: var(--muted); }
    ul { padding-inline-start: 18px; margin: 6px 0; }
    li { margin-bottom: 4px; font-size: 13px; }
    .tag { display: inline-block; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 2px; }
    .contact-line { font-size: 13px; margin-top: 8px; display: flex; gap: 12px; flex-wrap: wrap; color: var(--muted); }
    @media print { .page { padding: 0; margin: 20px; } body { -webkit-print-color-adjust: exact; } }
  `;

  let body = "";
  
  if(type === "ats" || type === "cv"){
    // Header
    const basics = resume.basics;
    body += `
      <header style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
        ${options.includePhoto && basics.photo ? `<img src="${basics.photo}" alt="Profile" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent);">` : ""}
        <div>
          <h1>${htmlEscape(basics.name)}</h1>
          <div class="job-title">${htmlEscape(basics.headline)}</div>
          <div class="contact-line">
            ${basics.email ? `<span>📧 ${htmlEscape(basics.email)}</span>` : ""}
            ${basics.phone ? `<span>📱 ${htmlEscape(basics.phone)}</span>` : ""}
            ${basics.location ? `<span>📍 ${htmlEscape(basics.location)}</span>` : ""}
            ${(basics.links||[]).map(l=>`<a href="${l.url}">${htmlEscape(l.label||"Link")}</a>`).join(" • ")}
          </div>
        </div>
      </header>
    `;

    // Summary
    if(resume.summary) body += `<section><h2>${isAr?"الملخص المهني":"Summary"}</h2><p style="font-size:13px">${htmlEscape(resume.summary)}</p></section>`;

    // Experience
    if(resume.experience.length){
      body += `<section><h2>${isAr?"الخبرة المهنية":"Experience"}</h2>`;
      resume.experience.forEach(x=>{
        body += `
          <div style="margin-bottom:16px;">
            <div class="row">
              <strong style="font-size:15px;">${htmlEscape(x.role)}</strong>
              <span class="meta">${htmlEscape(x.startDate)} — ${htmlEscape(x.endDate)}</span>
            </div>
            <div class="row">
              <span style="font-size:14px; color:#4b5563;">${htmlEscape(x.company)}</span>
              <span class="meta">${htmlEscape(x.location)}</span>
            </div>
            ${x.highlights.length ? `<ul>${x.highlights.map(h=>`<li>${htmlEscape(h)}</li>`).join("")}</ul>` : ""}
            ${x.tech && x.tech.length ? `<div style="margin-top:4px; font-size:12px;">🛠 ${x.tech.map(t=>`<span class="tag">${htmlEscape(t)}</span>`).join(" ")}</div>` : ""}
          </div>
        `;
      });
      body += `</section>`;
    }

    // Projects
    if(resume.projects.length){
      body += `<section><h2>${isAr?"المشاريع":"Projects"}</h2>`;
      resume.projects.forEach(p=>{
        body += `
          <div style="margin-bottom:12px;">
            <div class="row">
              <strong style="font-size:14px;">${htmlEscape(p.name)} ${p.link?`<a href="${p.link}" style="font-size:12px;">↗</a>`:""}</strong>
            </div>
            <div style="font-size:13px; margin-bottom:4px;">${htmlEscape(p.context)}</div>
            ${p.highlights.length ? `<ul>${p.highlights.map(h=>`<li>${htmlEscape(h)}</li>`).join("")}</ul>` : ""}
          </div>
        `;
      });
      body += `</section>`;
    }

    // Skills
    const allSkills = [...(resume.skills.core || []), ...(resume.skills.tools || []), ...(resume.skills.soft || []), ...(resume.skills.domains || [])];
    if(allSkills.length){
      body += `<section><h2>${isAr?"المهارات":"Skills"}</h2>`;
      body += `<div>${allSkills.map(s=>`<span class="tag">${htmlEscape(s)}</span>`).join(" ")}</div>`;
      body += `</section>`;
    }

    // Education
    if(resume.education.length){
      body += `<section><h2>${isAr?"التعليم":"Education"}</h2>`;
      resume.education.forEach(e=>{
        body += `
          <div style="margin-bottom:8px;">
            <div class="row">
              <strong>${htmlEscape(e.institution)}</strong>
              <span class="meta">${htmlEscape(e.startDate)} - ${htmlEscape(e.endDate)}</span>
            </div>
            <div style="font-size:13px;">${htmlEscape(e.degree)} ${e.field?`in ${htmlEscape(e.field)}`:""}</div>
          </div>
        `;
      });
      body += `</section>`;
    }
  } 
  else if (type === "cover") {
    // Simple Cover Letter logic
    const cl = resume.coverLetter;
    body += `
      <header style="border-bottom: 2px solid var(--line); padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="font-size:24px;">${htmlEscape(resume.basics.name)}</h1>
        <div class="contact-line">${htmlEscape(resume.basics.email)} | ${htmlEscape(resume.basics.phone)}</div>
      </header>
      <div style="margin-bottom: 30px; font-size: 14px; color: var(--muted);">
        <div>${new Date().toDateString()}</div>
        <div style="margin-top:10px;"><strong>To:</strong> ${htmlEscape(cl.hiringManager || "Hiring Manager")}</div>
        <div>${htmlEscape(cl.company)}</div>
      </div>
      <div style="font-size: 14px; line-height: 1.8;">
        <p>Dear ${htmlEscape(cl.hiringManager || "Hiring Team")},</p>
        <p>I am writing to express my interest in the <strong>${htmlEscape(cl.role)}</strong> position at ${htmlEscape(cl.company)}.</p>
        <p>${htmlEscape(cl.custom || "I believe my skills and background make me a strong candidate for this role.")}</p>
        <p>Thank you for your time and consideration.</p>
        <br>
        <p>Sincerely,</p>
        <p><strong>${htmlEscape(resume.basics.name)}</strong></p>
      </div>
    `;
  }

  return `<!doctype html><html lang="${isAr?"ar":"en"}" dir="${dir}"><head><meta charset="utf-8"><title>Preview</title><style>${css}</style></head><body><div class="page">${body}</div></body></html>`;
}

// ---------- Main Wiring ----------

function updatePreview(type){
  const html = buildHTML(type || "ats", STATE);
  el("previewFrame").srcdoc = html;
  updateATSPanel();
}

function wireEvents(){
  // Auto-save input bindings
  document.body.addEventListener("input", (e)=>{
    if(e.target.matches("input, textarea, select")){
      collectFromUI();
      // Debounce preview update slightly
      if(window._previewTimer) clearTimeout(window._previewTimer);
      window._previewTimer = setTimeout(()=>updatePreview("ats"), 500); 
    }
  });

  const photoInput = el("inPhoto");
  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) {
        STATE.resume.basics.photo = "";
        saveState(STATE);
        updatePreview("ats");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compress the image so it fits within LocalStorage limits
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; // max width/height
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          
          try {
            STATE.resume.basics.photo = compressed;
            saveState(STATE);
            updatePreview("ats");
            showToast("تم إضافة الصورة بنجاح", "success");
          } catch (e) {
            console.error(e);
            showToast("الصورة لا تزال كبيرة جداً على ذاكرة المتصفح", "error");
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Buttons
  el("btnNew").addEventListener("click", ()=>{
    if(confirm("هل أنت متأكد؟ سيتم مسح جميع البيانات الحالية.")){
      STATE = emptyState();
      saveState(STATE);
      fillUI();
      showToast("تم إنشاء سيرة ذاتية جديدة", "success");
    }
  });

  el("btnLoadSample").addEventListener("click", ()=>{
    if(confirm("تحميل مثال سيستبدل بياناتك الحالية. هل تود المتابعة؟")){
      // Rich Sample Data
      STATE = normalizeState({
        options: {...defaultOptions, outputLanguage:"ar", templateStyle:"modern", atsStrictMode:true, emphasis:"projects"},
        jobDesc: "نبحث عن قائد تقني (Tech Lead) لقيادة فريق تطوير الواجهات، يمتلك خبرة عميقة في React و System Design، وقادر على توجيه المطورين وتحسين أداء التطبيقات الكبيرة.",
        resume: {
          meta: { 
            keywords:["React","System Design","Leadership","Performance Optimization","CI/CD","TypeScript","Next.js","GraphQL","Testing","Mentorship","Architecture","Cloud","Agile"], 
            targetRole:"Senior Frontend Engineer / Tech Lead",
            language: "ar"
          },
          basics: {
            name: "سعود العتيبي",
            headline: "Tech Lead | Senior Frontend Engineer | React & Next.js Expert",
            email: "saud.otb@example.com",
            phone: "+966 50 123 4567",
            location: "الرياض، المملكة العربية السعودية",
            links: [
              {label: "LinkedIn", url: "https://linkedin.com/in/saud-example"},
              {label: "GitHub", url: "https://github.com/saud-code"},
              {label: "Portfolio", url: "https://saud.dev"},
              {label: "Tech Blog", url: "https://blog.saud.dev"}
            ]
          },
          summary: "قائد تقني ومطور واجهات بخبرة تزيد عن 8 سنوات في بناء تطبيقات ويب معقدة وقابلة للتوسع. لدي سجل حافل في قيادة الفرق التقنية، وتحسين أداء التطبيقات بنسبة تزيد عن 40%، وهندسة أنظمة frontend قوية باستخدام React و Next.js. شغوف بمشاركة المعرفة وتطبيق أفضل ممارسات هندسة البرمجيات (Clean Code, Testing, CI/CD).",
          skills: {
            core: ["JavaScript (ES6+)", "TypeScript", "React.js", "Next.js", "HTML5", "CSS3 / SCSS"],
            tools: ["Webpack", "Vite", "Jest / Vitest", "Cypress", "Git & GitHub", "Docker", "JIRA"],
            soft: ["القيادة التقنية", "التواصل الفعال", "حل المشكلات المعقدة", "توجيه الأعضاء (Mentorship)", "إدارة الوقت"],
            domains: ["E-commerce", "SaaS Platforms", "Fintech", "Real-time Dashboards"]
          },
          experience: [
            {
              company: "شركة الحلول المتقدمة (Tech Solutions)",
              role: "Tech Lead - Frontend",
              location: "الرياض (عن بعد)",
              startDate: "2023-01",
              endDate: "Present",
              tech: ["Next.js", "TypeScript", "TailwindCSS", "AWS"],
              highlights: [
                "قيادة فريق مكون من 6 مطورين لبناء منصة SaaS لإدارة الموارد البشرية، تخدم أكثر من 500 شركة.",
                "إعادة هيكلة الكود (Refactoring) لتقليل الديون التقنية، مما أدى لزيادة سرعة التطوير بنسبة 30%.",
                "تصميم وتنفيذ نظام تصميم (Design System) موحد باستخدام Storybook، مما وحد هوية المنتجات.",
                "تحسين مؤشرات أداء الويب (Core Web Vitals) لتصبح ضمن المنطقة الخضراء (LCP < 2.5s)."
              ]
            },
            {
              company: "منصة تجارة (E-Shop)",
              role: "Senior Frontend Developer",
              location: "دبي، الإمارات",
              startDate: "2020-03",
              endDate: "2022-12",
              tech: ["React", "Redux", "GraphQL", "Node.js"],
              highlights: [
                "تطوير واجهة المتجر الإلكتروني باستخدام React و Redux Toolkit مع دعم كامل للغة العربية (RTL).",
                "دمج بوابات الدفع (Stripe, HyperPay) وتحسين تجربة الـ Checkout لرفع معدل التحويل بنسبة 15%.",
                "كتابة اختبارات شاملة (Unit & Integration Tests) تغطي 85% من الكود الأساسي.",
                "التطبيق مبني بأسلوب Micro-frontends لتسهيل التوسع المستقبلي."
              ]
            },
            {
              company: "ستارتب كود (Startup Code)",
              role: "Frontend Developer",
              location: "الرياض",
              startDate: "2018-06",
              endDate: "2020-02",
              tech: ["Vue.js", "JavaScript", "Firebase"],
              highlights: [
                "بناء لوحات تحكم تفاعلية للمسؤولين لعرض التقارير والتحليلات.",
                "تحويل التصاميم من Figma إلى كود متجاوب (Responsive) يعمل على جميع الأجهزة.",
                "المساهمة في بناء API باستخدام Node.js و Express."
              ]
            }
          ],
          projects: [
            {
              name: "نظام إدارة المهام الذكي (TaskFlow)",
              link: "https://taskflow.demo",
              context: "مشروع مفتوح المصدر لإدارة المشاريع مع ميزات الذكاء الاصطناعي.",
              tech: ["React", "AI Integration", "Supabase"],
              highlights: [
                "يستخدم OpenAI API لاقتراح تقسيم المهام وكتابة الوصف.",
                "يدعم السحب والإفلات (Drag & Drop) وتنظيم المهام بأسلوب Kanban.",
                "حصل على أكثر من 500 نجمة على GitHub."
              ]
            },
            {
              name: "مكتبة مكونات عربية (ArabUI)",
              link: "https://npm.im/arabui",
              context: "مكتبة React UI Components مصممة خصيصاً لدعم RTL.",
              tech: ["React", "Rollup", "NPM"],
              highlights: [
                "توفير أكثر من 30 مكون جاهز للاستخدام يدعم اللغتين العربية والإنجليزية.",
                "حزمة خفيفة الوزن (Tree-shakable) وسهلة التخصيص."
              ]
            }
          ],
          education: [
            {
              institution: "جامعة الملك سعود",
              degree: "بكالوريوس علوم الحاسب (Computer Science)",
              field: "نظم المعلومات",
              startDate: "2014",
              endDate: "2018",
              details: ["مشروع التخرج: نظام تتبع الحضور باستخدام تقنية التعرف على الوجه.", "معدل تراكمي: 4.5/5"]
            }
          ],
          certifications: [
            {name: "AWS Certified Solutions Architect - Associate", issuer: "Amazon Web Services", date: "2023-05", url: "https://aws.amazon.com/verify"},
            {name: "Meta Frontend Developer Professional Certificate", issuer: "Coursera / Meta", date: "2022-08", url: ""}
          ],
          languages: [
            {name: "العربية", level: "اللغة الأم (Native)"},
            {name: "الإنكليزية", level: "احترافي (Professional / C1)"}
          ],
          coverLetter: {
            company: "شركة نيوم التقنية",
            role: "Senior Engineering Manager",
            hiringManager: "أستاذ عبدالله",
            tone: "confident",
            custom: "أتابع بشغف كبير التطورات الهائلة التي تقودها نيوم في مجال التقنية والمدن الذكية. أؤمن أن خبرتي في بناء الأنظمة القابلة للتوسع وقيادة الفرق التقنية ستكون إضافة قيمة لمشروع The Line."
          }
        }
      });
      
      saveState(STATE);
      fillUI();
      updatePreview("ats");
      showToast("تم تحميل بيانات تجريبية شاملة ✅", "success");
    }
  });

  el("btnExportJSON").addEventListener("click", ()=>{
    const str = JSON.stringify(STATE, null, 2);
    downloadFile(`resume_${filenameSafe(STATE.resume.basics.name)}.json`, str, "application/json");
    showToast("تم تصدير ملف JSON", "success");
  });

  el("fileImport").addEventListener("change", async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    try {
      const text = await f.text();
      STATE = normalizeState(JSON.parse(text));
      saveState(STATE);
      fillUI();
      showToast("تم استيراد البيانات بنجاح", "success");
    } catch {
      showToast("خطأ في قراءة ملف JSON", "error");
    }
    e.target.value = "";
  });
  
  el("btnExtractKeywords").addEventListener("click", ()=>{
    const desc = el("jobDesc").value;
    if(!desc) return showToast("الرجاء لصق الوصف الوظيفي أولاً", "info");
    const kws = extractKeywords(desc);
    STATE.resume.meta.keywords = kws;
    renderKeywordChips();
    updatePreview("ats");
    showToast(`تم استخراج ${kws.length} كلمة مفتاحية`, "success");
  });

  // Add Item Buttons
  el("btnAddLink").addEventListener("click", ()=>{ STATE.resume.basics.links.push({label:"",url:""}); renderLinks(); });
  el("btnAddExperience").addEventListener("click", ()=>{ STATE.resume.experience.push({company:"",role:"",startDate:"",endDate:"",highlights:[],tech:[]}); renderExperience(); });
  el("btnAddProject").addEventListener("click", ()=>{ STATE.resume.projects.push({name:"",link:"",context:"",highlights:[],tech:[]}); renderProjects(); });
  el("btnAddEducation").addEventListener("click", ()=>{ STATE.resume.education.push({institution:"",degree:"",startDate:"",endDate:"",details:[]}); renderEducation(); });
  el("btnAddCert").addEventListener("click", ()=>{ STATE.resume.certifications.push({name:"",issuer:"",date:"",url:""}); renderCerts(); });
  el("btnAddLang").addEventListener("click", ()=>{ STATE.resume.languages.push({name:"",level:""}); renderLangs(); });

  // Preview Switchers
  el("btnPreviewATS").addEventListener("click", ()=>updatePreview("ats"));
  el("btnPreviewCV").addEventListener("click", ()=>updatePreview("cv"));
  el("btnPreviewCL").addEventListener("click", ()=>updatePreview("cover"));

  // Download All
  el("btnDownloadAll").addEventListener("click", ()=>{
    showToast("جاري تحضير الملفات...", "info");
    const baseName = filenameSafe(STATE.resume.basics.name);
    
    // 1. Download Resume HTML (Preferred format)
    const htmlATS = buildHTML("ats", STATE);
    downloadFile(`${baseName}_ATS.html`, htmlATS);
    
    setTimeout(()=>{
        const htmlCV = buildHTML("cv", STATE);
        downloadFile(`${baseName}_Creative.html`, htmlCV);
    }, 500);
    
    setTimeout(()=>{
        const htmlCL = buildHTML("cover", STATE);
        downloadFile(`${baseName}_CoverLetter.html`, htmlCL);
    }, 1000);

    setTimeout(()=>{
        const json = JSON.stringify(STATE, null, 2);
        downloadFile(`${baseName}_data.json`, json, "application/json");
        showToast("✅ تم تنزيل جميع الملفات");
    }, 1500);
  });

  // Print PDF for Current Preview
  el("btnDownloadPDF").addEventListener("click", ()=>{
    const iframe = el("previewFrame");
    if(iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  });
} 

// Initial Load
document.addEventListener("DOMContentLoaded", ()=>{
  wireTabs();
  fillUI();
  updateATSPanel(); // Initial check
  updatePreview("ats");
  wireEvents();
  
  // Delegate clicks for Repeatable deletions/moves
  ["linksList","experienceList","projectsList","educationList","certsList","langsList"].forEach(id=>{
    el(id).addEventListener("click", onRepeatableClick);
    el(id).addEventListener("input", onRepeatableInput); // delegation for inputs inside repeatables
  });
});
