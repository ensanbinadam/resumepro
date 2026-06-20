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
    for (const k of Object.keys(p)) if (!BLOCKED_MERGE_KEYS.has(k) && !(k in out)) out[k] = p[k];
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
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const BLOCKED_MERGE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function localizeDateLabel(value, isAr){
  const text = safe(value);
  if (!text) return "";
  if (!isAr) return text;
  const currentLabels = ["present", "current", "now", "ongoing", "حتى الآن", "الحالي"];
  return currentLabels.includes(text.toLocaleLowerCase()) ? "حتى الآن" : text;
}

function formatDateRange(startDate, endDate, isAr=false){
  const start = localizeDateLabel(startDate, isAr);
  const end = localizeDateLabel(endDate, isAr);
  if (start && end) return `${start} — ${end}`;
  return start || end;
}

function formatEducationCredential(education, isAr){
  const degree = safe(education?.degree);
  const field = safe(education?.field);
  if (!degree) return field;
  if (!field) return degree;

  const normalizedDegree = degree.toLocaleLowerCase();
  const normalizedField = field.toLocaleLowerCase();
  if (normalizedDegree.includes(normalizedField)) return degree;

  if (isAr) {
    if (/(^|\s)(في|in)\s*$/i.test(degree)) return `${degree} ${field}`;
    if (/(^|\s)(في|in)(\s|$)/i.test(degree)) return `${degree} - ${field}`;
    return `${degree} في ${field}`;
  }

  if (/\bin\s*$/i.test(degree)) return `${degree} ${field}`;
  if (/\bin\b/i.test(degree)) return `${degree} - ${field}`;
  return `${degree} in ${field}`;
}

function wordCount(text){
  return (safe(text).match(/[\p{L}\p{N}+#.-]+/gu) || []).length;
}

function cleanList(items){
  return (items || []).map(safe).filter(Boolean);
}

function joinNonEmpty(parts, separator=" | "){
  return cleanList(parts).join(separator);
}

function normalizeForSearch(text){
  return safe(text).toLocaleLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه");
}

function resumeTextForMatching(r){
  return [
    r.basics?.headline,
    r.basics?.location,
    r.summary,
    ...(r.skills?.core || []),
    ...(r.skills?.tools || []),
    ...(r.skills?.soft || []),
    ...(r.skills?.domains || []),
    ...(r.experience || []).flatMap(x=>[x.company, x.role, x.location, ...(x.highlights || []), ...(x.tech || [])]),
    ...(r.projects || []).flatMap(p=>[p.name, p.context, ...(p.highlights || []), ...(p.tech || [])]),
    ...(r.education || []).flatMap(e=>[e.institution, e.degree, e.field, ...(e.details || [])]),
    ...(r.certifications || []).flatMap(c=>[c.name, c.issuer]),
    ...(r.languages || []).flatMap(l=>[l.name, l.level])
  ].join(" ");
}

function hasAnyValue(values){
  return values.some(value=>Array.isArray(value) ? cleanList(value).length : Boolean(safe(value)));
}

function getExperienceEntries(r){
  return (r.experience || []).filter(x=>hasAnyValue([x.company, x.role, x.location, x.startDate, x.endDate, x.highlights, x.tech]));
}

function getProjectEntries(r){
  return (r.projects || []).filter(p=>hasAnyValue([p.name, p.link, p.context, p.highlights, p.tech]));
}

function getEducationEntries(r){
  return (r.education || []).filter(e=>hasAnyValue([e.institution, e.degree, e.field, e.startDate, e.endDate, e.details]));
}

function getCertificationEntries(r){
  return (r.certifications || []).filter(c=>hasAnyValue([c.name, c.issuer, c.date, c.url]));
}

function getLanguageEntries(r){
  return (r.languages || []).filter(l=>hasAnyValue([l.name, l.level]));
}

function htmlEscape(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function attrEscape(s){
  return htmlEscape(s).replaceAll("`", "&#096;");
}

function safeUrl(url){
  let raw = safe(url);
  if(!raw) return "";
  if(/^www\./i.test(raw)) raw = `https://${raw}`;
  if(/^[\p{L}\p{N}.-]+\.[a-z]{2,}(?:[/:?#]|$)/iu.test(raw) && !/^[a-z][a-z\d+.-]*:/i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const parsed = new URL(raw);
    if(["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) {
      return attrEscape(parsed.href);
    }
  } catch {}
  return "";
}

function safeImageSrc(src){
  const raw = safe(src);
  if(!raw) return "";
  if(/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw)) {
    return attrEscape(raw.replace(/\s/g, ""));
  }
  try {
    const parsed = new URL(raw, window.location.href);
    if(["http:", "https:"].includes(parsed.protocol)) return attrEscape(parsed.href);
  } catch {}
  return "";
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
function loadState(){
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizeState(stored ? JSON.parse(stored) : null);
  } catch (error) {
    console.warn("Saved resume data could not be loaded.", error);
    return emptyState();
  }
}

let STATE = loadState();

function saveState(state){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save resume data.", error);
    showToast("تعذر حفظ البيانات محلياً. قد تكون مساحة المتصفح ممتلئة.", "error");
    return false;
  }
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
      <div class="field"><label>تاريخ البدء</label><input data-bind="eduStart" data-idx="${idx}" placeholder="2018" value="${htmlEscape(e.startDate||"")}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>تاريخ الانتهاء</label><input data-bind="eduEnd" data-idx="${idx}" placeholder="2022" value="${htmlEscape(e.endDate||"")}"></div>
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
  if (bind==="eduEnd") r.education[idx].endDate = safe(t.value);
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

  const refresh = () => { saveState(STATE); renderAll(); updatePreview(CURRENT_PREVIEW); };

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
function extractKeywords(text, limit=35){
  const t=(text||"").toLowerCase();
  const raw=t.replace(/[^\p{L}\p{N}\s+#.-]/gu," ").split(/\s+/).map(x=>x.trim()).filter(x=>x.length>=3);
  const stop=new Set(["the","and","for","with","you","your","are","our","from","that","this","will","have","can","skills","work","team","join","year","years",
    "role","candidate","required","preferred","using","able","ability","responsible","including","based",
    "من","في","عن","على","الى","إلى","مع","هذا","هذه","ذلك","تلك","الذي","التي","ان","أن","لا","ما","هو","هي","هم","أو","او","كل","كما","لدى","ضمن","غير","بين","يجب","نبحث","مطلوب"]);
  const freq=new Map();
  raw.forEach(w=>{
    const normalized = normalizeForSearch(w);
    if(!stop.has(normalized) && !/^\d+$/.test(normalized)) freq.set(normalized, (freq.get(normalized)||0)+1);
  });
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,limit);
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

function getSkillList(r){
  return [
    ...(r.skills.core || []),
    ...(r.skills.tools || []),
    ...(r.skills.soft || []),
    ...(r.skills.domains || [])
  ].map(safe).filter(Boolean);
}

function getDuplicateSkills(skills){
  const seen = new Set();
  const duplicated = new Set();
  skills.forEach(skill=>{
    const key = normalizeForSearch(skill);
    if (seen.has(key)) duplicated.add(skill);
    seen.add(key);
  });
  return [...duplicated];
}

function getResumeBullets(r){
  return [
    ...getExperienceEntries(r).flatMap(x=>x.highlights || []),
    ...getProjectEntries(r).flatMap(p=>p.highlights || [])
  ].map(safe).filter(Boolean);
}

function isWeakBullet(text){
  const normalized = normalizeForSearch(text);
  const genericStart = /^(عملت|قمت|شاركت|ساهمت|مسؤول|مسؤوله|worked|helped|participated|responsible|assisted)\b/i.test(normalized);
  const hasMetric = /(\d+|%|٪|ريال|sar|usd|مليون|الف|ألف|kpi|sla|مستخدم|عميل|طالب|طالبه|موظف)/i.test(normalized);
  return wordCount(text) < 7 || (genericStart && !hasMetric);
}

function getKeywordMatchReport(r, jobDesc, strategy="balanced"){
  if(!jobDesc || jobDesc.length <= 20) return {keywords: [], matched: [], missing: [], ratio: null};
  const limit = strategy === "aggressive" ? 18 : 12;
  const keywords = extractKeywords(jobDesc, limit);
  const resumeText = normalizeForSearch(resumeTextForMatching(r));
  const matched = keywords.filter(w=>resumeText.includes(normalizeForSearch(w)));
  const missing = keywords.filter(w=>!resumeText.includes(normalizeForSearch(w)));
  return {keywords, matched, missing, ratio: matched.length / Math.max(1, keywords.length)};
}

function computeATSReport(r, jobDesc, options=STATE.options){
  let score = 100;
  const warn = [];
  const tips = [];
  const strictMode = options.atsStrictMode !== false;
  
  if(!r.basics.name) { score-=10; warn.push("الاسم الكامل مفقود"); }
  if(!r.basics.email) { score-=8; warn.push("البريد الإلكتروني مفقود"); }
  if(!r.basics.phone) { score-=6; warn.push("رقم الهاتف مفقود"); }
  if(!r.basics.headline && !r.meta.targetRole) { score-=5; warn.push("المسمى المهني أو الدور المستهدف مفقود"); }

  const experienceEntries = getExperienceEntries(r);
  const projectEntries = getProjectEntries(r);

  const summaryWords = wordCount(r.summary);
  if(!r.summary || summaryWords < 25) { score-=10; warn.push("الملخص المهني قصير؛ الأفضل 25 إلى 70 كلمة واضحة"); }
  if(summaryWords > 90) { score-=5; tips.push("الملخص طويل؛ اختصره حتى يبقى سريع القراءة"); }

  if(!experienceEntries.length && !projectEntries.length) {
    score-=20;
    warn.push("أضف خبرة أو مشاريع تثبت قدرتك العملية");
  } else if(!experienceEntries.length && projectEntries.length) {
    tips.push("لا توجد خبرات؛ سيتم إبراز المشاريع تلقائياً لأنها أقوى دليل متاح");
  }
  
  const skills = getSkillList(r);
  if(skills.length < 6) { score-=8; warn.push("المهارات قليلة؛ أضف أهم المهارات المرتبطة بالوظيفة فقط"); }
  if(skills.length > 30) { score-=4; tips.push("المهارات كثيرة؛ احذف الأقل صلة حتى لا تبدو القائمة عامة"); }

  const duplicateSkills = getDuplicateSkills(skills);
  if(duplicateSkills.length) {
    score-=4;
    tips.push(`هناك مهارات مكررة: ${duplicateSkills.slice(0, 4).join("، ")}`);
  }

  const bullets = getResumeBullets(r);
  if((experienceEntries.length || projectEntries.length) && bullets.length < 3) {
    score-=10;
    warn.push("نقاط الإنجاز قليلة؛ أضف 3 نقاط قوية على الأقل في الخبرة أو المشاريع");
  }

  const weakBullets = bullets.filter(isWeakBullet);
  if(weakBullets.length) {
    if(strictMode) score-=Math.min(12, weakBullets.length * 4);
    tips.push("بعض نقاط الخبرة/المشاريع عامة؛ اجعلها تبدأ بفعل قوي وتنتهي بأثر أو نتيجة");
  }

  const educationWithoutDates = getEducationEntries(r).filter(e=>safe(e.institution) && !safe(e.startDate) && !safe(e.endDate));
  if(educationWithoutDates.length) tips.push("بعض سجلات التعليم بلا تاريخ؛ أضف سنة التخرج إن كانت مناسبة");

  const totalWords = wordCount(resumeTextForMatching(r));
  const pageWordTarget = Number(options.maxPages || 1) === 1 ? 650 : 1150;
  if(totalWords > pageWordTarget) {
    tips.push(Number(options.maxPages || 1) === 1
      ? "السيرة طويلة لهدف صفحة واحدة؛ اختصر النقاط الأقل صلة"
      : "السيرة طويلة نسبياً؛ راجع النقاط المتكررة أو الأقل تأثيراً");
  }

  const keywordReport = getKeywordMatchReport(r, jobDesc, options.keywordStrategy);
  if(keywordReport.ratio !== null){
     if(keywordReport.ratio < 0.35) {
       if(strictMode) score-=15;
       warn.push("تطابق الكلمات المفتاحية ضعيف مع الوصف الوظيفي");
     }
     else if(keywordReport.ratio < 0.55) {
       if(strictMode) score-=8;
       tips.push("تطابق الكلمات متوسط؛ راجع الكلمات الناقصة إن كانت صحيحة وتنطبق عليك");
     }
  }

  score = Math.max(0, score);
  return {score, warn, tips, keywordReport};
}

function updateATSPanel(){
  const rep = computeATSReport(STATE.resume, STATE.jobDesc, STATE.options);
  const host = el("atsReport");
  if(!host) return;
  
  const level = rep.score >= 80 ? "score-good" : (rep.score >= 50 ? "score-warn" : "score-bad");
  
  let html = `<div style="display:flex; justify-content:space-between; align-items:center;">
    <span class="score-badge ${level}">جاهزية السيرة: ${rep.score}/100</span>
  </div>`;
  
  if(rep.warn.length){
    html += `<div class="report-title">الأولوية الآن</div>
    <ul class="report-list">
      ${rep.warn.map(w=>`<li>${w}</li>`).join("")}
    </ul>`;
  } else {
    html += `<div class="report-ok">السيرة جاهزة مبدئياً. راجع مطابقة كل وصف وظيفي قبل التقديم.</div>`;
  }

  if(rep.tips.length){
    html += `<div class="report-title">تحسينات اختيارية</div>
    <ul class="report-list report-list-muted">
      ${rep.tips.map(w=>`<li>${w}</li>`).join("")}
    </ul>`;
  }

  if(rep.keywordReport.ratio !== null){
    const percent = Math.round(rep.keywordReport.ratio * 100);
    html += `<div class="report-title">مطابقة الوصف الوظيفي: ${percent}%</div>`;
    if(rep.keywordReport.matched.length){
      html += `<div class="chip-group-label">موجودة في السيرة</div>
      <div class="chip-container compact">${rep.keywordReport.matched.slice(0, 12).map(k=>`<span class="chip chip-match">${htmlEscape(k)}</span>`).join("")}</div>`;
    }
    if(rep.keywordReport.missing.length){
      html += `<div class="chip-group-label">ناقصة أو تحتاج مراجعة</div>
      <div class="chip-container compact">${rep.keywordReport.missing.slice(0, 12).map(k=>`<span class="chip chip-missing">${htmlEscape(k)}</span>`).join("")}</div>`;
    }
  }
  
  host.innerHTML = html;
}


// ---------- Preview Generators (Simplified Injection) ----------
// Using the same printing logic but cleaner injection

function buildHTML(type, state){
  const {resume, options} = state;
  const isAr = options.outputLanguage === "ar";
  const isATS = type === "ats";
  const dir = isAr ? "rtl" : "ltr";
  const csp = "default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'none';";
  const labels = {
    summary: isAr ? "الملخص المهني" : "Summary",
    experience: isAr ? "الخبرة المهنية" : "Experience",
    projects: isAr ? "المشاريع" : "Projects",
    skills: isAr ? "المهارات" : "Skills",
    education: isAr ? "التعليم" : "Education",
    certifications: isAr ? "الشهادات" : "Certifications",
    languages: isAr ? "اللغات" : "Languages",
    email: isAr ? "البريد" : "Email",
    phone: isAr ? "الهاتف" : "Phone",
    location: isAr ? "الموقع" : "Location",
    technologies: isAr ? "التقنيات" : "Technologies",
    projectLink: isAr ? "الرابط" : "Link"
  };
  
  // Choose Colors based on template
  let accent = "#2563eb";
  if(options.templateStyle === "modern") accent = "#0f766e";
  if(options.templateStyle === "minimal") accent = "#334155";

  // Shared CSS
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600&display=swap');
    :root { --accent: ${accent}; --text: #1f2937; --muted: #6b7280; --line: #e5e7eb; }
    body { font-family: 'Inter', 'Cairo', sans-serif; color: var(--text); padding: 0; margin: 0; background: #fff; line-height: 1.5; }
    a { text-decoration: none; color: var(--accent); }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 28px; margin: 0; color: var(--accent); }
    h2 { font-size: 16px; text-transform: ${isAr ? "none" : "uppercase"}; letter-spacing: 0; color: var(--accent); border-bottom: 2px solid var(--line); padding-bottom: 6px; margin: 24px 0 12px; }
    .job-title { font-size: 14px; font-weight: 600; margin-top: 4px; color: var(--muted); }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
    .meta { font-size: 12px; color: var(--muted); }
    .entry { margin-bottom: 14px; break-inside: avoid; }
    .entry-title { font-size: 15px; font-weight: 700; }
    .entry-subtitle { font-size: 14px; color: #4b5563; }
    .inline-list { font-size: 13px; margin-top: 4px; }
    ul { padding-inline-start: 18px; margin: 6px 0; }
    li { margin-bottom: 4px; font-size: 13px; }
    .tag { display: inline-block; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 2px; }
    .contact-line { font-size: 13px; margin-top: 8px; display: flex; gap: 12px; flex-wrap: wrap; color: var(--muted); }
    .ats-page { max-width: 780px; padding: 32px 40px; }
    .ats-page h1 { color: #111827; font-size: 24px; }
    .ats-page h2 { color: #111827; border-bottom: 1px solid #d1d5db; margin-top: 18px; }
    .ats-page .tag { background: transparent; padding: 0; margin: 0; border-radius: 0; }
    .ats-page .contact-line { color: #374151; gap: 8px; }
    .ats-page .inline-list { color: #111827; }
    .ats-page a { color: #111827; }
    @media print { .page { padding: 0; margin: 20px; } body { -webkit-print-color-adjust: exact; } }
  `;

  let body = "";
  
  if(type === "ats" || type === "cv"){
    // Header
    const basics = resume.basics;
    const displayName = options.anonymize ? (isAr ? "مرشح" : "Candidate") : basics.name;
    const displayEmail = options.anonymize ? "" : basics.email;
    const displayPhone = options.anonymize ? "" : basics.phone;
    const displayLocation = options.anonymize ? "" : basics.location;
    const photoSrc = safeImageSrc(basics.photo);
    const contactLinks = options.anonymize ? [] : (basics.links || []).map(l => {
      const href = safeUrl(l.url);
      return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${htmlEscape(l.label || l.url)}</a>` : "";
    }).filter(Boolean);
    const contactParts = [
      displayEmail ? `${isATS ? `${labels.email}: ` : "📧 "}${htmlEscape(displayEmail)}` : "",
      displayPhone ? `${isATS ? `${labels.phone}: ` : "📱 "}${htmlEscape(displayPhone)}` : "",
      displayLocation ? `${isATS ? `${labels.location}: ` : "📍 "}${htmlEscape(displayLocation)}` : "",
      ...contactLinks
    ].filter(Boolean);

    const renderSection = (title, content) => content ? `<section><h2>${title}</h2>${content}</section>` : "";
    const renderList = (items) => cleanList(items).length ? `<ul>${cleanList(items).map(h=>`<li>${htmlEscape(h)}</li>`).join("")}</ul>` : "";
    const renderInlineList = (items) => {
      const values = cleanList(items);
      if(!values.length) return "";
      if(isATS) return `<div class="inline-list">${values.map(htmlEscape).join(" | ")}</div>`;
      return `<div class="inline-list">${values.map(s=>`<span class="tag">${htmlEscape(s)}</span>`).join(" ")}</div>`;
    };

    const sectionRenderers = {
      summary: () => renderSection(labels.summary, resume.summary ? `<p style="font-size:13px">${htmlEscape(resume.summary)}</p>` : ""),
      experience: () => {
        const items = getExperienceEntries(resume);
        if(!items.length) return "";
        const content = items.map(x=>{
          const experienceDate = formatDateRange(x.startDate, x.endDate, isAr);
          const companyLine = joinNonEmpty([x.company, x.location], isAr ? "، " : " | ");
          const tech = cleanList(x.tech || []);
          return `
            <div class="entry">
              <div class="row">
                <strong class="entry-title">${htmlEscape(x.role)}</strong>
                ${experienceDate ? `<span class="meta">${htmlEscape(experienceDate)}</span>` : ""}
              </div>
              ${companyLine ? `<div class="entry-subtitle">${htmlEscape(companyLine)}</div>` : ""}
              ${renderList(x.highlights)}
              ${tech.length ? `<div class="inline-list">${isATS ? `${labels.technologies}: ${tech.map(htmlEscape).join(" | ")}` : `🛠 ${tech.map(t=>`<span class="tag">${htmlEscape(t)}</span>`).join(" ")}`}</div>` : ""}
            </div>
          `;
        }).join("");
        return renderSection(labels.experience, content);
      },
      projects: () => {
        const items = getProjectEntries(resume);
        if(!items.length) return "";
        const content = items.map(p=>{
          const url = safeUrl(p.link);
          return `
            <div class="entry">
              <div class="row">
                <strong class="entry-title">${htmlEscape(p.name)} ${url && !isATS ? `<a href="${htmlEscape(url)}" style="font-size:12px;">↗</a>` : ""}</strong>
              </div>
              ${p.context ? `<div style="font-size:13px; margin-bottom:4px;">${htmlEscape(p.context)}</div>` : ""}
              ${url && isATS ? `<div class="meta">${labels.projectLink}: ${htmlEscape(url)}</div>` : ""}
              ${renderList(p.highlights)}
              ${renderInlineList(p.tech)}
            </div>
          `;
        }).join("");
        return renderSection(labels.projects, content);
      },
      skills: () => renderSection(labels.skills, renderInlineList(getSkillList(resume))),
      education: () => {
        const items = getEducationEntries(resume);
        if(!items.length) return "";
        const content = items.map(e=>{
          const educationDate = formatDateRange(e.startDate, e.endDate, isAr);
          const credential = formatEducationCredential(e, isAr);
          return `
            <div class="entry">
              <div class="row">
                <strong class="entry-title">${htmlEscape(e.institution)}</strong>
                ${educationDate ? `<span class="meta">${htmlEscape(educationDate)}</span>` : ""}
              </div>
              ${credential ? `<div style="font-size:13px;">${htmlEscape(credential)}</div>` : ""}
              ${renderList(e.details)}
            </div>
          `;
        }).join("");
        return renderSection(labels.education, content);
      },
      certifications: () => {
        const items = getCertificationEntries(resume);
        if(!items.length) return "";
        const content = items.map(c=>{
          const url = safeUrl(c.url);
          const issuerDate = joinNonEmpty([c.issuer, localizeDateLabel(c.date, isAr)], isAr ? "، " : " | ");
          return `
            <div class="entry">
              <div class="row">
                <strong class="entry-title">${url ? `<a href="${htmlEscape(url)}">${htmlEscape(c.name)}</a>` : htmlEscape(c.name)}</strong>
                ${issuerDate ? `<span class="meta">${htmlEscape(issuerDate)}</span>` : ""}
              </div>
            </div>
          `;
        }).join("");
        return renderSection(labels.certifications, content);
      },
      languages: () => {
        const items = getLanguageEntries(resume).map(l=>joinNonEmpty([l.name, l.level], " - ")).filter(Boolean);
        if(!items.length) return "";
        return renderSection(labels.languages, renderInlineList(items));
      }
    };

    const getSectionOrder = () => {
      let order = ["summary", "experience", "projects", "skills", "education", "certifications", "languages"];
      if(options.emphasis === "projects") order = ["summary", "projects", "experience", "skills", "education", "certifications", "languages"];
      if(options.emphasis === "skills") order = ["summary", "skills", "experience", "projects", "education", "certifications", "languages"];
      if(!getExperienceEntries(resume).length && getProjectEntries(resume).length) order = ["summary", "projects", "skills", "education", "certifications", "languages", "experience"];
      return [...new Set(order)];
    };

    body += `
      <header style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
        ${!isATS && options.includePhoto && !options.anonymize && photoSrc ? `<img src="${photoSrc}" alt="Profile" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent);">` : ""}
        <div>
          <h1>${htmlEscape(displayName)}</h1>
          <div class="job-title">${htmlEscape(basics.headline)}</div>
          ${contactParts.length ? `<div class="contact-line">${contactParts.map(p=>`<span>${p}</span>`).join(isATS ? "" : "")}</div>` : ""}
        </div>
      </header>
    `;

    body += getSectionOrder().map(key=>sectionRenderers[key]()).join("");
  } 
  else if (type === "cover") {
    // Simple Cover Letter logic
    const cl = resume.coverLetter;
    const displayName = options.anonymize ? (isAr ? "مرشح" : "Candidate") : resume.basics.name;
    const displayEmail = options.anonymize ? "" : resume.basics.email;
    const displayPhone = options.anonymize ? "" : resume.basics.phone;
    const date = new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", { dateStyle: "long" }).format(new Date());
    body += `
      <header style="border-bottom: 2px solid var(--line); padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="font-size:24px;">${htmlEscape(displayName)}</h1>
        <div class="contact-line">${[displayEmail, displayPhone].filter(Boolean).map(htmlEscape).join(" | ")}</div>
      </header>
      <div style="margin-bottom: 30px; font-size: 14px; color: var(--muted);">
        <div>${htmlEscape(date)}</div>
        <div style="margin-top:10px;"><strong>${isAr ? "إلى:" : "To:"}</strong> ${htmlEscape(cl.hiringManager || (isAr ? "فريق التوظيف" : "Hiring Manager"))}</div>
        <div>${htmlEscape(cl.company)}</div>
      </div>
      <div style="font-size: 14px; line-height: 1.8;">
        <p>${isAr ? `السادة ${htmlEscape(cl.hiringManager || "فريق التوظيف")}،` : `Dear ${htmlEscape(cl.hiringManager || "Hiring Team")},`}</p>
        <p>${isAr ? `أرغب في التقدم إلى وظيفة <strong>${htmlEscape(cl.role)}</strong> لدى ${htmlEscape(cl.company)}.` : `I am writing to express my interest in the <strong>${htmlEscape(cl.role)}</strong> position at ${htmlEscape(cl.company)}.`}</p>
        <p>${htmlEscape(cl.custom || (isAr ? "أرى أن خبراتي ومهاراتي تجعلني مرشحاً مناسباً لهذا الدور." : "I believe my skills and background make me a strong candidate for this role."))}</p>
        <p>${isAr ? "شكراً لوقتكم واهتمامكم." : "Thank you for your time and consideration."}</p>
        <br>
        <p>${isAr ? "مع خالص التحية،" : "Sincerely,"}</p>
        <p><strong>${htmlEscape(displayName)}</strong></p>
      </div>
    `;
  }

  return `<!doctype html><html lang="${isAr?"ar":"en"}" dir="${dir}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Preview</title><style>${css}</style></head><body><div class="page ${isATS ? "ats-page" : "cv-page"}">${body}</div></body></html>`;
}

// ---------- Main Wiring ----------
let CURRENT_PREVIEW = "ats";

function updatePreview(type){
  CURRENT_PREVIEW = type || CURRENT_PREVIEW || "ats";
  const html = buildHTML(CURRENT_PREVIEW, STATE);
  el("previewFrame").srcdoc = html;
  document.querySelectorAll(".preview-toolbar .btn").forEach(btn=>btn.classList.remove("active"));
  const activeBtn = el(CURRENT_PREVIEW === "cv" ? "btnPreviewCV" : (CURRENT_PREVIEW === "cover" ? "btnPreviewCL" : "btnPreviewATS"));
  if(activeBtn) activeBtn.classList.add("active");
  updateATSPanel();
}

function wireEvents(){
  // Auto-save input bindings
  const syncFromFormEvent = (e)=>{
    if(e.target.matches("input, textarea, select")){
      collectFromUI();
      // Debounce preview update slightly
      if(window._previewTimer) clearTimeout(window._previewTimer);
      window._previewTimer = setTimeout(()=>updatePreview(CURRENT_PREVIEW), 500); 
    }
  };
  document.body.addEventListener("input", syncFromFormEvent);
  document.body.addEventListener("change", syncFromFormEvent);

  const photoInput = el("inPhoto");
  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) {
        STATE.resume.basics.photo = "";
        saveState(STATE);
        updatePreview(CURRENT_PREVIEW);
        return;
      }
      if(!/^image\/(png|jpe?g|webp)$/i.test(file.type || "")) {
        showToast("الرجاء اختيار صورة PNG أو JPG أو WebP فقط", "error");
        e.target.value = "";
        return;
      }
      if(file.size > MAX_PHOTO_BYTES) {
        showToast("حجم الصورة كبير. اختر صورة أقل من 5MB.", "error");
        e.target.value = "";
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
            const previousPhoto = STATE.resume.basics.photo;
            STATE.resume.basics.photo = compressed;
            if(saveState(STATE)) {
              updatePreview(CURRENT_PREVIEW);
              showToast("تم إضافة الصورة بنجاح", "success");
            } else {
              STATE.resume.basics.photo = previousPhoto;
            }
          } catch (e) {
            console.error(e);
            showToast("الصورة لا تزال كبيرة جداً على ذاكرة المتصفح", "error");
          }
        };
        img.onerror = () => showToast("تعذر قراءة الصورة المختارة", "error");
        img.src = event.target.result;
      };
      reader.onerror = () => showToast("تعذر قراءة ملف الصورة", "error");
      reader.readAsDataURL(file);
    });
  }

  // Buttons
  el("btnNew").addEventListener("click", ()=>{
    if(confirm("هل أنت متأكد؟ سيتم مسح جميع البيانات الحالية.")){
      STATE = emptyState();
      saveState(STATE);
      fillUI();
      updatePreview("ats");
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
    if(f.size > MAX_IMPORT_BYTES) {
      showToast("ملف JSON كبير جداً. الحد الأقصى 2MB.", "error");
      e.target.value = "";
      return;
    }
    try {
      const text = await f.text();
      STATE = normalizeState(JSON.parse(text));
      saveState(STATE);
      fillUI();
      updatePreview(CURRENT_PREVIEW);
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
    saveState(STATE);
    renderKeywordChips();
    updatePreview(CURRENT_PREVIEW);
    showToast(`تم استخراج ${kws.length} كلمة مفتاحية`, "success");
  });

  // Add Item Buttons
  el("btnAddLink").addEventListener("click", ()=>{ STATE.resume.basics.links.push({label:"",url:""}); saveState(STATE); renderLinks(); updatePreview(CURRENT_PREVIEW); });
  el("btnAddExperience").addEventListener("click", ()=>{ STATE.resume.experience.push({company:"",role:"",startDate:"",endDate:"",highlights:[],tech:[]}); saveState(STATE); renderExperience(); updatePreview(CURRENT_PREVIEW); });
  el("btnAddProject").addEventListener("click", ()=>{ STATE.resume.projects.push({name:"",link:"",context:"",highlights:[],tech:[]}); saveState(STATE); renderProjects(); updatePreview(CURRENT_PREVIEW); });
  el("btnAddEducation").addEventListener("click", ()=>{ STATE.resume.education.push({institution:"",degree:"",startDate:"",endDate:"",details:[]}); saveState(STATE); renderEducation(); updatePreview(CURRENT_PREVIEW); });
  el("btnAddCert").addEventListener("click", ()=>{ STATE.resume.certifications.push({name:"",issuer:"",date:"",url:""}); saveState(STATE); renderCerts(); updatePreview(CURRENT_PREVIEW); });
  el("btnAddLang").addEventListener("click", ()=>{ STATE.resume.languages.push({name:"",level:""}); saveState(STATE); renderLangs(); updatePreview(CURRENT_PREVIEW); });

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
