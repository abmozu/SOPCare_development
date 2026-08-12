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
  actor: { id: string; name: string; email: string; specialty: string };
  athletes: Athlete[]; encounters: Encounter[]; injuries: Injury[]; injuryHistory: InjuryHistory[]; rehabilitationPlans: RehabilitationPlan[]; rehabilitationPhases: RehabilitationPhase[]; rehabilitationExercises: RehabilitationExercise[]; rehabilitationSessions: RehabilitationSession[]; practitioners: Practitioner[]; activities: Activity[];
  sports: RefItem[]; teams: RefItem[];
  stats: { activeAthletes: number; encountersThisWeek: number; followUps: number; modifiedTraining: number; openInjuries: number; rtsReviews: number; activeRehabPlans: number; rehabSessionsThisWeek: number; rehabCriteriaReady: number; rehabReviewsDue: number };
};

const statusOptions = ["Available", "Modified Training", "Under Treatment", "Return-to-Sport Review", "Temporarily Unavailable"];
const navItems = ["Overview", "Athletes", "Injuries", "Rehabilitation", "Care Team"] as const;
const futureItems = ["Nutrition", "Psychology", "Performance"];
const navGlyphs: Record<string, string> = {
  Overview: "⌂", Athletes: "◎", Encounters: "≡", "Care Team": "◇",
  Injuries: "+", Rehabilitation: "↗", Nutrition: "◒", Psychology: "◉", Performance: "⌁",
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("");
}

function fullName(athlete: Athlete) {
  return `${athlete.firstName} ${athlete.lastName}`;
}

function age(date: string) {
  const dob = new Date(`${date}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) years--;
  return years;
}

function shortDate(value: string | null) {
  if (!value) return "—";
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
  const [modal, setModal] = useState<null | "athlete" | "encounter" | "edit" | "care" | "injury" | "injuryStage" | "linkEncounter" | "rehabilitation" | "rehabSession" | "rehabAdvance" | "clinicalSafety">(null);
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
          <label className="global-search"><span>⌕</span><input aria-label="Search athletes" placeholder="Search athlete or MRN…" value={query} onChange={(event) => { setQuery(event.target.value); setView("Athletes"); }} /><kbd>⌘ K</kbd></label>
          <div className="top-actions"><button className="icon-button" aria-label="Notifications"><span className="notification-dot" />◌</button><div className="account"><Avatar name={identity.fullName} size="sm" /><span><strong>{identity.fullName}</strong><small>{identity.professionalRole}</small></span><span className="chevron">⌄</span></div></div>
        </header>
        <div className="prototype-banner"><span>Prototype environment</span> Do not enter real patient information.</div>

        <main className="content">
          {view === "Overview" && <Overview data={data} today={today} onSearch={(value) => { setQuery(value); setView("Athletes"); }} onInjuries={() => navigate("Injuries")} />}
          {view === "Athletes" && <AthletesView athletes={filtered} all={data.athletes} query={query} setQuery={setQuery} sportFilter={sportFilter} setSportFilter={setSportFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onAthlete={showProfile} />}
          {view === "Injuries" && <InjuriesView injuries={data.injuries} onNew={() => setModal("injury")} onOpen={showInjury} />}
          {view === "InjuryDetail" && selectedInjury && <InjuryDetailView injury={selectedInjury} rehabilitationPlan={data.rehabilitationPlans.find((plan) => plan.injuryId === selectedInjury.id)} history={data.injuryHistory.filter((item) => item.injuryId === selectedInjury.id)} encounters={data.encounters.filter((item) => item.injuryId === selectedInjury.id)} onBack={() => navigate("Injuries")} onAthlete={showProfile} onStage={() => setModal("injuryStage")} onLink={() => setModal("linkEncounter")} onRehabilitation={showRehabilitation} onCreateRehabilitation={() => setModal("rehabilitation")} />}
          {view === "Rehabilitation" && <RehabilitationView plans={data.rehabilitationPlans} stats={data.stats} onNew={() => setModal("rehabilitation")} onOpen={showRehabilitation} />}
          {view === "RehabilitationDetail" && selectedRehabilitation && <RehabilitationDetailView plan={selectedRehabilitation} phases={data.rehabilitationPhases.filter((phase) => phase.planId === selectedRehabilitation.id)} exercises={data.rehabilitationExercises} sessions={data.rehabilitationSessions.filter((session) => session.planId === selectedRehabilitation.id)} onBack={() => navigate("Rehabilitation")} onInjury={showInjury} onAthlete={showProfile} onSession={() => setModal("rehabSession")} onAdvance={() => setModal("rehabAdvance")} />}
          {view === "Care Team" && <CareTeamView practitioners={data.practitioners} athletes={data.athletes} />}
          {view === "Profile" && selected && <ProfileView athlete={selected} athletes={data.athletes} encounters={data.encounters} injuries={data.injuries.filter((injury) => injury.athleteId === selected.id)} practitioners={data.practitioners} tab={profileTab} setTab={setProfileTab} onBack={() => navigate("Athletes")} onAthlete={showProfile} onEncounter={() => setModal("encounter")} onNewInjury={() => setModal("injury")} onInjury={showInjury} onEdit={() => setModal("edit")} onCare={() => setModal("care")} onSafety={editClinicalSafety} onSave={saveEncounterFields} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <button key={item} className={view === item || (view === "Profile" && item === "Athletes") || (view === "InjuryDetail" && item === "Injuries") || (view === "RehabilitationDetail" && item === "Rehabilitation") ? "active" : ""} onClick={() => navigate(item)}><span aria-hidden="true">{navGlyphs[item]}</span>{item === "Care Team" ? "Team" : item === "Rehabilitation" ? "Rehab" : item}</button>)}</nav>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className={`modal ${modal === "encounter" || modal === "injury" || modal === "rehabilitation" ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="modal-close" onClick={() => setModal(null)} aria-label="Close dialog">×</button>
          {modal === "athlete" && <AthleteForm data={data} onSubmit={submitAthlete} busy={busy} />}
          {modal === "encounter" && <EncounterForm athletes={data.athletes} actor={data.actor} selectedId={selected?.id} onSubmit={submitEncounter} busy={busy} />}
          {modal === "edit" && selected && <EditForm athlete={selected} onSubmit={submitEdit} busy={busy} />}
          {modal === "care" && selected && <CareForm athlete={selected} practitioners={data.practitioners} onSubmit={submitCare} busy={busy} />}
          {modal === "injury" && <InjuryForm athletes={data.athletes} practitioners={data.practitioners} selectedId={selected?.id} onSubmit={submitInjury} busy={busy} />}
          {modal === "injuryStage" && selectedInjury && <InjuryStageForm injury={selectedInjury} onSubmit={submitInjuryStage} busy={busy} />}
          {modal === "linkEncounter" && selectedInjury && <LinkEncounterForm injury={selectedInjury} encounters={data.encounters.filter((item) => item.athleteId === selectedInjury.athleteId && item.injuryId !== selectedInjury.id)} onSubmit={submitLinkEncounter} busy={busy} />}
          {modal === "rehabilitation" && <RehabilitationForm injuries={data.injuries} practitioners={data.practitioners} selectedInjuryId={selectedInjury?.id} onSubmit={submitRehabilitation} busy={busy} />}
          {modal === "rehabSession" && selectedRehabilitation && <RehabilitationSessionForm plan={selectedRehabilitation} onSubmit={submitRehabSession} busy={busy} />}
          {modal === "rehabAdvance" && selectedRehabilitation && <RehabilitationAdvanceForm plan={selectedRehabilitation} onSubmit={submitRehabAdvance} busy={busy} />}
          {modal === "clinicalSafety" && selected && <ClinicalSafetyForm athlete={selected} category={safetyCategory} onSubmit={submitClinicalSafety} busy={busy} />}
        </section>
      </div>}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}

function Overview({ data, today, onSearch, onInjuries }: { data: Bootstrap; today: string; onSearch: (value: string) => void; onInjuries: () => void }) {
  return <>
    <PageHeading eyebrow={today} title={`Good morning, ${data.actor.name.split(" ").slice(-1)[0]}`} text="Find an athlete and continue their multidisciplinary care." />
    <section className="hero-card">
      <div className="hero-copy"><span className="hero-kicker">Clinical command center</span><h2>See the athlete.<br />Align the whole team.</h2><p>Move from the latest clinical decision to the next action without losing context across specialties.</p><label className="hero-search"><span>⌕</span><input aria-label="Find an athlete" placeholder="Search name, MRN, team, or sport" onKeyDown={(event) => { if (event.key === "Enter") onSearch(event.currentTarget.value); }} /><button onClick={(event) => onSearch(event.currentTarget.parentElement?.querySelector("input")?.value ?? "")}>Find athlete</button></label></div>
      <div className="hero-board">
        <div className="hero-board-head"><div><span>Today’s care board</span><small>Live from the clinical record</small></div><i><b /> Live</i></div>
        <button onClick={() => onSearch("")}><span className="board-index urgent">01</span><div><strong>{data.stats.followUps} follow-ups due</strong><small>Review scheduled care decisions</small></div><b>›</b></button>
        <button onClick={() => onSearch("")}><span className="board-index draft">02</span><div><strong>{data.stats.encountersThisWeek} encounters this week</strong><small>Open the multidisciplinary record</small></div><b>›</b></button>
        <button onClick={onInjuries}><span className="board-index watch">03</span><div><strong>{data.stats.openInjuries} open injury episodes</strong><small>{data.stats.rtsReviews} awaiting return-to-sport review</small></div><b>›</b></button>
      </div>
    </section>
  </>;
}

function AthletesView({ athletes, all, query, setQuery, sportFilter, setSportFilter, statusFilter, setStatusFilter, onAthlete }: { athletes: Athlete[]; all: Athlete[]; query: string; setQuery: (v: string) => void; sportFilter: string; setSportFilter: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; onAthlete: (id: string) => void }) {
  const [rosterMode, setRosterMode] = useState<"By sport" | "All athletes">("By sport");
  const sports = Array.from(new Set(all.map((athlete) => athlete.sport))).sort();
  const visibleSports = Array.from(new Set(athletes.map((athlete) => athlete.sport))).sort();
  const clearFilters = () => { setQuery(""); setSportFilter("All sports"); setStatusFilter("All statuses"); };
  return <>
    <PageHeading eyebrow="Clinical registry" title="Athletes" text="Find every athlete by sport or review the complete clinical registry." />
    <section className="panel registry-panel"><div className="registry-tools"><label className="table-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, MRN, team, or sport" aria-label="Search athlete registry" /></label><select value={sportFilter} onChange={(event) => setSportFilter(event.target.value)} aria-label="Filter by sport"><option>All sports</option>{sports.map((sport) => <option key={sport}>{sport}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option>All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select><div className="roster-mode-switch" aria-label="Athlete view"><button className={rosterMode === "By sport" ? "active" : ""} onClick={() => setRosterMode("By sport")}>By sport</button><button className={rosterMode === "All athletes" ? "active" : ""} onClick={() => setRosterMode("All athletes")}>All athletes</button></div><span className="result-count">{athletes.length} athletes</span></div>
      {athletes.length && rosterMode === "By sport" ? <div className="sport-roster-groups athlete-registry-groups">{visibleSports.map((sport) => { const members = athletes.filter((athlete) => athlete.sport === sport); return <section key={sport}><header><span>{sport.slice(0, 2).toUpperCase()}</span><div><strong>{sport}</strong><small>{members.length} athletes</small></div></header><div>{members.map((athlete) => <button key={athlete.id} onClick={() => onAthlete(athlete.id)}><Avatar name={fullName(athlete)} color={athlete.accent} size="sm" /><span><strong>{fullName(athlete)}</strong><small>{athlete.discipline} · {athlete.mrn}</small></span><Status value={athlete.status} /><b>›</b></button>)}</div></section>; })}</div> : athletes.length ? <div className="table-wrap"><table><thead><tr><th>Athlete</th><th>Sport / discipline</th><th>Squad</th><th>Clinical status</th><th>Lead practitioner</th><th>Last encounter</th><th /></tr></thead><tbody>{athletes.map((athlete) => <tr key={athlete.id} onClick={() => onAthlete(athlete.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onAthlete(athlete.id); }}><td><div className="athlete-cell"><Avatar name={fullName(athlete)} color={athlete.accent} /><span><strong>{fullName(athlete)}</strong><small>{athlete.mrn} · {age(athlete.dateOfBirth)} yrs</small></span></div></td><td><strong>{athlete.sport}</strong><small className="cell-sub">{athlete.discipline}</small></td><td>{athlete.team}</td><td><Status value={athlete.status} /></td><td>{athlete.leadPractitioner}</td><td>{shortDate(athlete.lastEncounter)}</td><td><button className="row-menu" aria-label={`Open ${fullName(athlete)}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>⌕</span><h3>No athletes match those filters</h3><p>Try a broader name, sport, or clinical status.</p><button className="button secondary" onClick={clearFilters}>Clear filters</button></div>}
    </section>
  </>;
}

function ProfileView({ athlete, athletes, encounters, injuries, practitioners, tab, setTab, onBack, onAthlete, onEncounter, onNewInjury, onInjury, onEdit, onCare, onSafety, onSave }: { athlete: Athlete; athletes: Athlete[]; encounters: Encounter[]; injuries: Injury[]; practitioners: Practitioner[]; tab: string; setTab: (v: string) => void; onBack: () => void; onAthlete: (id: string) => void; onEncounter: () => void; onNewInjury: () => void; onInjury: (id: string) => void; onEdit: () => void; onCare: () => void; onSafety: (category: "allergies" | "chronicConditions" | "prohibitedMedications") => void; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const athleteEncounters = encounters.filter((encounter) => encounter.athleteId === athlete.id);
  const tabs = [`Encounters ${athleteEncounters.length}`, `Injuries ${injuries.length}`, "Care Team", "Activity Log"];
  return <>
    <button className="back-link" onClick={onBack}>← Athlete registry</button>
    <section className="profile-hero"><span className="profile-watermark" aria-hidden="true">360</span><div className="profile-identity"><Avatar name={fullName(athlete)} color={athlete.accent} size="lg" /><div><span className="profile-kicker">Athlete 360° record</span><div className="profile-title-row"><h1>{fullName(athlete)}</h1><Status value={athlete.status} /></div><p>{athlete.mrn} <span>·</span> {athlete.sport} <span>·</span> {athlete.discipline} <span>·</span> {athlete.team}</p><div className="identity-meta"><span><small>Age</small>{age(athlete.dateOfBirth)} years</span><span><small>Dominant side</small>{athlete.dominantSide}</span><span><small>Lead practitioner</small>{athlete.leadPractitioner}</span></div></div></div><div className="profile-actions"><button className="button secondary" onClick={onEdit}>Edit profile</button><button className="button primary" onClick={onEncounter}>＋ New encounter</button></div></section>
    <div className="tabs" role="tablist">{tabs.map((item) => { const key = item.split(" ").slice(0, item.startsWith("Activity") ? 2 : 1).join(" "); return <button key={item} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{item}</button>; })}</div>
    {tab.startsWith("Encounters") && <><ClinicalSafetyPanel athlete={athlete} onEdit={onSafety} /><EncountersView encounters={encounters} athletes={athletes} initialAthleteId={athlete.id} embedded onNew={onEncounter} onAthlete={onAthlete} onSave={onSave} /></>}
    {tab.startsWith("Injuries") && <div className="panel tab-panel"><div className="panel-head"><div><span className="section-kicker">Injury pathway</span><h3>Injury episodes</h3></div><button className="button primary small" onClick={onNewInjury}>＋ Open episode</button></div>{injuries.length ? <div className="athlete-injury-list">{injuries.map((injury) => <button key={injury.id} onClick={() => onInjury(injury.id)}><div><strong>{injury.title}</strong><small>{injury.bodyArea} · Onset {shortDate(injury.onsetDate)}</small></div><Status value={injury.stage} /><span>›</span></button>)}</div> : <div className="empty-state compact-empty"><h3>No injury episodes</h3><p>Open an episode to coordinate assessment, treatment, and return to sport.</p></div>}</div>}
    {tab === "Care Team" && <div className="panel tab-panel"><div className="panel-head"><div><span className="section-kicker">Multidisciplinary care</span><h3>Assigned practitioners</h3></div><button className="button primary small" onClick={onCare}>＋ Assign practitioner</button></div><div className="team-cards"><CarePerson name={athlete.leadPractitioner} specialty="Lead practitioner" lead />{practitioners.filter((person) => person.name !== athlete.leadPractitioner).map((person) => <CarePerson key={person.id} name={person.name} specialty={person.specialty} />)}</div></div>}
    {tab === "Activity Log" && <div className="panel tab-panel"><div className="audit-message"><span>◎</span><div><h3>Traceable by design</h3><p>Profile edits, assignments, and automatically saved clinical changes remain in the SOPCare audit history.</p></div></div></div>}
  </>;
}

const safetyDetails = {
  allergies: { title: "Allergies", none: "No known allergies", icon: "!" },
  chronicConditions: { title: "Chronic conditions", none: "No chronic conditions recorded", icon: "+" },
  prohibitedMedications: { title: "Prohibited medication", none: "No prohibited medication recorded", icon: "×" },
} as const;

function safetyDisplayItems(value: string) {
  return value.split(/\n|,|\s+/).map((item) => item.trim()).filter(Boolean);
}

function ClinicalSafetyPanel({ athlete, onEdit }: { athlete: Athlete; onEdit: (category: "allergies" | "chronicConditions" | "prohibitedMedications") => void }) {
  return <section className="clinical-safety-panel" aria-label="Clinical safety"><div className="clinical-safety-head"><div><span className="section-kicker">Clinical safety</span><h3>Important athlete information</h3></div><span>Review before care decisions</span></div><div className="clinical-safety-grid">{(Object.keys(safetyDetails) as Array<keyof typeof safetyDetails>).map((category) => { const detail = safetyDetails[category]; const value = athlete[category]; const none = !value || value === "None recorded"; const items = safetyDisplayItems(value); return <article key={category} className={`safety-card ${none ? "is-clear" : "has-record"}`}><span className="safety-icon">{detail.icon}</span><div><small>{detail.title}</small><strong className="safety-value">{none ? detail.none : items.map((item, index) => <span key={`${item}-${index}`}>{index > 0 && <i>•</i>}{item}</span>)}</strong><p>{none ? "Confirm this status or add a record." : "Recorded in the athlete clinical file."}</p></div><button className="button secondary small" onClick={() => onEdit(category)}>{none ? "Confirm / add" : "Edit"}</button></article>; })}</div></section>;
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) { return <div className="summary-item"><small>{label}</small>{children}</div>; }
function CarePerson({ name, specialty, lead }: { name: string; specialty: string; lead?: boolean }) { return <div className="care-person"><Avatar name={name} size="sm" /><span><strong>{name}</strong><small>{specialty}</small></span>{lead && <i>Lead</i>}</div>; }

function EncounterTimeline({ encounters }: { encounters: Encounter[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <div className="panel timeline-panel"><div className="panel-head"><div><span className="section-kicker">Continuity of care</span><h3>Recent encounters</h3></div><span className="result-count">{encounters.length} records</span></div>{encounters.length ? <div className="timeline">{encounters.map((encounter) => {
    const noteOpen = openId === encounter.id;
    return <article className="timeline-item" key={encounter.id}><div className="timeline-marker"><span /></div><div className="timeline-card"><div className="encounter-top"><div><span className="encounter-date">{shortDate(encounter.encounterDate)} · {makkahTime(encounter.encounterDate)}</span><h4>{encounter.encounterType}</h4><p>{encounter.reason}</p></div>{encounter.visibility === "Restricted" && <span className="restricted">Restricted</span>}</div>
      {noteOpen && (encounter.visibility === "Restricted" ? <div className="restricted-note"><span>◉</span><div><strong>Restricted clinical note</strong><p>SOAP content is protected and visible only to authorized specialty roles.</p></div></div> : <SOAPNote encounter={encounter} />)}
      <div className="encounter-foot"><span><Avatar name={encounter.practitioner} size="sm" />{encounter.practitioner} · {encounter.specialty}</span><span><button className="inline-action note-toggle" aria-expanded={noteOpen} onClick={() => setOpenId(noteOpen ? null : encounter.id)}>{noteOpen ? "Hide note" : "View SOAP note"}</button></span></div></div></article>;
  })}</div> : <div className="empty-state compact-empty"><h3>No encounters yet</h3><p>The athlete’s first clinical record will appear here.</p></div>}</div>;
}

function SOAPNote({ encounter }: { encounter: Encounter }) {
  const sections = [
    ["Subjective", encounter.subjective, "S"],
    ["Objective", encounter.objective, "O"],
    ["Assessment", encounter.assessment, "A"],
    ["Plan", encounter.plan, "P"],
  ];
  return <div className="note-preview soap-note" aria-label="SOAP clinical note">{sections.map(([label, content, letter]) => <div key={label}><span className={`soap-letter soap-${letter.toLowerCase()}`}>{letter}</span><div><small>{label}</small><p>{content || `No ${label.toLowerCase()} information recorded.`}</p></div></div>)}</div>;
}

const injuryStages = ["New", "Under Assessment", "Under Treatment", "Modified Training", "Return-to-Sport Review", "Closed"];

function daysOpen(injury: Injury) {
  const end = injury.closedAt ? new Date(injury.closedAt) : new Date();
  return Math.max(0, Math.floor((end.getTime() - new Date(`${injury.onsetDate}T00:00:00`).getTime()) / 864e5));
}

function InjuriesView({ injuries, onNew, onOpen }: { injuries: Injury[]; onNew: () => void; onOpen: (id: string) => void }) {
  const [stageFilter, setStageFilter] = useState("Open episodes");
  const shown = injuries.filter((injury) => stageFilter === "All stages" || (stageFilter === "Open episodes" ? injury.stage !== "Closed" : injury.stage === stageFilter));
  const count = (stage: string) => injuries.filter((injury) => injury.stage === stage).length;
  return <>
    <PageHeading eyebrow="Injury management" title="Injury episodes" text="Coordinate assessment, treatment, training modification, and return-to-sport decisions in one pathway." action={<button className="button primary" onClick={onNew}>＋ Open injury episode</button>} />
    <section className="injury-metrics">
      <div><span className="metric-icon mint">＋</span><small>Assessment queue</small><strong>{count("New") + count("Under Assessment")}</strong><p>New or under assessment</p></div>
      <div><span className="metric-icon teal">↗</span><small>Under treatment</small><strong>{count("Under Treatment")}</strong><p>Active clinical plans</p></div>
      <div><span className="metric-icon gold">⌁</span><small>Modified training</small><strong>{count("Modified Training")}</strong><p>Coordinated load changes</p></div>
      <div><span className="metric-icon rose">✓</span><small>RTS review</small><strong>{count("Return-to-Sport Review")}</strong><p>Shared decisions pending</p></div>
    </section>
    <section className="panel registry-panel"><div className="registry-tools"><div className="stage-filters" role="group" aria-label="Filter injury stages">{["Open episodes", "Under Assessment", "Under Treatment", "Modified Training", "Return-to-Sport Review", "Closed", "All stages"].map((stage) => <button key={stage} className={stageFilter === stage ? "active" : ""} onClick={() => setStageFilter(stage)}>{stage}</button>)}</div><span className="result-count">{shown.length} episodes</span></div>
      {shown.length ? <div className="table-wrap"><table className="injury-table"><thead><tr><th>Athlete</th><th>Injury</th><th>Stage</th><th>Participation</th><th>Days open</th><th>Next review</th><th>Lead</th><th /></tr></thead><tbody>{shown.map((injury) => <tr key={injury.id} onClick={() => onOpen(injury.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(injury.id); }}><td><div className="athlete-cell"><Avatar name={injury.athleteName} /><span><strong>{injury.athleteName}</strong><small>{injury.mrn} · {injury.sport}</small></span></div></td><td><strong>{injury.title}</strong><small className="cell-sub">{injury.bodyArea} · {injury.diagnosisStatus}</small></td><td><Status value={injury.stage} /></td><td>{injury.participationStatus}</td><td><strong>{daysOpen(injury)}</strong> days</td><td>{shortDate(injury.reviewDate)}</td><td>{injury.leadPractitioner}</td><td><button className="row-menu" aria-label={`Open ${injury.title}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>✓</span><h3>No episodes in this stage</h3><p>Choose another pathway stage or open a new injury episode.</p></div>}
    </section>
  </>;
}

function InjuryDetailView({ injury, rehabilitationPlan, history, encounters, onBack, onAthlete, onStage, onLink, onRehabilitation, onCreateRehabilitation }: { injury: Injury; rehabilitationPlan?: RehabilitationPlan; history: InjuryHistory[]; encounters: Encounter[]; onBack: () => void; onAthlete: (id: string) => void; onStage: () => void; onLink: () => void; onRehabilitation: (id: string) => void; onCreateRehabilitation: () => void }) {
  const activeIndex = injuryStages.indexOf(injury.stage);
  return <>
    <button className="back-link" onClick={onBack}>← Injury registry</button>
    <section className="injury-hero"><div className="injury-hero-main"><button className="clean-button injury-athlete" onClick={() => onAthlete(injury.athleteId)}><Avatar name={injury.athleteName} size="lg" /><span><small>{injury.mrn} · {injury.sport}</small><strong>{injury.athleteName}</strong></span></button><div className="injury-title"><span className="profile-kicker">Injury episode · {injury.diagnosisStatus}</span><h1>{injury.title}</h1><p>{injury.bodyArea} · {injury.laterality} · Onset {shortDate(injury.onsetDate)}</p></div></div><div className="injury-hero-actions"><Status value={injury.stage} /><button className="button secondary" onClick={onLink}>Link encounter</button><button className="button primary" onClick={onStage}>Update stage</button></div></section>
    <section className="panel pathway-panel"><div className="panel-head"><div><span className="section-kicker">Clinical pathway</span><h3>Episode progression</h3></div><span className="result-count">Day {daysOpen(injury)}</span></div><div className="stage-track">{injuryStages.map((stage, index) => <div key={stage} className={`${index < activeIndex ? "complete" : ""} ${index === activeIndex ? "current" : ""}`}><span>{index < activeIndex ? "✓" : index + 1}</span><small>{stage}</small></div>)}</div></section>
    <section className="injury-detail-grid"><div className="injury-detail-main"><div className="panel"><div className="panel-head"><div><span className="section-kicker">Clinical snapshot</span><h3>Episode details</h3></div><Status value={injury.participationStatus} /></div><div className="snapshot-grid"><SummaryItem label="Body area"><strong>{injury.bodyArea} · {injury.laterality}</strong></SummaryItem><SummaryItem label="Severity"><strong>{injury.severity}</strong></SummaryItem><SummaryItem label="Mechanism"><strong>{injury.mechanism}</strong></SummaryItem><SummaryItem label="Diagnosis"><strong>{injury.diagnosisStatus}</strong></SummaryItem><SummaryItem label="Lead practitioner"><strong>{injury.leadPractitioner}</strong></SummaryItem><SummaryItem label="Expected return"><strong>{shortDate(injury.expectedReturnDate)}</strong></SummaryItem></div></div><div className="next-action-card"><span>Next clinical action</span><h3>{injury.nextAction}</h3><p>Review scheduled {shortDate(injury.reviewDate)}</p></div>{injury.closureSummary && <div className="panel closure-card"><span className="section-kicker">Closure summary</span><p>{injury.closureSummary}</p></div>}{rehabilitationPlan ? <button className="rehab-link-card" onClick={() => onRehabilitation(rehabilitationPlan.id)}><ProgressRing value={rehabilitationPlan.overallProgress} /><div><span>Active rehabilitation plan</span><h3>{rehabilitationPlan.title}</h3><p>Phase {rehabilitationPlan.currentPhase} · {rehabilitationPlan.currentPhaseTitle}</p></div><b>Open plan ›</b></button> : injury.stage !== "Closed" && <button className="rehab-empty-card" onClick={onCreateRehabilitation}><span>↗</span><div><strong>Build the rehabilitation pathway</strong><small>No active rehabilitation plan is linked to this injury.</small></div><b>＋ Create plan</b></button>}<div className="panel"><div className="panel-head"><div><span className="section-kicker">Connected record</span><h3>Linked encounters</h3></div><button className="text-button" onClick={onLink}>＋ Link encounter</button></div>{encounters.length ? <div className="linked-encounters">{encounters.map((encounter) => <div key={encounter.id}><span className="linked-record-mark">≡</span><div><strong>{encounter.encounterType}</strong><small>{encounter.practitioner} · {shortDate(encounter.encounterDate)} · {makkahTime(encounter.encounterDate)} Makkah</small></div></div>)}</div> : <div className="empty-state compact-empty"><h3>No linked encounters</h3><p>Connect relevant notes to keep the pathway evidence together.</p></div>}</div></div>
      <aside className="panel injury-history"><div className="panel-head"><div><span className="section-kicker">Decision trail</span><h3>Status history</h3></div></div><div className="history-timeline">{history.map((item) => <div key={item.id}><i /><span><strong>{item.toStage}</strong><p>{item.note}</p><small>{item.changedBy} · {shortDate(item.createdAt)}</small></span></div>)}</div></aside>
    </section>
  </>;
}

function ProgressRing({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  return <span className={`progress-ring progress-ring-${size}`} style={{ "--progress": `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as React.CSSProperties}><strong>{value}%</strong></span>;
}

function RehabilitationView({ plans, stats, onNew, onOpen }: { plans: RehabilitationPlan[]; stats: Bootstrap["stats"]; onNew: () => void; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState("Active plans");
  const shown = plans.filter((plan) => filter === "All plans" || plan.status === (filter === "Active plans" ? "Active" : "Completed"));
  return <>
    <PageHeading eyebrow="Rehabilitation workspace" title="Plans & progression" text="Turn clinical decisions into measurable phases, sessions, and criteria-led progression." action={<button className="button primary" onClick={onNew}>＋ Create rehabilitation plan</button>} />
    <section className="rehab-overview-metrics"><div><span>↗</span><small>Active plans</small><strong>{stats.activeRehabPlans}</strong><p>Across current injury pathways</p></div><div><span>≡</span><small>Sessions · 7 days</small><strong>{stats.rehabSessionsThisWeek}</strong><p>Completed rehabilitation work</p></div><div><span>✓</span><small>Criteria ready</small><strong>{stats.rehabCriteriaReady}</strong><p>Eligible for phase review</p></div><div><span>!</span><small>Reviews due</small><strong>{stats.rehabReviewsDue}</strong><p>Clinical decisions needed</p></div></section>
    <section className="panel registry-panel"><div className="registry-tools"><div className="stage-filters">{["Active plans", "Completed", "All plans"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><span className="result-count">{shown.length} plans</span></div>{shown.length ? <div className="rehab-plan-grid">{shown.map((plan) => <button key={plan.id} className="rehab-plan-card" onClick={() => onOpen(plan.id)}><div className="rehab-plan-top"><ProgressRing value={plan.overallProgress} size="lg" /><span><Status value={plan.status} /><small>{plan.mrn} · {plan.sport}</small><h3>{plan.athleteName}</h3><p>{plan.injuryTitle}</p></span></div><div className="rehab-plan-phase"><span>Current phase</span><strong>{plan.currentPhase} / {plan.phaseCount} · {plan.currentPhaseTitle}</strong><div><i style={{ width: `${plan.currentPhaseProgress}%` }} /></div><small>{plan.currentPhaseProgress}% phase progress</small></div><div className="rehab-plan-foot"><span><small>Next session</small>{shortDate(plan.nextSessionDate)}</span><span><small>Review</small>{shortDate(plan.nextReviewDate)}</span><b>Open pathway ›</b></div></button>)}</div> : <div className="empty-state"><span>↗</span><h3>No rehabilitation plans here</h3><p>Create a plan from an open injury episode to begin progression.</p></div>}</section>
  </>;
}

function RehabilitationDetailView({ plan, phases, exercises, sessions, onBack, onInjury, onAthlete, onSession, onAdvance }: { plan: RehabilitationPlan; phases: RehabilitationPhase[]; exercises: RehabilitationExercise[]; sessions: RehabilitationSession[]; onBack: () => void; onInjury: (id: string) => void; onAthlete: (id: string) => void; onSession: () => void; onAdvance: () => void }) {
  const current = phases.find((phase) => phase.phaseNumber === plan.currentPhase);
  const currentExercises = exercises.filter((exercise) => exercise.phaseId === current?.id);
  const canAdvance = plan.status === "Active" && (current?.progress ?? 0) >= 80;
  return <>
    <button className="back-link" onClick={onBack}>← Rehabilitation workspace</button>
    <section className="rehab-detail-hero"><div className="rehab-detail-identity"><ProgressRing value={plan.overallProgress} size="lg" /><div><span className="profile-kicker">Rehabilitation plan · {plan.status}</span><h1>{plan.title}</h1><p><button onClick={() => onAthlete(plan.athleteId)}>{plan.athleteName}</button> · <button onClick={() => onInjury(plan.injuryId)}>{plan.injuryTitle}</button></p></div></div><div className="rehab-detail-actions"><button className="button secondary" onClick={onSession}>＋ Log session</button><button className="button primary" onClick={onAdvance} disabled={!canAdvance}>{current?.phaseNumber === phases.length ? "Complete plan" : "Advance phase"}</button></div></section>
    <section className="panel rehab-phase-map"><div className="panel-head"><div><span className="section-kicker">Criteria-led pathway</span><h3>Rehabilitation phases</h3></div><span className="result-count">Target {shortDate(plan.targetDate)}</span></div><div className="rehab-phase-track">{phases.map((phase) => <div key={phase.id} className={phase.status.toLowerCase()}><span>{phase.status === "Complete" ? "✓" : phase.phaseNumber}</span><div><small>Phase {phase.phaseNumber}</small><strong>{phase.title}</strong><i><b style={{ width: `${phase.progress}%` }} /></i></div></div>)}</div></section>
    <section className="rehab-detail-grid"><div className="rehab-detail-main"><div className="current-phase-card"><div><span>Current phase · {current?.phaseNumber} of {phases.length}</span><h2>{current?.title}</h2><p>{current?.goals}</p></div><ProgressRing value={current?.progress ?? 0} size="lg" /><div className="criteria-box"><small>Exit criteria</small><strong>{current?.exitCriteria}</strong><p>{canAdvance ? "Criteria review is ready for clinical sign-off." : `Progress must reach 80% before advancement. Current: ${current?.progress ?? 0}%.`}</p></div></div><div className="panel"><div className="panel-head"><div><span className="section-kicker">Current prescription</span><h3>Exercises & loading</h3></div><span className="result-count">{currentExercises.length} items</span></div>{currentExercises.length ? <div className="exercise-list">{currentExercises.map((exercise, index) => <div key={exercise.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{exercise.name}</strong><small>{exercise.target}</small></div><b>{exercise.dosage}</b><Status value={exercise.status} /></div>)}</div> : <div className="empty-state compact-empty"><h3>No exercises prescribed</h3><p>The current phase can be progressed through recorded sessions and criteria.</p></div>}</div><div className="panel"><div className="panel-head"><div><span className="section-kicker">Delivery record</span><h3>Sessions</h3></div><button className="text-button" onClick={onSession}>＋ Log session</button></div><div className="rehab-session-list">{sessions.map((session) => <article key={session.id}><span className={`session-state ${session.status.toLowerCase()}`}>{session.status === "Completed" ? "✓" : "◷"}</span><div><strong>{session.sessionType}</strong><p>{session.notes || session.nextAction}</p><small>{session.practitioner} · {shortDate(session.sessionDate)}</small></div>{session.status === "Completed" ? <div className="session-scores"><span><small>Load</small>{session.loadScore}/10</span><span><small>Pain</small>{session.painPre}→{session.painPost}</span><span><small>Phase</small>{session.phaseProgress}%</span></div> : <Status value="Scheduled" />}</article>)}</div></div></div>
      <aside className="rehab-detail-side"><div className="panel rehab-plan-summary"><div className="panel-head"><div><span className="section-kicker">Plan controls</span><h3>Clinical summary</h3></div></div><dl><div><dt>Plan owner</dt><dd>{plan.ownerPractitioner}</dd></div><div><dt>Frequency</dt><dd>{plan.weeklyFrequency}</dd></div><div><dt>Next review</dt><dd>{shortDate(plan.nextReviewDate)}</dd></div><div><dt>Completed sessions</dt><dd>{plan.completedSessionCount}</dd></div></dl><div className="rehab-goal"><small>Primary goal</small><p>{plan.primaryGoal}</p></div><div className="rehab-precaution"><small>Precautions</small><p>{plan.precautions}</p></div></div><div className="panel phase-criteria-list"><div className="panel-head"><div><span className="section-kicker">Decision framework</span><h3>Phase criteria</h3></div></div>{phases.map((phase) => <div key={phase.id}><span>{phase.phaseNumber}</span><div><strong>{phase.title}</strong><small>{phase.exitCriteria}</small></div></div>)}</div></aside>
    </section>
  </>;
}

function EncountersView({ encounters, athletes, initialAthleteId, embedded = false, onNew, onAthlete: _onAthlete, onSave }: { encounters: Encounter[]; athletes: Athlete[]; initialAthleteId?: string; embedded?: boolean; onNew: () => void; onAthlete: (id: string) => void; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const [athleteId, setAthleteId] = useState(initialAthleteId ?? encounters[0]?.athleteId ?? athletes[0]?.id ?? "");
  const [encounterType, setEncounterType] = useState("All encounter types");
  const [clinicCity, setClinicCity] = useState("All cities");
  const [clinicType, setClinicType] = useState("All clinics");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const selectedAthlete = athletes.find((athlete) => athlete.id === athleteId);
  const athleteEncounters = encounters.filter((encounter) => encounter.athleteId === athleteId);
  const filteredEncounters = athleteEncounters.filter((encounter) => {
    const day = encounter.encounterDate.slice(0, 10);
    return (encounterType === "All encounter types" || encounter.encounterType === encounterType)
      && (clinicCity === "All cities" || encounter.clinicCity === clinicCity)
      && (clinicType === "All clinics" || encounter.clinicType === clinicType)
      && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
  });
  const pageCount = Math.max(1, Math.ceil(filteredEncounters.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEncounters = filteredEncounters.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedEncounter = pageEncounters.find((encounter) => encounter.id === selectedEncounterId) ?? pageEncounters[0] ?? null;
  const encounterTypes = Array.from(new Set(athleteEncounters.map((encounter) => encounter.encounterType))).sort();
  const clinicTypes = Array.from(new Set(encounters.map((encounter) => encounter.clinicType))).sort();
  const clearFilters = () => { setEncounterType("All encounter types"); setClinicCity("All cities"); setClinicType("All clinics"); setDateFrom(""); setDateTo(""); setPage(1); };
  useEffect(() => { if (initialAthleteId) { setAthleteId(initialAthleteId); setSelectedEncounterId(null); } }, [initialAthleteId]);
  useEffect(() => { setPage(1); }, [athleteId, encounterType, clinicCity, clinicType, dateFrom, dateTo, pageSize]);
  return <>
    {!embedded && <PageHeading eyebrow="Unified longitudinal record" title="Medical File" text="Select any athlete, then review every specialty visit in one chronological record." action={<button className="button primary" onClick={onNew}>＋ New encounter</button>} />}
    <section className="medical-file-shell">
      <div className="medical-file-commandbar">
        {selectedAthlete && <div className="selected-athlete-brief"><Avatar name={fullName(selectedAthlete)} color={selectedAthlete.accent} /><span><small>Open medical file</small><strong>{fullName(selectedAthlete)}</strong><p>{selectedAthlete.mrn} · {selectedAthlete.sport} · {selectedAthlete.discipline}</p></span><Status value={selectedAthlete.status} /></div>}
        <div className="medical-file-actions">{embedded && <button className="button primary small" onClick={onNew}>＋ New encounter</button>}</div>
      </div>
      <div className="medical-file-body">
        <div className="medical-record-stage">
          <div className="medical-file-tabs"><button className="active">Medical file</button></div>
          <div className="medical-file-filters"><label><span>Encounter type</span><select value={encounterType} onChange={(event) => setEncounterType(event.target.value)}><option>All encounter types</option>{encounterTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Clinic city</span><select value={clinicCity} onChange={(event) => setClinicCity(event.target.value)}><option>All cities</option><option>Riyadh</option><option>Dammam</option><option>Dhahran</option></select></label><label><span>Clinic type</span><select value={clinicType} onChange={(event) => setClinicType(event.target.value)}><option>All clinics</option>{clinicTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="date-filter"><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label className="date-filter"><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label><button className="filter-clear" onClick={clearFilters}>Clear</button></div>
          <div className="medical-file-workspace medical-file-two-column">
            <aside className="visit-history"><div className="medical-column-head"><div><span className="section-kicker">One timeline</span><h3>{filteredEncounters.length} encounters</h3></div><span className="chronology-mark">Newest first</span></div><div className="visit-history-list">{pageEncounters.map((encounter) => { const date = new Date(encounter.encounterDate); return <button key={encounter.id} className={selectedEncounter?.id === encounter.id ? "active" : ""} onClick={() => setSelectedEncounterId(encounter.id)}><span className="visit-date"><strong>{String(date.getDate()).padStart(2, "0")}</strong><small>{new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date)}<br />{date.getFullYear()}</small><time>{makkahTime(encounter.encounterDate)}</time></span><span className="visit-card-copy"><i>{initials(encounter.practitioner)}</i><span><strong>{encounter.practitioner}</strong><small>{encounter.specialty}</small><p>{encounter.clinicType}<br />{encounter.clinicLocation} · {encounter.clinicCity}</p></span></span></button>; })}{!filteredEncounters.length && <div className="medical-empty"><span>⌕</span><strong>No matching visits</strong><p>Clear the filters or choose another athlete.</p></div>}</div>{filteredEncounters.length > 0 && <div className="timeline-pagination"><label>Per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[5, 10, 15, 20].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><div><button aria-label="Previous encounters page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage} / {pageCount}</span><button aria-label="Next encounters page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button></div></div>}</aside>
            <main className="consultation-panel">{selectedEncounter && selectedAthlete ? <><div className="medical-column-head"><div><span className="section-kicker">Visit review</span><h3>{selectedEncounter.encounterType}</h3></div></div><div className="consultation-scroll" key={selectedEncounter.id}><section className="visit-summary-cards"><article><small>Diagnosis</small><strong>{selectedEncounter.diagnosis || "No diagnosis recorded."}</strong></article><article><small>Location</small><strong>{selectedEncounter.clinicCity}</strong></article><article className="visit-reason-card"><small>Reason for visit / presenting concern</small><strong>{selectedEncounter.reason}</strong></article></section><VisitReviewEditor encounter={selectedEncounter} onSave={onSave} /></div></> : <div className="medical-empty large"><span>≡</span><strong>Select an encounter</strong><p>The visit review will appear here.</p></div>}</main>
          </div>
        </div>
      </div>
    </section>
    {selectedEncounter && selectedAthlete && <EncounterReportTemplate encounter={selectedEncounter} athlete={selectedAthlete} />}
  </>;
}

type EditableEncounterField = "subjective" | "objective" | "assessment" | "plan" | "diagnosis";

function VisitReviewEditor({ encounter, onSave }: { encounter: Encounter; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const [values, setValues] = useState<Record<EditableEncounterField, string>>({ subjective: encounter.subjective, objective: encounter.objective, assessment: encounter.assessment, plan: encounter.plan, diagnosis: encounter.diagnosis });
  const [editing, setEditing] = useState<EditableEncounterField | null>(null);
  const [saveState, setSaveState] = useState("Visit completed");
  const [amendmentMode, setAmendmentMode] = useState(false);
  const [requestingAmendment, setRequestingAmendment] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setValues({ subjective: encounter.subjective, objective: encounter.objective, assessment: encounter.assessment, plan: encounter.plan, diagnosis: encounter.diagnosis }); setEditing(null); setSaveState("Visit completed"); setAmendmentMode(false); setRequestingAmendment(false); setAmendmentReason(""); setSavedAt(""); }, [encounter.id]);
  const update = (field: EditableEncounterField, value: string) => { setValues((current) => ({ ...current, [field]: value })); setSaveState("Unsaved changes"); };
  const saveField = async (field: EditableEncounterField) => {
    if (editing !== field) return;
    setSaveState("Saving…");
    const saved = await onSave(encounter.id, { [field]: values[field], amendmentReason });
    if (saved) { setEditing(null); setSavedAt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh" }).format(new Date())); setSaveState("Field saved"); }
    else setSaveState("Save failed — try again");
  };
  const beginAmendment = () => { if (!amendmentReason.trim()) return; setAmendmentMode(true); setRequestingAmendment(false); setSaveState("Amendment in progress"); };
  const historyValue = values.plan || [values.subjective, values.objective, values.assessment].filter(Boolean).map((item) => `<p>${item}</p>`).join("") || "<p>No clinical history recorded.</p>";
  const formatHistory = (command: string, value?: string) => { document.execCommand(command, false, value); historyRef.current?.focus(); setValues((current) => ({ ...current, plan: historyRef.current?.innerHTML ?? current.plan })); setSaveState("Unsaved changes"); };
  const saveHistory = async () => { const history = historyRef.current?.innerHTML ?? values.plan; setValues((current) => ({ ...current, plan: history })); setSaveState("Saving…"); const saved = await onSave(encounter.id, { plan: history, amendmentReason }); if (saved) { setSavedAt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Riyadh" }).format(new Date())); setSaveState("History saved"); } else setSaveState("Save failed — try again"); };
  const editor = (field: EditableEncounterField, title: string) => editing === field ? <div className="field-editor"><textarea autoFocus value={values[field]} onChange={(event) => update(field, event.target.value)} onBlur={() => void saveField(field)} /><button className="field-save" onMouseDown={(event) => event.preventDefault()} onClick={() => void saveField(field)}>Save</button></div> : null;
  return <><section className="history-editor"><div className="history-head"><div><span className="section-kicker">Clinical record</span><h3>History</h3></div><span>{encounter.canEdit === 1 ? "Editable clinical note" : "Read-only clinical note"}</span></div><div className="history-toolbar" role="toolbar"><button type="button" onClick={() => formatHistory("bold")}><b>B</b></button><button type="button" onClick={() => formatHistory("italic")}><i>I</i></button><button type="button" onClick={() => formatHistory("underline")}><u>U</u></button><button type="button" onClick={() => formatHistory("insertUnorderedList")}>• List</button><input type="color" defaultValue="#006c46" onChange={(event) => formatHistory("foreColor", event.target.value)} /></div><div ref={historyRef} className="history-content" contentEditable={encounter.canEdit === 1} suppressContentEditableWarning onInput={(event) => { setValues((current) => ({ ...current, plan: event.currentTarget.innerHTML })); setSaveState("Unsaved changes"); }} dangerouslySetInnerHTML={{ __html: historyValue }} />{encounter.canEdit === 1 && <button className="button primary small history-save" onClick={() => void saveHistory()}>Save history</button>}</section><div className="visit-action-footer">{encounter.canEdit === 1 && <button className="button secondary small" onClick={() => setRequestingAmendment(true)}>✎ Amend visit</button>}<button className="button secondary small pdf-button" onClick={() => window.print()}>↓ Download PDF</button></div><div className={`autosave-state ${saveState.startsWith("Save failed") ? "error" : ""}`}><span>●</span>{saveState}{savedAt && ` at ${savedAt}`}</div></>;
}

function EncounterReportTemplate({ encounter, athlete }: { encounter: Encounter; athlete: Athlete }) {
  const logos = ["SOPCare"];
  return <article className="report-print-template"><header><div className={`report-logo-row logo-count-${logos.length}`}>{logos.map((logo) => <strong key={logo}>{logo}</strong>)}</div><p>Sports Health Visit Report</p></header><section className="report-athlete"><div><small>Athlete</small><strong>{fullName(athlete)}</strong><span>{athlete.mrn} · {athlete.sport} · {athlete.discipline}</span></div><div><small>Visit</small><strong>{shortDate(encounter.encounterDate)} · {makkahTime(encounter.encounterDate)} Makkah</strong><span>{encounter.encounterType}</span></div></section><section className="report-meta"><div><small>Practitioner</small><strong>{encounter.practitioner}</strong><span>{encounter.specialty}</span></div><div><small>Clinic</small><strong>{encounter.clinicType}</strong><span>{encounter.clinicCity}</span></div></section><section className="report-diagnosis"><small>Diagnosis</small><p>{encounter.diagnosis || "No diagnosis recorded."}</p></section><section className="report-reason"><small>Reason for visit</small><p>{encounter.reason}</p></section><div className="report-soap">{[["S", "Subjective", encounter.subjective], ["O", "Objective", encounter.objective], ["A", "Assessment", encounter.assessment], ["P", "Plan", encounter.plan]].map(([letter, title, content]) => <section key={letter}><b>{letter}</b><div><h2>{title}</h2><p>{content || `No ${title.toLowerCase()} information recorded.`}</p></div></section>)}</div><footer><span>SOPCare · Sports Health Intelligence</span><span>Generated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date())}</span></footer></article>;
}

function CareTeamView({ practitioners, athletes }: { practitioners: Practitioner[]; athletes: Athlete[] }) {
  const specialties = ["Sports Medicine", "Physiotherapy", "Sports Nutrition", "Sports Psychology", "Clinical Administration"];
  return <><PageHeading eyebrow="Multidisciplinary network" title="Care Team" text="The practitioners collaborating around athlete health and availability." /><section className="specialty-strip">{specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</section><section className="team-directory">{practitioners.map((person, index) => <article className="person-card" key={person.id}><div className="person-card-top"><Avatar name={person.name} color={["#006C46", "#397F91", "#BB7B43", "#6A5E8C", "#4D7D72"][index]} size="lg" /><span className="availability"><i /> Available</span></div><h3>{person.name}</h3><p>{person.credentials} · {person.specialty}</p><div className="person-stat"><strong>{athletes.filter((_, athleteIndex) => athleteIndex % practitioners.length === index).length + 2}</strong><small>assigned athletes</small></div><button className="panel-action">View practitioner →</button></article>)}</section></>;
}

function ModalHeading({ kicker, title, text }: { kicker: string; title: string; text: string }) { return <div className="modal-heading"><span className="section-kicker">{kicker}</span><h2 id="modal-title">{title}</h2><p>{text}</p></div>; }

function AthleteForm({ data, onSubmit, busy }: { data: Bootstrap; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="New athlete" title="Create athlete profile" text="Start the single clinical record that every specialty will share." /><div className="form-grid"><label>First name*<input name="firstName" required autoFocus /></label><label>Last name*<input name="lastName" required /></label><label>Date of birth*<input name="dateOfBirth" type="date" required /></label><label>Sex*<select name="sex" required><option value="">Select</option><option>Female</option><option>Male</option></select></label><label>Sport*<select name="sportId" required><option value="">Select sport</option>{data.sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label><label>Discipline*<input name="discipline" required placeholder="e.g. 400 m" /></label><label>Primary squad*<select name="teamId" required><option value="">Select squad</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Dominant side<select name="dominantSide"><option>Right</option><option>Left</option><option>Mixed</option></select></label></div><div className="form-note"><span>i</span> A SOPCare medical record number will be generated automatically.</div><ModalActions busy={busy} primary="Create athlete" /></form>;
}

function EncounterForm({ athletes, actor, selectedId, onSubmit, busy }: { athletes: Athlete[]; actor: Bootstrap["actor"]; selectedId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Clinical encounter" title="New encounter" text="Record the visit, review the clinical note, then finish it as a completed record." /><div className="encounter-author-strip"><Avatar name={actor.name} size="sm" /><span><small>Practitioner</small><strong>{actor.name}</strong><p>{actor.specialty}</p></span><b>Verified account</b></div><div className="form-grid"><label className="span-2">Athlete*<select name="athleteId" required defaultValue={selectedId ?? ""}><option value="">Select athlete</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{fullName(athlete)} · {athlete.mrn}</option>)}</select></label><label>Encounter type*<select name="encounterType" required><option>Medical Review</option><option>Physiotherapy Review</option><option>Nutrition Follow-up</option><option>Performance Psychology</option><option>Return-to-Sport Review</option><option>Medical Screening</option></select></label><label>Clinic city*<select name="clinicCity" required defaultValue="Riyadh"><option>Riyadh</option><option>Dammam</option><option>Dhahran</option></select></label><label className="span-2">Clinic type*<select name="clinicType" required defaultValue="Sports Medicine Clinic"><option>Sports Medicine Clinic</option><option>Physiotherapy Clinic</option><option>Sports Nutrition Clinic</option><option>Sports Psychology Clinic</option><option>Performance &amp; Recovery Clinic</option></select></label><label className="span-2">Clinic location*<input name="clinicLocation" required placeholder="e.g. Riyadh High Performance Center" /></label><label className="span-2">Reason for visit*<input name="reason" required placeholder="Concise clinical reason" /></label><label className="span-2">Subjective history<textarea name="subjective" rows={3} placeholder="Symptoms, training context, mechanism, response to load and athlete goals" /></label><label className="span-2">Objective findings<textarea name="objective" rows={3} placeholder="Examination, functional testing, relevant measures and red flags" /></label><label>Clinical assessment<textarea name="assessment" rows={4} placeholder="Clinical reasoning and impact on sport participation" /></label><label>Management plan<textarea name="plan" rows={4} placeholder="Treatment, loading advice, referrals and return-to-sport actions" /></label><label className="span-2">Diagnosis · free text*<textarea name="diagnosis" rows={3} required placeholder="Write the clinical diagnosis in plain language — no ICD-10 code required" /></label><details className="advanced-options span-2"><summary>More options</summary><div><label>Visibility<select name="visibility"><option>Care team</option><option>Restricted</option></select></label><label>Follow-up date<input name="followUpDate" type="date" /></label></div></details></div><div className="finish-visit-note"><span>✓</span><p><strong>Finish Visit</strong><small>The visit becomes read-only. You can reopen it later through a documented amendment.</small></p></div><div className="modal-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Finishing…" : "Finish Visit"}</button></div></form>;
}

function InjuryForm({ athletes, practitioners, selectedId, onSubmit, busy }: { athletes: Athlete[]; practitioners: Practitioner[]; selectedId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Injury management" title="Open injury episode" text="Create a shared pathway from first assessment through safe return to sport." /><div className="form-grid"><label className="span-2">Athlete*<select name="athleteId" required defaultValue={selectedId ?? ""} autoFocus><option value="">Select athlete</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{fullName(athlete)} · {athlete.mrn}</option>)}</select></label><label className="span-2">Episode title*<input name="title" required placeholder="e.g. Right hamstring strain" /></label><label>Diagnosis status*<select name="diagnosisStatus" defaultValue="Suspected"><option>Suspected</option><option>Confirmed</option></select></label><label>Severity*<select name="severity" defaultValue="Moderate"><option>Mild</option><option>Moderate</option><option>Severe</option></select></label><label>Body area*<input name="bodyArea" required placeholder="e.g. Posterior thigh" /></label><label>Laterality<select name="laterality"><option>Right</option><option>Left</option><option>Bilateral</option><option>Not applicable</option></select></label><label>Onset date*<input name="onsetDate" type="date" required /></label><label>Participation status*<select name="participationStatus" defaultValue="Under Treatment"><option>Available</option><option>Modified Training</option><option>Under Treatment</option><option>Return-to-Sport Review</option><option>Unavailable</option></select></label><label className="span-2">Mechanism*<input name="mechanism" required placeholder="How did the episode start?" /></label><label className="span-2">Lead practitioner*<select name="leadPractitionerId" required><option value="">Select practitioner</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.specialty}</option>)}</select></label><label className="span-2">Next clinical action*<textarea name="nextAction" required rows={3} placeholder="The next clear action for the care team" /></label><label>Review date<input name="reviewDate" type="date" /></label><label>Expected return<input name="expectedReturnDate" type="date" /></label></div><ModalActions busy={busy} primary="Open injury episode" /></form>;
}

function InjuryStageForm({ injury, onSubmit, busy }: { injury: Injury; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Clinical pathway" title="Update injury stage" text={`Record the next shared decision for ${injury.athleteName}.`} /><div className="locked-note injury-note"><Status value={injury.stage} /><div><strong>{injury.title}</strong><small>Current pathway stage</small></div></div><div className="form-grid one-column"><label>Pathway stage*<select name="stage" required defaultValue={injury.stage} autoFocus>{injuryStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label>Participation status*<select name="participationStatus" required defaultValue={injury.participationStatus}><option>Available</option><option>Modified Training</option><option>Under Treatment</option><option>Return-to-Sport Review</option><option>Unavailable</option></select></label><label>Decision note<textarea name="note" rows={3} placeholder="Why is the pathway changing?" /></label><label>Next clinical action*<textarea name="nextAction" rows={3} required defaultValue={injury.nextAction} /></label><label>Review date<input name="reviewDate" type="date" defaultValue={injury.reviewDate ?? ""} /></label><label>Expected return<input name="expectedReturnDate" type="date" defaultValue={injury.expectedReturnDate ?? ""} /></label><label>Closure summary<textarea name="closureSummary" rows={4} defaultValue={injury.closureSummary ?? ""} placeholder="Required when moving the episode to Closed" /></label></div><ModalActions busy={busy} primary="Update pathway" /></form>;
}

function LinkEncounterForm({ injury, encounters, onSubmit, busy }: { injury: Injury; encounters: Encounter[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Connected clinical record" title="Link an encounter" text={`Attach a relevant encounter to ${injury.title}.`} />{encounters.length ? <><div className="form-grid one-column"><label>Encounter*<select name="encounterId" required autoFocus><option value="">Select encounter</option>{encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{shortDate(encounter.encounterDate)} · {encounter.encounterType} · {encounter.practitioner}</option>)}</select></label></div><ModalActions busy={busy} primary="Link encounter" /></> : <div className="empty-state compact-empty"><h3>No available encounters</h3><p>Create an encounter for this athlete before linking it to the injury pathway.</p></div>}</form>;
}

function RehabilitationForm({ injuries, practitioners, selectedInjuryId, onSubmit, busy }: { injuries: Injury[]; practitioners: Practitioner[]; selectedInjuryId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const clinicalPractitioners = practitioners.filter((person) => ["Sports Medicine", "Physiotherapy"].includes(person.specialty));
  return <form onSubmit={onSubmit}><ModalHeading kicker="Rehabilitation pathway" title="Create rehabilitation plan" text="Define the goal, review cadence, and four-stage criteria-led pathway for an open injury episode." /><div className="form-grid"><label className="span-2">Injury episode*<select name="injuryId" required defaultValue={selectedInjuryId ?? ""}><option value="">Select open injury</option>{injuries.filter((injury) => injury.stage !== "Closed").map((injury) => <option key={injury.id} value={injury.id}>{injury.athleteName} · {injury.title}</option>)}</select></label><label className="span-2">Plan title*<input name="title" required placeholder="e.g. Hamstring return-to-speed pathway" /></label><label>Plan owner*<select name="ownerPractitionerId" required><option value="">Select practitioner</option>{clinicalPractitioners.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.specialty}</option>)}</select></label><label>Weekly frequency*<input name="weeklyFrequency" required placeholder="e.g. 4 sessions / week" /></label><label>Start date*<input name="startDate" type="date" required /></label><label>Target date<input name="targetDate" type="date" /></label><label>Next review<input name="nextReviewDate" type="date" /></label><label className="span-2">Primary goal*<textarea name="primaryGoal" rows={3} required placeholder="The measurable outcome this plan is working toward" /></label><label className="span-2">Precautions<textarea name="precautions" rows={3} placeholder="Loading restrictions, red flags, and performance constraints" /></label></div><div className="form-note"><span>4</span> SOPCare will create four phases: Protect & restore, Build capacity, Sport integration, and Return to performance.</div><ModalActions busy={busy} primary="Create rehabilitation plan" /></form>;
}

function RehabilitationSessionForm({ plan, onSubmit, busy }: { plan: RehabilitationPlan; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker={`Phase ${plan.currentPhase} · ${plan.currentPhaseTitle}`} title="Record rehabilitation session" text={`Capture delivery, response, and the next action for ${plan.athleteName}.`} /><div className="form-grid"><label>Session date & time*<input name="sessionDate" type="datetime-local" required /></label><label>Session status*<select name="status" defaultValue="Completed"><option>Completed</option><option>Scheduled</option></select></label><label className="span-2">Session type*<input name="sessionType" required placeholder="e.g. Field + gym rehabilitation" /></label><label>Load score · 0–10<input name="loadScore" type="number" min="0" max="10" /></label><label>Phase progress · 0–100<input name="phaseProgress" type="number" min="0" max="100" defaultValue={plan.currentPhaseProgress} /></label><label>Pain before · 0–10<input name="painPre" type="number" min="0" max="10" /></label><label>Pain after · 0–10<input name="painPost" type="number" min="0" max="10" /></label><label className="span-2">Session notes<textarea name="notes" rows={4} placeholder="What was completed and how did the athlete respond?" /></label><label className="span-2">Next action*<textarea name="nextAction" rows={3} required placeholder="The next clear rehabilitation action" /></label></div><ModalActions busy={busy} primary="Record session" /></form>;
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
  return <form onSubmit={onSubmit}><ModalHeading kicker={athlete.mrn} title={detail.title} text="Add each item separately. Saved items remain visible and can be removed individually." /><div className="form-grid one-column"><label>{detail.title}<div className="safety-entry"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addItem(); } }} placeholder={`Add ${detail.title.toLowerCase()} and press Enter`} autoFocus /><button type="button" className="button secondary small" onClick={addItem}>Add</button></div></label>{items.length > 0 && <div className="safety-chips" aria-label={`Recorded ${detail.title.toLowerCase()}`}>{items.map((item) => <span key={item}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => setItems(items.filter((current) => current !== item))}>×</button></span>)}</div>}<label className="none-option"><input type="checkbox" checked={noneConfirmed} onChange={(event) => setNoneConfirmed(event.target.checked)} /><span><strong>No {detail.title.toLowerCase()} to record</strong><small>This only confirms the empty state; it never removes saved items.</small></span></label><input type="hidden" name="value" value={items.join("\n")} /></div><ModalActions busy={busy} primary="Save clinical safety" /></form>;
}

function CareForm({ athlete, practitioners, onSubmit, busy }: { athlete: Athlete; practitioners: Practitioner[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Shared care" title="Assign practitioner" text={`Add a practitioner to ${fullName(athlete)}’s multidisciplinary care team.`} /><div className="form-grid one-column"><label>Practitioner<select name="practitionerId" required autoFocus><option value="">Select practitioner</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.specialty}</option>)}</select></label></div><ModalActions busy={busy} primary="Assign practitioner" /></form>;
}

function ModalActions({ busy, primary }: { busy: boolean; primary: string }) { return <div className="modal-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Saving…" : primary}</button></div>; }
