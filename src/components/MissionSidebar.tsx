import { Brand } from "./Brand";
import { UserBadge } from "./UserBadge";
import { UsersRound } from "lucide-react";
import type { Language } from "../lib/types";

type Props = {
  language: Language;
  currentStep: number | null;
  expanded: boolean;
  connectedLabel: string;
  homeLabel: string;
  teamLabel: string;
  homeActive: boolean;
  teamActive: boolean;
  onToggle: () => void;
  onHome: () => void;
  onTeam: () => void;
  onStepSelect: (step: number) => void;
};

const labels = {
  pt: ["Memória do projeto", "Concepção", "Conceito da missão", "CubeSat", "Payload", "Órbita", "Comunicação", "Requisitos", "Software", "Revisão"],
  en: ["Project memory", "Conception", "Mission concept", "CubeSat", "Payload", "Orbit", "Communication", "Requirements", "Software", "Review"]
};

function PhaseIcon({ step }: { step: number }) {
  if (step === 0) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v13H5z" /><path d="M8 9h8M8 12h8M8 15h5" /></svg>;
  if (step === 1) return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="8" /></svg>;
  if (step === 2) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 15 9l6 .9-4.5 4.3 1.1 6.1L12 17.4 6.4 20.3l1.1-6.1L3 9.9 9 9z" /></svg>;
  if (step === 3) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 4v10l-7 4-7-4V7z" /><path d="m5 7 7 4 7-4M12 11v10" /></svg>;
  if (step === 4) return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M4 12c2.2-4 4.9-6 8-6s5.8 2 8 6c-2.2 4-4.9 6-8 6s-5.8-2-8-6Z" /></svg>;
  if (step === 5) return <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-25 12 12)" /><circle cx="12" cy="12" r="2" /></svg>;
  if (step === 6) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v4M9 21h6" /><path d="M8.5 15.5 12 12l3.5 3.5" /><path d="M6 11a8 8 0 0 1 12 0M8.8 13.2a4.5 4.5 0 0 1 6.4 0" /></svg>;
  if (step === 7) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z" /><path d="m8 9 1.5 1.5L12 8M14 9h2M8 14l1.5 1.5L12 13M14 14h2" /></svg>;
  if (step === 8) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7-4 5 4 5M15 7l4 5-4 5M13 5l-2 14" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z" /><path d="m8 12 2.2 2.2L16 8.5" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.2" y="5.1" width="7.6" height="5.1" rx="1" /><path d="M3.8 5.1V3.7a2.2 2.2 0 0 1 4.4 0v1.4" /></svg>;
}

export function MissionSidebar({ language, currentStep, expanded, connectedLabel, homeLabel, teamLabel, homeActive, teamActive, onToggle, onHome, onTeam, onStepSelect }: Props) {
  const phaseLabels = labels[language];
  const stateWords = language === "pt" ? { complete: "Concluída", current: "Fase atual", locked: "Ainda não disponível" } : { complete: "Complete", current: "Current phase", locked: "Not available yet" };

  return (
    <>
      <aside className={expanded ? "mission-sidebar expanded" : "mission-sidebar collapsed"} aria-label={language === "pt" ? "Navegação da missão" : "Mission navigation"}>
        <div className="mission-sidebar-header">
          {expanded && <Brand />}
          <button className="mission-sidebar-toggle" type="button" onClick={onToggle} aria-label={expanded ? (language === "pt" ? "Recolher barra lateral" : "Collapse sidebar") : (language === "pt" ? "Expandir barra lateral" : "Expand sidebar")} aria-expanded={expanded}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d={expanded ? "m12.5 5-5 5 5 5" : "m7.5 5 5 5-5 5"} /></svg>
          </button>
        </div>

        <button className={homeActive ? "mission-sidebar-home active" : "mission-sidebar-home"} type="button" onClick={onHome} title={!expanded ? homeLabel : undefined}>
          <span className="mission-sidebar-home-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></svg></span>
          <span className="mission-sidebar-home-label">{homeLabel}</span>
        </button>

        <button className={teamActive ? "mission-sidebar-home mission-sidebar-team active" : "mission-sidebar-home mission-sidebar-team"} type="button" onClick={onTeam} title={!expanded ? teamLabel : undefined}>
          <span className="mission-sidebar-home-icon"><UsersRound aria-hidden="true" /></span>
          <span className="mission-sidebar-home-label">{teamLabel}</span>
        </button>

        <div className="mission-sidebar-divider" />

        <nav className="mission-pipeline" aria-label={language === "pt" ? "Pipeline da missão" : "Mission pipeline"}>
          {phaseLabels.map((label, step) => {
            const complete = currentStep !== null && step < currentStep;
            const current = currentStep === step;
            const locked = currentStep === null || step > currentStep;
            const state = complete ? "complete" : current ? "current" : "locked";
            const clickable = complete;
            const stateLabel = stateWords[state];
            const tooltip = `${String(step + 1).padStart(2, "0")} · ${label} · ${stateLabel}`;

            return (
              <button className={`mission-phase ${state}`} key={label} type="button" aria-current={current ? "step" : undefined} aria-disabled={!clickable} tabIndex={clickable ? 0 : -1} onClick={() => clickable && onStepSelect(step)} title={!expanded ? tooltip : undefined}>
                <span className="mission-phase-rail" />
                <span className="mission-phase-icon">
                  <PhaseIcon step={step} />
                  {complete && <span className="mission-phase-check">✓</span>}
                  {locked && <span className="mission-phase-lock"><LockIcon /></span>}
                </span>
                <span className="mission-phase-copy">
                  <small>{String(step + 1).padStart(2, "0")}</small>
                  <span>{label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mission-sidebar-user"><UserBadge connectedLabel={connectedLabel} compact={!expanded} /></div>
      </aside>
      <button className={expanded ? "mission-sidebar-overlay visible" : "mission-sidebar-overlay"} type="button" aria-label={language === "pt" ? "Recolher barra lateral" : "Collapse sidebar"} onClick={onToggle} />
    </>
  );
}
