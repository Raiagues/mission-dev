import type { Checkpoint, MissionIssue, MissionLink, MissionNode, NodeState } from "./types";

export const MAX_CARD_WORDS = 24;

export function countWords(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).length;
}

export function limitWords(text: string, maxWords = MAX_CARD_WORDS): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ");
}

export function hasDefinedResolution(nodes: MissionNode[], issueKey: string): boolean {
  return nodes.some((node) => node.issueKey === issueKey && node.state === "defined");
}

export function getIssues(nodes: MissionNode[]): MissionIssue[] {
  const issues: MissionIssue[] = [];
  const fast = nodes.find((node) => node.kickerKey === "nodes.timeKicker" && node.state !== "closed");
  const broad = nodes.find((node) => node.kickerKey === "nodes.contextKicker" && node.state !== "closed");
  const beneficiary = nodes.find((node) => node.kickerKey === "nodes.beneficiaryKicker" && node.state !== "closed");
  const beneficiaryQuestion = nodes.find((node) => node.titleKey === "nodes.beneficiaryQuestion" && node.state !== "closed");

  if (fast && broad && !hasDefinedResolution(nodes, "coverage-latency")) {
    issues.push({
      key: "coverage-latency",
      titleKey: "issues.coverageLatencyTitle",
      descriptionKey: "issues.coverageLatencyDescription",
      nodeIds: [fast.id, broad.id],
      severity: "critical",
      suggestions: [
        { titleKey: "issues.prioritizeRegionsTitle", descriptionKey: "issues.prioritizeRegionsDescription" },
        { titleKey: "issues.splitDetectionTitle", descriptionKey: "issues.splitDetectionDescription" },
        { titleKey: "issues.largerWindowTitle", descriptionKey: "issues.largerWindowDescription" }
      ]
    });
  }

  if (!beneficiary || beneficiary.state !== "defined") {
    issues.push({
      key: "beneficiary",
      titleKey: "issues.beneficiaryTitle",
      descriptionKey: "issues.beneficiaryDescription",
      nodeIds: beneficiary ? [beneficiary.id] : beneficiaryQuestion ? [beneficiaryQuestion.id] : [1],
      severity: "gap",
      suggestions: [
        { titleKey: "issues.civilDefenseTitle", descriptionKey: "issues.civilDefenseDescription" },
        { titleKey: "issues.environmentalCentersTitle", descriptionKey: "issues.environmentalCentersDescription" },
        { titleKey: "issues.fieldBrigadesTitle", descriptionKey: "issues.fieldBrigadesDescription" }
      ]
    });
  }

  return issues;
}

export function getScopedIssues(nodes: MissionNode[], visibleNodeIds: Set<number>, resolvedIssueKeys: string[] = []): MissionIssue[] {
  return getIssues(nodes).filter((issue) => !resolvedIssueKeys.includes(issue.key) && issue.nodeIds.every((id) => visibleNodeIds.has(id)));
}

function strongestState(nodes: MissionNode[]): NodeState {
  if (nodes.some((node) => node.state === "defined")) return "defined";
  if (nodes.some((node) => node.state === "hypothesis")) return "hypothesis";
  if (nodes.some((node) => node.state === "open")) return "open";
  return "open";
}

export function getCheckpoints(nodes: MissionNode[]): Checkpoint[] {
  const evidence = {
    problem: nodes.filter((node) => node.type === "center" && node.state !== "closed"),
    result: nodes.filter((node) => node.kickerKey === "nodes.resultKicker" && node.state !== "closed"),
    context: nodes.filter((node) => node.kickerKey === "nodes.contextKicker" && node.state !== "closed"),
    beneficiary: nodes.filter((node) => node.kickerKey === "nodes.beneficiaryKicker" && node.state !== "closed"),
    time: nodes.filter((node) => node.kickerKey === "nodes.timeKicker" && node.state !== "closed"),
    constraints: nodes.filter((node) => node.kickerKey === "nodes.constraintKicker" && node.state !== "closed")
  };

  return [
    { key: "problem", nameKey: "checkpoints.problem", descriptionKey: "checkpoints.problemDescription", state: strongestState(evidence.problem), evidence: evidence.problem, mandatory: true },
    { key: "result", nameKey: "checkpoints.result", descriptionKey: "checkpoints.resultDescription", state: strongestState(evidence.result), evidence: evidence.result, mandatory: true },
    { key: "context", nameKey: "checkpoints.context", descriptionKey: "checkpoints.contextDescription", state: strongestState(evidence.context), evidence: evidence.context, mandatory: true },
    { key: "beneficiary", nameKey: "checkpoints.beneficiary", descriptionKey: "checkpoints.beneficiaryDescription", state: strongestState(evidence.beneficiary), evidence: evidence.beneficiary, mandatory: true },
    { key: "time", nameKey: "checkpoints.time", descriptionKey: "checkpoints.timeDescription", state: strongestState(evidence.time), evidence: evidence.time, mandatory: true },
    { key: "constraints", nameKey: "checkpoints.constraints", descriptionKey: "checkpoints.constraintsDescription", state: strongestState(evidence.constraints), evidence: evidence.constraints, mandatory: false }
  ];
}

export function getProgress(nodes: MissionNode[]): number {
  const checkpoints = getCheckpoints(nodes);
  let score = 0;

  for (const checkpoint of checkpoints) {
    if (checkpoint.state === "defined") score += 1;
    if (checkpoint.state === "hypothesis") score += 0.5;
  }

  return Math.round((score / checkpoints.length) * 100);
}

export function getNodeStateProgress(nodes: MissionNode[]): number {
  const active = nodes.filter((node) => node.state !== "closed");
  if (active.length === 0) return 0;
  let score = 0;
  for (const node of active) {
    if (node.state === "defined") score += 1;
    if (node.state === "hypothesis") score += 0.5;
  }
  return Math.round((score / active.length) * 100);
}

export function canCloseProblemPhase(nodes: MissionNode[], resolvedIssueKeys: string[] = []): boolean {
  const checkpoints = getCheckpoints(nodes);
  const missingMandatory = checkpoints.some((checkpoint) => checkpoint.mandatory && checkpoint.state !== "defined");
  const criticalIssue = getIssues(nodes).some((issue) => issue.severity === "critical" && !resolvedIssueKeys.includes(issue.key));
  return !missingMandatory && !criticalIssue;
}

export function getVisibleNodeIds(rootId: number | null, nodes: MissionNode[], links: MissionLink[]): Set<number> {
  if (rootId === null) return new Set(nodes.map((node) => node.id));
  const visible = new Set<number>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const link of links) {
      if (link.from === current && !visible.has(link.to)) {
        visible.add(link.to);
        queue.push(link.to);
      }
    }
  }

  return visible;
}

export function layoutTopDown(nodes: MissionNode[], links: MissionLink[], rootId: number | null = null, visibleNodeIds?: Set<number>): MissionNode[] {
  const visible = visibleNodeIds ?? new Set(nodes.map((node) => node.id));
  const root = rootId !== null ? nodes.find((node) => node.id === rootId) : nodes.find((node) => node.type === "center" && visible.has(node.id));
  if (!root) return nodes;

  const mainIds = new Set(nodes.filter((node) => visible.has(node.id) && (node.bucket ?? "main") === "main").map((node) => node.id));
  const levels = new Map<number, number[]>();
  const visited = new Set<number>([root.id]);
  const queue: Array<{ id: number; depth: number }> = [{ id: root.id, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const level = levels.get(current.depth) ?? [];
    level.push(current.id);
    levels.set(current.depth, level);

    for (const link of links) {
      if (link.from !== current.id || !mainIds.has(link.to) || visited.has(link.to)) continue;
      visited.add(link.to);
      queue.push({ id: link.to, depth: current.depth + 1 });
    }
  }

  const unvisited = Array.from(mainIds).filter((id) => !visited.has(id));
  if (unvisited.length > 0) levels.set(Math.max(0, ...Array.from(levels.keys())) + 1, unvisited);

  const next = nodes.map((node) => ({ ...node }));
  const centerX = 1200;
  const columnGap = 310;
  const rowGap = 220;

  for (const [depth, ids] of levels.entries()) {
    const totalWidth = Math.max(0, ids.length - 1) * columnGap;
    ids.forEach((id, index) => {
      const target = next.find((node) => node.id === id);
      if (!target) return;
      target.x = centerX - totalWidth / 2 + index * columnGap - target.width / 2;
      target.y = 120 + depth * rowGap;
    });
  }

  const ideas = next.filter((node) => visible.has(node.id) && node.bucket === "ideas");
  const questions = next.filter((node) => visible.has(node.id) && node.bucket === "questions");
  ideas.forEach((node, index) => { node.x = 80; node.y = 170 + index * 165; });
  questions.forEach((node, index) => { node.x = 2150; node.y = 170 + index * 165; });
  return next;
}

export function createInitialNodes(): MissionNode[] {
  return [
    { id: 1, x: 720, y: 310, width: 300, titleKey: "nodes.startTitle", kickerKey: "nodes.startKicker", state: "defined", type: "center", bucket: "main" },
    { id: 2, x: 300, y: 170, width: 240, titleKey: "nodes.detectTitle", kickerKey: "nodes.resultKicker", state: "defined", type: "normal", bucket: "main" },
    { id: 3, x: 300, y: 520, width: 240, titleKey: "nodes.coverageTitle", kickerKey: "nodes.contextKicker", state: "hypothesis", type: "normal", bucket: "main" },
    { id: 4, x: 1170, y: 165, width: 240, titleKey: "nodes.responseTitle", kickerKey: "nodes.timeKicker", state: "hypothesis", type: "normal", bucket: "main" },
    { id: 5, x: 1170, y: 500, width: 240, titleKey: "nodes.beneficiaryQuestion", kickerKey: "nodes.questionKicker", state: "open", type: "question", bucket: "questions" },
    { id: 6, x: 700, y: 660, width: 240, titleKey: "nodes.thermalTitle", kickerKey: "nodes.freeIdeaKicker", state: "open", type: "normal", bucket: "ideas" },
    { id: 7, x: 1500, y: 320, width: 240, titleKey: "nodes.lowCostTitle", kickerKey: "nodes.constraintKicker", state: "hypothesis", type: "normal", bucket: "main" }
  ];
}

export function createInitialLinks(): MissionLink[] {
  return [
    { id: 101, from: 1, to: 2, type: "normal" },
    { id: 102, from: 1, to: 3, type: "normal" },
    { id: 103, from: 1, to: 4, type: "normal" },
    { id: 104, from: 1, to: 5, type: "normal" },
    { id: 105, from: 2, to: 6, type: "normal" },
    { id: 106, from: 1, to: 7, type: "normal" }
  ];
}