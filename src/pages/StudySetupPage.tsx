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
  type: "pdf" | "repository" | "document" | "csv";
  label: string;
  iconSrc: string;
};

type MockMember = {
  initials: string;
  name: string;
  rolePt: string;
  roleEn: string;
};

const mockSources: MockSource[] = [
  { type: "pdf", label: "Edital_OBSAT_2026.pdf", iconSrc: "" },
  { type: "repository", label: "equipe-aurora/cansat-2025", iconSrc: "https://cdn.simpleicons.org/github/FFFFFF" },
  { type: "document", label: "Relatório final 2025", iconSrc: "https://cdn.simpleicons.org/googledocs/4285F4" },
  { type: "csv", label: "Lições_aprendidas.csv", iconSrc: "https://cdn.simpleicons.org/googlesheets/34A853" }
];

const mockMembers: MockMember[] = [
  { initials: "EM", name: "Emilly", rolePt: "Líder de Missão", roleEn: "Mission Lead" },
  { initials: "LU", name: "Lucas", rolePt: "Engenheiro de Sistemas", roleEn: "Systems Engineer" },
  { initials: "BI", name: "Bianca", rolePt: "Engenheira de Estruturas", roleEn: "Structures Engineer" }
];

function SourceIcon({ source }: { source: MockSource }) {
  if (source.type === "pdf") {
    return <svg className="memory-pdf-icon" viewBox="0 0 40 48" aria-hidden="true"><path className="memory-pdf-page" d="M7 2.5h19l7 7V45.5H7z" /><path className="memory-pdf-fold" d="M26 2.5v7h7" /><rect className="memory-pdf-label" x="10" y="24" width="20" height="12" rx="2" /><text className="memory-pdf-text" x="20" y="32.6" textAnchor="middle">PDF</text></svg>;
  }

  return <img src={source.iconSrc} alt="" aria-hidden="true" />;
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 13.8 8.8 15.2a3.1 3.1 0 0 1-4.4-4.4l2.5-2.5a3.1 3.1 0 0 1 4.4 0" /><path d="m13.8 10.2 1.4-1.4a3.1 3.1 0 1 1 4.4 4.4l-2.5 2.5a3.1 3.1 0 0 1-4.4 0" /><path d="m9.3 14.7 5.4-5.4" /></svg>;
}

export function StudySetupPage({ language, t, onLanguageChange, onContinue }: Props) {
  const c = language === "pt" ? {
    eyebrow: "MEMÓRIA DO PROJETO",
    title: "Contexto e referências da missão",
    program: "PROGRAMA / COMPETIÇÃO",
    competition: "Olimpíada Brasileira de Satélites",
    deadline: "Prazo final: 18/09/2026",
    connected: "Conectado",
    sources: "FONTES E ARTEFATOS CONECTADOS",
    document: "DOCUMENTO",
    repository: "REPOSITÓRIO",
    connectedDate: "Conectado em 15/05/2026",
    team: "EQUIPE",
    invite: "Convidar membro",
    unavailable: "Em desenvolvimento",
    continue: "Começar concepção"
  } : {
    eyebrow: "PROJECT MEMORY",
    title: "Mission context and references",
    program: "PROGRAM / COMPETITION",
    competition: "Brazilian Satellite Olympiad",
    deadline: "Final deadline: 18/09/2026",
    connected: "Connected",
    sources: "CONNECTED SOURCES AND ARTIFACTS",
    document: "DOCUMENT",
    repository: "REPOSITORY",
    connectedDate: "Connected on 15/05/2026",
    team: "TEAM",
    invite: "Invite member",
    unavailable: "In development",
    continue: "Start conception"
  };

  function sourceType(source: MockSource) {
    return source.type === "repository" ? c.repository : c.document;
  }

  return (
    <div className="setup-shell setup-shell-fixed memory-shell">
      <main className="setup-main setup-main-fixed memory-main">
        <header className="setup-topbar memory-topbar">
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
                <div className="memory-program-meta"><span>◷ {c.deadline}</span></div>
              </div>
              <div className="memory-program-connected"><i>✓</i>{c.connected}</div>
            </div>
          </section>

          <section className="memory-reference-section">
            <div className="memory-reference-label">{c.sources}</div>
            <div className="memory-reference-sources-grid">
              {mockSources.map((source) => (
                <article className="memory-reference-source-card" key={source.label}>
                  <div className={`memory-reference-source-icon ${source.type}`}><SourceIcon source={source} /></div>
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
