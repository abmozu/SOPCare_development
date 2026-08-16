export type ReportAssetPosition = "left" | "center" | "right";

export type ReportSettings = {
  organizationName: string;
  reportTitle: string;
  primaryLogo: string;
  primaryLogoPosition: ReportAssetPosition;
  secondaryLogo: string;
  secondaryLogoPosition: ReportAssetPosition;
  stamp: string;
  stampPosition: ReportAssetPosition;
  showStamp: boolean;
};

export const defaultReportSettings: ReportSettings = {
  organizationName: "SOPCare Sports Health",
  reportTitle: "Clinical Encounter Report",
  primaryLogo: "/branding/team-saudi.png",
  primaryLogoPosition: "left",
  secondaryLogo: "/branding/saudi-olympic-paralympic.png",
  secondaryLogoPosition: "right",
  stamp: "",
  stampPosition: "right",
  showStamp: false,
};

const storageKey = "sopcare.report-settings.v1";

function withDefaultBranding(value: Partial<ReportSettings>): ReportSettings {
  const settings = { ...defaultReportSettings, ...value };
  if (!settings.primaryLogo) settings.primaryLogo = defaultReportSettings.primaryLogo;
  if (!settings.secondaryLogo) settings.secondaryLogo = defaultReportSettings.secondaryLogo;
  return settings;
}

export function loadReportSettings(): ReportSettings {
  if (typeof window === "undefined") return defaultReportSettings;
  try {
    return withDefaultBranding(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
  } catch {
    return defaultReportSettings;
  }
}

export function saveReportSettings(settings: ReportSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

export async function fetchReportSettings(): Promise<ReportSettings> {
  try {
    const response = await fetch("/api/report-settings", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load report settings");
    const body = await response.json() as { settings?: Partial<ReportSettings> };
    const settings = withDefaultBranding(body.settings ?? {});
    saveReportSettings(settings);
    return settings;
  } catch {
    return loadReportSettings();
  }
}

export async function persistReportSettings(settings: ReportSettings) {
  const response = await fetch("/api/report-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
  const body = await response.json() as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Unable to save report settings");
  saveReportSettings(settings);
}

type PdfEncounter = { id: string; encounterDate: string; encounterType: string; clinicCity: string; reason: string; diagnosis: string; plan: string; subjective: string; objective: string; assessment: string; practitioner: string; specialty: string };
type PdfAthlete = { mrn: string; firstName: string; lastName: string; dateOfBirth: string; sport: string; discipline: string };

function plainText(html: string) {
  const document = new DOMParser().parseFromString(html || "", "text/html");
  return (document.body.textContent || "").replace(/\s+/g, " ").trim();
}

type RichRun = { text: string; bold: boolean; italic: boolean; underline: boolean; color?: string; size?: number; breakAfter?: number };

function richTextRuns(html: string): RichRun[] {
  const parsed = new DOMParser().parseFromString(html || "", "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,form,input,button").forEach((node) => node.remove());
  const runs: RichRun[] = [];
  const walk = (node: Node, inherited: Omit<RichRun, "text">) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").replace(/\s+/g, " ");
      if (text.trim()) runs.push({ text, ...inherited });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    const style = getComputedStyle(node);
    const next = {
      ...inherited,
      bold: inherited.bold || ["b", "strong"].includes(tag) || Number.parseInt(style.fontWeight, 10) >= 600,
      italic: inherited.italic || ["i", "em"].includes(tag) || style.fontStyle === "italic",
      underline: inherited.underline || tag === "u" || style.textDecorationLine.includes("underline"),
      color: node.style.color || inherited.color,
      size: tag === "h1" ? 15 : tag === "h2" ? 13.5 : tag === "h3" ? 12 : inherited.size,
    };
    if (tag === "li") runs.push({ text: tag === "li" && node.parentElement?.tagName === "OL" ? `${[...node.parentElement.children].indexOf(node) + 1}. ` : "• ", ...next });
    node.childNodes.forEach((child) => walk(child, next));
    if (["p", "div", "li", "h1", "h2", "h3", "br"].includes(tag) && runs.length) runs[runs.length - 1].breakAfter = tag === "br" ? 3 : 5;
  };
  parsed.body.childNodes.forEach((node) => walk(node, { bold: false, italic: false, underline: false, size: 10.2 }));
  return runs;
}

function reportAge(dateOfBirth: string, visitDate: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const visit = new Date(visitDate);
  let years = visit.getFullYear() - birth.getFullYear();
  if (visit.getMonth() < birth.getMonth() || (visit.getMonth() === birth.getMonth() && visit.getDate() < birth.getDate())) years -= 1;
  return Math.max(0, years);
}

function reportDate(value: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function reportText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function reportRichText(value: string) {
  const parsed = new DOMParser().parseFromString(value || "", "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,form,input,button").forEach((node) => node.remove());
  parsed.body.querySelectorAll("*").forEach((node) => [...node.attributes].forEach((attribute) => {
    if (attribute.name.startsWith("on") || !["style"].includes(attribute.name)) node.removeAttribute(attribute.name);
  }));
  return parsed.body.innerHTML;
}

export async function downloadEncounterPdf(encounter: PdfEncounter, athlete: PdfAthlete) {
  // Direct PDF drawing is intentionally the production path. Browser DOM capture
  // is unreliable in embedded and standard Chrome contexts and can yield blank pages.
  return downloadEncounterPdfLegacy(encounter, athlete);
  /* c8 ignore start -- retained while the report-template editor is migrated. */
  const { jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");
  const settings = await fetchReportSettings();
  const resolveAsset = async (source: string) => {
    if (!source || source.startsWith("data:")) return source;
    const blob = await fetch(source).then((response) => response.blob());
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  };
  const [primaryLogo, secondaryLogo, sopcareLogo] = await Promise.all([
    resolveAsset(settings.primaryLogo), resolveAsset(settings.secondaryLogo), resolveAsset("/branding/sopcare-logo-v2.png"),
  ]);
  const slots: Record<ReportAssetPosition, string[]> = { left: [], center: [], right: [] };
  if (primaryLogo) slots[settings.primaryLogoPosition].push(primaryLogo);
  if (secondaryLogo) slots[settings.secondaryLogoPosition].push(secondaryLogo);
  const visitDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh" }).format(new Date(encounter.encounterDate));
  const root = document.createElement("section");
  root.className = "pdf-report-source";
  root.innerHTML = `
    <style>
      .pdf-report-source{box-sizing:border-box;width:794px;padding:54px 62px 72px;color:#172d25;background:#fff;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.62}
      .pdf-logo-row{min-height:72px;display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;gap:18px}.pdf-logo-slot{min-width:0;display:flex;align-items:center;gap:12px}.pdf-logo-slot.center{justify-content:center}.pdf-logo-slot.right{justify-content:flex-end}.pdf-logo-slot img{max-width:150px;max-height:66px;object-fit:contain}.pdf-brand{text-align:center}.pdf-brand img{width:310px;max-height:122px;object-fit:contain}.pdf-rule{height:4px;margin:18px 0 24px;border:0;background:linear-gradient(90deg,#087052 0 72%,#c8a45d 72%)}
      .pdf-title{text-align:center}.pdf-title h1{margin:0;color:#073b32;font-size:27px;line-height:1.15}.pdf-title p{margin:7px 0 22px;color:#6c7c75;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
      .pdf-info{overflow:hidden;border:1px solid #d9e5df;border-radius:12px}.pdf-info-head{padding:11px 16px;color:#fff;background:#073b32;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.pdf-info-grid{display:grid;grid-template-columns:1fr 1fr}.pdf-info-grid div{padding:13px 16px;border-bottom:1px solid #e5ece8}.pdf-info-grid div:nth-child(odd){border-right:1px solid #e5ece8}.pdf-info-grid div:nth-last-child(-n+2){border-bottom:0}.pdf-info small{display:block;margin-bottom:4px;color:#708078;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.pdf-info strong{color:#173a2f;font-size:13px}
      .pdf-section{margin-top:20px;break-inside:auto}.pdf-section h2{margin:0 0 9px;padding-bottom:7px;color:#124d3a;border-bottom:2px solid #b99850;font-size:16px;letter-spacing:.035em;text-transform:uppercase}.pdf-section p{margin:0;white-space:pre-wrap}.pdf-section.accent{padding:14px 16px;border-left:4px solid #c8a45d;border-radius:7px;background:#faf8f1}.pdf-section.accent h2{padding:0;border:0;font-size:11px}.clinical-copy{font-size:14px;line-height:1.68}.clinical-copy p{margin:0 0 11px}.clinical-copy h1,.clinical-copy h2,.clinical-copy h3{margin:18px 0 8px;color:#174c3b}.clinical-copy ul,.clinical-copy ol{margin:7px 0 12px;padding-left:25px}.clinical-copy li{margin:3px 0}.clinical-copy strong,.clinical-copy b{font-weight:800}.clinical-copy em,.clinical-copy i{font-style:italic}.clinical-copy u{text-underline-offset:2px}
    </style>
    <div class="pdf-logo-row">
      ${(["left", "center", "right"] as ReportAssetPosition[]).map((position) => `<div class="pdf-logo-slot ${position}">${slots[position].map((source) => `<img src="${source}" alt="" />`).join("")}</div>`).join("")}
    </div>
    <div class="pdf-brand"><img src="${sopcareLogo}" alt="SOPCare" /></div>
    <div class="pdf-rule"></div>
    <div class="pdf-title"><h1>${reportText(settings.reportTitle || "Medical Report")}</h1><p>${reportText(settings.organizationName)}</p></div>
    <section class="pdf-info"><div class="pdf-info-head">Athlete and visit information</div><div class="pdf-info-grid">
      <div><small>Visit date</small><strong>${visitDate}</strong></div>
      <div><small>Athlete name</small><strong>${reportText(`${athlete.firstName} ${athlete.lastName}`)}</strong></div>
      <div><small>Date of birth</small><strong>${reportText(reportDate(athlete.dateOfBirth))}</strong></div>
      <div><small>Age</small><strong>${reportAge(athlete.dateOfBirth, encounter.encounterDate)} years</strong></div>
      <div><small>Medical record number</small><strong>${reportText(athlete.mrn)}</strong></div>
      <div><small>Sport</small><strong>${reportText(`${athlete.sport}${athlete.discipline ? ` - ${athlete.discipline}` : ""}`)}</strong></div>
      <div><small>Clinic city</small><strong>${reportText(encounter.clinicCity || "Not recorded")}</strong></div>
      <div><small>Reporter name</small><strong>${reportText(encounter.practitioner)}</strong></div>
    </div></section>
    <section class="pdf-section accent"><h2>Diagnosis</h2><p>${reportText(encounter.diagnosis || "No diagnosis recorded.")}</p></section>
    <section class="pdf-section accent"><h2>Reason for visit</h2><p>${reportText(encounter.reason || "Not recorded.")}</p></section>
    <section class="pdf-section"><h2>Clinical history</h2><div class="clinical-copy">${reportRichText(encounter.plan) || "<p>No clinical history recorded.</p>"}</div></section>`;
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.zIndex = "2147483647";
  root.style.pointerEvents = "none";
  document.body.appendChild(root);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  try {
    await document.fonts.ready;
    await Promise.all([...root.querySelectorAll("img")].map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
    const canvas = await html2canvas(root, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
    const pageWidthMm = 210;
    const contentHeightMm = 278;
    const sliceHeightPx = Math.floor(canvas.width * contentHeightMm / pageWidthMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / sliceHeightPx));
    for (let index = 0; index < totalPages; index++) {
      if (index > 0) pdf.addPage();
      const sourceY = index * sliceHeightPx;
      const sourceHeight = Math.min(sliceHeightPx, canvas.height - sourceY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      pageCanvas.getContext("2d")?.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
      pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, pageWidthMm, sourceHeight * pageWidthMm / canvas.width, undefined, "FAST");
    }
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      pdf.setPage(page); pdf.setDrawColor(219, 229, 223); pdf.line(16, 286, 194, 286);
      pdf.setTextColor(103, 119, 112); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
      pdf.text("SOPCare - Saudi Olympic and Paralympic Care", 16, 291);
      pdf.text(`Page ${page} of ${pages}`, 194, 291, { align: "right" });
    }
    pdf.save(`SOPCare-${athlete.mrn}-${encounter.id}.pdf`);
  } finally {
    root.remove();
  }
  /* c8 ignore stop */
}

async function downloadEncounterPdfLegacy(encounter: PdfEncounter, athlete: PdfAthlete) {
  const { jsPDF } = await import("jspdf");
  const settings = await fetchReportSettings();
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const usable = width - margin * 2;
  const green = [5, 91, 68] as const;
  const ink = [24, 31, 28] as const;
  const muted = [83, 96, 90] as const;
  let y = 18;

  const xFor = (position: ReportAssetPosition, assetWidth: number) => position === "left" ? margin : position === "center" ? (width - assetWidth) / 2 : width - margin - assetWidth;
  const resolveAsset = async (source: string) => {
    if (!source || source.startsWith("data:")) return source;
    const response = await fetch(source, { cache: "force-cache" });
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  };
  const addAsset = (source: string, position: ReportAssetPosition, top: number, assetWidth: number, assetHeight: number) => {
    if (!source) return;
    try { pdf.addImage(source, source.includes("image/png") ? "PNG" : "JPEG", xFor(position, assetWidth), top, assetWidth, assetHeight, undefined, "FAST"); } catch { /* Keep the report available if an optional asset cannot be decoded. */ }
  };

  const [primaryLogo, secondaryLogo] = await Promise.all([
    resolveAsset(settings.primaryLogo || defaultReportSettings.primaryLogo),
    resolveAsset(settings.secondaryLogo || defaultReportSettings.secondaryLogo),
  ]);
  addAsset(primaryLogo, settings.primaryLogoPosition || "left", y, 47, 19);
  addAsset(secondaryLogo, settings.secondaryLogoPosition || "right", y - 2, 34, 22);

  pdf.setTextColor(...ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
  pdf.text("Medical Report", width / 2, y + 28, { align: "center" });
  y += 39;

  const visitDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", hour12: true, timeZone: "Asia/Riyadh" }).format(new Date(encounter.encounterDate));
  const info = [
    ["Visit date", visitDate],
    ["Athlete name", `${athlete.firstName} ${athlete.lastName}`],
    ["Date of birth", reportDate(athlete.dateOfBirth)],
    ["Age", `${reportAge(athlete.dateOfBirth, encounter.encounterDate)} years`],
    ["Sport / Discipline", `${athlete.sport}${athlete.discipline ? ` / ${athlete.discipline}` : ""}`],
    ["Clinic City", encounter.clinicCity || "Not recorded"],
    ["Reporter Name", encounter.practitioner || "Not recorded"],
  ];
  info.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(...ink);
    pdf.text(`${label}:`, margin, y);
    const labelWidth = pdf.getTextWidth(`${label}: `);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(value || "Not recorded"), margin + labelWidth, y);
    y += 5.6;
  });
  y += 5;

  const newPage = () => {
    pdf.addPage();
    y = 20;
  };
  const addSection = (title: string, body: string) => {
    const text = body || "Not recorded.";
    const lines = pdf.splitTextToSize(text, usable);
    const required = 14 + lines.length * 5.15;
    if (y + required > 276) newPage();
    pdf.setTextColor(...green); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12.5);
    pdf.text(title.toUpperCase(), margin, y);
    y += 3;
    pdf.setDrawColor(...green); pdf.setLineWidth(0.35); pdf.line(margin, y, width - margin, y);
    y += 6;
    pdf.setTextColor(...ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10.5);
    for (const line of lines) {
      if (y > 276) newPage();
      pdf.text(line, margin, y);
      y += 5.15;
    }
    y += 6;
  };

  const addRichSection = (title: string, html: string) => {
    if (y + 20 > 276) newPage();
    pdf.setTextColor(...green); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12.5);
    pdf.text(title.toUpperCase(), margin, y);
    y += 3;
    pdf.setDrawColor(...green); pdf.setLineWidth(0.35); pdf.line(margin, y, width - margin, y);
    y += 7;
    const runs = richTextRuns(html);
    if (!runs.length) { addSection("", "No clinical history recorded."); return; }
    let x = margin;
    for (const run of runs) {
      const size = run.size || 10.5;
      pdf.setFontSize(size);
      pdf.setFont("helvetica", run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal");
      const colorMatch = run.color?.match(/^#([0-9a-f]{6})$/i);
      if (colorMatch) {
        const value = Number.parseInt(colorMatch[1], 16);
        pdf.setTextColor((value >> 16) & 255, (value >> 8) & 255, value & 255);
      } else pdf.setTextColor(...ink);
      const words = run.text.split(/\s+/).filter(Boolean);
      for (const word of words) {
        const token = `${word} `;
        const tokenWidth = pdf.getTextWidth(token);
        if (x + tokenWidth > width - margin) { x = margin; y += Math.max(5.2, size * 0.5); }
        if (y > 276) { newPage(); x = margin; }
        pdf.text(token, x, y);
        if (run.underline) { pdf.setDrawColor(pdf.getTextColor()); pdf.setLineWidth(0.18); pdf.line(x, y + 0.8, x + tokenWidth - 0.7, y + 0.8); }
        x += tokenWidth;
      }
      if (run.breakAfter) { x = margin; y += Math.max(run.breakAfter, size * 0.52); }
    }
    y += 5;
  };

  const historyHtml = encounter.plan || [encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).map((value) => `<p>${reportText(plainText(value))}</p>`).join("");
  addRichSection("History of present illness", historyHtml);
  addSection("Diagnosis", encounter.diagnosis || "No diagnosis recorded.");
  addSection("Reason for visit / presenting concern", encounter.reason || "Not recorded.");

  if (settings.showStamp && settings.stamp) addAsset(await resolveAsset(settings.stamp), settings.stampPosition, Math.min(y + 2, 248), 34, 28);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(213, 222, 217); pdf.setLineWidth(0.25); pdf.line(margin, 284, width - margin, 284);
    pdf.setTextColor(...muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
    pdf.text("SOPCare - Saudi Olympic and Paralympic Care", margin, 290);
    pdf.text(`Page ${page} of ${pages}`, width - margin, 290, { align: "right" });
  }

  pdf.save(`SOPCare-${athlete.mrn}-${encounter.id}.pdf`);
}
