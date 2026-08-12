Exit code: 0
Wall time: 0.6 seconds
Total output lines: 723
Output:
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { PortalUser } from "./access-model";

type Athlete = {
  id: string; mrn: string; firstName: string; lastName: string; dateOfBirth: string;
  sex: string; nationality: string; sport: string; discipline: string; dominantSide: string;
  status: string; medicalAlerts: string; allergies: string; chronicConditions: string; prohibitedMedications: string; emergencyContact: string; followUpDate: string | null;
  accent: string; team: string; leadPractitioner: string; lastEncounter: string | null;
};
type Encounter = {
  id: string; athleteId: string; encounterDate: string; encounterType: string; clinicCity: string;
  clinicType: string; clinicLocation: string; reason: string; diagnosis: string;
  subjective: string; objective: string; assessment: string; plan: string; visibility: string;
  followUpDate: string | null; practitioner: string; specialty: string; amendmentCount: number;
  canEdit: number; injuryId?: string | null; injuryTitle?: string | null;
};
type EncounterUpdate = Partial<Pick<Encounter, "subjective" | "objective" | "assessment" | "plan" | "diagnosis">> & { amendmentReason?: string };
type Injury = {
  id: string; athleteId: string; title: string; diagnosisStatus: string; bodyArea: string; laterality: string;
  onsetDate: string; mechanism: string; severity: string; participationStatus: string; stage: string;
  nextAction: string; reviewDate: string | null; expectedReturnDate: string | null; closureSummary: string | null;
  closedAt: string | null; createdAt: string; updatedAt: string; athleteName: string; mrn: string; sport: string;
  team: string; leadPractitioner: string; linkedEncounterCount: number;
};
type InjuryHistory = { id: string; injuryId: string; fromStage: string | null; toStage: string; note: string; changedBy: string; createdAt: string };
type RehabilitationPlan = {
  id: string; injuryId: string; athleteId: string; title: string; status: string; startDate: string;
  targetDate: string | null; currentPhase: number; overallProgress: number; weeklyFrequency: string;
  primaryGoal: string; precautions: string; nextReviewDate: string | null; athleteName: string; mrn: string;
  sport: string; injuryTitle: string; ownerPractitioner: string; currentPhaseId: string; currentPhaseTitle: string;
  currentPhaseProgress: number; currentExitCriteria: string; phaseCount: number; completedSessionCount: number;
  nextSessionDate: string | null; createdAt: string; updatedAt: string;
};
type RehabilitationPhase = { id: string; planId: string; phaseNumber: number; title: string; status: string; goals: string; entryCriteria: string; exitCriteria: string; progress: number; startedAt: string | null; completedAt: string | null };
type RehabilitationExercise = { id: string; phaseId: string; name: string; dosage: string; target: string; status: string; sortOrder: number };
type RehabilitationSession = { id: string; planId: string; phaseId: string; sessionDate: string; sessionType: string; status: string; loadScore: number | null; painPre: number | null; painPost: number | null; phaseProgress: number | null; notes: string; nextAction: string; completedAt: string | null; practitioner: string };
type Practitioner = { id: string; name: string; specialty: string; credentials: string };
type Activity = { id: number; action: string; entityType: string; entityId: string; summary: string; createdAt: string; actor: string };
type RefItem = { id: string; name: string; category?: string };
type Bootstrap = {
  actor: { id: string; name: string; email: string; specialty: string; defaultEncounterType: string; clinicCity: string; clinicType: string; clinicLocation: string };
  athletes: Athlete[]; encounters: Encounter[]; injuries: Injury[]; injuryHistory: InjuryHistory[]; rehabilitationPlans: RehabilitationPlan[]; rehabilitationPhases: RehabilitationPhase[]; rehabilitationExercises: RehabilitationExercise[]; rehabilitationSessions: RehabilitationSession[]; practitioners: Practitioner[]; activities: Activity[];
  sports: RefItem[]; teams: RefItem[];
  stats: { activeAthletes: number; encountersThisWeek: number; followUps: number; modifiedTraining: number; openInjuries: number; rtsReviews: number; activeRehabPlans: number; rehabSessionsThisWeek: number; rehabCriteriaReady: number; rehabReviewsDue: number };
};

const statusOptions = ["Available", "Modified Training", "Under Treatment", "Return-to-Sport Review", "Temporarily Unavailable"];
const navItems = ["Overview", "Athletes", "Injuries", "Rehabilitation", "Care Team"] as const;
const futureItems = ["Nutrition", "Psychology", "Performance"];
const navGlyphs: Record<string, string> = {
  Overview: "âŒ‚", Athletes: "â—Ž", Encounters: "â‰¡", "Care Team": "â—‡",
  Injuries: "+", Rehabilitation: "â†—", Nutrition: "â—’", Psychology: "â—‰", Performance: "âŒ",
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

function fullName(athlete: Athlete) {
  return `${athlete.firstName} ${athlete.lastName}`;
}

function age(date: string) {
  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) return "â€”";
  const dob = new Date(`${date}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) years--;
  return years;
}

function shortDate(value: string | null) {
  if (!value) return "â€”";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function makkahTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh" }).format(new Date(value));
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.round(diff / 36e5));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Avatar({ name, color = "#006C46", size = "md" }: { name: string; color?: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`avatar avatar-${size}`} style={{ "--avatar": color } as React.CSSProperties}>{initials(name)}</span>;
}

function Status({ value }: { value: string }) {
  const key = value.toLowerCase().replace(/[^a-z]+/g, "-");
  return <span className={`status status-${key}`}><span className="status-dot" />{value}</span>;
}

export default function SOPCareApp({ identity, onSwitchWorkspace, onLogout }: { identity: PortalUser; onSwitchWorkspace?: () => void; onLogout: () => void }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("Overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInjuryId, setSelectedInjuryId] = useState<string | null>(null);
  const [selectedRehabilitationId, setSelectedRehabilitationId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState("Encounters");
  const [query, setQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("All sports");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [modal, setModal] = useState<null | "athlete" | "encounter" | "edit" | "care" | "injury" | "injuryStage" | "linkEncounter" | "rehabilitation" | "rehabSession" | "rehabAdvance" | "clinicalSafety" | "practitionerProfile">(null);
  const [safetyCategory, setSafetyCategory] = useState<"allergies" | "chronicConditions" | "prohibitedMedications">("allergies");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  async function loadData() {
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the clinical workspace.");
      setData(await response.json());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load SOPCare.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const selected = data?.athletes.find((athlete) => athlete.id === selectedId) ?? null;
  const selectedInjury = data?.injuries.find((injury) => injury.id === selectedInjuryId) ?? null;
  const selectedRehabilitation = data?.rehabilitationPlans.find((plan) => plan.id === selectedRehabilitationId) ?? null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.athletes ?? []).filter((athlete) => {
      const matchesQuery = !normalized || `${fullName(athlete)} ${athlete.mrn} ${athlete.team}`.toLowerCase().includes(normalized);
      const matchesSport = sportFilter === "All sports" || athlete.sport === sportFilter;
      const matchesStatus = statusFilter === "All statuses" || athlete.status === statusFilter;
      return matchesQuery && matchesSport && matchesStatus;
    });
  }, [data, query, sportFilter, statusFilter]);

  function showProfile(id: string) {
    setSelectedId(id);
    setProfileTab("Encounters");
    setView("Profile");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showInjury(id: string) {
    setSelectedInjuryId(id);
    setView("InjuryDetail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showRehabilitation(id: string) {
    setSelectedRehabilitationId(id);
    setView("RehabilitationDetail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(next: string) {
    setView(next);
    setSelectedId(null);
    setSelectedInjuryId(null);
    setSelectedRehabilitationId(null);
    if (next !== "Athletes") setQuery("");
  }

  async function apiAction(path: string, options: RequestInit, success: string) {
    setBusy(true);
    try {
      const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}) } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The request could not be completed.");
      setModal(null);
      setToast(success);
      await loadData();
      return body;
    } catch (actionError) {
      setToast(actionError instanceof Error ? actionError.message : "Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitAthlete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const result = await apiAction("/api/athletes", { method: "POST", body: JSON.stringify(body) }, "Athlete profile created");
    if (result?.id) showProfile(result.id);
  }

  async function submitEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiAction("/api/encounters", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) }, "Encounter saved");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await apiAction(`/api/athletes/${selected.id}`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Athlete profile updated");
  }

  async function submitPractitionerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiAction("/api/practitioner-profile", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Practitioner profile updated");
  }

  async function submitClinicalSafety(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await apiAction(`/api/athletes/${selected.id}`, { method: "PATCH", body: JSON.stringify({ safetyCategory, value: form.get("value") }) }, "Clinical safety record updated");
  }

  function editClinicalSafety(category: "allergies" | "chronicConditions" | "prohibitedMedications") {
    setSafetyCategory(category);
    setModal("clinicalSafety");
  }

  async function submitCare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await apiAction(`/api/athletes/${selected.id}/care-team`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Care team member assigned");
  }

  async function saveEncounterFields(id: string, fields: EncounterUpdate) {
    try {
      const response = await fetch(`/api/encounters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The visit could not be saved.");
      setData((current) => current ? { ...current, encounters: current.encounters.map((encounter) => encounter.id === id ? { ...encounter, ...fields } : encounter) } : current);
      return true;
    } catch (saveError) {
      setToast(saveError instanceof Error ? saveError.message : "The visit could not be saved.");
      return false;
    }
  }

  async function submitInjury(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await apiAction("/api/injuries", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Injury episode opened");
    if (result?.id) showInjury(result.id);
  }

  async function submitInjuryStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInjury) return;
    await apiAction(`/api/injuries/${selectedInjury.id}/stage`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Injury pathway updated");
  }

  async function submitLinkEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInjury) return;
    await apiAction(`/api/injuries/${selectedInjury.id}/encounters`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Encounter linked to injury episode");
  }

  async function submitRehabilitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await apiAction("/api/rehabilitation", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Rehabilitation plan opened");
    if (result?.id) showRehabilitation(result.id);
  }

  async function submitRehabSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRehabilitation) return;
    await apiAction(`/api/rehabilitation/${selectedRehabilitation.id}/sessions`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Rehabilitation session recorded");
  }

  async function submitRehabAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRehabilitation) return;
    await apiAction(`/api/rehabilitation/${selectedRehabilitation.id}/advance`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }, "Rehabilitation phase advanced");
  }

  if (loading) {
    return <main className="loading-screen"><div className="brand-mark">S</div><p>Preparing your clinical workspace</p><span className="loading-line" /></main>;
  }

  if (!data || error) {
    return <main className="error-screen"><div className="brand-mark">S</div><h1>SOPCare is temporarily unavailable</h1><p>{error}</p><button className="button primary" onClick={() => { setLoading(true); void loadData(); }}>Try again</button></main>;
  }

  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("Overview")} aria-label="SOPCare overview">
          <span className="brand-mark">S</span><span><strong>SOPCare</strong><small>Sports Health Intelligence</small></span>
        </button>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => <button key={item} className={`nav-item ${view === item || (view === "Profile" && item === "Athletes") || (view === "InjuryDetail" && item === "Injuries") || (view === "RehabilitationDetail" && item === "Rehabilitation") ? "active" : ""}`} onClick={() => navigate(item)}><span className="nav-glyph" aria-hidden="true">{navGlyphs[item]}</span>{item}</button>)}
          <p className="nav-label future-label">Care modules</p>
          {futureItems.map((item) => <button key={item} className="nav-item future" disabled title="Coming in a future SOPCare brick"><span className="nav-glyph" aria-hidden="true">{navGlyphs[item]}</span>{item}<span className="soon">Soon</span></button>)}
        </nav>
        <div className="sidebar-foot">
          <span className="secure-pulse" /><div><strong>Private workspace</strong><small>Authenticated access</small></div>
        </div>
        <div className="sidebar-session-actions">
          {onSwitchWorkspace && <button onClick={onSwitchWorkspace}>Switch workspace</button>}
          <button onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => navigate("Overview")}><span className="brand-mark">S</span><strong>SOPCare</strong></button>
          <label className="global-search"><span>âŒ•</span><input aria-label="Search athletes" placeholder="Search athlete or MRNâ€¦" value={query} onChange={(event) => { setQuery(event.target.value); setView("Athletes"); }} /><kbd>âŒ˜ K</kbd></label>
          <div className="top-actions"><button className="icon-button" aria-label="Notifications"><span className="notification-dot" />â—Œ</button><button className="account" onClick={() => setModal("practitionerProfile")} aria-label="Open practitioner profile"><Avatar name={identity.fullName} size="sm" /><span><strong>{identity.fullName}</strong><small>{identity.professionalRole}</small></span><span className="chevron">âŒ„</span></button></div>
        </header>
        <div className="prototype-banner"><span>Prototype environment</span> Do not enter real patient information.</div>

        <main className="content">
          {view === "Overview" && <Overview data={data} today={today} onSearch={(value) => { setQuery(value); setView("Athletes"); }} onInjuries={() => navigate("Injuries")} />}
          {view === "Athletes" && <AthletesView athletes={filtered} all={data.athletes} query={query} setQuery={setQuery} sportFilter={sportFilter} setSportFilter={setSportFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onAthlete={showProfile} />}
          {view === "Injuries" && <InjuriesView injuries={data.injuries} onNew={() => setModal("injury")} onOpen={showInjury} />}
          {view === "InjuryDetail" && selectedInjury && <InjuryDetailView injury={selectedInjury} rehabilitationPlan={data.rehabilitationPla…17958 tokens truncated…specialty}</p></span><b>Verified account</b></div><div className="form-grid"><label className="span-2">Athlete*<select name="athleteId" required defaultValue={selectedId ?? ""}><option value="">Select athlete</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{fullName(athlete)} Â· {athlete.mrn}</option>)}</select></label><label>Encounter type*<select name="encounterType" required><option>Medical Review</option><option>Physiotherapy Review</option><option>Nutrition Follow-up</option><option>Performance Psychology</option><option>Return-to-Sport Review</option><option>Medical Screening</option></select></label><label>Clinic city*<select name="clinicCity" required defaultValue="Riyadh"><option>Riyadh</option><option>Dammam</option><option>Dhahran</option></select></label><label className="span-2">Clinic type*<select name="clinicType" required defaultValue="Sports Medicine Clinic"><option>Sports Medicine Clinic</option><option>Physiotherapy Clinic</option><option>Sports Nutrition Clinic</option><option>Sports Psychology Clinic</option><option>Performance &amp; Recovery Clinic</option></select></label><label className="span-2">Clinic location*<input name="clinicLocation" required placeholder="e.g. Riyadh High Performance Center" /></label><label className="span-2">Reason for visit*<input name="reason" required placeholder="Concise clinical reason" /></label><label className="span-2 history-field">History<RichHistoryInput /></label><label className="span-2">Diagnosis Â· free text*<textarea name="diagnosis" rows={3} required placeholder="Write the clinical diagnosis in plain language â€” no ICD-10 code required" /></label><details className="advanced-options span-2"><summary>More options</summary><div><label>Visibility<select name="visibility"><option>Care team</option><option>Restricted</option></select></label><label>Follow-up date<input name="followUpDate" type="date" /></label></div></details></div><div className="finish-visit-note"><span>âœ“</span><p><strong>Finish Visit</strong><small>The visit becomes read-only. You can reopen it later through a documented amendment.</small></p></div><div className="modal-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Finishingâ€¦" : "Finish Visit"}</button></div></form>;
}

function LegacyEncounterForm({ athletes, actor, selectedId, onSubmit, busy }: { athletes: Athlete[]; actor: Bootstrap["actor"]; selectedId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Clinical encounter" title="New encounter" text="Record the visit, review the clinical note, then finish it as a completed record." /><div className="encounter-author-strip"><Avatar name={actor.name} size="sm" /><span><small>Practitioner</small><strong>{actor.name}</strong><p>{actor.specialty}</p></span><b>Verified account</b></div><div className="form-grid"><label className="span-2">Athlete*<select name="athleteId" required defaultValue={selectedId ?? ""}><option value="">Select athlete</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{fullName(athlete)} Â· {athlete.mrn}</option>)}</select></label><label>Encounter type*<select name="encounterType" required><option>Medical Review</option><option>Physiotherapy Review</option><option>Nutrition Follow-up</option><option>Performance Psychology</option><option>Return-to-Sport Review</option><option>Medical Screening</option></select></label><label>Clinic city*<select name="clinicCity" required defaultValue="Riyadh"><option>Riyadh</option><option>Dammam</option><option>Dhahran</option></select></label><label className="span-2">Clinic type*<select name="clinicType" required defaultValue="Sports Medicine Clinic"><option>Sports Medicine Clinic</option><option>Physiotherapy Clinic</option><option>Sports Nutrition Clinic</option><option>Sports Psychology Clinic</option><option>Performance &amp; Recovery Clinic</option></select></label><label className="span-2">Clinic location*<input name="clinicLocation" required placeholder="e.g. Riyadh High Performance Center" /></label><label className="span-2">Reason for visit*<input name="reason" required placeholder="Concise clinical reason" /></label><label className="span-2">Subjective history<textarea name="subjective" rows={3} placeholder="Symptoms, training context, mechanism, response to load and athlete goals" /></label><label className="span-2">Objective findings<textarea name="objective" rows={3} placeholder="Examination, functional testing, relevant measures and red flags" /></label><label>Clinical assessment<textarea name="assessment" rows={4} placeholder="Clinical reasoning and impact on sport participation" /></label><label>Management plan<textarea name="plan" rows={4} placeholder="Treatment, loading advice, referrals and return-to-sport actions" /></label><label className="span-2">Diagnosis Â· free text*<textarea name="diagnosis" rows={3} required placeholder="Write the clinical diagnosis in plain language â€” no ICD-10 code required" /></label><details className="advanced-options span-2"><summary>More options</summary><div><label>Visibility<select name="visibility"><option>Care team</option><option>Restricted</option></select></label><label>Follow-up date<input name="followUpDate" type="date" /></label></div></details></div><div className="finish-visit-note"><span>âœ“</span><p><strong>Finish Visit</strong><small>The visit becomes read-only. You can reopen it later through a documented amendment.</small></p></div><div className="modal-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Finishingâ€¦" : "Finish Visit"}</button></div></form>;
}

function InjuryForm({ athletes, practitioners, selectedId, onSubmit, busy }: { athletes: Athlete[]; practitioners: Practitioner[]; selectedId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Injury management" title="Open injury episode" text="Create a shared pathway from first assessment through safe return to sport." /><div className="form-grid"><label className="span-2">Athlete*<select name="athleteId" required defaultValue={selectedId ?? ""} autoFocus><option value="">Select athlete</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{fullName(athlete)} Â· {athlete.mrn}</option>)}</select></label><label className="span-2">Episode title*<input name="title" required placeholder="e.g. Right hamstring strain" /></label><label>Diagnosis status*<select name="diagnosisStatus" defaultValue="Suspected"><option>Suspected</option><option>Confirmed</option></select></label><label>Severity*<select name="severity" defaultValue="Moderate"><option>Mild</option><option>Moderate</option><option>Severe</option></select></label><label>Body area*<input name="bodyArea" required placeholder="e.g. Posterior thigh" /></label><label>Laterality<select name="laterality"><option>Right</option><option>Left</option><option>Bilateral</option><option>Not applicable</option></select></label><label>Onset date*<input name="onsetDate" type="date" required /></label><label>Participation status*<select name="participationStatus" defaultValue="Under Treatment"><option>Available</option><option>Modified Training</option><option>Under Treatment</option><option>Return-to-Sport Review</option><option>Unavailable</option></select></label><label className="span-2">Mechanism*<input name="mechanism" required placeholder="How did the episode start?" /></label><label className="span-2">Lead practitioner*<select name="leadPractitionerId" required><option value="">Select practitioner</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name} Â· {person.specialty}</option>)}</select></label><label className="span-2">Next clinical action*<textarea name="nextAction" required rows={3} placeholder="The next clear action for the care team" /></label><label>Review date<input name="reviewDate" type="date" /></label><label>Expected return<input name="expectedReturnDate" type="date" /></label></div><ModalActions busy={busy} primary="Open injury episode" /></form>;
}

function InjuryStageForm({ injury, onSubmit, busy }: { injury: Injury; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Clinical pathway" title="Update injury stage" text={`Record the next shared decision for ${injury.athleteName}.`} /><div className="locked-note injury-note"><Status value={injury.stage} /><div><strong>{injury.title}</strong><small>Current pathway stage</small></div></div><div className="form-grid one-column"><label>Pathway stage*<select name="stage" required defaultValue={injury.stage} autoFocus>{injuryStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label>Participation status*<select name="participationStatus" required defaultValue={injury.participationStatus}><option>Available</option><option>Modified Training</option><option>Under Treatment</option><option>Return-to-Sport Review</option><option>Unavailable</option></select></label><label>Decision note<textarea name="note" rows={3} placeholder="Why is the pathway changing?" /></label><label>Next clinical action*<textarea name="nextAction" rows={3} required defaultValue={injury.nextAction} /></label><label>Review date<input name="reviewDate" type="date" defaultValue={injury.reviewDate ?? ""} /></label><label>Expected return<input name="expectedReturnDate" type="date" defaultValue={injury.expectedReturnDate ?? ""} /></label><label>Closure summary<textarea name="closureSummary" rows={4} defaultValue={injury.closureSummary ?? ""} placeholder="Required when moving the episode to Closed" /></label></div><ModalActions busy={busy} primary="Update pathway" /></form>;
}

function LinkEncounterForm({ injury, encounters, onSubmit, busy }: { injury: Injury; encounters: Encounter[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Connected clinical record" title="Link an encounter" text={`Attach a relevant encounter to ${injury.title}.`} />{encounters.length ? <><div className="form-grid one-column"><label>Encounter*<select name="encounterId" required autoFocus><option value="">Select encounter</option>{encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{shortDate(encounter.encounterDate)} Â· {encounter.encounterType} Â· {encounter.practitioner}</option>)}</select></label></div><ModalActions busy={busy} primary="Link encounter" /></> : <div className="empty-state compact-empty"><h3>No available encounters</h3><p>Create an encounter for this athlete before linking it to the injury pathway.</p></div>}</form>;
}

function RehabilitationForm({ injuries, practitioners, selectedInjuryId, onSubmit, busy }: { injuries: Injury[]; practitioners: Practitioner[]; selectedInjuryId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const clinicalPractitioners = practitioners.filter((person) => ["Sports Medicine", "Physiotherapy"].includes(person.specialty));
  return <form onSubmit={onSubmit}><ModalHeading kicker="Rehabilitation pathway" title="Create rehabilitation plan" text="Define the goal, review cadence, and four-stage criteria-led pathway for an open injury episode." /><div className="form-grid"><label className="span-2">Injury episode*<select name="injuryId" required defaultValue={selectedInjuryId ?? ""}><option value="">Select open injury</option>{injuries.filter((injury) => injury.stage !== "Closed").map((injury) => <option key={injury.id} value={injury.id}>{injury.athleteName} Â· {injury.title}</option>)}</select></label><label className="span-2">Plan title*<input name="title" required placeholder="e.g. Hamstring return-to-speed pathway" /></label><label>Plan owner*<select name="ownerPractitionerId" required><option value="">Select practitioner</option>{clinicalPractitioners.map((person) => <option key={person.id} value={person.id}>{person.name} Â· {person.specialty}</option>)}</select></label><label>Weekly frequency*<input name="weeklyFrequency" required placeholder="e.g. 4 sessions / week" /></label><label>Start date*<input name="startDate" type="date" required /></label><label>Target date<input name="targetDate" type="date" /></label><label>Next review<input name="nextReviewDate" type="date" /></label><label className="span-2">Primary goal*<textarea name="primaryGoal" rows={3} required placeholder="The measurable outcome this plan is working toward" /></label><label className="span-2">Precautions<textarea name="precautions" rows={3} placeholder="Loading restrictions, red flags, and performance constraints" /></label></div><div className="form-note"><span>4</span> SOPCare will create four phases: Protect & restore, Build capacity, Sport integration, and Return to performance.</div><ModalActions busy={busy} primary="Create rehabilitation plan" /></form>;
}

function RehabilitationSessionForm({ plan, onSubmit, busy }: { plan: RehabilitationPlan; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker={`Phase ${plan.currentPhase} Â· ${plan.currentPhaseTitle}`} title="Record rehabilitation session" text={`Capture delivery, response, and the next action for ${plan.athleteName}.`} /><div className="form-grid"><label>Session date & time*<input name="sessionDate" type="datetime-local" required /></label><label>Session status*<select name="status" defaultValue="Completed"><option>Completed</option><option>Scheduled</option></select></label><label className="span-2">Session type*<input name="sessionType" required placeholder="e.g. Field + gym rehabilitation" /></label><label>Load score Â· 0â€“10<input name="loadScore" type="number" min="0" max="10" /></label><label>Phase progress Â· 0â€“100<input name="phaseProgress" type="number" min="0" max="100" defaultValue={plan.currentPhaseProgress} /></label><label>Pain before Â· 0â€“10<input name="painPre" type="number" min="0" max="10" /></label><label>Pain after Â· 0â€“10<input name="painPost" type="number" min="0" max="10" /></label><label className="span-2">Session notes<textarea name="notes" rows={4} placeholder="What was completed and how did the athlete respond?" /></label><label className="span-2">Next action*<textarea name="nextAction" rows={3} required placeholder="The next clear rehabilitation action" /></label></div><ModalActions busy={busy} primary="Record session" /></form>;
}

function RehabilitationAdvanceForm({ plan, onSubmit, busy }: { plan: RehabilitationPlan; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const finalPhase = plan.currentPhase >= plan.phaseCount;
  return <form onSubmit={onSubmit}><ModalHeading kicker="Criteria-led progression" title={finalPhase ? "Complete rehabilitation plan" : "Advance rehabilitation phase"} text="Confirm that the current exit criteria have been reviewed before changing the pathway." /><div className="advance-summary"><ProgressRing value={plan.currentPhaseProgress} /><div><small>Current phase {plan.currentPhase} of {plan.phaseCount}</small><strong>{plan.currentPhaseTitle}</strong><p>{plan.currentExitCriteria}</p></div></div><label className="criteria-confirm"><input type="checkbox" name="criteriaMet" required /><span><strong>Exit criteria have been met and reviewed</strong><small>This decision will be stored in the audit trail.</small></span></label><div className="form-grid one-column"><label>Clinical decision note*<textarea name="decisionNote" rows={4} required placeholder="Summarize the objective evidence and shared decision" /></label></div><ModalActions busy={busy} primary={finalPhase ? "Complete plan" : "Advance phase"} /></form>;
}

function EditForm({ athlete, onSubmit, busy }: { athlete: Athlete; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker={athlete.mrn} title="Update athlete profile" text="Keep the current clinical status and contact information accurate for the care team." /><div className="form-grid one-column"><label>Clinical status<select name="status" defaultValue={athlete.status}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label><label>Emergency contact<input name="emergencyContact" defaultValue={athlete.emergencyContact} /></label><input type="hidden" name="medicalAlerts" value={athlete.medicalAlerts} /><input type="hidden" name="followUpDate" value={athlete.followUpDate ?? ""} /></div><ModalActions busy={busy} primary="Save changes" /></form>;
}

function ClinicalSafetyForm({ athlete, category, onSubmit, busy }: { athlete: Athlete; category: "allergies" | "chronicConditions" | "prohibitedMedications"; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const detail = safetyDetails[category];
  const initialItems = athlete[category] === "None recorded" ? [] : athlete[category].split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const [noneConfirmed, setNoneConfirmed] = useState(!initialItems.length);
  const addItem = () => { const value = draft.trim(); if (!value || items.some((item) => item.toLowerCase() === value.toLowerCase())) return; setItems([...items, value]); setDraft(""); setNoneConfirmed(false); };
  return <form onSubmit={onSubmit}><ModalHeading kicker={athlete.mrn} title={detail.title} text="Add each item separately. Saved items remain visible and can be removed individually." /><div className="form-grid one-column"><label>{detail.title}<div className="safety-entry"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addItem(); } }} placeholder={`Add ${detail.title.toLowerCase()} and press Enter`} autoFocus /><button type="button" className="button secondary small" onClick={addItem}>Add</button></div></label>{items.length > 0 && <div className="safety-chips" aria-label={`Recorded ${detail.title.toLowerCase()}`}>{items.map((item) => <span key={item}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => setItems(items.filter((current) => current !== item))}>Ã—</button></span>)}</div>}<label className="none-option"><input type="checkbox" checked={noneConfirmed} onChange={(event) => setNoneConfirmed(event.target.checked)} /><span><strong>No {detail.title.toLowerCase()} to record</strong><small>This only confirms the empty state; it never removes saved items.</small></span></label><input type="hidden" name="value" value={items.join("\n")} /></div><ModalActions busy={busy} primary="Save clinical safety" /></form>;
}

function CareForm({ athlete, practitioners, onSubmit, busy }: { athlete: Athlete; practitioners: Practitioner[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Shared care" title="Assign practitioner" text={`Add a practitioner to ${fullName(athlete)}â€™s multidisciplinary care team.`} /><div className="form-grid one-column"><label>Practitioner<select name="practitionerId" required autoFocus><option value="">Select practitioner</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name} Â· {person.specialty}</option>)}</select></label></div><ModalActions busy={busy} primary="Assign practitioner" /></form>;
}

function ModalActions({ busy, primary }: { busy: boolean; primary: string }) { return <div className="modal-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Savingâ€¦" : primary}</button></div>; }

