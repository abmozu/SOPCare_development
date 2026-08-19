"use client";

import { ClipboardEvent, FormEvent, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyleKit } from "@tiptap/extension-text-style";
import type { PortalUser } from "./access-model";
import { downloadEncounterPdf } from "./reporting";
import ProjectLogo from "./ProjectLogo";

type Athlete = {
  id: string; mrn: string; firstName: string; lastName: string; dateOfBirth: string;
  sex: string; nationality: string; sport: string; discipline: string; dominantSide: string;
  status: string; medicalAlerts: string; allergies: string; chronicConditions: string; prohibitedMedications: string; emergencyContact: string; followUpDate: string | null;
  accent: string; team: string; leadPractitioner: string; lastEncounter: string | null;
};
type Encounter = {
  id: string; athleteId: string; encounterDate: string; encounterType: string; clinicCity: string;
  reason: string; diagnosis: string;
  subjective: string; objective: string; assessment: string; plan: string; visibility: string;
  followUpDate: string | null; practitioner: string; specialty: string; amendmentCount: number;
  canEdit: number; injuryId?: string | null; injuryTitle?: string | null; injuryOrigin?: number;
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
  nextSessionDate: string | null; lastFollowUpDate: string | null; createdAt: string; updatedAt: string;
};
type RehabilitationPhase = { id: string; planId: string; phaseNumber: number; title: string; status: string; goals: string; entryCriteria: string; exitCriteria: string; progress: number; startedAt: string | null; completedAt: string | null };
type RehabilitationExercise = { id: string; phaseId: string; name: string; dosage: string; target: string; status: string; sortOrder: number };
type RehabilitationSession = { id: string; planId: string; phaseId: string; sessionDate: string; sessionType: string; status: string; loadScore: number | null; painPre: number | null; painPost: number | null; phaseProgress: number | null; notes: string; nextAction: string; completedAt: string | null; practitioner: string };
type RehabilitationMeasurement = { id: string; sessionId: string; planId: string; metricType: string; label: string; numericValue: number | null; textValue: string; unit: string; context: string; recordedAt: string };
type Practitioner = { id: string; userId: string; name: string; specialty: string; credentials: string; clinicCity: string };
type Activity = { id: number; action: string; entityType: string; entityId: string; summary: string; createdAt: string; actor: string };
type RefItem = { id: string; name: string; category?: string };
type ScrollPosition = { windowY: number; consultation: number; timeline: number };
type Bootstrap = {
  actor: { id: string; name: string; email: string; phoneNumber: string; jobTitle: string; specialty: string; clinicCity: string; permissions: string[]; workspaceIds: string[] };
  athletes: Athlete[]; encounters: Encounter[]; injuries: Injury[]; injuryHistory: InjuryHistory[]; rehabilitationPlans: RehabilitationPlan[]; rehabilitationPhases: RehabilitationPhase[]; rehabilitationExercises: RehabilitationExercise[]; rehabilitationSessions: RehabilitationSession[]; rehabilitationMeasurements: RehabilitationMeasurement[]; practitioners: Practitioner[]; activities: Activity[];
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
  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) return "—";
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
  const [modal, setModal] = useState<null | "athlete" | "encounter" | "edit" | "care" | "injury" | "injuryStage" | "linkEncounter" | "injuryAssociation" | "rehabilitation" | "rehabSession" | "rehabAdvance" | "clinicalSafety" | "practitionerProfile">(null);
  const [pendingEncounterId, setPendingEncounterId] = useState<string | null>(null);
  const [focusedEncounterId, setFocusedEncounterId] = useState<string | null>(null);
  const [returnToInjuryId, setReturnToInjuryId] = useState<string | null>(null);
  const [injuryOriginAthleteId, setInjuryOriginAthleteId] = useState<string | null>(null);
  const [returnToEncounterId, setReturnToEncounterId] = useState<string | null>(null);
  const [returnToProfileKey, setReturnToProfileKey] = useState<string | null>(null);
  const [returnToEncounterScroll, setReturnToEncounterScroll] = useState<ScrollPosition | null>(null);
  const [safetyCategory, setSafetyCategory] = useState<"allergies" | "chronicConditions" | "prohibitedMedications">("allergies");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [expandedLinkedEncounters, setExpandedLinkedEncounters] = useState<Record<string, string[]>>({});
  const scrollMemory = useRef(new Map<string, ScrollPosition>());
  const navigationKey = view === "Profile"
    ? [view, selectedId ?? "", profileTab, focusedEncounterId ?? ""].join(":")
    : view === "InjuryDetail"
      ? [view, selectedInjuryId ?? ""].join(":")
      : view === "AthleteInjuries"
        ? [view, selectedId ?? ""].join(":")
      : view === "RehabilitationDetail"
        ? [view, selectedRehabilitationId ?? ""].join(":")
        : view;

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
  useLayoutEffect(() => {
    const saved = scrollMemory.current.get(navigationKey);
    const restore = () => {
      window.scrollTo({ top: saved?.windowY ?? 0, behavior: "auto" });
      const consultation = document.querySelector<HTMLElement>(".consultation-scroll");
      const timeline = document.querySelector<HTMLElement>(".visit-history-list");
      if (consultation) consultation.scrollTop = saved?.consultation ?? 0;
      if (timeline) timeline.scrollTop = saved?.timeline ?? 0;
    };
    restore();
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [navigationKey]);

  function captureScroll(key = navigationKey) {
    const position: ScrollPosition = {
      windowY: window.scrollY,
      consultation: document.querySelector<HTMLElement>(".consultation-scroll")?.scrollTop ?? 0,
      timeline: document.querySelector<HTMLElement>(".visit-history-list")?.scrollTop ?? 0,
    };
    scrollMemory.current.set(key, position);
    return position;
  }

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
    captureScroll();
    setFocusedEncounterId(null);
    setReturnToInjuryId(null);
    setSelectedId(id);
    setProfileTab("Encounters");
    setView("Profile");
  }

  function showInjury(id: string, athleteOriginId?: string) {
    captureScroll();
    setReturnToEncounterId(null);
    setInjuryOriginAthleteId(athleteOriginId ?? null);
    setSelectedInjuryId(id);
    setView("InjuryDetail");
  }

  function showAthleteInjuries() {
    if (!selectedId) return;
    captureScroll();
    setFocusedEncounterId(null);
    setView("AthleteInjuries");
  }

  function showRehabilitation(id: string) {
    captureScroll();
    setSelectedRehabilitationId(id);
    setView("RehabilitationDetail");
  }

  function navigate(next: string) {
    captureScroll();
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
    const result = await apiAction("/api/encounters", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) }, "Encounter saved");
    if (result?.id) { setPendingEncounterId(result.id); setModal("injuryAssociation"); }
  }

  function openInjuryFromEncounter(injuryId: string, encounterId: string) {
    const originScroll = captureScroll();
    setReturnToProfileKey(navigationKey);
    setReturnToEncounterScroll(originScroll);
    setReturnToEncounterId(encounterId);
    setSelectedInjuryId(injuryId);
    setView("InjuryDetail");
  }

  function returnToEncounter() {
    const encounter = data?.encounters.find((item) => item.id === returnToEncounterId);
    if (!encounter) return;
    captureScroll();
    const destinationKey = ["Profile", encounter.athleteId, "Encounters", encounter.id].join(":");
    const savedOrigin = returnToEncounterScroll ?? (returnToProfileKey ? scrollMemory.current.get(returnToProfileKey) : undefined);
    if (savedOrigin) scrollMemory.current.set(destinationKey, savedOrigin);
    setSelectedId(encounter.athleteId);
    setFocusedEncounterId(encounter.id);
    setProfileTab("Encounters");
    setReturnToEncounterId(null);
    setReturnToProfileKey(null);
    setReturnToEncounterScroll(null);
    setView("Profile");
  }

  function openEncounterFromInjury(encounter: Encounter) {
    captureScroll();
    setReturnToInjuryId(selectedInjuryId);
    setFocusedEncounterId(encounter.id);
    setSelectedId(encounter.athleteId);
    setProfileTab("Encounters");
    setView("Profile");
  }

  async function submitInjuryAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const injuryId = String(new FormData(event.currentTarget).get("injuryId") ?? "");
    if (!pendingEncounterId || !injuryId) return;
    await apiAction(`/api/injuries/${injuryId}/encounters`, { method: "POST", body: JSON.stringify({ encounterId: pendingEncounterId }) }, "Injury linked to encounter");
    setPendingEncounterId(null);
  }

  async function removeInjuryAssociation() {
    if (!pendingEncounterId) return;
    const encounter = data?.encounters.find((item) => item.id === pendingEncounterId);
    if (!encounter?.injuryId) return;
    await apiAction(`/api/injuries/${encounter.injuryId}/encounters`, { method: "DELETE", body: JSON.stringify({ encounterId: pendingEncounterId }) }, "Injury link removed");
    setPendingEncounterId(null);
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
    if (result?.id && pendingEncounterId) {
      await apiAction(`/api/injuries/${result.id}/encounters`, { method: "POST", body: JSON.stringify({ encounterId: pendingEncounterId }) }, "Injury created and linked to encounter");
      setPendingEncounterId(null);
    }
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
          <ProjectLogo compact light />
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
          <button className="mobile-brand" onClick={() => navigate("Overview")}><ProjectLogo compact /></button>
          <label className="global-search"><span>⌕</span><input aria-label="Search athletes" placeholder="Search athlete or MRN…" value={query} onChange={(event) => { captureScroll(); setQuery(event.target.value); setView("Athletes"); }} /><kbd>⌘ K</kbd></label>
          <div className="top-actions"><button className="icon-button" aria-label="Notifications"><span className="notification-dot" />◌</button><button className="account" onClick={() => setModal("practitionerProfile")} aria-label="Open practitioner profile"><Avatar name={identity.fullName} size="sm" /><span><strong>{identity.fullName}</strong><small>{identity.professionalRole}</small></span><span className="chevron">⌄</span></button></div>
        </header>
        <div className="prototype-banner"><span>Prototype environment</span> Do not enter real patient information.</div>

        <main className="content">
          {view === "Overview" && <Overview data={data} today={today} onSearch={(value) => { captureScroll(); setQuery(value); setView("Athletes"); }} onInjuries={() => navigate("Injuries")} />}
          {view === "Athletes" && <AthletesView athletes={filtered} all={data.athletes} query={query} setQuery={setQuery} sportFilter={sportFilter} setSportFilter={setSportFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onAthlete={showProfile} onNew={data.actor.permissions.includes("athletes.create") ? () => setModal("athlete") : undefined} />}
          {view === "Injuries" && <InjuriesView injuries={data.injuries} onOpen={showInjury} />}
          {view === "InjuryDetail" && selectedInjury && <InjuryDetailView injury={selectedInjury} rehabilitationPlan={data.rehabilitationPlans.find((plan) => plan.injuryId === selectedInjury.id)} history={data.injuryHistory.filter((item) => item.injuryId === selectedInjury.id)} encounters={data.encounters.filter((item) => item.injuryId === selectedInjury.id)} expandedEncounters={expandedLinkedEncounters[selectedInjury.id] ?? []} onExpandedEncountersChange={(ids) => setExpandedLinkedEncounters((current) => ({ ...current, [selectedInjury.id]: ids }))} backLabel={returnToEncounterId ? "Back to encounter" : injuryOriginAthleteId ? "Back to all injuries" : "Injury registry"} onBack={returnToEncounterId ? returnToEncounter : injuryOriginAthleteId ? () => { const athleteId = injuryOriginAthleteId; setInjuryOriginAthleteId(null); setSelectedId(athleteId); setView("AthleteInjuries"); } : () => navigate("Injuries")} onAthlete={showProfile} onEncounter={openEncounterFromInjury} onStage={() => setModal("injuryStage")} onRehabilitation={showRehabilitation} onCreateRehabilitation={() => setModal("rehabilitation")} />}
          {view === "Rehabilitation" && <RehabilitationView plans={data.rehabilitationPlans} measurements={data.rehabilitationMeasurements} stats={data.stats} onNew={() => setModal("rehabilitation")} onOpen={showRehabilitation} />}
          {view === "RehabilitationDetail" && selectedRehabilitation && <RehabilitationDetailViewV2 plan={selectedRehabilitation} phases={data.rehabilitationPhases.filter((phase) => phase.planId === selectedRehabilitation.id)} exercises={data.rehabilitationExercises} sessions={data.rehabilitationSessions.filter((session) => session.planId === selectedRehabilitation.id)} measurements={data.rehabilitationMeasurements.filter((measurement) => measurement.planId === selectedRehabilitation.id)} onBack={() => navigate("Rehabilitation")} onInjury={showInjury} onAthlete={showProfile} onSession={() => setModal("rehabSession")} onAdvance={() => setModal("rehabAdvance")} />}
          {view === "Care Team" && <CareTeamView practitioners={data.practitioners} athletes={data.athletes} />}
          {view === "Profile" && selected && <ProfileView athlete={selected} athletes={data.athletes} encounters={data.encounters} injuries={data.injuries.filter((injury) => injury.athleteId === selected.id)} practitioners={data.practitioners} tab={profileTab} setTab={setProfileTab} initialEncounterId={focusedEncounterId} returnToInjury={returnToInjuryId ? data.injuries.find((injury) => injury.id === returnToInjuryId) : undefined} onBack={() => { if (returnToInjuryId) { showInjury(returnToInjuryId); setReturnToInjuryId(null); setFocusedEncounterId(null); } else navigate("Athletes"); }} onAthlete={showProfile} onEncounter={() => setModal("encounter")} onManageInjury={(encounterId) => { setPendingEncounterId(encounterId); setModal("injuryAssociation"); }} onInjury={openInjuryFromEncounter} onAllInjuries={showAthleteInjuries} onEdit={() => setModal("edit")} onCare={() => setModal("care")} onSafety={editClinicalSafety} onSave={saveEncounterFields} />}
          {view === "AthleteInjuries" && selected && <AthleteInjuriesView athlete={selected} injuries={data.injuries.filter((injury) => injury.athleteId === selected.id)} onBack={() => setView("Profile")} onOpen={(id) => showInjury(id, selected.id)} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <button key={item} className={view === item || (view === "Profile" && item === "Athletes") || (view === "InjuryDetail" && item === "Injuries") || (view === "RehabilitationDetail" && item === "Rehabilitation") ? "active" : ""} onClick={() => navigate(item)}><span aria-hidden="true">{navGlyphs[item]}</span>{item === "Care Team" ? "Team" : item === "Rehabilitation" ? "Rehab" : item}</button>)}</nav>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className={`modal ${modal === "encounter" || modal === "injury" || modal === "rehabilitation" ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="modal-close" onClick={() => setModal(null)} aria-label="Close dialog">×</button>
          {modal === "athlete" && <AthleteForm data={data} onSubmit={submitAthlete} busy={busy} />}
          {modal === "encounter" && selected && <EncounterForm actor={data.actor} athlete={selected} onSubmit={submitEncounter} busy={busy} />}
          {modal === "practitionerProfile" && <PractitionerProfileForm actor={data.actor} onSubmit={submitPractitionerProfile} busy={busy} />}
          {modal === "edit" && selected && <EditForm athlete={selected} onSubmit={submitEdit} busy={busy} />}
          {modal === "care" && selected && <CareForm athlete={selected} practitioners={data.practitioners} onSubmit={submitCare} busy={busy} />}
          {modal === "injury" && <InjuryForm athletes={data.athletes} practitioners={data.practitioners} selectedId={selected?.id} onSubmit={submitInjury} busy={busy} />}
          {modal === "injuryStage" && selectedInjury && <InjuryStageForm injury={selectedInjury} onSubmit={submitInjuryStage} busy={busy} />}
          {modal === "linkEncounter" && selectedInjury && <LinkEncounterForm injury={selectedInjury} encounters={data.encounters.filter((item) => item.athleteId === selectedInjury.athleteId && item.injuryId !== selectedInjury.id)} onSubmit={submitLinkEncounter} busy={busy} />}
          {modal === "injuryAssociation" && selected && pendingEncounterId && <InjuryAssociationForm injuries={data.injuries.filter((item) => item.athleteId === selected.id && item.stage !== "Closed")} currentInjuryId={data.encounters.find((item) => item.id === pendingEncounterId)?.injuryId} onLater={() => setModal(null)} onNone={data.encounters.find((item) => item.id === pendingEncounterId)?.injuryId ? removeInjuryAssociation : () => { setPendingEncounterId(null); setModal(null); }} onRemove={removeInjuryAssociation} onCreate={() => setModal("injury")} onSubmit={submitInjuryAssociation} busy={busy} />}
          {modal === "rehabilitation" && <RehabilitationForm injuries={data.injuries} activePlanInjuryIds={data.rehabilitationPlans.filter((plan) => plan.status === "Active").map((plan) => plan.injuryId)} selectedInjuryId={selectedInjury?.id} onSubmit={submitRehabilitation} busy={busy} />}
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

function todayInputDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function AthletesView({ athletes, all, query, setQuery, sportFilter, setSportFilter, statusFilter, setStatusFilter, onAthlete, onNew }: { athletes: Athlete[]; all: Athlete[]; query: string; setQuery: (v: string) => void; sportFilter: string; setSportFilter: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; onAthlete: (id: string) => void; onNew?: () => void }) {
  const [rosterMode, setRosterMode] = useState<"By sport" | "All athletes">("By sport");
  const sports = Array.from(new Set(all.map((athlete) => athlete.sport))).sort();
  const visibleSports = Array.from(new Set(athletes.map((athlete) => athlete.sport))).sort();
  const clearFilters = () => { setQuery(""); setSportFilter("All sports"); setStatusFilter("All statuses"); };
  return <>
    <PageHeading eyebrow="Clinical registry" title="Athletes" text="Find every athlete by sport or review the complete clinical registry." action={onNew ? <button className="button primary" onClick={onNew}>＋ Create athlete</button> : undefined} />
    <section className="panel registry-panel"><div className="registry-tools"><label className="table-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, MRN, team, or sport" aria-label="Search athlete registry" /></label><select value={sportFilter} onChange={(event) => setSportFilter(event.target.value)} aria-label="Filter by sport"><option>All sports</option>{sports.map((sport) => <option key={sport}>{sport}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option>All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select><div className="roster-mode-switch" aria-label="Athlete view"><button className={rosterMode === "By sport" ? "active" : ""} onClick={() => setRosterMode("By sport")}>By sport</button><button className={rosterMode === "All athletes" ? "active" : ""} onClick={() => setRosterMode("All athletes")}>All athletes</button></div><span className="result-count">{athletes.length} athletes</span></div>
      {athletes.length && rosterMode === "By sport" ? <div className="sport-roster-groups athlete-registry-groups">{visibleSports.map((sport) => { const members = athletes.filter((athlete) => athlete.sport === sport); return <section key={sport}><header><span>{sport.slice(0, 2).toUpperCase()}</span><div><strong>{sport}</strong><small>{members.length} athletes</small></div></header><div>{members.map((athlete) => <button key={athlete.id} onClick={() => onAthlete(athlete.id)}><Avatar name={fullName(athlete)} color={athlete.accent} size="sm" /><span><strong>{fullName(athlete)}</strong><small>{athlete.discipline} · {shortDate(athlete.dateOfBirth)} · {age(athlete.dateOfBirth)} yrs</small></span><Status value={athlete.status} /><b>›</b></button>)}</div></section>; })}</div> : athletes.length ? <div className="table-wrap"><table><thead><tr><th>Athlete</th><th>Date of birth</th><th>Sport / discipline</th><th>Squad</th><th>Clinical status</th><th>Lead practitioner</th><th>Last encounter</th><th /></tr></thead><tbody>{athletes.map((athlete) => <tr key={athlete.id} onClick={() => onAthlete(athlete.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onAthlete(athlete.id); }}><td><div className="athlete-cell"><Avatar name={fullName(athlete)} color={athlete.accent} /><span><strong>{fullName(athlete)}</strong><small>{athlete.mrn} · {age(athlete.dateOfBirth)} yrs</small></span></div></td><td><strong>{shortDate(athlete.dateOfBirth)}</strong><small className="cell-sub">{age(athlete.dateOfBirth)} years</small></td><td><strong>{athlete.sport}</strong><small className="cell-sub">{athlete.discipline}</small></td><td>{athlete.team}</td><td><Status value={athlete.status} /></td><td>{athlete.leadPractitioner}</td><td>{shortDate(athlete.lastEncounter)}</td><td><button className="row-menu" aria-label={`Open ${fullName(athlete)}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>⌕</span><h3>No athletes match those filters</h3><p>Try a broader name, sport, or clinical status.</p><button className="button secondary" onClick={clearFilters}>Clear filters</button></div>}
    </section>
  </>;
}

function ProfileView({ athlete, athletes, encounters, injuries, practitioners, tab, setTab, initialEncounterId, returnToInjury, onBack, onAthlete, onEncounter, onManageInjury, onInjury, onAllInjuries, onEdit, onCare, onSafety, onSave }: { athlete: Athlete; athletes: Athlete[]; encounters: Encounter[]; injuries: Injury[]; practitioners: Practitioner[]; tab: string; setTab: (v: string) => void; initialEncounterId?: string | null; returnToInjury?: Injury; onBack: () => void; onAthlete: (id: string) => void; onEncounter: () => void; onManageInjury: (encounterId: string) => void; onInjury: (injuryId: string, encounterId: string) => void; onAllInjuries: () => void; onEdit: () => void; onCare: () => void; onSafety: (category: "allergies" | "chronicConditions" | "prohibitedMedications") => void; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const athleteEncounters = encounters.filter((encounter) => encounter.athleteId === athlete.id);
  const tabs = [`Encounters ${athleteEncounters.length}`, "Care Team", "Activity Log"];
  return <>
    <button className={`back-link ${returnToInjury ? "return-context" : ""}`} onClick={onBack}>← {returnToInjury ? `Back to ${returnToInjury.title}` : "Athlete registry"}</button>
    <section className="profile-hero"><span className="profile-watermark" aria-hidden="true">360</span><div className="profile-identity"><Avatar name={fullName(athlete)} color={athlete.accent} size="lg" /><div><span className="profile-kicker">Athlete 360° record</span><div className="profile-title-row"><h1>{fullName(athlete)}</h1><Status value={athlete.status} /></div><p>{athlete.mrn} <span>·</span> {athlete.sport} <span>·</span> {athlete.discipline} <span>·</span> {athlete.team}</p><div className="identity-meta"><span><small>Date of birth</small>{shortDate(athlete.dateOfBirth)}</span><span><small>Age</small>{age(athlete.dateOfBirth)} years</span><span><small>Dominant side</small>{athlete.dominantSide}</span><span><small>Lead practitioner</small>{athlete.leadPractitioner}</span></div></div></div><div className="profile-actions"><button className="button secondary" onClick={onAllInjuries}>All injuries <span>{injuries.length}</span></button><button className="button secondary" onClick={onEdit}>Edit profile</button></div></section>
    <div className="tabs" role="tablist">{tabs.map((item) => { const key = item.split(" ").slice(0, item.startsWith("Activity") ? 2 : 1).join(" "); return <button key={item} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{item}</button>; })}</div>
    {tab.startsWith("Encounters") && <><ClinicalSafetyPanel athlete={athlete} onEdit={onSafety} /><EncountersView encounters={encounters} athletes={athletes} initialAthleteId={athlete.id} initialEncounterId={initialEncounterId} embedded onNew={onEncounter} onAthlete={onAthlete} onManageInjury={onManageInjury} onInjury={onInjury} onSave={onSave} /></>}
    {tab.startsWith("Injuries") && <div className="panel tab-panel"><div className="panel-head"><div><span className="section-kicker">Injury pathway</span><h3>Injury episodes</h3></div></div>{injuries.length ? <div className="athlete-injury-list">{injuries.map((injury) => <button key={injury.id} onClick={() => onInjury(injury.id)}><div><strong>{injury.title}</strong><small>{injury.bodyArea} · Onset {shortDate(injury.onsetDate)}</small></div><Status value={injury.stage} /><span>›</span></button>)}</div> : <div className="empty-state compact-empty"><h3>No injury episodes</h3><p>An injury episode can be created after saving a relevant encounter.</p></div>}</div>}
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

function InjuriesView({ injuries, onOpen }: { injuries: Injury[]; onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<"current" | "previous">("current");
  const [stageFilter, setStageFilter] = useState("All current stages");
  const [query, setQuery] = useState("");
  const [athleteFilter, setAthleteFilter] = useState("All athletes");
  const isPrevious = mode === "previous";
  const athletes = [...new Map(injuries.map((injury) => [injury.athleteId, injury.athleteName])).entries()];
  const shown = injuries.filter((injury) => {
    const matchesMode = isPrevious ? injury.stage === "Closed" : injury.stage !== "Closed";
    const matchesStage = isPrevious || stageFilter === "All current stages" || injury.stage === stageFilter;
    const matchesSearch = !query.trim() || `${injury.athleteName} ${injury.mrn} ${injury.title}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesAthlete = athleteFilter === "All athletes" || injury.athleteId === athleteFilter;
    return matchesMode && matchesStage && matchesSearch && matchesAthlete;
  }).sort((a, b) => new Date(isPrevious ? (b.closedAt ?? b.updatedAt) : b.updatedAt).getTime() - new Date(isPrevious ? (a.closedAt ?? a.updatedAt) : a.updatedAt).getTime());
  const count = (stage: string) => injuries.filter((injury) => injury.stage === stage).length;
  return <>
    <PageHeading eyebrow="Injury management" title="Injury episodes" text="Coordinate assessment, treatment, training modification, and return-to-sport decisions in one pathway. New episodes start from a saved encounter." />
    <section className="injury-metrics">
      <div><span className="metric-icon mint">＋</span><small>Assessment queue</small><strong>{count("New") + count("Under Assessment")}</strong><p>New or under assessment</p></div>
      <div><span className="metric-icon teal">↗</span><small>Under treatment</small><strong>{count("Under Treatment")}</strong><p>Active clinical plans</p></div>
      <div><span className="metric-icon gold">⌁</span><small>Modified training</small><strong>{count("Modified Training")}</strong><p>Coordinated load changes</p></div>
      <div><span className="metric-icon rose">✓</span><small>RTS review</small><strong>{count("Return-to-Sport Review")}</strong><p>Shared decisions pending</p></div>
    </section>
    <section className="panel registry-panel"><div className="registry-tools injury-registry-tools"><div className="injury-registry-mode" role="group" aria-label="Injury registry view"><button className={!isPrevious ? "active" : ""} onClick={() => { setMode("current"); setAthleteFilter("All athletes"); }}>Current injuries</button><button className={isPrevious ? "active" : ""} onClick={() => { setMode("previous"); setStageFilter("All current stages"); }}>Previous injuries</button></div>{isPrevious ? <><label className="table-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search athlete, MRN, or injury" aria-label="Search previous injuries" /></label><select value={athleteFilter} onChange={(event) => setAthleteFilter(event.target.value)} aria-label="Choose athlete for previous injuries"><option value="All athletes">All athletes</option>{athletes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></> : <div className="stage-filters" role="group" aria-label="Filter current injury stages">{["All current stages", "Under Assessment", "Under Treatment", "Modified Training", "Return-to-Sport Review"].map((stage) => <button key={stage} className={stageFilter === stage ? "active" : ""} onClick={() => setStageFilter(stage)}>{stage}</button>)}</div>}<span className="result-count">{shown.length} episodes</span></div>
      {shown.length ? isPrevious && athleteFilter !== "All athletes" ? <InjuryTimeline injuries={shown} onOpen={onOpen} label="Previous injuries timeline" /> : <div className="table-wrap"><table className="injury-table"><thead><tr><th>Athlete</th><th>Injury</th><th>Stage</th><th>Participation</th><th>Days open</th><th>{isPrevious ? "Closed" : "Next review"}</th><th>Lead</th><th /></tr></thead><tbody>{shown.map((injury) => <tr key={injury.id} onClick={() => onOpen(injury.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(injury.id); }}><td><div className="athlete-cell"><Avatar name={injury.athleteName} /><span><strong>{injury.athleteName}</strong><small>{injury.mrn} · {injury.sport}</small></span></div></td><td><strong>{injury.title}</strong><small className="cell-sub">{injury.bodyArea} · {injury.diagnosisStatus}</small></td><td><Status value={injury.stage} /></td><td>{injury.participationStatus}</td><td><strong>{daysOpen(injury)}</strong> days</td><td>{shortDate(isPrevious ? injury.closedAt : injury.reviewDate)}</td><td>{injury.leadPractitioner}</td><td><button className="row-menu" aria-label={`Open ${injury.title}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>✓</span><h3>{isPrevious ? "No previous injuries found" : "No current injuries found"}</h3><p>{isPrevious ? "Try another athlete or search term." : "Current injury episodes will appear here."}</p></div>}
    </section>
  </>;
}

function InjuryTimeline({ injuries, onOpen, label = "All injuries" }: { injuries: Injury[]; onOpen: (id: string) => void; label?: string }) {
  return <div className="injury-record-timeline" aria-label={label}>{injuries.map((injury) => <button key={injury.id} onClick={() => onOpen(injury.id)}><span className={`injury-timeline-dot ${injury.stage === "Closed" ? "closed" : ""}`} /><time>{shortDate(injury.closedAt ?? injury.onsetDate)}</time><div><strong>{injury.title}</strong><small>{injury.bodyArea} · {injury.laterality} · {injury.leadPractitioner}</small></div><Status value={injury.stage} /><b>›</b></button>)}</div>;
}

function AthleteInjuriesView({ athlete, injuries, onBack, onOpen }: { athlete: Athlete; injuries: Injury[]; onBack: () => void; onOpen: (id: string) => void }) {
  const ordered = [...injuries].sort((a, b) => new Date(b.closedAt ?? b.updatedAt).getTime() - new Date(a.closedAt ?? a.updatedAt).getTime());
  return <><button className="back-link return-context" onClick={onBack}>← Back to {fullName(athlete)}</button><PageHeading eyebrow="Athlete injury record" title="All injuries" text={`${fullName(athlete)} · ${shortDate(athlete.dateOfBirth)} · ${age(athlete.dateOfBirth)} years.`} /><section className="panel athlete-injury-timeline-panel"><div className="panel-head"><div><span className="section-kicker">Longitudinal record</span><h3>{ordered.length} injury episodes</h3></div><span className="result-count">{ordered.filter((injury) => injury.stage !== "Closed").length} current · {ordered.filter((injury) => injury.stage === "Closed").length} previous</span></div>{ordered.length ? <InjuryTimeline injuries={ordered} onOpen={onOpen} /> : <div className="empty-state"><h3>No injury episodes</h3><p>This athlete has no current or previous injury records.</p></div>}</section></>;
}

function InjuryDetailView({ injury, rehabilitationPlan, history, encounters, expandedEncounters, onExpandedEncountersChange, backLabel, onBack, onAthlete, onEncounter, onStage, onRehabilitation, onCreateRehabilitation }: { injury: Injury; rehabilitationPlan?: RehabilitationPlan; history: InjuryHistory[]; encounters: Encounter[]; expandedEncounters: string[]; onExpandedEncountersChange: (ids: string[]) => void; backLabel: string; onBack: () => void; onAthlete: (id: string) => void; onEncounter: (encounter: Encounter) => void; onStage: () => void; onRehabilitation: (id: string) => void; onCreateRehabilitation: () => void }) {
  const activeIndex = injuryStages.indexOf(injury.stage);
  const toggleEncounter = (id: string) => onExpandedEncountersChange(expandedEncounters.includes(id) ? expandedEncounters.filter((item) => item !== id) : [...expandedEncounters, id]);
  return <>
    <button className={`back-link ${backLabel === "Back to encounter" ? "return-context" : ""}`} onClick={onBack}>← {backLabel}</button>
    <section className="injury-hero"><div className="injury-hero-main"><button className="clean-button injury-athlete" onClick={() => onAthlete(injury.athleteId)}><Avatar name={injury.athleteName} size="lg" /><span><small>{injury.mrn} · {injury.sport}</small><strong>{injury.athleteName}</strong></span></button><div className="injury-title"><span className="profile-kicker">Injury episode · {injury.diagnosisStatus}</span><h1>{injury.title}</h1><p>{injury.bodyArea} · {injury.laterality} · Onset {shortDate(injury.onsetDate)}</p></div></div><div className="injury-hero-actions"><Status value={injury.stage} /><button className="button primary" onClick={onStage}>Update stage</button></div></section>
    <section className="panel pathway-panel"><div className="panel-head"><div><span className="section-kicker">Clinical pathway</span><h3>Episode progression</h3></div><span className="result-count">Day {daysOpen(injury)}</span></div><div className="stage-track">{injuryStages.map((stage, index) => <div key={stage} className={`${index < activeIndex ? "complete" : ""} ${index === activeIndex ? "current" : ""}`}><span>{index < activeIndex ? "✓" : index + 1}</span><small>{stage}</small></div>)}</div></section>
    <section className="injury-detail-grid"><div className="injury-detail-main"><div className="panel"><div className="panel-head"><div><span className="section-kicker">Clinical snapshot</span><h3>Episode details</h3></div><Status value={injury.participationStatus} /></div><div className="snapshot-grid"><SummaryItem label="Body area"><strong>{injury.bodyArea} · {injury.laterality}</strong></SummaryItem><SummaryItem label="Severity"><strong>{injury.severity}</strong></SummaryItem><SummaryItem label="Mechanism"><strong>{injury.mechanism}</strong></SummaryItem><SummaryItem label="Diagnosis"><strong>{injury.diagnosisStatus}</strong></SummaryItem><SummaryItem label="Lead practitioner"><strong>{injury.leadPractitioner}</strong></SummaryItem><SummaryItem label="Expected return"><strong>{shortDate(injury.expectedReturnDate)}</strong></SummaryItem></div></div><div className="next-action-card"><span>Next clinical action</span><h3>{injury.nextAction}</h3><p>Review scheduled {shortDate(injury.reviewDate)}</p></div>{injury.closureSummary && <div className="panel closure-card"><span className="section-kicker">Closure summary</span><p>{injury.closureSummary}</p></div>}{rehabilitationPlan ? <button className="rehab-link-card" onClick={() => onRehabilitation(rehabilitationPlan.id)}><ProgressRing value={rehabilitationPlan.overallProgress} /><div><span>Active rehabilitation plan</span><h3>{rehabilitationPlan.title}</h3><p>Phase {rehabilitationPlan.currentPhase} · {rehabilitationPlan.currentPhaseTitle}</p></div><b>Open plan ›</b></button> : injury.stage !== "Closed" && <button className="rehab-empty-card" onClick={onCreateRehabilitation}><span>↗</span><div><strong>Build the rehabilitation pathway</strong><small>No active rehabilitation plan is linked to this injury.</small></div><b>＋ Create plan</b></button>}<div className="panel linked-encounters-panel"><div className="panel-head"><div><span className="section-kicker">Connected record</span><h3>Linked encounters</h3></div></div>{encounters.length ? <div className="linked-encounters">{encounters.map((encounter) => { const expanded = expandedEncounters.includes(encounter.id); const encounterHistory = encounter.plan || [encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).map((item) => `<p>${item}</p>`).join("") || "<p>No clinical history recorded.</p>"; return <article key={encounter.id} className={expanded ? "expanded" : ""}><div className="linked-encounter-summary"><span className="linked-record-mark">≡</span><div><strong>{encounter.encounterType}</strong><small>{encounter.practitioner} · {shortDate(encounter.encounterDate)} · {makkahTime(encounter.encounterDate)} Makkah</small><p>{encounter.diagnosis || "No diagnosis recorded"}</p></div><button onClick={() => toggleEncounter(encounter.id)} aria-expanded={expanded}>{expanded ? "Hide details ↑" : "View details ↓"}</button></div>{expanded && <div className="linked-encounter-details"><div><small>Reason for visit</small><strong>{encounter.reason}</strong></div><div><small>Diagnosis</small><strong>{encounter.diagnosis || "No diagnosis recorded"}</strong></div><div><small>City</small><strong>{encounter.clinicCity}</strong></div><section><small>History</small><div dangerouslySetInnerHTML={{ __html: encounterHistory }} /></section><button className="button primary small" onClick={() => onEncounter(encounter)}>Open full encounter →</button></div>}</article>; })}</div> : <div className="empty-state compact-empty"><h3>No linked encounters</h3><p>Link an injury from its related encounter to keep the pathway evidence together.</p></div>}</div></div>
      <aside className="panel injury-history"><div className="panel-head"><div><span className="section-kicker">Decision trail</span><h3>Status history</h3></div></div><div className="history-timeline">{history.map((item) => <div key={item.id}><i /><span><strong>{item.toStage}</strong><p>{item.note}</p><small>{item.changedBy} · {shortDate(item.createdAt)}</small></span></div>)}</div></aside>
    </section>
  </>;
}

function ProgressRing({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  return <span className={`progress-ring progress-ring-${size}`} style={{ "--progress": `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as React.CSSProperties}><strong>{value}%</strong></span>;
}

function latestMeasurement(measurements: RehabilitationMeasurement[], metricType: string) {
  return measurements.find((measurement) => measurement.metricType === metricType);
}

function measurementValue(measurement?: RehabilitationMeasurement) {
  if (!measurement) return "Not recorded";
  if (measurement.numericValue !== null) return `${measurement.numericValue}${measurement.unit}`;
  return measurement.textValue || "Not recorded";
}

function RehabilitationView({ plans, measurements, stats, onNew, onOpen }: { plans: RehabilitationPlan[]; measurements: RehabilitationMeasurement[]; stats: Bootstrap["stats"]; onNew: () => void; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState("Active plans");
  const today = new Date();
  const shown = plans
    .filter((plan) => filter === "All plans" || plan.status === (filter === "Active plans" ? "Active" : "Completed"))
    .sort((a, b) => Math.abs(new Date(a.startDate).getTime() - today.getTime()) - Math.abs(new Date(b.startDate).getTime() - today.getTime()));
  return <>
    <PageHeading eyebrow="Rehabilitation workspace" title="Plans & progression" text="Turn clinical decisions into measurable phases, sessions, and criteria-led progression." action={<button className="button primary" onClick={onNew}>＋ Create rehabilitation plan</button>} />
    <section className="rehab-overview-metrics"><div><span>↗</span><small>Active plans</small><strong>{stats.activeRehabPlans}</strong><p>Across current injury pathways</p></div><div><span>≡</span><small>Sessions · 7 days</small><strong>{stats.rehabSessionsThisWeek}</strong><p>Completed rehabilitation work</p></div><div><span>✓</span><small>Criteria ready</small><strong>{stats.rehabCriteriaReady}</strong><p>Eligible for phase review</p></div><div><span>!</span><small>Reviews due</small><strong>{stats.rehabReviewsDue}</strong><p>Clinical decisions needed</p></div></section>
    <section className="panel registry-panel"><div className="registry-tools"><div className="stage-filters">{["Active plans", "Completed", "All plans"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><span className="result-count">{shown.length} plans</span></div>{shown.length ? <div className="rehab-plan-grid">{shown.map((plan) => { const planMeasurements = measurements.filter((item) => item.planId === plan.id); return <button key={plan.id} className="rehab-plan-card" onClick={() => onOpen(plan.id)}><div className="rehab-plan-top"><ProgressRing value={plan.overallProgress} size="lg" /><span><Status value={plan.status} /><small>{plan.mrn} · {plan.sport}</small><h3>{plan.athleteName}</h3><p>{plan.injuryTitle}</p></span></div><div className="rehab-plan-phase"><span>Current phase</span><strong>{plan.currentPhase} / {plan.phaseCount} · {plan.currentPhaseTitle}</strong><div><i style={{ width: `${plan.currentPhaseProgress}%` }} /></div><small>{plan.currentPhaseProgress}% phase progress</small></div><div className="rehab-card-clinical"><span><small>Pain</small>{measurementValue(latestMeasurement(planMeasurements, "pain"))}</span><span><small>ROM</small>{measurementValue(latestMeasurement(planMeasurements, "rom"))}</span><span><small>Mobility</small>{measurementValue(latestMeasurement(planMeasurements, "mobility"))}</span></div><div className="rehab-plan-foot"><span><small>Starting date</small>{shortDate(plan.startDate)}</span><span><small>Last follow-up</small>{shortDate(plan.lastFollowUpDate)}</span><b>Open pathway ›</b></div></button>; })}</div> : <div className="empty-state"><span>↗</span><h3>No rehabilitation plans here</h3><p>Create a plan from an open injury episode to begin progression.</p></div>}</section>
  </>;
}

function RehabilitationDetailView({ plan, phases, exercises, sessions, measurements, onBack, onInjury, onAthlete, onSession, onAdvance }: { plan: RehabilitationPlan; phases: RehabilitationPhase[]; exercises: RehabilitationExercise[]; sessions: RehabilitationSession[]; measurements: RehabilitationMeasurement[]; onBack: () => void; onInjury: (id: string) => void; onAthlete: (id: string) => void; onSession: () => void; onAdvance: () => void }) {
  const current = phases.find((phase) => phase.phaseNumber === plan.currentPhase);
  const currentExercises = exercises.filter((exercise) => exercise.phaseId === current?.id);
  const canAdvance = plan.status === "Active" && (current?.progress ?? 0) >= 80;
  const latestClinical = ["pain", "rom", "swelling", "strength", "neuromuscular", "mobility", "response"].map((type) => latestMeasurement(measurements, type)).filter((item): item is RehabilitationMeasurement => Boolean(item));
  return <>
    <button className="back-link" onClick={onBack}>← Rehabilitation workspace</button>
    <section className="rehab-detail-hero"><div className="rehab-detail-identity"><ProgressRing value={plan.overallProgress} size="lg" /><div><span className="profile-kicker">Rehabilitation plan · {plan.status}</span><h1>{plan.title}</h1><p><button onClick={() => onAthlete(plan.athleteId)}>{plan.athleteName}</button> · <button onClick={() => onInjury(plan.injuryId)}>{plan.injuryTitle}</button></p></div></div><div className="rehab-detail-actions"><button className="button secondary" onClick={onSession} disabled={(current?.progress ?? 0) >= 100}>＋ Log session</button><button className="button primary" onClick={onAdvance} disabled={!canAdvance}>{current?.phaseNumber === phases.length ? "Complete plan" : "Next phase"}</button></div></section>
    <section className="panel rehab-phase-map"><div className="panel-head"><div><span className="section-kicker">Criteria-led pathway</span><h3>Rehabilitation phases</h3></div></div><div className="rehab-phase-track">{phases.map((phase) => <div key={phase.id} className={phase.status.toLowerCase()}><span>{phase.status === "Complete" ? "✓" : phase.phaseNumber}</span><div><small>Phase {phase.phaseNumber}</small><strong>{phase.title}</strong><i><b style={{ width: `${phase.progress}%` }} /></i></div></div>)}</div></section>
    <section className="panel rehab-clinical-snapshot"><div className="panel-head"><div><span className="section-kicker">Latest clinical check-in</span><h3>Measurable rehabilitation status</h3></div><span className="result-count">Updated from logged sessions</span></div>{latestClinical.length ? <div className="rehab-clinical-grid">{latestClinical.map((measurement) => <article key={measurement.id} className={`metric-${measurement.metricType}`}><small>{measurement.label}</small><strong>{measurementValue(measurement)}</strong><p>{measurement.context || shortDate(measurement.recordedAt)}</p><time>{shortDate(measurement.recordedAt)}</time></article>)}</div> : <div className="empty-state compact-empty"><h3>No clinical measurements yet</h3><p>Use Detailed clinical check-in while logging a session only when a meaningful measurement is available.</p></div>}</section>
    <section className="rehab-detail-grid"><div className="rehab-detail-main"><div className="current-phase-card"><div><span>Current phase · {current?.phaseNumber} of {phases.length}</span><h2>{current?.title}</h2><p>{current?.goals}</p></div><ProgressRing value={current?.progress ?? 0} size="lg" /><div className="criteria-box"><small>Exit criteria</small><strong>{current?.exitCriteria}</strong><p>{canAdvance ? "Criteria review is ready for clinical sign-off." : `Progress must reach 80% before advancement. Current: ${current?.progress ?? 0}%.`}</p></div></div><div className="panel"><div className="panel-head"><div><span className="section-kicker">Current prescription</span><h3>Exercises & loading</h3></div><span className="result-count">{currentExercises.length} items</span></div>{currentExercises.length ? <div className="exercise-list">{currentExercises.map((exercise, index) => <div key={exercise.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{exercise.name}</strong><small>{exercise.target}</small></div><b>{exercise.dosage}</b><Status value={exercise.status} /></div>)}</div> : <div className="empty-state compact-empty"><h3>No exercises prescribed</h3><p>The current phase can be progressed through recorded sessions and criteria.</p></div>}</div><div className="panel"><div className="panel-head"><div><span className="section-kicker">Delivery record</span><h3>Sessions</h3></div><button className="text-button" onClick={onSession} disabled={(current?.progress ?? 0) >= 100}>＋ Log session</button></div><div className="rehab-session-list">{sessions.map((session) => { const sessionMeasurements = measurements.filter((measurement) => measurement.sessionId === session.id); return <article key={session.id}><span className={`session-state ${session.status.toLowerCase()}`}>{session.status === "Completed" ? "✓" : "◷"}</span><div><strong>{session.sessionType}</strong><p>{session.notes || session.nextAction}</p><small>{session.practitioner} · {shortDate(session.sessionDate)}</small>{sessionMeasurements.length > 0 && <div className="session-measurement-chips">{sessionMeasurements.slice(0, 4).map((measurement) => <span key={measurement.id}>{measurement.label}: {measurementValue(measurement)}</span>)}</div>}</div>{session.status === "Completed" ? <div className="session-scores">{session.loadScore !== null && <span><small>Load</small>{session.loadScore}/10</span>}{(session.painPre !== null || session.painPost !== null) && <span><small>Pain</small>{session.painPre ?? "—"}→{session.painPost ?? "—"}</span>}<span><small>Phase</small>{session.phaseProgress}%</span></div> : <Status value="Scheduled" />}</article>; })}</div></div></div>
      <aside className="rehab-detail-side"><div className="panel rehab-plan-summary"><div className="panel-head"><div><span className="section-kicker">Plan controls</span><h3>Clinical summary</h3></div></div><dl><div><dt>Plan owner</dt><dd>{plan.ownerPractitioner}</dd></div><div><dt>Frequency</dt><dd>{plan.weeklyFrequency}</dd></div><div><dt>Next review</dt><dd>{shortDate(plan.nextReviewDate)}</dd></div><div><dt>Completed sessions</dt><dd>{plan.completedSessionCount}</dd></div></dl><div className="rehab-goal"><small>Primary goal</small><p>{plan.primaryGoal}</p></div><div className="rehab-goal"><small>Target date</small><p>{shortDate(plan.targetDate)}</p></div><div className="rehab-precaution"><small>Precautions</small><p>{plan.precautions}</p></div></div><div className="panel phase-criteria-list"><div className="panel-head"><div><span className="section-kicker">Decision framework</span><h3>Phase criteria</h3></div></div>{phases.map((phase) => <div key={phase.id}><span>{phase.phaseNumber}</span><div><strong>{phase.title}</strong><small>{phase.exitCriteria}</small></div></div>)}</div></aside>
    </section>
  </>;
}

function RehabilitationDetailViewV2({ plan, phases, exercises, sessions, measurements, onBack, onInjury, onAthlete, onSession, onAdvance }: { plan: RehabilitationPlan; phases: RehabilitationPhase[]; exercises: RehabilitationExercise[]; sessions: RehabilitationSession[]; measurements: RehabilitationMeasurement[]; onBack: () => void; onInjury: (id: string) => void; onAthlete: (id: string) => void; onSession: () => void; onAdvance: () => void }) {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const current = phases.find((phase) => phase.phaseNumber === plan.currentPhase);
  const currentExercises = exercises.filter((exercise) => exercise.phaseId === current?.id);
  const canAdvance = plan.status === "Active" && (current?.progress ?? 0) >= 80;
  const toggleSession = (id: string) => setExpandedSessionId((currentId) => currentId === id ? null : id);

  return <>
    <button className="back-link" onClick={onBack}>← Rehabilitation workspace</button>
    <section className="rehab-detail-hero"><div className="rehab-detail-identity"><ProgressRing value={plan.overallProgress} size="lg" /><div><span className="profile-kicker">Rehabilitation plan · {plan.status}</span><h1>{plan.title}</h1><p><button onClick={() => onAthlete(plan.athleteId)}>{plan.athleteName}</button> · <button onClick={() => onInjury(plan.injuryId)}>{plan.injuryTitle}</button></p></div></div><div className="rehab-detail-actions"><button className="button secondary" onClick={onSession} disabled={(current?.progress ?? 0) >= 100}>＋ Log session</button><button className="button primary" onClick={onAdvance} disabled={!canAdvance}>{current?.phaseNumber === phases.length ? "Complete plan" : "Next phase"}</button></div></section>
    <section className="panel rehab-phase-map"><div className="panel-head"><div><span className="section-kicker">Criteria-led pathway</span><h3>Rehabilitation phases</h3></div></div><div className="rehab-phase-track">{phases.map((phase) => <div key={phase.id} className={phase.status.toLowerCase()}><span>{phase.status === "Complete" ? "✓" : phase.phaseNumber}</span><div><small>Phase {phase.phaseNumber}</small><strong>{phase.title}</strong><i><b style={{ width: `${phase.progress}%` }} /></i></div></div>)}</div></section>
    <section className="rehab-detail-grid"><div className="rehab-detail-main"><div className="current-phase-card"><div><span>Current phase · {current?.phaseNumber} of {phases.length}</span><h2>{current?.title}</h2><p>{current?.goals}</p></div><ProgressRing value={current?.progress ?? 0} size="lg" /><div className="criteria-box"><small>Exit criteria</small><strong>{current?.exitCriteria}</strong><p>{canAdvance ? "Criteria review is ready for clinical sign-off." : `Progress must reach 80% before advancement. Current: ${current?.progress ?? 0}%.`}</p></div></div><div className="panel"><div className="panel-head"><div><span className="section-kicker">Current prescription</span><h3>Exercises & loading</h3></div><span className="result-count">{currentExercises.length} items</span></div>{currentExercises.length ? <div className="exercise-list">{currentExercises.map((exercise, index) => <div key={exercise.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{exercise.name}</strong><small>{exercise.target}</small></div><b>{exercise.dosage}</b><Status value={exercise.status} /></div>)}</div> : <div className="empty-state compact-empty"><h3>No exercises prescribed</h3><p>The current phase can be progressed through recorded sessions and criteria.</p></div>}</div><div className="panel"><div className="panel-head"><div><span className="section-kicker">Delivery record</span><h3>Sessions</h3></div><button className="text-button" onClick={onSession} disabled={(current?.progress ?? 0) >= 100}>＋ Log session</button></div><div className="rehab-session-list">{sessions.map((session) => { const isExpanded = expandedSessionId === session.id; const sessionMeasurements = measurements.filter((measurement) => measurement.sessionId === session.id); const hasScores = session.loadScore !== null || session.painPre !== null || session.painPost !== null || (session.phaseProgress !== null && Number.isFinite(Number(session.phaseProgress))); return <article key={session.id} className={isExpanded ? "expanded" : ""}><span className={`session-state ${session.status.toLowerCase()}`}>{session.status === "Completed" ? "✓" : "◷"}</span><div className="session-summary"><strong>{session.sessionType}</strong><small>{session.practitioner} · {shortDate(session.sessionDate)}</small></div>{session.status === "Completed" ? <div className="session-scores">{session.loadScore !== null && <span><small>Load</small>{session.loadScore}/10</span>}{(session.painPre !== null || session.painPost !== null) && <span><small>Pain</small>{session.painPre ?? "—"}→{session.painPost ?? "—"}</span>}{session.phaseProgress !== null && Number.isFinite(Number(session.phaseProgress)) && <span><small>Phase</small>{session.phaseProgress}%</span>}</div> : <Status value="Scheduled" />}<button className="session-details-toggle" onClick={() => toggleSession(session.id)} aria-expanded={isExpanded}>{isExpanded ? "Hide details ↑" : "View details ↓"}</button>{isExpanded && <div className="session-details"><section><small>Session comment & next action</small><p>{session.notes || session.nextAction || "No comment recorded."}</p></section>{hasScores && <section className="session-clinical-summary"><small>Session measures</small><div>{session.loadScore !== null && <span>Load: {session.loadScore}/10</span>}{(session.painPre !== null || session.painPost !== null) && <span>Pain: {session.painPre ?? "—"}→{session.painPost ?? "—"}</span>}{session.phaseProgress !== null && Number.isFinite(Number(session.phaseProgress)) && <span>Phase progress: {session.phaseProgress}%</span>}</div></section>}<section><small>Detailed clinical check-in</small>{sessionMeasurements.length ? <div className="session-measurement-details">{sessionMeasurements.map((measurement) => <div key={measurement.id}><strong>{measurement.label}</strong><span>{measurementValue(measurement)}</span>{measurement.context && <em>{measurement.context}</em>}</div>)}</div> : <p className="muted-copy">No detailed clinical measurements were recorded for this session.</p>}</section></div>}</article>; })}</div></div></div>
      <aside className="rehab-detail-side"><div className="panel rehab-plan-summary"><div className="panel-head"><div><span className="section-kicker">Plan controls</span><h3>Clinical summary</h3></div></div><dl><div><dt>Plan owner</dt><dd>{plan.ownerPractitioner}</dd></div><div><dt>Frequency</dt><dd>{plan.weeklyFrequency}</dd></div><div><dt>Next review</dt><dd>{shortDate(plan.nextReviewDate)}</dd></div><div><dt>Completed sessions</dt><dd>{plan.completedSessionCount}</dd></div></dl><div className="rehab-goal"><small>Primary goal</small><p>{plan.primaryGoal}</p></div><div className="rehab-goal"><small>Target date</small><p>{shortDate(plan.targetDate)}</p></div><div className="rehab-precaution"><small>Precautions</small><p>{plan.precautions}</p></div></div><div className="panel phase-criteria-list"><div className="panel-head"><div><span className="section-kicker">Decision framework</span><h3>Phase criteria</h3></div></div>{phases.map((phase) => <div key={phase.id}><span>{phase.phaseNumber}</span><div><strong>{phase.title}</strong><small>{phase.exitCriteria}</small></div></div>)}</div></aside>
    </section>
  </>;
}

function EncountersView({ encounters, athletes, initialAthleteId, initialEncounterId, embedded = false, onNew, onAthlete: _onAthlete, onManageInjury, onInjury, onSave }: { encounters: Encounter[]; athletes: Athlete[]; initialAthleteId?: string; initialEncounterId?: string | null; embedded?: boolean; onNew: () => void; onAthlete: (id: string) => void; onManageInjury?: (encounterId: string) => void; onInjury?: (injuryId: string, encounterId: string) => void; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const [athleteId, setAthleteId] = useState(initialAthleteId ?? encounters[0]?.athleteId ?? athletes[0]?.id ?? "");
  const [encounterType, setEncounterType] = useState("All professional roles");
  const [clinicCity, setClinicCity] = useState("All cities");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const selectedAthlete = athletes.find((athlete) => athlete.id === athleteId);
  const athleteEncounters = encounters.filter((encounter) => encounter.athleteId === athleteId);
  const filteredEncounters = athleteEncounters.filter((encounter) => {
    const day = encounter.encounterDate.slice(0, 10);
    return (encounterType === "All professional roles" || encounter.encounterType === encounterType)
      && (clinicCity === "All cities" || encounter.clinicCity === clinicCity)
      && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
  });
  const pageCount = Math.max(1, Math.ceil(filteredEncounters.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEncounters = filteredEncounters.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedEncounter = pageEncounters.find((encounter) => encounter.id === selectedEncounterId) ?? pageEncounters[0] ?? null;
  const encounterTypes = Array.from(new Set(athleteEncounters.map((encounter) => encounter.encounterType))).sort();
  const clearFilters = () => { setEncounterType("All professional roles"); setClinicCity("All cities"); setDateFrom(""); setDateTo(""); setPage(1); };
  useEffect(() => { if (initialAthleteId) { setAthleteId(initialAthleteId); setSelectedEncounterId(null); } }, [initialAthleteId]);
  useEffect(() => { if (initialEncounterId) { setSelectedEncounterId(initialEncounterId); const index = filteredEncounters.findIndex((encounter) => encounter.id === initialEncounterId); if (index >= 0) setPage(Math.floor(index / pageSize) + 1); } }, [initialEncounterId, filteredEncounters.length, pageSize]);
  useEffect(() => { setPage(1); }, [athleteId, encounterType, clinicCity, dateFrom, dateTo, pageSize]);
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
          <div className="medical-file-filters"><label><span>Professional role</span><select value={encounterType} onChange={(event) => setEncounterType(event.target.value)}><option>All professional roles</option>{encounterTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Clinic city</span><select value={clinicCity} onChange={(event) => setClinicCity(event.target.value)}><option>All cities</option><option>Riyadh</option><option>Jeddah</option><option>Dammam</option></select></label><label className="date-filter"><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label className="date-filter"><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label><button className="filter-clear" onClick={clearFilters}>Clear</button></div>
          <div className="medical-file-workspace medical-file-two-column">
            <aside className="visit-history"><div className="medical-column-head"><div><span className="section-kicker">One timeline</span><h3>{filteredEncounters.length} encounters</h3></div><span className="chronology-mark">Newest first</span></div><div className="visit-history-list">{pageEncounters.map((encounter) => { const date = new Date(encounter.encounterDate); const encounterLabel = encounter.injuryId ? (encounter.injuryOrigin ? "New injury" : "Follow-up injury") : null; return <button key={encounter.id} className={selectedEncounter?.id === encounter.id ? "active" : ""} onClick={() => setSelectedEncounterId(encounter.id)}><span className="visit-date"><strong>{String(date.getDate()).padStart(2, "0")}</strong><small>{new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date)}<br />{date.getFullYear()}</small><time>{makkahTime(encounter.encounterDate)}</time></span><span className="visit-card-copy"><i>{initials(encounter.practitioner)}</i><span><strong>{encounter.practitioner}</strong><small>{encounter.specialty}</small><p>{encounter.clinicCity}</p>{encounterLabel && <em className={`encounter-kind ${encounter.injuryOrigin ? "injury" : "followup"}`}>{encounterLabel}</em>}</span></span></button>; })}{!filteredEncounters.length && <div className="medical-empty"><span>⌕</span><strong>No matching visits</strong><p>Clear the filters or choose another athlete.</p></div>}</div>{filteredEncounters.length > 0 && <div className="timeline-pagination"><label>Per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[5, 10, 15, 20].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><div><button aria-label="Previous encounters page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage} / {pageCount}</span><button aria-label="Next encounters page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button></div></div>}</aside>
            <main className="consultation-panel">{selectedEncounter && selectedAthlete ? <><div className="medical-column-head"><div><span className="section-kicker">Visit review</span><h3>{selectedEncounter.encounterType}</h3></div></div><div className="consultation-scroll" key={selectedEncounter.id}><section className="visit-summary-cards"><article><small>Diagnosis</small><strong>{selectedEncounter.diagnosis || "No diagnosis recorded."}</strong></article><article><small>Location</small><strong>{selectedEncounter.clinicCity}</strong></article><article className="visit-reason-card"><small>Reason for visit / presenting concern</small><strong>{selectedEncounter.reason}</strong></article></section><div className={`injury-relationship-card ${selectedEncounter.injuryId ? "linked" : "unlinked"}`}><span><small>Injury relationship</small><strong>{selectedEncounter.injuryTitle || "No injury linked"}</strong></span><div>{selectedEncounter.injuryId && <button onClick={() => onInjury?.(selectedEncounter.injuryId!, selectedEncounter.id)}>View details</button>}<button onClick={() => onManageInjury?.(selectedEncounter.id)}>{selectedEncounter.injuryId ? "Manage link" : "Link or create injury"}</button></div></div><VisitReviewEditor encounter={selectedEncounter} onSave={onSave} onDownload={() => downloadEncounterPdf(selectedEncounter, selectedAthlete)} /></div></> : <div className="medical-empty large"><span>≡</span><strong>Select an encounter</strong><p>The visit review will appear here.</p></div>}</main>
          </div>
        </div>
      </div>
    </section>
    {selectedEncounter && selectedAthlete && <EncounterReportTemplate encounter={selectedEncounter} athlete={selectedAthlete} />}
  </>;
}

type EditableEncounterField = "subjective" | "objective" | "assessment" | "plan" | "diagnosis";

function VisitReviewEditor({ encounter, onSave, onDownload }: { encounter: Encounter; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean>; onDownload: () => Promise<void> }) {
  const [amending, setAmending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [amendments, setAmendments] = useState<Array<{ id: string; createdAt: string }>>([]);
  const history = encounter.plan || [encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).map((item) => `<p>${item}</p>`).join("") || "<p>No clinical history recorded.</p>";
  const [draft, setDraft] = useState(history);
  const loadAmendments = async () => {
    if (encounter.canEdit !== 1) { setAmendments([]); return; }
    try {
      const response = await fetch(`/api/encounters/${encounter.id}/amendments`);
      if (!response.ok) { setAmendments([]); return; }
      const body = await response.json() as { amendments?: Array<{ id: string; createdAt: string }> };
      setAmendments(Array.isArray(body.amendments) ? body.amendments : []);
    } catch { setAmendments([]); }
  };
  useEffect(() => { setAmending(false); setDraft(history); setMessage(""); void loadAmendments(); }, [encounter.id, encounter.canEdit, history]);
  const saveAmendment = async () => {
    const content = draft || history;
    setSaving(true); setMessage("");
    const saved = await onSave(encounter.id, { plan: content });
    setSaving(false);
    if (saved) { setAmending(false); setMessage("Saved."); await loadAmendments(); }
    else setMessage("The amendment could not be saved. Please try again.");
  };
  const downloadReport = async () => {
    setDownloading(true); setMessage("");
    try { await onDownload(); }
    catch (error) { setMessage(error instanceof Error ? `PDF could not be created: ${error.message}` : "PDF could not be created. Please try again."); }
    finally { setDownloading(false); }
  };
  const cancelAmendment = () => { setDraft(history); setAmending(false); };
  const amendmentTimes = amendments.flatMap((item) => {
    const date = new Date(item.createdAt);
    return Number.isNaN(date.getTime()) ? [] : [new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date)];
  });
  return <>
    <section className={`encounter-history ${amending ? "is-amending" : ""}`}>
      {amending ? <TiptapClinicalEditor value={draft} onChange={setDraft} /> : <div className="encounter-history-content rich-document" dir="ltr" lang="en" dangerouslySetInnerHTML={{ __html: history }} />}
      {amending && <div className="history-amend-actions"><button className="button secondary small" onClick={cancelAmendment}>Cancel</button><button className="button primary small" disabled={saving} onClick={() => void saveAmendment()}>{saving ? "Saving…" : "Save amendment"}</button></div>}
    </section>
    {encounter.canEdit === 1 && !amending && <div className="visit-action-footer"><button className="button secondary small" onClick={() => { setMessage(""); setAmending(true); }}>✎ Amend visit</button><button className="button secondary small pdf-button" disabled={downloading} onClick={() => void downloadReport()}>{downloading ? "Preparing PDF…" : "↓ Download PDF"}</button></div>}
    {message && <div className="amendment-message">{message}</div>}
    {amendmentTimes.length > 0 && <div className="amendment-times">{amendmentTimes.map((time, index) => <span key={`${time}-${index}`}>{time}</span>)}</div>}
  </>;
}

function DeprecatedVisitReviewEditor({ encounter, onSave, onDownload }: { encounter: Encounter; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean>; onDownload: () => Promise<void> }) {
  const [amending, setAmending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [amendments, setAmendments] = useState<Array<{ id: string; createdAt: string }>>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const history = encounter.plan || [encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).map((item) => `<p>${item}</p>`).join("") || "<p>No clinical history recorded.</p>";
  const loadAmendments = async () => { if (encounter.canEdit !== 1) { setAmendments([]); return; } try { const response = await fetch(`/api/encounters/${encounter.id}/amendments`); if (!response.ok) { setAmendments([]); return; } const body = await response.json() as { amendments?: Array<{ id: string; createdAt: string }> }; setAmendments(Array.isArray(body.amendments) ? body.amendments : []); } catch { setAmendments([]); } };
  useEffect(() => { setAmending(false); setMessage(""); void loadAmendments(); }, [encounter.id, encounter.canEdit]);
  const startAmendment = () => { setMessage(""); setAmending(true); };
  const cancelAmendment = () => { if (editorRef.current) editorRef.current.innerHTML = history; setAmending(false); };
  const formatHistory = (command: string, value?: string) => { editorRef.current?.focus(); document.execCommand(command, false, value); };
  const saveAmendment = async () => { const content = editorRef.current?.innerHTML ?? history; setSaving(true); setMessage(""); const saved = await onSave(encounter.id, { plan: content }); setSaving(false); if (saved) { setAmending(false); setMessage("Saved."); await loadAmendments(); } else setMessage("The amendment could not be saved. Please try again."); };
  const downloadReport = async () => { setDownloading(true); setMessage(""); try { await onDownload(); } catch (error) { setMessage(error instanceof Error ? `PDF could not be created: ${error.message}` : "PDF could not be created. Please try again."); } finally { setDownloading(false); } };
  const amendmentTimes = amendments.flatMap((item) => { const date = new Date(item.createdAt); return Number.isNaN(date.getTime()) ? [] : [new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date)]; });
  return <><section className={`encounter-history ${amending ? "is-amending" : ""}`}>{amending && <div className="history-toolbar" role="toolbar" aria-label="History formatting"><button type="button" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => formatHistory("bold")}><b>B</b></button><button type="button" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => formatHistory("italic")}><i>I</i></button><button type="button" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => formatHistory("underline")}><u>U</u></button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatHistory("insertUnorderedList")}>• List</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => formatHistory("insertOrderedList")}>1. List</button><input aria-label="Text colour" type="color" defaultValue="#006c46" onChange={(event) => formatHistory("foreColor", event.target.value)} /></div>}<div ref={editorRef} className="encounter-history-content" contentEditable={amending} suppressContentEditableWarning dir="ltr" lang="en" spellCheck dangerouslySetInnerHTML={{ __html: history }} />{amending && <div className="history-amend-actions"><button className="button secondary small" onClick={cancelAmendment}>Cancel</button><button className="button primary small" disabled={saving} onClick={() => void saveAmendment()}>{saving ? "Saving…" : "Save amendment"}</button></div>}</section>{encounter.canEdit === 1 && !amending && <div className="visit-action-footer"><button className="button secondary small" onClick={startAmendment}>✎ Amend visit</button><button className="button secondary small pdf-button" disabled={downloading} onClick={() => void downloadReport()}>{downloading ? "Preparing PDF…" : "↓ Download PDF"}</button></div>}{message && <div className="amendment-message">{message}</div>}{amendmentTimes.length > 0 && <div className="amendment-times">{amendmentTimes.map((time, index) => <span key={`${time}-${index}`}>{time}</span>)}</div>}</>;
}

function CursorBugVisitReviewEditor({ encounter, onSave }: { encounter: Encounter; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const [amending, setAmending] = useState(false);
  const [draft, setDraft] = useState(encounter.plan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [amendments, setAmendments] = useState<Array<{ id: string; createdAt: string }>>([]);
  const loadAmendments = async () => { if (encounter.canEdit !== 1) { setAmendments([]); return; } try { const response = await fetch(`/api/encounters/${encounter.id}/amendments`); if (!response.ok) { setAmendments([]); return; } const body = await response.json() as { amendments?: Array<{ id: string; createdAt: string }> }; setAmendments(Array.isArray(body.amendments) ? body.amendments : []); } catch { setAmendments([]); } };
  useEffect(() => { setAmending(false); setDraft(encounter.plan); setMessage(""); void loadAmendments(); }, [encounter.id, encounter.canEdit]);
  const saveAmendment = async () => { setSaving(true); setMessage(""); const saved = await onSave(encounter.id, { plan: draft }); setSaving(false); if (saved) { setAmending(false); setMessage("Saved."); await loadAmendments(); } else setMessage("The amendment could not be saved. Please try again."); };
  const history = encounter.plan || [encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).map((item) => `<p>${item}</p>`).join("") || "<p>No clinical history recorded.</p>";
  const amendmentTimes = amendments.flatMap((item) => { const date = new Date(item.createdAt); return Number.isNaN(date.getTime()) ? [] : [new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date)]; });
  return <><section className="encounter-history"><div className="encounter-history-content" contentEditable={amending} suppressContentEditableWarning onInput={(event) => setDraft(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: amending ? draft : history }} />{amending && <div className="history-amend-actions"><button className="button secondary small" onClick={() => { setAmending(false); setDraft(encounter.plan); }}>Cancel</button><button className="button primary small" disabled={saving} onClick={() => void saveAmendment()}>{saving ? "Saving…" : "Save amendment"}</button></div>}</section>{encounter.canEdit === 1 && <div className="visit-action-footer"><button className="button secondary small" onClick={() => setAmending(true)}>✎ Amend visit</button><button className="button secondary small pdf-button" onClick={() => window.print()}>↓ Download PDF</button></div>}{message && <div className="amendment-message">{message}</div>}{amendmentTimes.length > 0 && <div className="amendment-times">{amendmentTimes.map((time, index) => <span key={`${time}-${index}`}>{time}</span>)}</div>}</>;
}

function PriorVisitReviewEditor({ encounter, onSave }: { encounter: Encounter; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const [amending, setAmending] = useState(false);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState(encounter.plan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [amendments, setAmendments] = useState<Array<{ id: string; reason: string; createdAt: string; practitioner: string }>>([]);
  const loadAmendments = async () => { const response = await fetch(`/api/encounters/${encounter.id}/amendments`); if (response.ok) { const body = await response.json() as { amendments: Array<{ id: string; reason: string; createdAt: string; practitioner: string }> }; setAmendments(body.amendments); } };
  useEffect(() => { setAmending(false); setReason(""); setDraft(encounter.plan); setMessage(""); void loadAmendments(); }, [encounter.id]);
  const saveAmendment = async () => { if (!reason.trim()) { setMessage("Add the reason for this amendment before saving."); return; } setSaving(true); setMessage(""); const saved = await onSave(encounter.id, { plan: draft, amendmentReason: reason.trim() }); setSaving(false); if (saved) { setAmending(false); setMessage("Amendment saved."); await loadAmendments(); } else setMessage("The amendment could not be saved. Please try again."); };
  const displayHistory = encounter.plan || [encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).map((item) => `<p>${item}</p>`).join("") || "<p>No clinical history recorded.</p>";
  return <><section className="encounter-history"><div className="encounter-history-content" dangerouslySetInnerHTML={{ __html: displayHistory }} /></section>{encounter.canEdit === 1 && <>{amending && <section className="amendment-editor"><label>Reason for amendment*<input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why does this record need to change?" /></label><label>Clinical history<div className="amendment-content" contentEditable suppressContentEditableWarning onInput={(event) => setDraft(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: draft }} /></label><div><button className="button secondary small" onClick={() => setAmending(false)}>Cancel</button><button className="button primary small" disabled={saving} onClick={() => void saveAmendment()}>{saving ? "Saving…" : "Save amendment"}</button></div></section>}<div className="visit-action-footer"><button className="button secondary small" onClick={() => setAmending(true)}>✎ Amend visit</button><button className="button secondary small pdf-button" onClick={() => window.print()}>↓ Download PDF</button></div></>}{message && <div className="amendment-message">{message}</div>}{amendments.length > 0 && <section className="amendment-log"><h4>Amendment record</h4>{amendments.map((item) => <div key={item.id}><strong>{item.practitioner}</strong><span>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(item.createdAt))}</span><p>{item.reason}</p></div>)}</section>}</>;
}

function LegacyVisitReviewEditor({ encounter, onSave }: { encounter: Encounter; onSave: (id: string, fields: EncounterUpdate) => Promise<boolean> }) {
  const [values, setValues] = useState<Record<EditableEncounterField, string>>({ subjective: encounter.subjective, objective: encounter.objective, assessment: encounter.assessment, plan: encounter.plan, diagnosis: encounter.diagnosis });
  const [editing, setEditing] = useState<EditableEncounterField | null>(null);
  const [saveState, setSaveState] = useState("");
  const [amendmentMode, setAmendmentMode] = useState(false);
  const [requestingAmendment, setRequestingAmendment] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setValues({ subjective: encounter.subjective, objective: encounter.objective, assessment: encounter.assessment, plan: encounter.plan, diagnosis: encounter.diagnosis }); setEditing(null); setSaveState(""); setAmendmentMode(false); setRequestingAmendment(false); setAmendmentReason(""); setSavedAt(""); }, [encounter.id]);
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
  const history = encounter.plan || [encounter.subjective, encounter.objective, encounter.assessment].filter(Boolean).map((item) => `<p>${item}</p>`).join("") || "<p>No clinical history recorded.</p>";
  return <article className="report-print-template"><header><div className={`report-logo-row logo-count-${logos.length}`}>{logos.map((logo) => <strong key={logo}>{logo}</strong>)}</div><p>Sports Health Visit Report</p></header><section className="report-athlete"><div><small>Athlete</small><strong>{fullName(athlete)}</strong><span>{athlete.mrn} · {shortDate(athlete.dateOfBirth)} · {age(athlete.dateOfBirth)} years</span><span>{athlete.sport} · {athlete.discipline}</span></div><div><small>Visit</small><strong>{shortDate(encounter.encounterDate)} · {makkahTime(encounter.encounterDate)} Makkah</strong><span>{encounter.encounterType}</span></div></section><section className="report-meta"><div><small>Practitioner</small><strong>{encounter.practitioner}</strong><span>{encounter.specialty}</span></div><div><small>City</small><strong>{encounter.clinicCity}</strong></div></section><section className="report-diagnosis"><small>Diagnosis</small><p>{encounter.diagnosis || "No diagnosis recorded."}</p></section><section className="report-reason"><small>Reason for visit</small><p>{encounter.reason}</p></section><section className="report-history"><small>History</small><div dangerouslySetInnerHTML={{ __html: history }} /></section><footer><span>SOPCare · Sports Health Intelligence</span><span>Generated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date())}</span></footer></article>;
}

function LegacyEncounterReportTemplate({ encounter, athlete }: { encounter: Encounter; athlete: Athlete }) {
  const logos = ["SOPCare"];
  return <article className="report-print-template"><header><div className={`report-logo-row logo-count-${logos.length}`}>{logos.map((logo) => <strong key={logo}>{logo}</strong>)}</div><p>Sports Health Visit Report</p></header><section className="report-athlete"><div><small>Athlete</small><strong>{fullName(athlete)}</strong><span>{athlete.mrn} · {shortDate(athlete.dateOfBirth)} · {age(athlete.dateOfBirth)} years</span><span>{athlete.sport} · {athlete.discipline}</span></div><div><small>Visit</small><strong>{shortDate(encounter.encounterDate)} · {makkahTime(encounter.encounterDate)} Makkah</strong><span>{encounter.encounterType}</span></div></section><section className="report-meta"><div><small>Practitioner</small><strong>{encounter.practitioner}</strong><span>{encounter.specialty}</span></div><div><small>City</small><strong>{encounter.clinicCity}</strong></div></section><section className="report-diagnosis"><small>Diagnosis</small><p>{encounter.diagnosis || "No diagnosis recorded."}</p></section><section className="report-reason"><small>Reason for visit</small><p>{encounter.reason}</p></section><div className="report-soap">{[["S", "Subjective", encounter.subjective], ["O", "Objective", encounter.objective], ["A", "Assessment", encounter.assessment], ["P", "Plan", encounter.plan]].map(([letter, title, content]) => <section key={letter}><b>{letter}</b><div><h2>{title}</h2><p>{content || `No ${title.toLowerCase()} information recorded.`}</p></div></section>)}</div><footer><span>SOPCare · Sports Health Intelligence</span><span>Generated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date())}</span></footer></article>;
}

function CareTeamView({ practitioners, athletes }: { practitioners: Practitioner[]; athletes: Athlete[] }) {
  const specialties = ["Sports Medicine", "Physiotherapy", "Sports Nutrition", "Sports Psychology", "Clinical Administration"];
  return <><PageHeading eyebrow="Multidisciplinary network" title="Care Team" text="The practitioners collaborating around athlete health and availability." /><section className="specialty-strip">{specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</section><section className="team-directory">{practitioners.map((person, index) => <article className="person-card" key={person.id}><div className="person-card-top"><Avatar name={person.name} color={["#006C46", "#397F91", "#BB7B43", "#6A5E8C", "#4D7D72"][index]} size="lg" /><span className="availability"><i /> Available</span></div><h3>{person.name}</h3><p>{person.credentials} · {person.specialty}</p><div className="person-stat"><strong>{athletes.filter((_, athleteIndex) => athleteIndex % practitioners.length === index).length + 2}</strong><small>assigned athletes</small></div><button className="panel-action">View practitioner →</button></article>)}</section></>;
}

function ModalHeading({ kicker, title, text }: { kicker: string; title: string; text: string }) { return <div className="modal-heading"><span className="section-kicker">{kicker}</span><h2 id="modal-title">{title}</h2><p>{text}</p></div>; }

function cleanPastedHtml(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,form,input,button,meta,link").forEach((node) => node.remove());
  const allowedTags = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "UL", "OL", "LI", "H1", "H2", "H3", "BLOCKQUOTE", "SPAN", "FONT"]);
  parsed.body.querySelectorAll("*").forEach((node) => {
    if (!allowedTags.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
    const style = node.getAttribute("style") || "";
    const safeStyle = style.split(";").map((rule) => rule.trim()).filter((rule) => /^(font-weight|font-style|font-size|font-family|text-decoration|color|background-color|text-align|margin-left|padding-left)\s*:/i.test(rule)).join("; ");
    const color = node.tagName === "FONT" ? node.getAttribute("color") : null;
    const size = node.tagName === "FONT" ? node.getAttribute("size") : null;
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    if (safeStyle) node.setAttribute("style", safeStyle);
    if (color) node.setAttribute("color", color);
    if (size) node.setAttribute("size", size);
  });
  return parsed.body.innerHTML;
}

function plainTextToRichHtml(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ");
  const escape = (value: string) => value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character);
  return normalized.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => `<p>${escape(paragraph)}</p>`).join("");
}

function medicalReportPasteHtml(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/[ \t\n]+/g, " ").trim();
  if (!/Visit date\s*:/i.test(normalized) || !/(HISTORY OF PRESENT ILLNESS|REASON FOR VISIT \/ PRESENTING CONCERN)/i.test(normalized)) return "";
  const escape = (value: string) => value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character);
  const marker = /(Visit date|Athlete name|Date of birth|Age|Sport \/ Discipline|Clinic City|Reporter Name)\s*:|\b(HISTORY OF PRESENT ILLNESS|REASON FOR VISIT \/ PRESENTING CONCERN|DIAGNOSIS)\b/gi;
  const matches = [...normalized.matchAll(marker)];
  if (!matches.length) return "";
  const blocks: string[] = [];
  matches.forEach((match, index) => {
    const title = (match[1] || match[2] || "").trim();
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || normalized.length : normalized.length;
    const value = normalized.slice(start, end).trim();
    if (match[1]) blocks.push(`<p class="pasted-report-field"><strong>${escape(title)}:</strong> ${escape(value)}</p>`);
    else blocks.push(`<h2 class="pasted-report-heading">${escape(title.toUpperCase())}</h2>${value ? `<p>${escape(value)}</p>` : ""}`);
  });
  return blocks.join("");
}

function pasteRichText(event: ClipboardEvent<HTMLDivElement>, onChange: (html: string) => void) {
  event.preventDefault();
  const html = event.clipboardData.getData("text/html");
  const text = event.clipboardData.getData("text/plain");
  const content = medicalReportPasteHtml(text) || (html ? cleanPastedHtml(html) : plainTextToRichHtml(text));
  document.execCommand("insertHTML", false, content);
  onChange(event.currentTarget.innerHTML);
}

function RichTextToolbar({ editorRef, onChange }: { editorRef: RefObject<HTMLDivElement | null>; onChange: (html: string) => void }) {
  const run = (command: string, value?: string) => { editorRef.current?.focus(); document.execCommand(command, false, value); onChange(editorRef.current?.innerHTML ?? ""); };
  const button = (label: string, command: string, content: ReactNode) => <button type="button" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={() => run(command)}>{content}</button>;
  return <div className="history-toolbar rich-toolbar" role="toolbar" aria-label="History formatting">
    <select aria-label="Paragraph style" title="Paragraph style" defaultValue="p" onChange={(event) => run("formatBlock", event.target.value)}><option value="p">Normal</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="blockquote">Quote</option></select>
    <select aria-label="Font family" title="Font family" defaultValue="Arial" onChange={(event) => run("fontName", event.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option></select>
    <select aria-label="Font size" title="Font size" defaultValue="3" onChange={(event) => run("fontSize", event.target.value)}><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Extra large</option></select>
    <span className="toolbar-divider" />{button("Bold", "bold", <b>B</b>)}{button("Italic", "italic", <i>I</i>)}{button("Underline", "underline", <u>U</u>)}{button("Bulleted list", "insertUnorderedList", "• List")}{button("Numbered list", "insertOrderedList", "1. List")}
    {button("Align left", "justifyLeft", "⇤")}{button("Align center", "justifyCenter", "↔")}{button("Align right", "justifyRight", "⇥")}
    <label className="toolbar-color" title="Text colour"><span>A</span><input aria-label="Text colour" type="color" defaultValue="#006c46" onChange={(event) => run("foreColor", event.target.value)} /></label>
    <label className="toolbar-color highlight" title="Highlight colour"><span>▰</span><input aria-label="Highlight colour" type="color" defaultValue="#fff2a8" onChange={(event) => run("hiliteColor", event.target.value)} /></label>
    {button("Undo", "undo", "↶")}{button("Redo", "redo", "↷")}{button("Clear formatting", "removeFormat", "Tx")}
  </div>;
}

function AthleteForm({ data, onSubmit, busy }: { data: Bootstrap; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="New athlete" title="Create athlete profile" text="Start the single clinical record that every specialty will share." /><div className="form-grid"><label>First name*<input name="firstName" required autoFocus /></label><label>Last name*<input name="lastName" required /></label><label>Date of birth*<input name="dateOfBirth" type="date" required /></label><label>Sex*<select name="sex" required><option value="">Select</option><option>Female</option><option>Male</option></select></label><label>Sport*<select name="sportId" required><option value="">Select sport</option>{data.sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label><label>Discipline*<input name="discipline" required placeholder="e.g. 400 m" /></label><label>Primary squad*<select name="teamId" required><option value="">Select squad</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Dominant side<select name="dominantSide"><option>Right</option><option>Left</option><option>Mixed</option></select></label></div><div className="form-note"><span>i</span> A SOPCare medical record number will be generated automatically.</div><ModalActions busy={busy} primary="Create athlete" /></form>;
}

function LegacyRichHistoryInput() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const format = (command: string, commandValue?: string) => { editorRef.current?.focus(); document.execCommand(command, false, commandValue); setValue(editorRef.current?.innerHTML ?? ""); };
  return <div className="rich-history-input"><div className="history-toolbar" role="toolbar" aria-label="History formatting"><button type="button" aria-label="Bold" onClick={() => format("bold")}><b>B</b></button><button type="button" aria-label="Italic" onClick={() => format("italic")}><i>I</i></button><button type="button" aria-label="Underline" onClick={() => format("underline")}><u>U</u></button><button type="button" onClick={() => format("insertUnorderedList")}>• List</button><button type="button" onClick={() => format("insertOrderedList")}>1. List</button><input aria-label="Text colour" type="color" defaultValue="#006c46" onChange={(event) => format("foreColor", event.target.value)} /></div><div ref={editorRef} className="history-content" contentEditable suppressContentEditableWarning dir="ltr" lang="en" spellCheck data-placeholder="Record symptoms, assessment, decisions, treatment and return-to-sport actions. You can paste formatted text here." onInput={(event) => setValue(event.currentTarget.innerHTML)} /><input type="hidden" name="plan" value={value} /></div>;
}

function TiptapClinicalEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: "tiptap-prose",
        "aria-label": "History",
        "data-placeholder": "Record symptoms, assessment, decisions, treatment and return-to-sport actions. Paste formatted text from Word or another clinical document.",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);
  if (!editor) return <div className="tiptap-loading">Loading editor…</div>;
  const run = (action: () => void) => action();
  return <div className="tiptap-editor rich-document">
    <div className="tiptap-toolbar" role="toolbar" aria-label="History formatting">
      <select aria-label="Paragraph style" value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"} onChange={(event) => run(() => event.target.value === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 }).run())}><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select>
      <select aria-label="Font family" value={(editor.getAttributes("textStyle").fontFamily as string) || "Arial"} onChange={(event) => run(() => editor.chain().focus().setFontFamily(event.target.value).run())}><option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option></select>
      <select aria-label="Font size" value={(editor.getAttributes("textStyle").fontSize as string) || "14px"} onChange={(event) => run(() => editor.chain().focus().setFontSize(event.target.value).run())}><option value="12px">Small</option><option value="14px">Normal</option><option value="16px">Large</option><option value="20px">Extra large</option></select>
      <span className="toolbar-divider" />
      <button type="button" aria-label="Bold" className={editor.isActive("bold") ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().toggleBold().run())}><b>B</b></button>
      <button type="button" aria-label="Italic" className={editor.isActive("italic") ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().toggleItalic().run())}><i>I</i></button>
      <button type="button" aria-label="Underline" className={editor.isActive("underline") ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}><u>U</u></button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}>• List</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}>1. List</button>
      <button type="button" aria-label="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().setTextAlign("left").run())}>⇤</button><button type="button" aria-label="Align center" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().setTextAlign("center").run())}>↔</button><button type="button" aria-label="Align right" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().setTextAlign("right").run())}>⇥</button>
      <label className="toolbar-color" title="Text colour"><span>A</span><input aria-label="Text colour" type="color" defaultValue="#006c46" onChange={(event) => run(() => editor.chain().focus().setColor(event.target.value).run())} /></label>
      <label className="toolbar-color highlight" title="Highlight colour"><span>■</span><input aria-label="Highlight colour" type="color" defaultValue="#fff2a8" onChange={(event) => run(() => editor.chain().focus().toggleHighlight({ color: event.target.value }).run())} /></label>
      <button type="button" aria-label="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().undo().run())}>↶</button><button type="button" aria-label="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().redo().run())}>↷</button>
      <button type="button" aria-label="Clear formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())}>Tx</button>
    </div>
    <EditorContent editor={editor} />
  </div>;
}

function RichHistoryInput() {
  const [value, setValue] = useState("");
  return <div className="rich-history-input word-like-editor"><TiptapClinicalEditor value={value} onChange={setValue} /><input type="hidden" name="plan" value={value} /></div>;
}

function EncounterForm({ actor, athlete, onSubmit, busy }: { actor: Bootstrap["actor"]; athlete: Athlete; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Clinical encounter" title="New encounter" text={`Record a new clinical encounter for ${fullName(athlete)}.`} /><input type="hidden" name="athleteId" value={athlete.id} /><div className="form-grid"><label className="span-2">Reason for visit*<input name="reason" required autoFocus placeholder="Concise clinical reason" /></label><div className="span-2 history-field"><span>History</span><RichHistoryInput /></div><label className="span-2">Diagnosis*<textarea name="diagnosis" rows={3} required placeholder="Write the clinical diagnosis in plain language — no ICD-10 code required" /></label><label className="span-2">Visibility<select name="visibility"><option>Care team</option><option>Restricted</option></select></label></div><div className="modal-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save encounter"}</button></div></form>;
}

function PractitionerProfileForm({ actor, onSubmit, busy }: { actor: Bootstrap["actor"]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Practitioner profile" title={actor.name} text="Your professional role and city are set when your account is created." /><div className="encounter-author-strip"><Avatar name={actor.name} size="sm" /><span><small>Professional role</small><strong>{actor.specialty}</strong><p>{actor.jobTitle || actor.email}</p></span><b>Signed-in account</b></div><section className="encounter-context"><div><small>Professional role</small><strong>{actor.specialty}</strong></div><div><small>City</small><strong>{actor.clinicCity}</strong></div></section><div className="form-grid"><label className="span-2">Mobile number<input name="phoneNumber" type="tel" defaultValue={actor.phoneNumber} /></label></div><ModalActions busy={busy} primary="Save profile" /></form>;
}

function InjuryAssociationForm({ injuries, currentInjuryId, onLater, onNone, onRemove, onCreate, onSubmit, busy }: { injuries: Injury[]; currentInjuryId?: string | null; onLater: () => void; onNone: () => void; onRemove: () => void; onCreate: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker={currentInjuryId ? "Injury relationship" : "Visit saved"} title="Is this visit related to an injury?" text="You can decide now or return to this setting from the visit at any time." /><div className="association-options"><button type="button" onClick={onNone}><strong>No injury</strong><small>Keep this encounter independent</small></button><button type="button" onClick={onCreate}><strong>Create new injury</strong><small>Start an injury pathway linked to this visit</small></button></div>{injuries.length > 0 && <div className="form-grid"><label className="span-2">Link an existing injury<select name="injuryId" required defaultValue={currentInjuryId || ""}><option value="">Select an open injury</option>{injuries.map((injury) => <option key={injury.id} value={injury.id}>{injury.title} · {injury.stage}</option>)}</select></label></div>}<div className="modal-actions split"><button type="button" className="button secondary" onClick={onLater}>Decide later</button>{currentInjuryId && <button type="button" className="button secondary danger" onClick={onRemove}>Remove link</button>}{injuries.length > 0 && <button className="button primary" disabled={busy}>{busy ? "Saving…" : currentInjuryId ? "Update link" : "Link selected injury"}</button>}</div></form>;
}

function InjuryForm({ athletes, practitioners, selectedId, onSubmit, busy }: { athletes: Athlete[]; practitioners: Practitioner[]; selectedId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const today = todayInputDate();
  return <form onSubmit={onSubmit}><ModalHeading kicker="Injury management" title="Open injury episode" text="Create a shared pathway from first assessment through safe return to sport." /><div className="form-grid"><label className="span-2">Athlete*<select name="athleteId" required defaultValue={selectedId ?? ""} autoFocus><option value="">Select athlete</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{fullName(athlete)} · {athlete.mrn}</option>)}</select></label><label className="span-2">Episode title*<input name="title" required placeholder="e.g. Right hamstring strain" /></label><label>Diagnosis status*<select name="diagnosisStatus" defaultValue="Suspected"><option>Suspected</option><option>Confirmed</option></select></label><label>Severity*<select name="severity" defaultValue="Moderate"><option>Mild</option><option>Moderate</option><option>Severe</option></select></label><label>Body area*<input name="bodyArea" required placeholder="e.g. Posterior thigh" /></label><label>Laterality<select name="laterality"><option>Right</option><option>Left</option><option>Bilateral</option><option>Not applicable</option></select></label><label>Onset date*<input name="onsetDate" type="date" max={today} required /></label><label>Participation status*<select name="participationStatus" defaultValue="Under Treatment"><option>Available</option><option>Modified Training</option><option>Under Treatment</option><option>Return-to-Sport Review</option><option>Unavailable</option></select></label><label className="span-2">Mechanism*<input name="mechanism" required placeholder="How did the episode start?" /></label><label className="span-2">Lead practitioner*<select name="leadPractitionerId" required><option value="">Select practitioner</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.specialty}</option>)}</select></label><label className="span-2">Next clinical action*<textarea name="nextAction" required rows={3} placeholder="The next clear action for the care team" /></label><label>Review date<input name="reviewDate" type="date" min={today} /></label><label>Expected return<input name="expectedReturnDate" type="date" min={today} /></label></div><ModalActions busy={busy} primary="Open injury episode" /></form>;
}

function InjuryStageForm({ injury, onSubmit, busy }: { injury: Injury; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const today = todayInputDate();
  return <form onSubmit={onSubmit}><ModalHeading kicker="Clinical pathway" title="Update injury stage" text={`Record the next shared decision for ${injury.athleteName}.`} /><div className="locked-note injury-note"><Status value={injury.stage} /><div><strong>{injury.title}</strong><small>Current pathway stage</small></div></div><div className="form-grid one-column"><label>Pathway stage*<select name="stage" required defaultValue={injury.stage} autoFocus>{injuryStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label>Participation status*<select name="participationStatus" required defaultValue={injury.participationStatus}><option>Available</option><option>Modified Training</option><option>Under Treatment</option><option>Return-to-Sport Review</option><option>Unavailable</option></select></label><label>Decision note<textarea name="note" rows={3} placeholder="Why is the pathway changing?" /></label><label>Next clinical action*<textarea name="nextAction" rows={3} required defaultValue={injury.nextAction} /></label><label>Review date<input name="reviewDate" type="date" min={today} defaultValue={injury.reviewDate ?? ""} /></label><label>Expected return<input name="expectedReturnDate" type="date" min={today} defaultValue={injury.expectedReturnDate ?? ""} /></label><label>Closure summary<textarea name="closureSummary" rows={4} defaultValue={injury.closureSummary ?? ""} placeholder="Required when moving the episode to Closed" /></label></div><ModalActions busy={busy} primary="Update pathway" /></form>;
}

function LinkEncounterForm({ injury, encounters, onSubmit, busy }: { injury: Injury; encounters: Encounter[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><ModalHeading kicker="Connected clinical record" title="Link an encounter" text={`Attach a relevant encounter to ${injury.title}.`} />{encounters.length ? <><div className="form-grid one-column"><label>Encounter*<select name="encounterId" required autoFocus><option value="">Select encounter</option>{encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{shortDate(encounter.encounterDate)} · {encounter.encounterType} · {encounter.practitioner}</option>)}</select></label></div><ModalActions busy={busy} primary="Link encounter" /></> : <div className="empty-state compact-empty"><h3>No available encounters</h3><p>Create an encounter for this athlete before linking it to the injury pathway.</p></div>}</form>;
}

function RehabilitationForm({ injuries, activePlanInjuryIds, selectedInjuryId, onSubmit, busy }: { injuries: Injury[]; activePlanInjuryIds: string[]; selectedInjuryId?: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const availableInjuries = injuries.filter((injury) => injury.stage !== "Closed" && !activePlanInjuryIds.includes(injury.id));
  const selectedValue = availableInjuries.some((injury) => injury.id === selectedInjuryId) ? selectedInjuryId : "";
  const today = todayInputDate();
  return <form onSubmit={onSubmit}><ModalHeading kicker="Rehabilitation pathway" title="Create rehabilitation plan" text="Start with the essential plan details. Athlete, injury, owner, role, and city are inherited automatically." /><div className="quick-form-intro"><strong>Quick plan</strong><span>Only the clinical essentials are required.</span></div><div className="form-grid"><label className="span-2">Injury episode*<select name="injuryId" required defaultValue={selectedValue}><option value="">Select open injury</option>{availableInjuries.map((injury) => <option key={injury.id} value={injury.id}>{injury.athleteName} · {injury.title}</option>)}</select></label><label className="span-2">Plan title*<input name="title" required placeholder="e.g. Hamstring return-to-speed pathway" /></label><label>Weekly frequency*<input name="weeklyFrequency" type="number" min="1" max="14" step="1" inputMode="numeric" required placeholder="e.g. 4" /><small>Sessions per week</small></label><label>Start date*<input name="startDate" type="date" required /></label><label>Target date<input name="targetDate" type="date" min={today} /></label><label className="span-2">Primary goal*<textarea name="primaryGoal" rows={3} required placeholder="The measurable outcome this plan is working toward" /></label><div className="locked-note span-2"><span className="status">Plan owner</span><div><strong>Signed-in practitioner</strong><small>Professional role and clinic city are inherited from the account.</small></div></div><details className="clinical-checkin-details span-2"><summary><span><strong>Optional plan details</strong><small>Add only when clinically useful</small></span><b>＋</b></summary><div className="form-grid"><label>Next review<input name="nextReviewDate" type="date" min={today} /></label><label className="span-2">Precautions<textarea name="precautions" rows={3} placeholder="Loading restrictions, red flags, and performance constraints" /></label></div></details></div><div className="form-note"><span>4</span> SOPCare will create four phases: Protect & restore, Build capacity, Sport integration, and Return to performance.</div><ModalActions busy={busy} primary="Create rehabilitation plan" /></form>;
}

function RehabilitationSessionForm({ plan, onSubmit, busy }: { plan: RehabilitationPlan; onSubmit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const defaultSessionDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return <form onSubmit={onSubmit}><ModalHeading kicker={`Phase ${plan.currentPhase} · ${plan.currentPhaseTitle}`} title="Log rehabilitation session" text={`A quick session takes four clinical entries. Open the detailed check-in only when a measurement matters.`} /><div className="quick-form-intro"><strong>Quick session</strong><span>Athlete, injury, practitioner, phase, and session number are automatic.</span></div><div className="form-grid"><label>Session date & time*<input name="sessionDate" type="datetime-local" defaultValue={defaultSessionDate} required /></label><label>Session status<select name="status" defaultValue="Completed"><option>Completed</option><option>Scheduled</option></select></label><label className="span-2">Session type*<input name="sessionType" required placeholder="e.g. Gym rehabilitation, pool, field" /></label><label>Phase progress · 0–100*<input name="phaseProgress" type="number" min="0" max="100" defaultValue={plan.currentPhaseProgress} required /></label><label className="span-2">Session comment & next action*<textarea name="notes" rows={4} required placeholder="What was completed, how did the athlete respond, and what happens next?" /></label><input type="hidden" name="nextAction" value="" /><details className="clinical-checkin-details span-2"><summary><span><strong>Detailed clinical check-in</strong><small>Pain, ROM, swelling, strength, neuromuscular control, and mobility — all optional</small></span><b>＋</b></summary><div className="form-grid clinical-measurement-form"><label>Load score · 0–10<input name="loadScore" type="number" min="0" max="10" /></label><label>Activity pain · 0–10<input name="painActivity" type="number" min="0" max="10" /></label><label className="span-2">Pain context<input name="painContext" placeholder="e.g. End-range knee flexion or walking" /></label><label>ROM movement<input name="romMovement" placeholder="e.g. Knee flexion" /></label><label>ROM type<select name="romMode" defaultValue="AROM"><option>AROM</option><option>PROM</option></select></label><label>ROM degrees<input name="romDegrees" type="number" min="-30" max="220" /></label><label>Effusion grade<select name="swellingGrade" defaultValue=""><option value="">Not recorded</option><option>None</option><option>Trace</option><option>1+</option><option>2+</option><option>3+</option></select></label><label>Swelling circumference<input name="swellingCircumference" type="number" min="0" max="200" step="0.1" /></label><label>Unit<select name="swellingUnit" defaultValue="cm"><option>cm</option><option>in</option></select></label><label className="span-2">Measurement landmark<input name="swellingLocation" placeholder="e.g. Knee joint line" /></label><label>Strength movement<input name="strengthMovement" placeholder="e.g. Knee extension or SLR" /></label><label>Strength method<select name="strengthMethod" defaultValue="Manual muscle testing"><option>Manual muscle testing</option><option>Dynamometer</option><option>External resistance</option></select></label><label>Strength value<input name="strengthValue" type="number" min="0" max="200" step="0.1" /></label><label>Strength unit<select name="strengthUnit" defaultValue="/5"><option>/5</option><option>kg</option><option>N</option></select></label><label>Neuromuscular control<select name="neuromuscularStatus" defaultValue=""><option value="">Not recorded</option><option>Unable</option><option>Assisted</option><option>Independent</option><option>Independent with resistance</option></select></label><label>Neuromuscular context<input name="neuromuscularContext" placeholder="e.g. SLR with 1 kg" /></label><label>Weight-bearing<select name="mobilityStatus" defaultValue=""><option value="">Not recorded</option><option>NWB</option><option>TTWB</option><option>PWB</option><option>WBAT</option><option>FWB</option><option>Independent ambulation</option></select></label><label>Assistive device<select name="assistiveDevice" defaultValue=""><option value="">None recorded</option><option>Two crutches</option><option>One crutch</option><option>Walker</option><option>Wheelchair</option><option>None</option></select></label><label>Clinical response<select name="clinicalResponse" defaultValue=""><option value="">Not recorded</option><option>Improving</option><option>Stable</option><option>Worsening</option></select></label><label>Pain before · 0–10<input name="painPre" type="number" min="0" max="10" /></label><label>Pain after · 0–10<input name="painPost" type="number" min="0" max="10" /></label></div></details></div><ModalActions busy={busy} primary="Save session" /></form>;
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
