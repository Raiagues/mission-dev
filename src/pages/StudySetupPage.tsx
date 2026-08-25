import { useState } from "react";
import { Brand } from "../components/Brand";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import type { Language } from "../lib/types";
import type { MissionProject, ProjectReference, StudyIntent } from "../lib/projectStore";
import { ux } from "../lib/uxCopy";

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

  function intentDescription(intent: StudyIntent): string {
    if (intent === "problem") return ux(language, "intentProblemDesc");
    if (intent === "technology") return ux(language, "intentTechnologyDesc");
    if (intent === "science") return ux(language, "intentScienceDesc");
    return ux(language, "intentOpenDesc");
  }

  return (
    <div className="setup-shell setup-shell-fixed">
      <aside className={sidebarOpen ? "setup-sidebar open" : "setup-sidebar"}>
        <div className="setup-brand-row"><Brand /><button className="setup-sidebar-close" aria-label={t("common.close")} onClick={() => setSidebarOpen(false)}>×</button></div>
        <div className="setup-side-section">
          <button className="setup-side-item" onClick={onHome}><span>⌂</span>{t("home.start")}</button>
          <button className="setup-side-item active"><span>01</span>{ux(language, "setupEyebrow")}</button>
          <button className="setup-side-item muted"><span>02</span>{t("brainstorm.problem")}</button>
        </div>
        <div className="setup-context-card">
          <small>{ux(language, "projectStructure")}</small>
          <strong>{project.name || ux(language, "projectNameDefault")}</strong>
          <span>{ux(language, "setupSaved")}</span>
        </div>
        <div className="setup-sidebar-user"><UserBadge connectedLabel={t("common.connected")} /></div>
      </aside>

      <button className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"} aria-label={t("common.close")} onClick={() => setSidebarOpen(false)} />

      <main className="setup-main setup-main-fixed">
        <header className="setup-topbar">
          <button className="square-menu" aria-label={t("brainstorm.menu")} onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <div className="setup-scroll">
          <div className="setup-content">
            <div className="setup-heading">
              <div className="modal-eyebrow">{ux(language, "setupEyebrow")}</div>
              <h1>{ux(language, "setupTitle")}</h1>
              <p>{ux(language, "setupLead")}</p>
            </div>

            <section className="setup-section">
              <label className="setup-label" htmlFor="project-name">{ux(language, "projectName")}</label>
              <input id="project-name" className="technical-input" value={project.name} placeholder={ux(language, "projectNamePlaceholder")} onChange={(event) => patchProject({ name: event.target.value })} />
            </section>

            <section className="setup-section">
              <div className="setup-section-head"><span>01</span><h2>{ux(language, "studyIntent")}</h2></div>
              <div className="intent-grid">
                {intents.map((intent) => (
                  <button key={intent} className={project.setup.intent === intent ? "intent-card selected" : "intent-card"} onClick={() => patchSetup({ intent })}>
                    <strong>{intentTitle(intent)}</strong>
                    <span>{intentDescription(intent)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="setup-section">
              <div className="setup-section-head"><span>02</span><h2>{ux(language, "startingStatement")}</h2></div>
              <p className="setup-hint">{ux(language, "startingStatementHint")}</p>
              <textarea className="technical-textarea" rows={3} value={project.setup.statement} placeholder={ux(language, "startingStatementPlaceholder")} onChange={(event) => patchSetup({ statement: event.target.value })} />
            </section>

            <section className="setup-section">
              <div className="setup-section-head"><span>03</span><h2>{ux(language, "framework")}</h2></div>
              <div className="framework-grid">
                <button className={project.setup.framework === "mission-dev-core" ? "framework-card selected" : "framework-card"} onClick={() => setFramework("mission-dev-core")}>
                  <span className="framework-code">CORE</span>
                  <strong>{ux(language, "frameworkStandard")}</strong>
                  <small>{ux(language, "frameworkStandardDesc")}</small>
                </button>
                <button className={project.setup.framework === "custom" ? "framework-card selected" : "framework-card"} onClick={() => setFramework("custom")}>
                  <span className="framework-code">CUSTOM</span>
                  <strong>{ux(language, "frameworkCustom")}</strong>
                  <small>{ux(language, "frameworkCustomDesc")}</small>
                </button>
              </div>
            </section>

            <section className="setup-section">
              <div className="setup-section-head"><span>04</span><h2>{ux(language, "references")}</h2></div>
              <p className="setup-hint">{ux(language, "referencesHint")}</p>
              <div className="reference-entry">
                <input className="technical-input" value={referenceText} placeholder={ux(language, "referencePlaceholder")} onChange={(event) => setReferenceText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addReference(); }} />
                <label className="binding-check"><input type="checkbox" checked={referenceBinding} onChange={(event) => setReferenceBinding(event.target.checked)} />{ux(language, "binding")}</label>
                <button className="technical-button" onClick={addReference}>{ux(language, "addReference")}</button>
              </div>
              <div className="reference-list">
                {project.setup.references.length === 0 && <div className="empty-reference">{ux(language, "noReferences")}</div>}
                {project.setup.references.map((reference) => (
                  <div className="reference-row" key={reference.id}>
                    <span className={reference.binding ? "reference-status binding" : "reference-status"}>{reference.binding ? ux(language, "binding") : ux(language, "referenceOnly")}</span>
                    <strong>{reference.label}</strong>
                    <button onClick={() => removeReference(reference.id)}>{ux(language, "remove")}</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer className="setup-footer setup-footer-fixed">
          <div className="setup-footer-note">{ux(language, "setupSaved")}</div>
          <div className="setup-footer-actions">
            <button className="technical-button" onClick={onHome}>{ux(language, "backHome")}</button>
            <button className="technical-button primary" onClick={onContinue}>{ux(language, "enterRoom")} →</button>
          </div>
        </footer>
      </main>
    </div>
  );
}
