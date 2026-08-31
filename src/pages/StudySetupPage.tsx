import { useState } from "react";
import { Brand } from "../components/Brand";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import type { Language } from "../lib/types";
import type { MissionProject } from "../lib/projectStore";
import "../setup-memory.css";
import "../setup-memory-source-cards.css";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onProjectChange: (project: MissionProject) => void;
  onContinue: () => void;
  onHome: () => void;
};

type MockSource = {
  type: "pdf" | "repository" | "document" | "sheet";
  label: string;
};

type MockMember = {
  initials: string;
  name: string;
  rolePt: string;
  roleEn: string;
};

const mockSources: MockSource[] = [
  { type: "pdf", label: "Edital_OBSAT_2026.pdf" },
  { type: "repository", label: "equipe-aurora/cansat-2025" },
  { type: "document", label: "Relatório final 2025" },
  { type: "sheet", label: "Lições aprendidas" }
];

const mockMembers: MockMember[] = [
  { initials: "EM", name: "Emilly", rolePt: "Líder de Missão", roleEn: "Mission Lead" },
  { initials: "LU", name: "Lucas", rolePt: "Engenheiro de Sistemas", roleEn: "Systems Engineer" },
  { initials: "BI", name: "Bianca", rolePt: "Engenheira de Estruturas", roleEn: "Structures Engineer" }
];

function SourceIcon({ type }: { type: MockSource["type"] }) {
  if (type === "repository") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6a9.4 9.4 0 0 0-3 18.3c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.2.7-1.5-2.2-.3-4.6-1.1-4.6-4.7 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.5 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.2 2.6-1 2.6-1 .5 1.2.2 2.2.1 2.5.7.7 1 1.5 1 2.5 0 3.6-2.4 4.4-4.6 4.7.4.3.7.9.7 1.7v2.5c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.6Z" /></svg>;
  }

  if (type === "sheet") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 2.8V7h4M8.5 11h7M8.5 14h7M8.5 17h7M11 10v8" /></svg>;
  }

  if (type === "pdf") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 2.8V7h4" /><path d="M8 16.8v-5h2a1.5 1.5 0 0 1 0 3H8M12.7 16.8v-5h1.4c1.7 0 2.8.9 2.8 2.5s-1.1 2.5-2.8 2.5z" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 2.8V7h4M8.5 11h7M8.5 14h7M8.5 17h5" /></svg>;
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 13.8 8.8 15.2a3.1 3.1 0 0 1-4.4-4.4l2.5-2.5a3.1 3.1 0 0 1 4.4 0" /><path d="m13.8 10.2 1.4-1.4a3.1 3.1 0 1 1 4.4 4.4l-2.5 2.5a3.1 3.1 0 0 1-4.4 0" /><path d="m9.3 14.7 5.4-5.4" /></svg>;
}

export function StudySetupPage({ language, t, onLanguageChange, onContinue, onHome }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const c = language === "pt" ? {
    eyebrow: "MEMÓRIA DO PROJETO",
    title: "Traga tudo que já existe",
    program: "PROGRAMA / COMPETIÇÃO",
    competition: "Olimpíada Brasileira de Satélites",
    cycle: "Ciclo 2026",
    deadline: "Prazo final: 18/09/2026",
    connected: "Conectado",
    sources: "FONTES E ARTEFATOS CONECTADOS",
    document: "DOCUMENTO",
    repository: "REPOSITÓRIO",
    connectedDate: "Conectado em 15/05/2026",
    team: "EQUIPE",
    invite: "Convidar membro",
    unavailable: "Em desenvolvimento",
    home: "Início",
    continue: "Começar concepção",
    pipeline: ["Memória do projeto", "Concepção", "Conceito da missão", "CubeSat", "Payload", "Órbita", "Comunicação", "Requisitos", "Software", "Revisão"]
  } : {
    eyebrow: "PROJECT MEMORY",
    title: "Bring in everything that already exists",
    program: "PROGRAM / COMPETITION",
    competition: "Brazilian Satellite Olympiad",
    cycle: "2026 Cycle",
    deadline: "Final deadline: 18/09/2026",
    connected: "Connected",
    sources: "CONNECTED SOURCES AND ARTIFACTS",
    document: "DOCUMENT",
    repository: "REPOSITORY",
    connectedDate: "Connected on 15/05/2026",
    team: "TEAM",
    invite: "Invite member",
    unavailable: "In development",
    home: "Home",
    continue: "Start conception",
    pipeline: ["Project memory", "Conception", "Mission concept", "CubeSat", "Payload", "Orbit", "Communication", "Requirements", "Software", "Review"]
  };

  function sourceType(source: MockSource) {
    return source.type === "repository" ? c.repository : c.document;
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

        <div className="memory-screen memory-reference-layout">
          <div className="memory-heading memory-reference-heading">
            <div className="modal-eyebrow">{c.eyebrow}</div>
            <h1>{c.title}</h1>
          </div>

          <section className="memory-program-card">
            <div className="memory-program-label">{c.program}</div>
            <div className="memory-program-row">
              <div className="memory-program-badge"><span>✦</span><strong>OBSAT</strong></div>
              <div className="memory-program-copy">
                <strong>{c.competition}</strong>
                <div className="memory-program-meta"><span>▣ {c.cycle}</span><span>◷ {c.deadline}</span></div>
              </div>
              <div className="memory-program-connected"><i>✓</i>{c.connected}</div>
            </div>
          </section>

          <section className="memory-reference-section">
            <div className="memory-reference-label">{c.sources}</div>
            <div className="memory-reference-sources-grid">
              {mockSources.map((source) => (
                <article className="memory-reference-source-card" key={source.label}>
                  <div className={`memory-reference-source-icon ${source.type}`}><SourceIcon type={source.type} /></div>
                  <div className="memory-reference-source-copy">
                    <small>{sourceType(source)}</small>
                    <strong>{source.label}</strong>
                    <span><LinkIcon />{c.connectedDate}</span>
                  </div>
                  <div className="memory-reference-source-check">✓</div>
                </article>
              ))}
            </div>
          </section>

          <section className="memory-reference-section memory-reference-team-section">
            <div className="memory-reference-label">{c.team}</div>
            <div className="memory-reference-team-strip">
              {mockMembers.map((member) => (
                <div className="memory-reference-member" key={member.name}>
                  <div className="memory-reference-avatar">{member.initials}</div>
                  <div><strong>{member.name}</strong><span>{language === "pt" ? member.rolePt : member.roleEn}<i /></span></div>
                </div>
              ))}
              <button className="memory-reference-invite" disabled aria-label={c.invite}><span>♙＋</span><small>{c.unavailable}</small></button>
            </div>
          </section>

          <div className="memory-next-step memory-reference-next-step">
            <button className="technical-button primary memory-primary" onClick={onContinue}>{c.continue}<span aria-hidden="true">→</span></button>
          </div>
        </div>
      </main>
    </div>
  );
}
