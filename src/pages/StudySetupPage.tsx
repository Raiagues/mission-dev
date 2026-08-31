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

export function StudySetupPage({ language, project, t, onLanguageChange, onProjectChange, onContinue, onHome }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [referenceBinding, setReferenceBinding] = useState(false);

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
    sourcePlaceholder: "Adicionar documento, norma, edital, repositório ou referência...",
    bindingHelp: "Vinculante significa que a referência deve ser tratada como uma restrição do projeto.",
    team: "Equipe",
    teamHelp: "Pessoas que compartilham o contexto e as decisões da missão.",
    currentUser: "Responsável pelo projeto",
    invite: "Convidar membro",
    unavailable: "Em desenvolvimento",
    add: "Adicionar fonte",
    noSources: "Nenhuma fonte conectada ainda.",
    source: "Referência",
    binding: "Vinculante",
    remove: "Remover",
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
    sourcePlaceholder: "Add a document, standard, call, repository, or reference...",
    bindingHelp: "Binding means the reference must be treated as a project constraint.",
    team: "Team",
    teamHelp: "People who share the mission context and decisions.",
    currentUser: "Project owner",
    invite: "Invite member",
    unavailable: "In development",
    add: "Add source",
    noSources: "No sources connected yet.",
    source: "Reference",
    binding: "Binding",
    remove: "Remove",
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
    const reference: ProjectReference = { id: `ref-${Date.now()}`, label, kind: "other", binding: referenceBinding };
    patchSetup({ references: [...project.setup.references, reference] });
    setReferenceText("");
    setReferenceBinding(false);
  }

  function removeReference(id: string) {
    patchSetup({ references: project.setup.references.filter((reference) => reference.id !== id) });
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
            <div className="memory-block-head">
              <div><span>01</span><h2>{c.sources}</h2></div>
              <p>{c.sourcesHelp}</p>
            </div>
            <div className="reference-entry memory-reference-entry">
              <input className="technical-input" value={referenceText} placeholder={c.sourcePlaceholder} onChange={(event) => setReferenceText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addReference(); }} />
              <label className="binding-check" title={c.bindingHelp}><input type="checkbox" checked={referenceBinding} onChange={(event) => setReferenceBinding(event.target.checked)} />{c.binding}</label>
              <button className="technical-button" onClick={addReference}>{c.add}</button>
            </div>
            <div className="artifact-grid memory-artifact-grid">
              {project.setup.references.length === 0 && <div className="artifact-empty">{c.noSources}</div>}
              {project.setup.references.map((reference) => (
                <article className="artifact-card" key={reference.id}>
                  <div className="artifact-icon">≡</div>
                  <div className="artifact-copy"><small>{reference.binding ? c.binding : c.source}</small><strong>{reference.label}</strong><span>{reference.binding ? c.bindingHelp : c.memory}</span></div>
                  <button aria-label={c.remove} onClick={() => removeReference(reference.id)}>×</button>
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
