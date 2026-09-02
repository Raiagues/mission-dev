import type { BrainstormAiAnalysis, BrainstormAiNodePlan } from "./brainstormAi";
import {
  DEFAULT_LAB_SETTINGS,
  LAB_NODE_HEIGHT,
  LAB_NODE_WIDTH,
  LAB_WORLD_HEIGHT,
  LAB_WORLD_WIDTH,
  organizeLabIntoDomains,
  suggestionPairId
} from "./brainstormLab";
import type { LabBoard, LabInsight, LabNode, LabSettings } from "./brainstormLab";
import type { Language } from "./types";

const MAIN_LEFT = 76;
const MAIN_RIGHT = 1860;
const MAIN_TOP = 92;
const ROW_GAP = 108;
const NODE_GAP = 68;
const CONTEXT_LEFT = 2040;

export function applyBrainstormAiOrganization(board: LabBoard, analysis: BrainstormAiAnalysis, language: Language): LabBoard {
  const planById = new Map(analysis.nodePlans.map((plan) => [plan.nodeId, plan]));
  if (board.settings.missionStructure) {
    const rewrittenBoard: LabBoard = {
      ...board,
      nodes: board.nodes.map((node) => {
        const plan = planById.get(node.id);
        const rewrittenText = board.settings.rewriteIdeas ? plan?.rewrittenText.trim().replace(/\s+/g, " ").slice(0, 220) : "";
        return { ...node, text: rewrittenText || node.text };
      })
    };
    const structured = organizeLabIntoDomains(
      rewrittenBoard,
      language,
      analysis.nodePlans.map((plan) => ({
        nodeId: plan.nodeId,
        domainId: plan.domainId,
        parentId: plan.parentId,
        level: plan.level,
        order: plan.order
      })),
      (analysis.gaps ?? []).map((gap) => ({ ...gap, source: "gemini" as const }))
    );
    return {
      ...structured,
      insights: brainstormAiInsights(analysis, language, board.settings).filter((insight) => !board.dismissedInsightIds.includes(insight.id))
    };
  }
  const mainPlans = analysis.nodePlans.filter((plan) => plan.lane === "main" && planById.has(plan.nodeId));
  const contextPlans = analysis.nodePlans.filter((plan) => plan.lane === "needs-context" && planById.has(plan.nodeId));
  const levelById = resolveLevels(mainPlans, board);
  const positions = layoutMainPlans(mainPlans, board.nodes, levelById);

  contextPlans
    .sort((first, second) => first.order - second.order || originalX(board.nodes, first.nodeId) - originalX(board.nodes, second.nodeId))
    .forEach((plan, index) => {
      const column = Math.floor(index / 8);
      const row = index % 8;
      positions.set(plan.nodeId, {
        x: clamp(CONTEXT_LEFT - column * (LAB_NODE_WIDTH + 42), MAIN_RIGHT + 32, LAB_WORLD_WIDTH - LAB_NODE_WIDTH - 54),
        y: clamp(MAIN_TOP + row * (LAB_NODE_HEIGHT + 58), 40, LAB_WORLD_HEIGHT - LAB_NODE_HEIGHT - 40)
      });
    });

  const nodes = board.nodes.map((node) => {
    const plan = planById.get(node.id);
    const position = positions.get(node.id) ?? { x: node.x, y: node.y };
    const rewrittenText = board.settings.rewriteIdeas ? plan?.rewrittenText.trim().replace(/\s+/g, " ").slice(0, 220) : "";
    return {
      ...node,
      text: rewrittenText || node.text,
      x: position.x,
      y: position.y
    };
  });

  return {
    ...board,
    nodes,
    insights: brainstormAiInsights(analysis, language, board.settings).filter((insight) => !board.dismissedInsightIds.includes(insight.id))
  };
}

export function brainstormAiInsights(
  analysis: BrainstormAiAnalysis | null,
  language: Language,
  settings: LabSettings = DEFAULT_LAB_SETTINGS,
  updatedAt = new Date().toISOString()
): LabInsight[] {
  if (!analysis) return [];
  const insights: LabInsight[] = [];

  analysis.nodePlans.forEach((plan) => {
    if (settings.flagIncomplete && plan.informationStatus !== "enough") {
      insights.push({
        id: `needs-context:${plan.nodeId}`,
        kind: "needs-context",
        nodeIds: [plan.nodeId],
        title: language === "pt" ? "Precisa de mais contexto" : "Needs more context",
        detail: plan.informationNeeded || (language === "pt" ? "A intenção desta ideia ainda não está clara." : "The intent behind this idea is not clear yet."),
        question: language === "pt" ? "Que resultado, limite ou condição ajudaria a tornar esta ideia verificável?" : "What outcome, limit, or condition would make this idea verifiable?",
        source: "gemini",
        updatedAt
      });
    }

    if (settings.flagDuplicates && plan.duplicateOf) {
      const pair = suggestionPairId(plan.nodeId, plan.duplicateOf);
      insights.push({
        id: `duplicate:${pair}`,
        kind: "duplicate",
        nodeIds: [plan.nodeId, plan.duplicateOf],
        title: language === "pt" ? "Possível repetição" : "Possible duplicate",
        detail: language === "pt" ? "Estas ideias parecem expressar uma intenção muito parecida." : "These ideas appear to express very similar intent.",
        question: language === "pt" ? "Elas representam a mesma decisão ou há uma diferença que vale explicitar?" : "Do they represent the same decision, or is there a difference worth making explicit?",
        source: "gemini",
        updatedAt
      });
    }
  });

  if (settings.highlightTensions) analysis.tensions.forEach((tension) => {
    insights.push({
      id: tension.id,
      kind: "tension",
      nodeIds: [tension.first, tension.second],
      title: tension.title,
      detail: tension.explanation,
      question: tension.question,
      source: "gemini",
      updatedAt
    });
  });

  return dedupeInsights(insights);
}

function resolveLevels(plans: BrainstormAiNodePlan[], board: LabBoard): Map<string, number> {
  const planById = new Map(plans.map((plan) => [plan.nodeId, plan]));
  const confirmedParent = new Map<string, string>();
  board.links.forEach((link) => {
    if (planById.has(link.from) && planById.has(link.to) && !confirmedParent.has(link.to)) confirmedParent.set(link.to, link.from);
  });
  const levels = new Map<string, number>();

  const visit = (nodeId: string, trail: Set<string>): number => {
    const cached = levels.get(nodeId);
    if (cached !== undefined) return cached;
    const plan = planById.get(nodeId);
    if (!plan || trail.has(nodeId)) return 0;
    const parentId = plan.parentId || confirmedParent.get(nodeId) || "";
    const nextTrail = new Set(trail).add(nodeId);
    const parentLevel = parentId && planById.has(parentId) ? visit(parentId, nextTrail) + 1 : 0;
    const level = clamp(Math.max(plan.level, parentLevel), 0, 8);
    levels.set(nodeId, level);
    return level;
  };

  plans.forEach((plan) => visit(plan.nodeId, new Set()));
  return levels;
}

function layoutMainPlans(plans: BrainstormAiNodePlan[], nodes: LabNode[], levelById: Map<string, number>): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const rows = new Map<number, BrainstormAiNodePlan[]>();
  plans.forEach((plan) => {
    const level = levelById.get(plan.nodeId) ?? plan.level;
    rows.set(level, [...(rows.get(level) ?? []), plan]);
  });

  [...rows.entries()].sort(([first], [second]) => first - second).forEach(([level, row]) => {
    row.sort((first, second) => first.order - second.order || originalX(nodes, first.nodeId) - originalX(nodes, second.nodeId));
    const available = MAIN_RIGHT - MAIN_LEFT;
    const desiredWidth = row.length * LAB_NODE_WIDTH + Math.max(0, row.length - 1) * NODE_GAP;
    const gap = row.length <= 1 ? 0 : Math.max(28, Math.min(NODE_GAP, (available - row.length * LAB_NODE_WIDTH) / (row.length - 1)));
    const rowWidth = Math.min(desiredWidth, row.length * LAB_NODE_WIDTH + Math.max(0, row.length - 1) * gap);
    const startX = MAIN_LEFT + Math.max(0, (available - rowWidth) / 2);
    row.forEach((plan, index) => positions.set(plan.nodeId, {
      x: clamp(startX + index * (LAB_NODE_WIDTH + gap), MAIN_LEFT, MAIN_RIGHT - LAB_NODE_WIDTH),
      y: clamp(MAIN_TOP + level * (LAB_NODE_HEIGHT + ROW_GAP), 40, LAB_WORLD_HEIGHT - LAB_NODE_HEIGHT - 40)
    }));
  });

  const childrenByParent = new Map<string, string[]>();
  plans.forEach((plan) => {
    if (!plan.parentId || !positions.has(plan.parentId) || !positions.has(plan.nodeId)) return;
    childrenByParent.set(plan.parentId, [...(childrenByParent.get(plan.parentId) ?? []), plan.nodeId]);
  });
  [...childrenByParent.entries()]
    .sort(([first], [second]) => (levelById.get(second) ?? 0) - (levelById.get(first) ?? 0))
    .forEach(([parentId, childIds]) => {
      const parent = positions.get(parentId);
      const children = childIds.map((id) => positions.get(id)).filter((position): position is { x: number; y: number } => Boolean(position));
      if (!parent || children.length === 0) return;
      const center = children.reduce((sum, child) => sum + child.x + LAB_NODE_WIDTH / 2, 0) / children.length;
      positions.set(parentId, { ...parent, x: clamp(center - LAB_NODE_WIDTH / 2, MAIN_LEFT, MAIN_RIGHT - LAB_NODE_WIDTH) });
    });

  rows.forEach((row) => resolveRowCollisions(row.map((plan) => plan.nodeId), positions));
  return positions;
}

function resolveRowCollisions(nodeIds: string[], positions: Map<string, { x: number; y: number }>): void {
  const ordered = nodeIds
    .map((id) => ({ id, position: positions.get(id) }))
    .filter((item): item is { id: string; position: { x: number; y: number } } => Boolean(item.position))
    .sort((first, second) => first.position.x - second.position.x);
  let cursor = MAIN_LEFT;
  ordered.forEach(({ id, position }) => {
    const x = Math.max(position.x, cursor);
    positions.set(id, { ...position, x });
    cursor = x + LAB_NODE_WIDTH + 38;
  });
  const overflow = cursor - 38 - MAIN_RIGHT;
  if (overflow <= 0) return;
  ordered.forEach(({ id }) => {
    const position = positions.get(id);
    if (position) positions.set(id, { ...position, x: Math.max(MAIN_LEFT, position.x - overflow) });
  });
}

function dedupeInsights(insights: LabInsight[]): LabInsight[] {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    if (seen.has(insight.id)) return false;
    seen.add(insight.id);
    return true;
  }).slice(0, 80);
}

function originalX(nodes: LabNode[], nodeId: string): number {
  return nodes.find((node) => node.id === nodeId)?.x ?? 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
