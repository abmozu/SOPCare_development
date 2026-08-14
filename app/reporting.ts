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
  primaryLogo: "",
  primaryLogoPosition: "left",
  secondaryLogo: "",
  secondaryLogoPosition: "right",
  stamp: "",
  stampPosition: "right",
  showStamp: false,
};

const storageKey = "sopcare.report-settings.v1";

export function loadReportSettings(): ReportSettings {
  if (typeof window === "undefined") return defaultReportSettings;
  try {
    return { ...defaultReportSettings, ...JSON.parse(localStorage.getItem(storageKey) ?? "{}") };
  } catch {
    return defaultReportSettings;
  }
}

export function saveReportSettings(settings: ReportSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

type PdfEncounter = { id: string; encounterDate: string; encounterType: string; clinicCity: string; reason: string; diagnosis: string; plan: string; subjective: string; objective: string; assessment: string; practitioner: string; specialty: string };
type PdfAthlete = { mrn: string; firstName: string; lastName: string; sport: string; discipline: string };

function plainText(html: string) {
  const document = new DOMParser().parseFromString(html || "", "text/html");
  return (document.body.textContent || "").replace(/\s+/g, " ").trim();
}

export async function downloadEncounterPdf(encounter: PdfEncounter, athlete: PdfAthlete) {
  const { jsPDF } = await import("jspdf");
  const settings = loadReportSettings();
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
  const addAsset = (source: string, position: ReportAssetPosition, top: number, assetWidth = 30, assetHeight = 14) => {
    if (!source) return;
    try { pdf.addImage(source, source.includes("image/png") ? "PNG" : "JPEG", xFor(position, assetWidth), top, assetWidth, assetHeight, undefined, "FAST"); } catch { /* Unsupported image data is ignored safely. */ }
  };

  addAsset(settings.primaryLogo, settings.primaryLogoPosition, y, 31, 14);
  addAsset(settings.secondaryLogo, settings.secondaryLogoPosition, y, 31, 14);
  pdf.setTextColor(...green); pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
  pdf.text(settings.organizationName, margin, y + 22);
  pdf.setTextColor(...muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  pdf.text(settings.reportTitle.toUpperCase(), margin, y + 28);
  pdf.setDrawColor(...gold); pdf.setLineWidth(1.2); pdf.line(margin, y + 33, width - margin, y + 33);
  y += 42;

  pdf.setFillColor(...green); pdf.roundedRect(margin, y, usable, 34, 3, 3, "F");
  pdf.setTextColor(210, 231, 222); pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
  pdf.text("ATHLETE", margin + 7, y + 8); pdf.text("VISIT", margin + 101, y + 8);
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(13);
  pdf.text(`${athlete.firstName} ${athlete.lastName}`, margin + 7, y + 17);
  pdf.setFontSize(10); pdf.text(encounter.encounterType, margin + 101, y + 17);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  pdf.text(`${athlete.mrn}  |  ${athlete.sport}${athlete.discipline ? `  |  ${athlete.discipline}` : ""}`, margin + 7, y + 25);
  const visitDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(encounter.encounterDate));
  pdf.text(`${visitDate}  |  ${encounter.clinicCity}`, margin + 101, y + 25);
  y += 42;

  const meta = [["PRACTITIONER", encounter.practitioner], ["PROFESSIONAL ROLE", encounter.specialty], ["CITY", encounter.clinicCity]];
  const columnWidth = usable / 3;
  meta.forEach(([label, value], index) => {
    const x = margin + index * columnWidth;
    pdf.setFillColor(...mint); pdf.roundedRect(x + (index ? 2 : 0), y, columnWidth - 3, 24, 2.5, 2.5, "F");
    pdf.setTextColor(...muted); pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.5); pdf.text(label, x + 6, y + 8);
    pdf.setTextColor(...ink); pdf.setFontSize(9); pdf.text(pdf.splitTextToSize(value || "Not recorded", columnWidth - 12), x + 6, y + 16);
  });
  y += 31;

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

  if (settings.showStamp && settings.stamp) addAsset(settings.stamp, settings.stampPosition, Math.min(y + 2, 245), 34, 28);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(220, 228, 224); pdf.line(margin, 284, width - margin, 284);
    pdf.setTextColor(...muted); pdf.setFontSize(7); pdf.text("Generated securely by SOPCare", margin, 290);
    pdf.text(`Page ${page} of ${pages}`, width - margin, 290, { align: "right" });
  }
  pdf.save(`SOPCare-${athlete.mrn}-${encounter.id}.pdf`);
}
