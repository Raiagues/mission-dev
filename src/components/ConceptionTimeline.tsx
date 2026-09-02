import { CalendarDays, Check, ExternalLink, Flag, Lightbulb, Network } from "lucide-react";
import { programCategory, programModality, referenceProgram } from "../lib/programs";
import type { MissionProject } from "../lib/projectStore";
import type { Language } from "../lib/types";

type Props = {
  language: Language;
  project: MissionProject;
  explorationCount: number;
  decisionCount: number;
};

export function ConceptionTimeline({ language, project, explorationCount, decisionCount }: Props) {
  const program = referenceProgram(project.context.programId);
  const modality = programModality(program, project.context.modalityId);
  const category = programCategory(modality, project.context.categoryId);
  const now = new Date();
  const phases = modality?.phases ?? [];

  const labels = language === "pt" ? {
    eyebrow: "CRONOGRAMA",
    title: "Da descoberta ao sistema",
    official: "CRONOGRAMA OFICIAL",
    projectFlow: "FLUXO DE CONCEPÇÃO",
    source: "Abrir fonte oficial",
    complete: "Concluída",
    current: "Em andamento",
    upcoming: "Próxima",
    memory: "Memória conectada",
    discovery: "Descoberta",
    system: "Sistema consolidado",
    ideas: "ideias",
    decisions: "decisões",
    milestone: "Próximo marco oficial"
  } : {
    eyebrow: "TIMELINE",
    title: "From discovery to system",
    official: "OFFICIAL TIMELINE",
    projectFlow: "CONCEPTION FLOW",
    source: "Open official source",
    complete: "Complete",
    current: "In progress",
    upcoming: "Next",
    memory: "Memory connected",
    discovery: "Discovery",
    system: "Consolidated system",
    ideas: "ideas",
    decisions: "decisions",
    milestone: "Next official milestone"
  };

  return (
    <section className="conception-timeline" aria-labelledby="conception-timeline-title">
      <header className="conception-timeline-heading">
        <div>
          <span>{labels.eyebrow}</span>
          <h2 id="conception-timeline-title">{labels.title}</h2>
        </div>
        {program && <div className="timeline-program-mark">
          {program.logoSrc && <img src={program.logoSrc} alt="" />}
          <span><strong>{program.name[language]}</strong><small>{modality?.label[language]} · {category?.label[language]}</small></span>
        </div>}
      </header>

      <div className="timeline-project-flow" aria-label={labels.projectFlow}>
        <article className="complete"><i><Check aria-hidden="true" /></i><span><small>01</small><strong>{labels.memory}</strong></span></article>
        <article className="active"><i><Lightbulb aria-hidden="true" /></i><span><small>02 · {explorationCount} {labels.ideas}</small><strong>{labels.discovery}</strong></span></article>
        <article className={decisionCount > 0 ? "active" : "pending"}><i><Network aria-hidden="true" /></i><span><small>03 · {decisionCount} {labels.decisions}</small><strong>{labels.system}</strong></span></article>
      </div>

      <div className="timeline-official-band">
        <div className="timeline-section-label"><CalendarDays aria-hidden="true" /><span>{labels.official}</span></div>
        <div className="timeline-phase-list">
          {phases.map((phase) => {
            const status = phaseStatus(phase.startDate, phase.endDate, now);
            return <a className={status} href={phase.url} target="_blank" rel="noreferrer" key={phase.id}>
              <i>{status === "complete" ? <Check aria-hidden="true" /> : status === "current" ? <Flag aria-hidden="true" /> : <span />}</i>
              <span><small>{status === "complete" ? labels.complete : status === "current" ? labels.current : labels.upcoming}</small><strong>{phase.label[language]}</strong><em>{phase.date}</em></span>
              <ExternalLink aria-hidden="true" />
            </a>;
          })}
          {phases.length === 0 && modality && <a className="current" href={modality.milestone.url} target="_blank" rel="noreferrer">
            <i><Flag aria-hidden="true" /></i>
            <span><small>{labels.milestone}</small><strong>{modality.milestone.label[language]}</strong><em>{modality.milestone.date}</em></span>
            <ExternalLink aria-hidden="true" />
          </a>}
        </div>
        {modality && <a className="timeline-source-link" href={modality.milestone.url} target="_blank" rel="noreferrer">{labels.source}<ExternalLink aria-hidden="true" /></a>}
      </div>
    </section>
  );
}

function phaseStatus(startDate: string | undefined, endDate: string | undefined, now: Date): "complete" | "current" | "upcoming" {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
  if (end && end < now) return "complete";
  if (start && start <= now && (!end || end >= now)) return "current";
  return "upcoming";
}
