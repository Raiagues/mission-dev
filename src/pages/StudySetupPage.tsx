import { useState } from "react";
import { Brand } from "../components/Brand";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import type { Language } from "../lib/types";
import type { MissionProject, ProjectReference } from "../lib/projectStore";
import "../setup-memory.css";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onProjectChange: (project: MissionProject) => void;
  onContinue: () => void;
  onHome: () => void;
};

function SourceIcon({ label }: { label: string }) {
  const value = label.toLowerCase();

  if (value.includes("github") || value.includes("git") || value.includes("repo")) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 18.5c-3.5 1-3.5-1.7-5-2.2M13 21v-2.7c0-.8.3-1.5.8-2-2.7-.3-5.5-1.3-5.5-6A4.7 4.7 0 0 1 9.6 7c-.1-.3-.6-1.6.1-3.2 0 0 1.1-.4 3.4 1.3a11.7 11.7 0 0 1 6.2 0c2.3-1.7 3.4-1.3 3.4-1.3.7 1.6.2 2.9.1 3.2a4.7 4.7 0 0 1 1.3 3.3c0 4.7-2.8 5.7-5.5 6 .5.5.8 1.2.8 2.2V21" /></svg>;
  }

  if (value.includes("pdf") || value.includes("edital")) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 2.8V7h4" /><path d="M8.3 16.8v-5h2a1.6 1.6 0 0 1 0 3.2h-2M13 16.8v-5h1.5c1.7 0 2.7 1 2.7 2.5s-1 2.5-2.7 2.5z" /></svg>;
  }

  if (value.includes("planilha") || value.includes("sheet") || value.includes("xls") || value.includes("csv")) {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 2.8V7h4M8.5 11h7M8.5 14h7M8.5 17h7M11 10v8" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 2.8V7h4M8.5 11h7M8.5 14h7M8.5 17h5" /></svg>;
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 13.8 8.8 15.2a3.1 3.1 0 0 1-4.4-4.4l2.5-2.5a3.1 3.1 0 0 1 4.4 0" /><path d="m13.8 10.2 1.4-1.4a3.1 3.1 0 1 1 4.4 4.4l-2.5 2.5a3.1 3.1 0 0 1-4.4 0" /><path d="m9.3 14.7 5.4-5.4" /></svg>;
}

export function StudySetupPage({ language, project, t, onLanguageChange, onProjectChange, onContinue, onHome }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [referenceBinding, setReferenceBinding] = useState(false);
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);

  const c = language === "pt" ? {
    eyebrow: "MEMÓRIA DO PROJETO",
    title: "Traga para o projeto o que já existe",
    lead: "Conecte fontes, referências e pessoas antes de começar a concepção. Esse material passa a fazer parte do contexto da missão.",
    project: "Projeto",
    phase: "Fase atual",
    memory: "Memória do projeto",
    preparation: "Em preparação",
    sources: "Fontes e artefatos conectados",
    sourcesHelp: "Documentos, normas, editais, repositórios e outras referências que precisam acompanhar as decisões da missão.",
    sourcePlaceholder: "Documento, norma, edital, repositório ou referência...",
    bindingHelp: "Vinculante significa que a referência deve ser tratada como uma restrição do projeto.",
    team: "Equipe",
    teamHelp: "Pessoas que compartilham o contexto e as decisões da missão.",
    currentUser: "Responsável pelo projeto",
    invite: "Convidar membro",
    unavailable: "Em desenvolvimento",
    add: "Conectar fonte",
    cancel: "Cancelar",
    noSources: "Nenhuma fonte conectada ainda.",
    document: "Documento",
    repository: "Repositório",
    binding: "Vinculante",
    remove: "Remover",
    connected: "Conectado à memória do projeto",
    home: "Início",
    nextPhase: "PRÓXIMA FASE · 02",
    continue: "Começar concepção",
    continueHelp: "Tudo que estiver conectado aqui será usado como contexto na Sala de Concepção.",
    pipeline: ["Memória do projeto", "Concepção", "Conceito da missão", "CubeSat", "Payload", "Órbita", "Comunicação", "Requisitos", "Software", "Revisão"]
  } : {
    eyebrow: "PROJECT MEMORY",
    title: "Bring in what already exists",
    lead: "Connect sources, references, and people before conception begins. This material becomes part of the mission context.",
    project: "Project",
    phase: "Current phase",
    memory: "Project memory",
    preparation: "In preparation",
    sources: "Connected sources and artifacts",
    sourcesHelp: "Documents, standards, calls, repositories, and other references that should follow mission decisions.",
    sourcePlaceholder: "Document, standard, call, repository, or reference...",
    bindingHelp: "Binding means the reference must be treated as a project constraint.",
    team: "Team",
    teamHelp: "People who share the mission context and decisions.",
    currentUser: "Project owner",
    invite: "Invite member",
    unavailable: "In development",
    add: "Connect source",
    cancel: "Cancel",
    noSources: "No sources connected yet.",
    document: "Document",
    repository: "Repository",
    binding: "Binding",
    remove: "Remove",
    connected: "Connected to project memory",
    home: "Home",
    nextPhase: "NEXT PHASE · 02",
    continue: "Start conception",
    continueHelp: "Everything connected here will be used as context inside the Conception Room.",
    pipeline: ["Project memory", "Conception", "Mission concept", "CubeSat", "Payload", "Orbit", "Communication", "Requirements", "Software", "Review"]
  };

  function patchSetup(patch: Partial<MissionProject["setup"]>) {
    onProjectChange({ ...project, setup: { ...project.setup, ...patch } });
  }

  function addReference() {
    const label = referenceText.trim();
    if (!label) return;
    const kind = /github|git|repo/i.test(label) ? "internal" : "other";
    const reference: ProjectReference = { id: `ref-${Date.now()}`, label, kind, binding: referenceBinding };
    patchSetup({ references: [...project.setup.references, reference] });
    setReferenceText("");
    setReferenceBinding(false);
    setSourceEditorOpen(false);
  }

  function removeReference(id: string) {
    patchSetup({ references: project.setup.references.filter((reference) => reference.id !== id) });
  }

  function sourceType(reference: ProjectReference) {
    if (reference.kind === "internal" || /github|git|repo/i.test(reference.label)) return c.repository;
    return c.document;
  }

  return (
    <div className="setup-shell setup-shell-fixed memory-shell">
      <aside className={sidebarOpen ? "setup-sidebar open memory-sidebar" : "setup-sidebar memory-sidebar"}>
        <div className="setup-brand-row"><Brand /><button className="setup-sidebar-close" aria-label={t("common.close")} onClick={() => setSidebarOpen(false)}>×</button></div>
        <button className="memory-home-link" onClick={onHome}><span>⌂</span>{c.home}</button>
        <div className="memory-pipeline" aria-label={language === "pt" ? "Etapas da missão" : "Mission stages"}>
          {c.pipeline.map((label, index) => (
            <div className={index === 0 ? "memory-pipeline-item active" : "memory-pipeline-item future"} key={label}>
              <span className="memory-pipeline-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="memory-pipeline-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="setup-sidebar-user"><UserBadge connectedLabel={t("common.connected")} /></div>
      </aside>

      <button className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"} aria-label={t("common.close")} onClick={() => setSidebarOpen(false)} />

      <main className="setup-main setup-main-fixed memory-main">
        <header className="setup-topbar memory-topbar">
          <button className="square-menu" aria-label={t("brainstorm.menu")} onClick={() => setSidebarOpen(true)}><span className="memory-menu-lines" /></button>
          <div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <div className="memory-screen">
          <div className="memory-heading">
            <div className="modal-eyebrow">{c.eyebrow}</div>
            <h1>{c.title}</h1>
            <p>{c.lead}</p>
          </div>

          <section className="memory-project-banner">
            <div>
              <small>{c.project}</small>
              <strong>{project.name}</strong>
            </div>
            <div className="memory-project-phase">
              <small>{c.phase}</small>
              <span>01 · {c.memory}</span>
            </div>
            <div className="memory-status"><i />{c.preparation}</div>
          </section>

          <section className="memory-block memory-sources-block">
            <div className="memory-sources-title-row">
              <div className="memory-block-head memory-sources-head">
                <div><span>01</span><h2>{c.sources}</h2></div>
                <p>{c.sourcesHelp}</p>
              </div>
              <button className="memory-connect-source" onClick={() => setSourceEditorOpen((current) => !current)}><span>＋</span>{c.add}</button>
            </div>

            {sourceEditorOpen && (
              <div className="memory-source-editor">
                <input className="technical-input" autoFocus value={referenceText} placeholder={c.sourcePlaceholder} onChange={(event) => setReferenceText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addReference(); if (event.key === "Escape") setSourceEditorOpen(false); }} />
                <label className="binding-check" title={c.bindingHelp}><input type="checkbox" checked={referenceBinding} onChange={(event) => setReferenceBinding(event.target.checked)} />{c.binding}</label>
                <button className="technical-button" onClick={() => setSourceEditorOpen(false)}>{c.cancel}</button>
                <button className="technical-button primary" onClick={addReference}>{c.add}</button>
              </div>
            )}

            <div className="memory-connected-sources">
              {project.setup.references.length === 0 && <button className="memory-source-empty-card" onClick={() => setSourceEditorOpen(true)}><span>＋</span><strong>{c.add}</strong><small>{c.noSources}</small></button>}
              {project.setup.references.map((reference) => (
                <article className="memory-source-card" key={reference.id}>
                  <div className="memory-source-icon"><SourceIcon label={reference.label} /></div>
                  <div className="memory-source-copy">
                    <small>{sourceType(reference)}</small>
                    <strong title={reference.label}>{reference.label}</strong>
                    <span><LinkIcon />{c.connected}</span>
                  </div>
                  <div className="memory-source-check" title={reference.binding ? c.binding : c.connected}>✓</div>
                  <button className="memory-source-remove" aria-label={c.remove} onClick={() => removeReference(reference.id)}>×</button>
                </article>
              ))}
            </div>
          </section>

          <section className="memory-block memory-team-block">
            <div className="memory-block-head compact">
              <div><span>02</span><h2>{c.team}</h2></div>
              <p>{c.teamHelp}</p>
            </div>
            <div className="team-strip">
              <div className="team-member"><div className="team-avatar">AC</div><div><strong>Arthur Campos</strong><span>{c.currentUser}</span></div><i /></div>
              <button className="team-invite" disabled><span>＋</span><strong>{c.invite}</strong><small>{c.unavailable}</small></button>
            </div>
          </section>

          <div className="memory-next-step">
            <div className="memory-next-copy"><small>{c.nextPhase}</small><span>{c.continueHelp}</span></div>
            <button className="technical-button primary memory-primary" onClick={onContinue}>{c.continue}<span aria-hidden="true">→</span></button>
          </div>
        </div>
      </main>
    </div>
  );
}
