import type { Language } from "./types";

export type LabMaturity = "draft" | "forming" | "decided";
export type LabSuggestionKind = "related" | "question" | "alternative" | "tension";
export type LabActionKind =
  | "created"
  | "edited"
  | "moved"
  | "deleted"
  | "maturity-changed"
  | "connection-created"
  | "connection-deleted"
  | "suggestion-accepted"
  | "suggestion-rejected"
  | "ai-organized"
  | "undo"
  | "redo";
export type LabInsightKind = "needs-context" | "duplicate" | "tension";

export type LabNode = {
  id: string;
  text: string;
  x: number;
  y: number;
  pinned: boolean;
  maturity: LabMaturity;
  createdAt: string;
};

export type LabLink = {
  id: string;
  from: string;
  to: string;
  createdAt: string;
};

export type LabSettings = {
  autoOrganize: boolean;
  semanticProximity: boolean;
  separateAlternatives: boolean;
  placeQuestions: boolean;
  highlightTensions: boolean;
  provisionalGroups: boolean;
  suggestRelations: boolean;
  stabilizeMature: boolean;
  rewriteIdeas: boolean;
  flagIncomplete: boolean;
  flagDuplicates: boolean;
};

export type LabTeamAction = {
  id: string;
  kind: LabActionKind;
  at: string;
  nodeIds: string[];
  source: "team" | "ai";
  summary: string;
};

export type LabInsight = {
  id: string;
  kind: LabInsightKind;
  nodeIds: string[];
  title: string;
  detail: string;
  question: string;
  source: "gemini";
  updatedAt: string;
};

export type LabBoard = {
  schemaVersion: 1;
  nodes: LabNode[];
  links: LabLink[];
  dismissedSuggestionIds: string[];
  dismissedInsightIds: string[];
  teamMemory: LabTeamAction[];
  insights: LabInsight[];
  settings: LabSettings;
};

export type LabSuggestion = {
  id: string;
  from: string;
  to: string;
  kind: LabSuggestionKind;
  confidence: number;
  reason: "shared-context" | "question-context" | "competing-paths" | "possible-tension" | "manual-proximity";
  explanation?: string;
  source?: "local" | "gemini";
};

export type LabGroup = {
  id: string;
  label: string;
  nodeIds: string[];
  source?: "local" | "gemini";
};

export const LAB_NODE_WIDTH = 240;
export const LAB_NODE_HEIGHT = 158;
export const LAB_WORLD_WIDTH = 2400;
export const LAB_WORLD_HEIGHT = 1400;

const STORAGE_PREFIX = "norte-brainstorm-lab-v1";
const LEGACY_STORAGE_PREFIX = "mission-dev-brainstorm-lab-v1";
const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "essa", "esse", "esta", "este", "isso", "mais", "menos", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "que", "se", "sem", "ser", "ter", "um", "uma", "usar",
  "a", "an", "and", "at", "be", "by", "for", "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "use", "what", "when", "where", "with"
]);

const CONCEPTS: Array<{ id: string; pt: string; en: string; terms: string[] }> = [
  { id: "wildfire", pt: "Queimadas", en: "Wildfires", terms: ["queimad", "incendi", "fogo", "wildfire", "fire"] },
  { id: "observation", pt: "Detecção", en: "Detection", terms: ["detect", "identific", "monitor", "observ", "imagem", "camera", "sensor", "image"] },
  { id: "night", pt: "Operação noturna", en: "Night operation", terms: ["noite", "noturn", "escuro", "termic", "infraverm", "night", "thermal", "infrared"] },
  { id: "alerts", pt: "Alertas", en: "Alerts", terms: ["alert", "avis", "notific", "warning"] },
  { id: "latency", pt: "Tempo de resposta", en: "Response time", terms: ["minut", "hora", "rapid", "tempo", "prazo", "latencia", "delay", "latency", "minute", "hour"] },
  { id: "satellite", pt: "Arquitetura orbital", en: "Orbital architecture", terms: ["satelit", "sentinel", "orbit", "orbital", "lancar", "launch"] },
  { id: "thermal", pt: "Sensoriamento térmico", en: "Thermal sensing", terms: ["termic", "infraverm", "camera", "thermal", "infrared"] },
  { id: "operations", pt: "Operação", en: "Operations", terms: ["funcion", "oper", "cobertura", "frequencia", "operation", "coverage", "frequency"] }
];

const ALTERNATIVE_TERMS = ["alternativ", "em vez", "opcao", "substituir", "versus", "proprio", "sentinel", "instead", "option", "own satellite"];
const NEGATION_TERMS = ["nao", "sem", "impossivel", "evitar", "descartar", "not ", "without", "impossible", "avoid", "discard"];
const QUESTION_STARTS = ["como ", "qual ", "quais ", "quem ", "onde ", "quando ", "por que ", "porque ", "o que ", "how ", "what ", "who ", "where ", "when ", "why "];

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  autoOrganize: true,
  semanticProximity: true,
  separateAlternatives: true,
  placeQuestions: true,
  highlightTensions: true,
  provisionalGroups: true,
  suggestRelations: true,
  stabilizeMature: true,
  rewriteIdeas: true,
  flagIncomplete: true,
  flagDuplicates: true
};

export function createEmptyLabBoard(): LabBoard {
  return {
    schemaVersion: 1,
    nodes: [],
    links: [],
    dismissedSuggestionIds: [],
    dismissedInsightIds: [],
    teamMemory: [],
    insights: [],
    settings: { ...DEFAULT_LAB_SETTINGS }
  };
}

export function labStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}:${projectId}`;
}

export function loadLabBoard(projectId: string, storage?: Pick<Storage, "getItem">): LabBoard {
  const source = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  if (!source) return createEmptyLabBoard();
  const raw = source.getItem(labStorageKey(projectId)) ?? source.getItem(`${LEGACY_STORAGE_PREFIX}:${projectId}`);
  if (!raw) return createEmptyLabBoard();

  try {
    const parsed = JSON.parse(raw) as Partial<LabBoard>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.links)) return createEmptyLabBoard();
    return {
      schemaVersion: 1,
      nodes: parsed.nodes.filter(isLabNode).map(normalizeLabNode),
      links: parsed.links.filter(isLabLink),
      dismissedSuggestionIds: Array.isArray(parsed.dismissedSuggestionIds) ? parsed.dismissedSuggestionIds.filter((id): id is string => typeof id === "string") : [],
      dismissedInsightIds: Array.isArray(parsed.dismissedInsightIds) ? parsed.dismissedInsightIds.filter((id): id is string => typeof id === "string") : [],
      teamMemory: Array.isArray(parsed.teamMemory) ? parsed.teamMemory.filter(isLabTeamAction).slice(-80) : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights.filter(isLabInsight).slice(-80) : [],
      settings: { ...DEFAULT_LAB_SETTINGS, ...parsed.settings }
    };
  } catch {
    return createEmptyLabBoard();
  }
}

export function saveLabBoard(projectId: string, board: LabBoard, storage?: Pick<Storage, "setItem">): void {
  const destination = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  destination?.setItem(labStorageKey(projectId), JSON.stringify(board));
}

export function createLabNode(text: string, x: number, y: number, id = makeId("idea"), createdAt = new Date().toISOString()): LabNode {
  return { id, text: text.trim(), x, y, pinned: false, maturity: "draft", createdAt };
}

export function createLabLink(from: string, to: string, id = makeId("relation"), createdAt = new Date().toISOString()): LabLink {
  return { id, from, to, createdAt };
}

export function createLabAction(
  kind: LabActionKind,
  summary: string,
  nodeIds: string[] = [],
  source: LabTeamAction["source"] = "team",
  id = makeId("action"),
  at = new Date().toISOString()
): LabTeamAction {
  return { id, kind, at, nodeIds: [...new Set(nodeIds)].slice(0, 12), source, summary: summary.trim().slice(0, 360) };
}

export function appendLabAction(board: LabBoard, action: LabTeamAction): LabBoard {
  return { ...board, teamMemory: [...board.teamMemory, action].slice(-80) };
}

export function suggestionPairId(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join("::");
}

export function deriveLabSuggestions(board: LabBoard): LabSuggestion[] {
  if (!board.settings.autoOrganize || !board.settings.suggestRelations) return [];
  const confirmed = new Set(board.links.map((link) => suggestionPairId(link.from, link.to)));
  const dismissed = new Set(board.dismissedSuggestionIds);
  const suggestions: LabSuggestion[] = [];

  for (let index = 0; index < board.nodes.length; index += 1) {
    for (let comparison = index + 1; comparison < board.nodes.length; comparison += 1) {
      const first = board.nodes[index];
      const second = board.nodes[comparison];
      const id = suggestionPairId(first.id, second.id);
      if (confirmed.has(id) || dismissed.has(id)) continue;
      const relation = scoreRelation(first, second, board.settings);
      if (!relation || relation.confidence < 0.34) continue;
      const [from, to] = first.createdAt <= second.createdAt ? [first.id, second.id] : [second.id, first.id];
      suggestions.push({ id, from, to, ...relation });
    }
  }

  return suggestions
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
    .slice(0, 12);
}

export function deriveLabGroups(board: LabBoard, language: Language): LabGroup[] {
  if (!board.settings.autoOrganize || !board.settings.provisionalGroups) return [];
  const groups = CONCEPTS
    .map((concept) => ({
      id: concept.id,
      label: language === "pt" ? concept.pt : concept.en,
      nodeIds: board.nodes.filter((node) => conceptsFor(node.text).has(concept.id)).map((node) => node.id)
    }))
    .filter((group) => group.nodeIds.length >= 2)
    .sort((a, b) => b.nodeIds.length - a.nodeIds.length);

  const unique: LabGroup[] = [];
  for (const group of groups) {
    const signature = [...group.nodeIds].sort().join("|");
    if (!unique.some((item) => [...item.nodeIds].sort().join("|") === signature)) unique.push(group);
    if (unique.length === 4) break;
  }
  return unique;
}

export function computeGentleLabLayout(board: LabBoard, suggestions = deriveLabSuggestions(board), focusNodeId?: string): LabNode[] {
  if (!board.settings.autoOrganize || board.nodes.length < 2) return board.nodes.map((node) => ({ ...node }));
  const force = new Map(board.nodes.map((node) => [node.id, { x: 0, y: 0 }]));
  const nodeById = new Map(board.nodes.map((node) => [node.id, node]));

  const addForce = (nodeId: string, x: number, y: number) => {
    const current = force.get(nodeId);
    if (!current) return;
    current.x += x;
    current.y += y;
  };

  for (let index = 0; index < board.nodes.length; index += 1) {
    for (let comparison = index + 1; comparison < board.nodes.length; comparison += 1) {
      const first = board.nodes[index];
      const second = board.nodes[comparison];
      const firstCenter = center(first);
      const secondCenter = center(second);
      const dx = secondCenter.x - firstCenter.x;
      const dy = secondCenter.y - firstCenter.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const minimumDistance = 275;
      if (distance < minimumDistance) {
        const pressure = (minimumDistance - distance) * 0.16;
        const unitX = dx / distance || (index % 2 === 0 ? 1 : -1);
        const unitY = dy / distance || 0.25;
        addForce(first.id, -unitX * pressure, -unitY * pressure);
        addForce(second.id, unitX * pressure, unitY * pressure);
      }
    }
  }

  suggestions.forEach((suggestion) => {
    const first = nodeById.get(suggestion.from);
    const second = nodeById.get(suggestion.to);
    if (!first || !second) return;
    const firstCenter = center(first);
    const secondCenter = center(second);
    const dx = secondCenter.x - firstCenter.x;
    const dy = secondCenter.y - firstCenter.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const unitX = dx / distance;
    const unitY = dy / distance;

    if (suggestion.kind === "alternative" && board.settings.separateAlternatives && distance < 390) {
      const pressure = (390 - distance) * 0.09;
      addForce(first.id, -unitX * pressure, -unitY * pressure * 0.35);
      addForce(second.id, unitX * pressure, unitY * pressure * 0.35);
      return;
    }

    const shouldPull = board.settings.semanticProximity || (suggestion.kind === "question" && board.settings.placeQuestions);
    if (shouldPull && distance > 285) {
      const pull = Math.min(38, (distance - 285) * 0.08) * suggestion.confidence;
      addForce(first.id, unitX * pull, unitY * pull);
      addForce(second.id, -unitX * pull, -unitY * pull);
    }
  });

  board.links.forEach((link) => {
    const first = nodeById.get(link.from);
    const second = nodeById.get(link.to);
    if (!first || !second) return;
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (distance <= 330) return;
    const pull = Math.min(24, (distance - 330) * 0.05);
    addForce(first.id, (dx / distance) * pull, (dy / distance) * pull);
    addForce(second.id, -(dx / distance) * pull, -(dy / distance) * pull);
  });

  return board.nodes.map((node) => {
    if (node.pinned) return { ...node };
    const nodeForce = force.get(node.id) ?? { x: 0, y: 0 };
    let mobility = focusNodeId === node.id ? 1 : 0.62;
    if (board.settings.stabilizeMature && node.maturity === "forming") mobility *= 0.45;
    if (board.settings.stabilizeMature && node.maturity === "decided") mobility *= 0.12;
    const dx = clamp(nodeForce.x * mobility, -64, 64);
    const dy = clamp(nodeForce.y * mobility, -52, 52);
    return {
      ...node,
      x: clamp(node.x + dx, 40, LAB_WORLD_WIDTH - LAB_NODE_WIDTH - 40),
      y: clamp(node.y + dy, 40, LAB_WORLD_HEIGHT - LAB_NODE_HEIGHT - 40)
    };
  });
}

function scoreRelation(first: LabNode, second: LabNode, settings: LabSettings): Omit<LabSuggestion, "id" | "from" | "to"> | null {
  const firstNormalized = normalize(first.text);
  const secondNormalized = normalize(second.text);
  const firstTokens = meaningfulTokens(firstNormalized);
  const secondTokens = meaningfulTokens(secondNormalized);
  const sharedTokens = [...firstTokens].filter((token) => secondTokens.has(token));
  const firstConcepts = conceptsFor(first.text);
  const secondConcepts = conceptsFor(second.text);
  const sharedConcepts = [...firstConcepts].filter((concept) => secondConcepts.has(concept));
  const firstQuestion = isQuestion(firstNormalized);
  const secondQuestion = isQuestion(secondNormalized);
  const oneQuestion = firstQuestion !== secondQuestion;
  const firstNegated = includesAny(firstNormalized, NEGATION_TERMS);
  const secondNegated = includesAny(secondNormalized, NEGATION_TERMS);
  const possibleTension = firstNegated !== secondNegated && (sharedTokens.length > 0 || sharedConcepts.length > 0);
  const alternativeSignal = includesAny(firstNormalized, ALTERNATIVE_TERMS) || includesAny(secondNormalized, ALTERNATIVE_TERMS);
  const centersDistance = Math.hypot(center(first).x - center(second).x, center(first).y - center(second).y);
  const spatialSignal = centersDistance < 210 ? 0.26 : centersDistance < 390 ? 0.1 * (1 - (centersDistance - 210) / 180) : 0;
  const semanticScore = Math.min(0.5, sharedTokens.length * 0.19) + Math.min(0.56, sharedConcepts.length * 0.36);
  let confidence = semanticScore + spatialSignal;
  let kind: LabSuggestionKind = "related";
  let reason: LabSuggestion["reason"] = semanticScore > 0 ? "shared-context" : "manual-proximity";

  if (possibleTension && settings.highlightTensions) {
    kind = "tension";
    reason = "possible-tension";
    confidence += 0.22;
  } else if (alternativeSignal && sharedConcepts.length > 0 && settings.separateAlternatives) {
    kind = "alternative";
    reason = "competing-paths";
    confidence += 0.2;
  } else if (oneQuestion && settings.placeQuestions && (semanticScore > 0 || centersDistance < 280)) {
    kind = "question";
    reason = "question-context";
    confidence += 0.16;
  }

  if (semanticScore === 0 && spatialSignal === 0) return null;
  return { kind, reason, confidence: clamp(confidence, 0, 0.98) };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9<>? ]+/g, " ").replace(/\s+/g, " ").trim();
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(value.split(" ").filter((token) => token.length >= 3 && !STOP_WORDS.has(token)));
}

function conceptsFor(text: string): Set<string> {
  const normalized = normalize(text);
  return new Set(CONCEPTS.filter((concept) => includesAny(normalized, concept.terms)).map((concept) => concept.id));
}

function isQuestion(normalized: string): boolean {
  return normalized.endsWith("?") || QUESTION_STARTS.some((start) => normalized.startsWith(start));
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function center(node: LabNode): { x: number; y: number } {
  return { x: node.x + LAB_NODE_WIDTH / 2, y: node.y + LAB_NODE_HEIGHT / 2 };
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isLabNode(value: unknown): value is LabNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<LabNode>;
  return typeof node.id === "string" && typeof node.text === "string" && typeof node.x === "number" && typeof node.y === "number";
}

function isLabLink(value: unknown): value is LabLink {
  if (!value || typeof value !== "object") return false;
  const link = value as Partial<LabLink>;
  return typeof link.id === "string" && typeof link.from === "string" && typeof link.to === "string";
}

function normalizeLabNode(node: LabNode): LabNode {
  return {
    ...node,
    pinned: node.pinned === true,
    maturity: node.maturity === "forming" || node.maturity === "decided" ? node.maturity : "draft",
    createdAt: typeof node.createdAt === "string" ? node.createdAt : new Date(0).toISOString()
  };
}

function isLabTeamAction(value: unknown): value is LabTeamAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<LabTeamAction>;
  return typeof action.id === "string"
    && typeof action.kind === "string"
    && typeof action.at === "string"
    && Array.isArray(action.nodeIds)
    && (action.source === "team" || action.source === "ai")
    && typeof action.summary === "string";
}

function isLabInsight(value: unknown): value is LabInsight {
  if (!value || typeof value !== "object") return false;
  const insight = value as Partial<LabInsight>;
  return typeof insight.id === "string"
    && (insight.kind === "needs-context" || insight.kind === "duplicate" || insight.kind === "tension")
    && Array.isArray(insight.nodeIds)
    && typeof insight.title === "string"
    && typeof insight.detail === "string"
    && typeof insight.question === "string"
    && insight.source === "gemini"
    && typeof insight.updatedAt === "string";
}
