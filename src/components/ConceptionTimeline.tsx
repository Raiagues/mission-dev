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
  const gantt = buildGantt(phases, now);

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
    milestone: "Próximo marco oficial",
    phase: "Fase",
    today: "Hoje",
    estimated: "Janela aproximada"
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
    milestone: "Next official milestone",
    phase: "Phase",
    today: "Today",
    estimated: "Approximate window"
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
        <div className="timeline-gantt-scroll">
          <div className="timeline-gantt">
            <div className="gantt-axis-row">
              <div className="gantt-axis-title">{labels.phase}</div>
              <div className="gantt-axis">{gantt.months.map((month, index) => <span key={month.toISOString()}><small>{month.toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", { month: "short", timeZone: "UTC" }).replace(".", "")}</small>{(index === 0 || month.getUTCMonth() === 0) && <strong>{month.getUTCFullYear()}</strong>}</span>)}</div>
            </div>
            <div className="timeline-phase-list">
              {gantt.todayPercent !== null && <div className="gantt-today-layer" aria-hidden="true"><i style={{ left: `${gantt.todayPercent}%` }}><span>{labels.today}</span></i></div>}
              {phases.map((phase, index) => {
            const status = phaseStatus(phase.startDate, phase.endDate, now);
                const range = gantt.ranges[index];
                return <a className={`${status}${phase.approximate ? " approximate" : ""}`} href={phase.url} target="_blank" rel="noreferrer" key={phase.id}>
                  <span className="gantt-phase-label"><i>{status === "complete" ? <Check aria-hidden="true" /> : status === "current" ? <Flag aria-hidden="true" /> : <span />}</i><span><small>{status === "complete" ? labels.complete : status === "current" ? labels.current : labels.upcoming}</small><strong>{phase.label[language]}</strong><em>{phase.date}{phase.approximate ? ` · ${labels.estimated}` : ""}</em></span></span>
                  <span className="gantt-track" style={{ backgroundSize: `${100 / Math.max(1, gantt.months.length)}% 100%` }}><i className="gantt-bar" style={{ left: `${range.left}%`, width: `${range.width}%` }}><span>{phase.label[language].split(" · ").at(-1)}</span></i><ExternalLink aria-hidden="true" /></span>
                </a>;
              })}
              {phases.length === 0 && modality && <a className="current milestone-only" href={modality.milestone.url} target="_blank" rel="noreferrer">
                <span className="gantt-phase-label"><i><Flag aria-hidden="true" /></i><span><small>{labels.milestone}</small><strong>{modality.milestone.label[language]}</strong><em>{modality.milestone.date}</em></span></span>
                <span className="gantt-track"><i className="gantt-bar" style={{ left: "45%", width: "12%" }} /><ExternalLink aria-hidden="true" /></span>
              </a>}
            </div>
          </div>
        </div>
        {modality && <a className="timeline-source-link" href={modality.milestone.url} target="_blank" rel="noreferrer">{labels.source}<ExternalLink aria-hidden="true" /></a>}
      </div>
    </section>
  );
}

function buildGantt(phases: Array<{ startDate?: string; endDate?: string }>, now: Date) {
  const datedValues = phases.flatMap((phase) => [phase.startDate, phase.endDate]).filter((value): value is string => Boolean(value));
  const fallbackYear = Number.parseInt(datedValues.at(-1)?.slice(0, 4) || String(now.getFullYear()), 10);
  const normalized = phases.map((phase) => ({
    start: parseDate(phase.startDate) ?? new Date(Date.UTC(fallbackYear, 6, 1)),
    end: parseDate(phase.endDate) ?? new Date(Date.UTC(fallbackYear, 11, 31))
  }));
  const starts = normalized.map((range) => range.start.getTime());
  const ends = normalized.map((range) => range.end.getTime());
  const earliest = new Date(Math.min(...starts, Date.UTC(now.getUTCFullYear(), 0, 1)));
  const latest = new Date(Math.max(...ends, Date.UTC(now.getUTCFullYear(), 11, 31)));
  const start = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1));
  const end = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0, 23, 59, 59));
  const span = Math.max(1, end.getTime() - start.getTime());
  const months: Date[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) months.push(cursor);
  const ranges = normalized.map((range) => {
    const left = Math.max(0, Math.min(100, ((range.start.getTime() - start.getTime()) / span) * 100));
    const right = Math.max(left + 1.2, Math.min(100, ((range.end.getTime() - start.getTime()) / span) * 100));
    return { left, width: Math.max(1.2, right - left) };
  });
  const current = now.getTime();
  const todayPercent = current >= start.getTime() && current <= end.getTime() ? ((current - start.getTime()) / span) * 100 : null;
  return { months, ranges, todayPercent };
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function phaseStatus(startDate: string | undefined, endDate: string | undefined, now: Date): "complete" | "current" | "upcoming" {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
  if (end && end < now) return "complete";
  if (start && start <= now && (!end || end >= now)) return "current";
  return "upcoming";
}
