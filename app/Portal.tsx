"use client";

import { FormEvent, useEffect, useState } from "react";
import SOPCareApp from "./SOPCareApp";
import AdministrationWorkspace from "./AdministrationWorkspace";
import type { PortalUser, Workspace, WorkspaceKey } from "./access-model";

type SessionPayload = { user: PortalUser; workspaces: Workspace[] };

export default function Portal() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: SessionPayload | null) => {
        if (!payload) return;
        setSession(payload);
        if (payload.workspaces.length === 1) setWorkspace(payload.workspaces[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const payload = await response.json() as SessionPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to sign in.");
      setSession(payload);
      setWorkspace(payload.workspaces.length === 1 ? payload.workspaces[0].id : null);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setWorkspace(null);
  }

  if (loading) return <main className="loading-screen"><div className="brand-mark">S</div><p>Securing your SOPCare workspace</p><span className="loading-line" /></main>;
  if (!session) return <LoginScreen onSubmit={signIn} busy={signingIn} error={error} />;
  if (!workspace) return <WorkspaceChooser session={session} onChoose={setWorkspace} onLogout={logout} />;
  if (workspace === "administration") return <AdministrationWorkspace user={session.user} onSwitch={() => setWorkspace(null)} onLogout={logout} />;
  return <SOPCareApp identity={session.user} onSwitchWorkspace={session.workspaces.length > 1 ? () => setWorkspace(null) : undefined} onLogout={logout} />;
}

function LoginScreen({ onSubmit, busy, error }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string }) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark">S</span><span><strong>SOPCare</strong><small>SPORTS HEALTH INTELLIGENCE</small></span></div>
        <div className="auth-copy"><p className="eyebrow">SECURE CARE PLATFORM</p><h1>One athlete.<br />One care team.<br /><em>One clear plan.</em></h1><p>A protected multidisciplinary health workspace built for high-performance sport.</p></div>
        <p className="auth-security">Encrypted session · Role-based access · Audited actions</p>
      </section>
      <section className="auth-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-mark"><span className="brand-mark">S</span></div>
          <p className="eyebrow">WELCOME BACK</p><h2>Sign in to SOPCare</h2><p className="login-intro">Use your organization credentials to continue.</p>
          <label>Username<input name="username" autoComplete="username" required placeholder="Enter your username" /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" /></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="button primary login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button>
          <div className="demo-access"><strong>Prototype access</strong><span>Administrator: admin</span><span>Password supplied securely by your administrator</span></div>
        </form>
      </section>
    </main>
  );
}

function WorkspaceChooser({ session, onChoose, onLogout }: { session: SessionPayload; onChoose: (id: WorkspaceKey) => void; onLogout: () => void }) {
  return (
    <main className="workspace-page">
      <header className="workspace-header"><div className="auth-brand dark"><span className="brand-mark">S</span><span><strong>SOPCare</strong><small>SPORTS HEALTH INTELLIGENCE</small></span></div><button className="text-button" onClick={onLogout}>Sign out</button></header>
      <section className="workspace-content"><span className="avatar avatar-lg">{session.user.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><p className="eyebrow">SIGNED IN AS {session.user.username.toUpperCase()}</p><h1>Choose Workspace</h1><p>Select where you would like to work. Only authorized workspaces are shown.</p>
        <div className="workspace-grid">{session.workspaces.map((item) => <button key={item.id} className="workspace-card" onClick={() => onChoose(item.id)}><span className="workspace-icon">{item.id === "administration" ? "A" : "+"}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><b>→</b></button>)}</div>
      </section>
    </main>
  );
}
