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

function reportAge(dateOfBirth: string, visitDate: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const visit = new Date(visitDate);
  let years = visit.getFullYear() - birth.getFullYear();
  if (visit.getMonth() < birth.getMonth() || (visit.getMonth() === birth.getMonth() && visit.getDate() < birth.getDate())) years -= 1;
  return Math.max(0, years);
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
      <div><small>Age</small><strong>${reportAge(athlete.dateOfBirth, encounter.encounterDate)} years</strong></div>
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
  const margin = 16;
  const usable = width - margin * 2;
  const green = [5, 78, 63] as const;
  const mint = [236, 246, 241] as const;
  const gold = [198, 157, 76] as const;
  const ink = [28, 43, 37] as const;
  const muted = [102, 118, 111] as const;
  let y = 16;

  const xFor = (position: ReportAssetPosition, assetWidth: number) => position === "left" ? margin : position === "center" ? (width - assetWidth) / 2 : width - margin - assetWidth;
  const resolveAsset = async (source: string) => {
    if (!source || source.startsWith("data:")) return source;
    const blob = await fetch(source).then((response) => response.blob());
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  };
  const addAsset = (source: string, position: ReportAssetPosition, top: number, assetWidth = 30, assetHeight = 14) => {
    if (!source) return;
    try { pdf.addImage(source, source.includes("image/png") ? "PNG" : "JPEG", xFor(position, assetWidth), top, assetWidth, assetHeight, undefined, "FAST"); } catch { /* Unsupported image data is ignored safely. */ }
  };

  addAsset(await resolveAsset(settings.primaryLogo), settings.primaryLogoPosition, y, 36, 14);
  addAsset(await resolveAsset(settings.secondaryLogo), settings.secondaryLogoPosition, y, 42, 14);
  addAsset(await resolveAsset("/branding/sopcare-logo-v2.png"), "center", y - 1, 76, 30);
  pdf.setTextColor(...green); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15);
  pdf.text(settings.reportTitle || "Medical Report", width / 2, y + 26, { align: "center" });
  pdf.setTextColor(...muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
  pdf.text(settings.organizationName || "Saudi Olympic and Paralympic Care", width / 2, y + 31, { align: "center" });
  pdf.setDrawColor(...green); pdf.setLineWidth(0.8); pdf.line(margin, y + 36, width - margin, y + 36);
  pdf.setDrawColor(...gold); pdf.setLineWidth(1.3); pdf.line(margin, y + 37.5, width - margin, y + 37.5);
  y += 46;

  pdf.setFillColor(...green); pdf.roundedRect(margin, y, usable, 12, 2.5, 2.5, "F");
  pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
  pdf.text("ATHLETE IDENTITY", margin + 7, y + 7.5);
  pdf.text("VISIT INFORMATION", margin + usable / 2 + 7, y + 7.5);
  y += 17;

  const visitDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(encounter.encounterDate));
  const info = [
    ["VISIT DATE", visitDate],
    ["ATHLETE NAME", `${athlete.firstName} ${athlete.lastName}`],
    ["AGE", `${reportAge(athlete.dateOfBirth, encounter.encounterDate)} years`],
    ["SPORT / DISCIPLINE", `${athlete.sport}${athlete.discipline ? ` / ${athlete.discipline}` : ""}`],
    ["CLINIC CITY", encounter.clinicCity || "Not recorded"],
    ["REPORTER NAME", encounter.practitioner || "Not recorded"],
  ];
  const cardWidth = (usable - 6) / 3;
  const cardHeight = 23;
  info.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + column * (cardWidth + 3);
    const cardY = y + row * (cardHeight + 3);
    pdf.setFillColor(...mint); pdf.roundedRect(x, cardY, cardWidth, cardHeight, 2.5, 2.5, "F");
    pdf.setTextColor(...muted); pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.4); pdf.text(label, x + 5, cardY + 7);
    pdf.setTextColor(...ink); pdf.setFontSize(8.5); pdf.setFont("helvetica", "bold");
    pdf.text(pdf.splitTextToSize(value || "Not recorded", cardWidth - 10), x + 5, cardY + 15);
  });
  y += cardHeight * 2 + 11;

  const addSection = (title: string, body: string, accent = false) => {
    const lines = pdf.splitTextToSize(body || "Not recorded.", usable - 16);
    const height = Math.max(25, 15 + lines.length * 5);
    if (y + height > 276) { pdf.addPage(); y = 18; }
    pdf.setFillColor(...(accent ? [251, 248, 240] as const : [248, 251, 249] as const));
    pdf.setDrawColor(...(accent ? gold : [215, 226, 220] as const));
    pdf.roundedRect(margin, y, usable, height, 3, 3, "FD");
    pdf.setTextColor(...(accent ? [119, 85, 22] as const : green)); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.text(title.toUpperCase(), margin + 7, y + 8);
    pdf.setTextColor(...ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.text(lines, margin + 7, y + 16);
    y += height + 7;
  };

  addSection("Diagnosis", encounter.diagnosis || "No diagnosis recorded.", true);
  addSection("Reason for visit / presenting concern", encounter.reason, true);
  const history = plainText(encounter.plan) || plainText([encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).join(" "));
  addSection("Clinical history", history || "No clinical history recorded.");

  if (settings.showStamp && settings.stamp) addAsset(await resolveAsset(settings.stamp), settings.stampPosition, Math.min(y + 2, 245), 34, 28);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(220, 228, 224); pdf.line(margin, 284, width - margin, 284);
    pdf.setTextColor(...muted); pdf.setFontSize(7); pdf.text("Generated securely by SOPCare", margin, 290);
    pdf.text(`Page ${page} of ${pages}`, width - margin, 290, { align: "right" });
  }
  pdf.save(`SOPCare-${athlete.mrn}-${encounter.id}.pdf`);
}
