import { useState } from "react";
import { Brand } from "../components/Brand";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import type { Language } from "../lib/types";
import type { MissionProject, ProjectReference, StudyIntent } from "../lib/projectStore";
import { ux } from "../lib/uxCopy";
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

const intents: StudyIntent[] = ["problem", "technology", "science", "open"];

export function StudySetupPage({ language, project, t, onLanguageChange, onProjectChange, onContinue, onHome }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [referenceBinding, setReferenceBinding] = useState(false);

  const c = language === "pt" ? {
    eyebrow: "MEMÓRIA DO PROJETO",
    title: "Traga para o projeto o que já existe",
    lead: "Contexto, documentos e conhecimento inicial entram como memória antes da concepção. Nada aqui define a solução do satélite.",
    identity: "Contexto do projeto",
    projectName: "Nome da missão",
    nature: "Natureza do estudo",
    sources: "Fontes e artefatos",
    sourcesHelp: "Adicione documentos, normas, editais, repositórios ou referências que precisam ser considerados durante a missão.",
    sourcePlaceholder: "Nome ou referência do documento, norma, edital, repositório...",
    bindingHelp: "Vinculante significa que a referência deve ser tratada como uma restrição do projeto.",
    team: "Equipe",
    teamHelp: "O contexto da missão poderá ser compartilhado com a equipe. Convites e permissões entram em uma próxima etapa da plataforma.",
    currentUser: "Responsável pelo projeto",
    invite: "Convidar membro",
    unavailable: "Em desenvolvimento",
    contributions: "Contribuições iniciais",
    contributionsHelp: "Registre o que já se sabe. Pode ser uma necessidade, observação, objetivo, aprendizado anterior ou dúvida importante.",
    contributionsPlaceholder: "Ex. Queremos reduzir o tempo para identificar novos focos de incêndio. Já sabemos que a cobertura precisa ser frequente, mas ainda não definimos como observar...",
    maturity: "Como acompanhar a definição da missão",
    maturityHelp: "Isso controla como o progresso será medido depois, sem travar a concepção agora.",
    standard: "Modelo padrão",
    standardDesc: "Usa os pontos mínimos esperados para uma concepção de missão.",
    custom: "Modelo personalizado",
    customDesc: "Permite criar critérios próprios para esta missão.",
    memoryReady: "A memória é salva automaticamente e acompanha o projeto exportado.",
    continue: "Preparar memória e abrir concepção",
    add: "Adicionar fonte",
    noSources: "Nenhuma fonte adicionada ainda.",
    source: "Referência",
    binding: "Vinculante",
    remove: "Remover",
    home: "Início",
    memory: "Memória do projeto",
    conception: "Concepção"
  } : {
    eyebrow: "PROJECT MEMORY",
    title: "Bring in what already exists",
    lead: "Context, documents, and early knowledge become project memory before conception. Nothing here defines the satellite solution.",
    identity: "Project context",
    projectName: "Mission name",
    nature: "Study nature",
    sources: "Sources and artifacts",
    sourcesHelp: "Add documents, standards, calls, repositories, or references that must be considered throughout the mission.",
    sourcePlaceholder: "Document, standard, call, repository, or reference name...",
    bindingHelp: "Binding means the reference must be treated as a project constraint.",
    team: "Team",
    teamHelp: "Mission context can later be shared with the team. Invitations and permissions will be added in a later platform stage.",
    currentUser: "Project owner",
    invite: "Invite member",
    unavailable: "In development",
    contributions: "Initial contributions",
    contributionsHelp: "Record what is already known. It may be a need, observation, objective, previous lesson, or important question.",
    contributionsPlaceholder: "E.g. We want to reduce the time required to identify new wildfire outbreaks. We already know coverage must be frequent, but we have not defined how to observe them...",
    maturity: "How mission definition will be tracked",
    maturityHelp: "This controls how progress will be measured later without blocking conception now.",
    standard: "Standard model",
    standardDesc: "Uses the minimum checkpoints expected for early mission conception.",
    custom: "Custom model",
    customDesc: "Allows project-specific definition criteria.",
    memoryReady: "Project memory is saved automatically and travels with the exported project.",
    continue: "Prepare memory and open conception",
    add: "Add source",
    noSources: "No sources added yet.",
    source: "Reference",
    binding: "Binding",
    remove: "Remove",
    home: "Home",
    memory: "Project memory",
    conception: "Conception"
  };

  function patchProject(patch: Partial<MissionProject>) {
    onProjectChange({ ...project, ...patch });
  }

  function patchSetup(patch: Partial<MissionProject["setup"]>) {
    patchProject({ setup: { ...project.setup, ...patch } });
  }

  function setFramework(framework: MissionProject["setup"]["framework"]) {
    onProjectChange({ ...project, setup: { ...project.setup, framework }, progress: { ...project.progress, mode: framework === "custom" ? "custom" : "standard" } });
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

  function intentTitle(intent: StudyIntent): string {
    if (intent === "problem") return ux(language, "intentProblem");
    if (intent === "technology") return ux(language, "intentTechnology");
    if (intent === "science") return ux(language, "intentScience");
    return ux(language, "intentOpen");
  }

  return (
    <div className="setup-shell setup-shell-fixed memory-shell">
      <aside className={sidebarOpen ? "setup-sidebar open" : "setup-sidebar"}>
        <div className="setup-brand-row"><Brand /><button className="setup-sidebar-close" aria-label={t("common.close")} onClick={() => setSidebarOpen(false)}>×</button></div>
        <div className="memory-nav">
          <button className="memory-nav-item" onClick={onHome}><span>00</span>{c.home}</button>
          <button className="memory-nav-item active"><span>01</span>{c.memory}</button>
          <button className="memory-nav-item locked" disabled><span>02</span>{c.conception}</button>
        </div>
        <div className="setup-context-card memory-context-card">
          <small>{c.memory}</small>
          <strong>{project.name || ux(language, "projectNameDefault")}</strong>
          <span>{c.memoryReady}</span>
        </div>
        <div className="setup-sidebar-user"><UserBadge connectedLabel={t("common.connected")} /></div>
      </aside>

      <button className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"} aria-label={t("common.close")} onClick={() => setSidebarOpen(false)} />

      <main className="setup-main setup-main-fixed memory-main">
        <header className="setup-topbar">
          <button className="square-menu" aria-label={t("brainstorm.menu")} onClick={() => setSidebarOpen(true)}><span className="memory-menu-lines" /></button>
          <div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <div className="setup-scroll">
          <div className="setup-content memory-content">
            <div className="setup-heading memory-heading">
              <div className="modal-eyebrow">{c.eyebrow}</div>
              <h1>{c.title}</h1>
              <p>{c.lead}</p>
            </div>

            <section className="memory-panel identity-panel">
              <div className="memory-panel-label">{c.identity}</div>
              <div className="identity-grid">
                <label className="memory-field"><span>{c.projectName}</span><input className="technical-input" value={project.name} onChange={(event) => patchProject({ name: event.target.value })} /></label>
                <div className="memory-field"><span>{c.nature}</span><div className="intent-compact-grid">{intents.map((intent) => <button key={intent} className={project.setup.intent === intent ? "intent-compact selected" : "intent-compact"} onClick={() => patchSetup({ intent })}>{intentTitle(intent)}</button>)}</div></div>
              </div>
            </section>

            <section className="memory-block">
              <div className="memory-block-head"><div><span>01</span><h2>{c.sources}</h2></div><p>{c.sourcesHelp}</p></div>
              <div className="reference-entry memory-reference-entry">
                <input className="technical-input" value={referenceText} placeholder={c.sourcePlaceholder} onChange={(event) => setReferenceText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addReference(); }} />
                <label className="binding-check" title={c.bindingHelp}><input type="checkbox" checked={referenceBinding} onChange={(event) => setReferenceBinding(event.target.checked)} />{c.binding}</label>
                <button className="technical-button" onClick={addReference}>{c.add}</button>
              </div>
              <div className="artifact-grid">
                {project.setup.references.length === 0 && <div className="artifact-empty">{c.noSources}</div>}
                {project.setup.references.map((reference) => (
                  <article className="artifact-card" key={reference.id}>
                    <div className="artifact-icon">≡</div>
                    <div className="artifact-copy"><small>{reference.binding ? c.binding : c.source}</small><strong>{reference.label}</strong><span>{reference.binding ? c.bindingHelp : c.memoryReady}</span></div>
                    <button aria-label={c.remove} onClick={() => removeReference(reference.id)}>×</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="memory-block">
              <div className="memory-block-head"><div><span>02</span><h2>{c.team}</h2></div><p>{c.teamHelp}</p></div>
              <div className="team-strip">
                <div className="team-member"><div className="team-avatar">AC</div><div><strong>Arthur Campos</strong><span>{c.currentUser}</span></div><i /></div>
                <button className="team-invite" disabled><span>＋</span><strong>{c.invite}</strong><small>{c.unavailable}</small></button>
              </div>
            </section>

            <section className="memory-block">
              <div className="memory-block-head"><div><span>03</span><h2>{c.contributions}</h2></div><p>{c.contributionsHelp}</p></div>
              <textarea className="technical-textarea contribution-area" rows={4} value={project.setup.statement} placeholder={c.contributionsPlaceholder} onChange={(event) => patchSetup({ statement: event.target.value })} />
            </section>

            <section className="memory-block maturity-block">
              <div className="memory-block-head"><div><span>04</span><h2>{c.maturity}</h2></div><p>{c.maturityHelp}</p></div>
              <div className="maturity-grid">
                <button className={project.setup.framework === "mission-dev-core" ? "maturity-option selected" : "maturity-option"} onClick={() => setFramework("mission-dev-core")}><strong>{c.standard}</strong><span>{c.standardDesc}</span></button>
                <button className={project.setup.framework === "custom" ? "maturity-option selected" : "maturity-option"} onClick={() => setFramework("custom")}><strong>{c.custom}</strong><span>{c.customDesc}</span></button>
              </div>
            </section>
          </div>
        </div>

        <footer className="setup-footer setup-footer-fixed memory-footer">
          <div className="setup-footer-note">{c.memoryReady}</div>
          <div className="setup-footer-actions">
            <button className="technical-button" onClick={onHome}>{ux(language, "backHome")}</button>
            <button className="technical-button primary memory-primary" onClick={onContinue}>{c.continue} →</button>
          </div>
        </footer>
      </main>
    </div>
  );
}
