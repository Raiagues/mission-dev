import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Focus, LayoutDashboard, Maximize2 } from "lucide-react";
import { ApiError, useAuth } from "../lib/auth";
import {
  brainstormAiRequestFingerprint,
  createBrainstormAiRequest,
  mergeBrainstormAiSuggestions,
  normalizeBrainstormAiAnalysis
} from "../lib/brainstormAi";
import type { BrainstormAiAnalysis } from "../lib/brainstormAi";
import { buildBrainstormMissionContext } from "../lib/brainstormMissionContext";
import { applyBrainstormAiOrganization, brainstormAiInsights } from "../lib/brainstormAiLayout";
import {
  LAB_NODE_HEIGHT,
  LAB_NODE_WIDTH,
  LAB_WORLD_HEIGHT,
  LAB_WORLD_WIDTH,
  appendLabAction,
  classifyLabDomain,
  computeGentleLabLayout,
  createLabAction,
  createLabLink,
  createLabNode,
  deriveMissionDomains,
  deriveLabSuggestions,
  labGapPoint,
  loadLabBoard,
  normalizeLabBoard,
  organizeLabIntoDomains,
  saveLabBoard
} from "../lib/brainstormLab";
import type { LabBoard, LabDomain, LabGap, LabInsight, LabMaturity, LabNode, LabSettings, LabSuggestion } from "../lib/brainstormLab";
import type { MissionProject } from "../lib/projectStore";
import type { TeamMember } from "../lib/team";
import type { Language } from "../lib/types";

type Props = {
  language: Language;
  project: MissionProject;
  onBoardChange: (board: LabBoard) => void;
};

type Transform = { scale: number; x: number; y: number };
type ComposerState = { x: number; y: number; text: string; domainId?: LabNode["domainId"] } | null;
type DragState = {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  before: LabBoard;
  moved: boolean;
} | null;
type PanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
} | null;
type SelectedRelation = { type: "suggestion" | "confirmed"; id: string } | null;
type LabHistory = { past: LabBoard[]; future: LabBoard[] };
type AiPhase = "checking" | "local" | "idle" | "analyzing" | "ready" | "quota" | "error";
type AiAnalysisState = { fingerprint: string; analysis: BrainstormAiAnalysis } | null;
type EditorState = { nodeId: string; text: string } | null;
type ConnectionSide = "top" | "right" | "bottom" | "left";
type ConnectionDraft = {
  fromId: string;
  pointerId: number;
  side: ConnectionSide;
  startX: number;
  startY: number;
  x: number;
  y: number;
  hoverNodeId: string | null;
  invalid: boolean;
} | null;
type AdjustableSetting = Exclude<keyof LabSettings, "autoOrganize" | "provisionalGroups">;

const HISTORY_LIMIT = 60;

const copy = {
  pt: {
    automatic: "Organização automática",
    autoShort: "Auto",
    arrangeMap: "Arrumar mapa",
    structureMission: "Estruturar missão",
    structureActive: "Estrutura ativa",
    enterDomain: "Abrir área",
    organizeDomain: "Organizar esta área",
    missingLink: "LACUNA PARA EXPLORAR",
    exploreGap: "Explorar agora",
    decisionSent: "No sistema consolidado",
    domainIdeas: "ideias",
    organizeWithAi: "Arrumar mapa",
    organizingWithAi: "Organizando...",
    organizedUndo: "Mapa organizado. Ctrl+Z desfaz toda a alteração.",
    settings: "Ajustes da organização",
    mapAdjustments: "MAPA",
    contentAdjustments: "CONTEÚDO",
    suggestionAdjustments: "SUGESTÕES",
    newIdea: "Nova ideia",
    delete: "Excluir seleção",
    undo: "Desfazer",
    redo: "Refazer",
    fit: "Enquadrar ideias",
    zoomIn: "Aumentar zoom",
    zoomOut: "Diminuir zoom",
    composer: "Escreva uma ideia...",
    idea: "IDEIA",
    suggestions: "sugestões",
    suggestion: "sugestão",
    relationSuggested: "RELAÇÃO SUGERIDA",
    relationSuggestedAi: "RELAÇÃO SUGERIDA",
    relationConfirmed: "Relação confirmada",
    accept: "Aceitar relação",
    ignore: "Ignorar",
    close: "Fechar",
    ideaState: "Maturidade da ideia",
    editIdea: "Editar ideia",
    save: "Salvar",
    cancel: "Cancelar",
    createConnection: "Criar conexão",
    needsContext: "Precisa de contexto",
    possibleDuplicate: "Possível repetição",
    verifyTension: "Ponto para verificar",
    editToClarify: "Editar para esclarecer",
    dismiss: "Dispensar marcador",
    draft: "Rascunho",
    forming: "Em avaliação",
    decided: "Decidida",
    releasePosition: "Permitir ajustes de posição",
    semanticProximity: "Aproximar ideias relacionadas",
    separateAlternatives: "Separar alternativas concorrentes",
    placeQuestions: "Colocar perguntas perto do contexto",
    highlightTensions: "Destacar possíveis contradições",
    provisionalGroups: "Criar grupos provisórios",
    suggestRelations: "Sugerir relações entre ideias",
    stabilizeMature: "Estabilizar decisões maduras",
    rewriteIdeas: "Aprimorar o texto dos cartões",
    flagIncomplete: "Marcar ideias que precisam de contexto",
    flagDuplicates: "Marcar possíveis repetições",
    missionStructure: "Organizar por áreas da missão",
    semanticZoom: "Resumir áreas ao afastar o zoom",
    provisional: "GRUPO PROVISÓRIO",
    sharedContext: "Contexto compartilhado entre as ideias",
    questionContext: "Pergunta provavelmente ligada a esta ideia",
    competingPaths: "Possíveis caminhos concorrentes",
    possibleTension: "Possível contradição a investigar",
    manualProximity: "A proximidade criada pela equipe sugere uma relação",
    aiChecking: "Preparando organização",
    aiLocal: "Organização local ativa",
    aiIdle: "Organização pronta",
    aiAnalyzing: "Analisando o mapa",
    aiReady: "Organização atualizada",
    aiQuota: "Organização temporariamente limitada",
    aiError: "Organização local disponível",
    aiNotConfigured: "Organização local disponível",
    prompts: [
      "Comece a escrever...",
      "Jogue aqui a primeira ideia...",
      "O que está vindo à cabeça?",
      "Uma frase já basta..."
    ]
  },
  en: {
    automatic: "Automatic organization",
    autoShort: "Auto",
    arrangeMap: "Arrange map",
    structureMission: "Structure mission",
    structureActive: "Structure active",
    enterDomain: "Open area",
    organizeDomain: "Organize this area",
    missingLink: "GAP TO EXPLORE",
    exploreGap: "Explore now",
    decisionSent: "In consolidated system",
    domainIdeas: "ideas",
    organizeWithAi: "Arrange map",
    organizingWithAi: "Organizing...",
    organizedUndo: "Map organized. Ctrl+Z undoes the entire change.",
    settings: "Organization settings",
    mapAdjustments: "MAP",
    contentAdjustments: "CONTENT",
    suggestionAdjustments: "SUGGESTIONS",
    newIdea: "New idea",
    delete: "Delete selection",
    undo: "Undo",
    redo: "Redo",
    fit: "Fit ideas",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    composer: "Write an idea...",
    idea: "IDEA",
    suggestions: "suggestions",
    suggestion: "suggestion",
    relationSuggested: "SUGGESTED RELATION",
    relationSuggestedAi: "SUGGESTED RELATION",
    relationConfirmed: "Confirmed relation",
    accept: "Accept relation",
    ignore: "Ignore",
    close: "Close",
    ideaState: "Idea maturity",
    editIdea: "Edit idea",
    save: "Save",
    cancel: "Cancel",
    createConnection: "Create connection",
    needsContext: "Needs context",
    possibleDuplicate: "Possible duplicate",
    verifyTension: "Point to verify",
    editToClarify: "Edit to clarify",
    dismiss: "Dismiss marker",
    draft: "Draft",
    forming: "In review",
    decided: "Decided",
    releasePosition: "Allow position adjustments",
    semanticProximity: "Bring related ideas closer",
    separateAlternatives: "Separate competing alternatives",
    placeQuestions: "Place questions near their context",
    highlightTensions: "Highlight possible contradictions",
    provisionalGroups: "Create provisional groups",
    suggestRelations: "Suggest relations between ideas",
    stabilizeMature: "Stabilize mature decisions",
    rewriteIdeas: "Improve card wording",
    flagIncomplete: "Flag ideas that need context",
    flagDuplicates: "Flag possible duplicates",
    missionStructure: "Organize by mission areas",
    semanticZoom: "Summarize areas when zooming out",
    provisional: "PROVISIONAL GROUP",
    sharedContext: "Shared context between these ideas",
    questionContext: "Question probably connected to this idea",
    competingPaths: "Possible competing paths",
    possibleTension: "Possible contradiction to investigate",
    manualProximity: "The proximity created by the team suggests a relation",
    aiChecking: "Preparing organization",
    aiLocal: "Local organization active",
    aiIdle: "Organization ready",
    aiAnalyzing: "Analyzing the map",
    aiReady: "Organization updated",
    aiQuota: "Organization temporarily limited",
    aiError: "Local organization available",
    aiNotConfigured: "Local organization available",
    prompts: [
      "Start writing...",
      "Drop the first idea here...",
      "What is coming to mind?",
      "One sentence is enough..."
    ]
  }
} as const;

export function BrainstormLab({ language, project, onBoardChange }: Props) {
  const auth = useAuth();
  const projectId = project.id;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const boardRef = useRef(loadLabBoard(projectId));
  const projectIdRef = useRef(projectId);
  const transformRef = useRef<Transform>({ scale: 0.82, x: 0, y: 0 });
  const dragRef = useRef<DragState>(null);
  const panRef = useRef<PanState>(null);
  const connectionRef = useRef<ConnectionDraft>(null);
  const animationFrameRef = useRef<number | null>(null);
  const aiRequestVersionRef = useRef(0);
  const onBoardChangeRef = useRef(onBoardChange);
  const reportedBoardFingerprintRef = useRef("");
  const skipAutomaticOrganizationUntilRef = useRef(0);
  const historyRef = useRef<LabHistory>({ past: [], future: [] });
  const lastCanvasPointRef = useRef({ x: LAB_WORLD_WIDTH / 2, y: LAB_WORLD_HEIGHT / 2 });
  const [board, setBoard] = useState(boardRef.current);
  const [transform, setTransformState] = useState(transformRef.current);
  const [composer, setComposer] = useState<ComposerState>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<SelectedRelation>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>(null);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  const [organizationSettingsOpen, setOrganizationSettingsOpen] = useState(false);
  const [settingsPosition, setSettingsPosition] = useState({ left: 12, top: 12, width: 350, maxHeight: 520 });
  const [panning, setPanning] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [historyAvailability, setHistoryAvailability] = useState({ canUndo: false, canRedo: false });
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiModel, setAiModel] = useState("gemini-3.5-flash-lite");
  const [aiPhase, setAiPhase] = useState<AiPhase>("checking");
  const [aiAnalysisState, setAiAnalysisState] = useState<AiAnalysisState>(null);
  const [aiOrganizing, setAiOrganizing] = useState(false);
  const [organizationNotice, setOrganizationNotice] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedGapId, setSelectedGapId] = useState<string | null>(null);
  const animatedPrompt = useAnimatedPrompt(copy[language].prompts);
  onBoardChangeRef.current = onBoardChange;

  const missionContext = useMemo(() => buildBrainstormMissionContext(project, teamMembers, language), [language, project, teamMembers]);
  const aiRequest = useMemo(() => createBrainstormAiRequest(board, language, "analyze", missionContext), [board, language, missionContext]);
  const aiFingerprint = useMemo(() => brainstormAiRequestFingerprint(aiRequest), [aiRequest]);
  const activeAiAnalysis = aiAnalysisState?.fingerprint === aiFingerprint ? aiAnalysisState.analysis : null;
  const localSuggestions = useMemo(() => deriveLabSuggestions(board), [board]);
  const suggestions = useMemo(
    () => mergeBrainstormAiSuggestions(localSuggestions, activeAiAnalysis, board),
    [activeAiAnalysis, board, localSuggestions]
  );
  const insights = useMemo(() => {
    const combined = new Map(board.insights.map((insight) => [insight.id, insight]));
    brainstormAiInsights(activeAiAnalysis, language, board.settings).forEach((insight) => combined.set(insight.id, insight));
    return [...combined.values()].filter((insight) => !board.dismissedInsightIds.includes(insight.id));
  }, [activeAiAnalysis, board.dismissedInsightIds, board.insights, board.settings, language]);
  const selectedSuggestion = selectedRelation?.type === "suggestion"
    ? suggestions.find((suggestion) => suggestion.id === selectedRelation.id) ?? null
    : null;
  const selectedInsight = selectedInsightId ? insights.find((insight) => insight.id === selectedInsightId) ?? null : null;
  const domains = useMemo(() => board.settings.missionStructure ? deriveMissionDomains(board, language) : [], [board, language]);
  const selectedGap = selectedGapId ? board.gaps.find((gap) => gap.id === selectedGapId) ?? null : null;
  const hasSelection = selectedNodeId !== null || selectedRelation !== null || selectedInsight !== null || selectedGap !== null;

  function lockSelection() {
    document.body.classList.add("workspace-interacting");
  }

  function unlockSelection() {
    document.body.classList.remove("workspace-interacting");
  }

  function setTransform(next: Transform | ((current: Transform) => Transform)) {
    const value = typeof next === "function" ? next(transformRef.current) : next;
    transformRef.current = value;
    setTransformState(value);
  }

  function setLiveBoard(next: LabBoard) {
    boardRef.current = next;
    setBoard(next);
  }

  function cloneBoard(source: LabBoard): LabBoard {
    return {
      ...source,
      nodes: source.nodes.map((node) => ({ ...node })),
      links: source.links.map((link) => ({ ...link })),
      dismissedSuggestionIds: [...source.dismissedSuggestionIds],
      dismissedInsightIds: [...source.dismissedInsightIds],
      teamMemory: source.teamMemory.map((action) => ({ ...action, nodeIds: [...action.nodeIds] })),
      insights: source.insights.map((insight) => ({ ...insight, nodeIds: [...insight.nodeIds] })),
      gaps: source.gaps.map((gap) => ({ ...gap })),
      settings: { ...source.settings }
    };
  }

  function requestFor(source: LabBoard, intent: "analyze" | "organize" = "analyze", focusDomainId?: LabDomain["id"]) {
    return createBrainstormAiRequest(source, language, intent, missionContext, focusDomainId);
  }

  function setHistory(next: LabHistory) {
    historyRef.current = next;
    setHistoryAvailability({ canUndo: next.past.length > 0, canRedo: next.future.length > 0 });
  }

  function recordHistory(snapshot: LabBoard) {
    setHistory({
      past: [...historyRef.current.past, cloneBoard(snapshot)].slice(-HISTORY_LIMIT),
      future: []
    });
  }

  function cancelAnimation() {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    setOrganizing(false);
  }

  function organizationSuggestionsFor(source: LabBoard): LabSuggestion[] {
    const sourceFingerprint = brainstormAiRequestFingerprint(requestFor(source));
    const matchingAnalysis = aiAnalysisState?.fingerprint === sourceFingerprint ? aiAnalysisState.analysis : null;
    return mergeBrainstormAiSuggestions(deriveLabSuggestions(source), matchingAnalysis, source);
  }

  function animateOrganization(source: LabBoard, focusNodeId?: string, providedSuggestions?: LabSuggestion[]) {
    if (source.settings.missionStructure) {
      animateBoardTransition(source, organizeLabIntoDomains(source, language), 820);
      return;
    }
    const targetNodes = computeGentleLabLayout(source, providedSuggestions ?? organizationSuggestionsFor(source), focusNodeId);
    animateBoardTransition(source, { ...source, nodes: targetNodes }, 760);
  }

  function animateBoardTransition(source: LabBoard, target: LabBoard, duration = 860) {
    cancelAnimation();
    const targetById = new Map(target.nodes.map((node) => [node.id, node]));
    const hasMovement = source.nodes.some((node) => {
      const target = targetById.get(node.id);
      return target && (Math.abs(target.x - node.x) > 0.1 || Math.abs(target.y - node.y) > 0.1);
    });
    if (!hasMovement) {
      setLiveBoard(target);
      return;
    }

    const startedAt = performance.now();
    setOrganizing(true);
    setLiveBoard({ ...target, nodes: source.nodes.map((node) => ({ ...node, text: targetById.get(node.id)?.text ?? node.text })) });

    const tick = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const frame: LabBoard = {
        ...target,
        nodes: source.nodes.map((node) => {
          const target = targetById.get(node.id) ?? node;
          return { ...target, x: node.x + (target.x - node.x) * eased, y: node.y + (target.y - node.y) * eased };
        })
      };
      setLiveBoard(frame);
      if (progress < 1) animationFrameRef.current = requestAnimationFrame(tick);
      else {
        animationFrameRef.current = null;
        setOrganizing(false);
      }
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  }

  function commitBoard(next: LabBoard, options: { organize?: boolean; focusNodeId?: string; record?: boolean; animateTarget?: boolean } = {}) {
    const current = boardRef.current;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    cancelAnimation();
    if (options.record !== false) recordHistory(current);
    if (options.animateTarget) animateBoardTransition(current, next);
    else if (options.organize) animateOrganization(next, options.focusNodeId);
    else setLiveBoard(next);
  }

  function undo() {
    cancelAnimation();
    const history = historyRef.current;
    const previous = history.past.at(-1);
    if (!previous) return;
    const current = cloneBoard(boardRef.current);
    setHistory({ past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, HISTORY_LIMIT) });
    const restored = cloneBoard(previous);
    restored.teamMemory = [...current.teamMemory, createLabAction("undo", "The team undid the latest canvas change.")].slice(-80);
    setLiveBoard(restored);
    setOrganizationNotice(false);
    clearSelection();
    requestAnimationFrame(fitAll);
  }

  function redo() {
    cancelAnimation();
    const history = historyRef.current;
    const next = history.future[0];
    if (!next) return;
    const current = cloneBoard(boardRef.current);
    setHistory({ past: [...history.past, current].slice(-HISTORY_LIMIT), future: history.future.slice(1) });
    const restored = cloneBoard(next);
    restored.teamMemory = [...current.teamMemory, createLabAction("redo", "The team restored the previously undone canvas change.")].slice(-80);
    setLiveBoard(restored);
    clearSelection();
    requestAnimationFrame(fitAll);
  }

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedRelation(null);
    setSelectedInsightId(null);
    setSelectedGapId(null);
    setCardMenuId(null);
  }

  function worldPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect();
    const current = transformRef.current;
    if (!rect) return { x: LAB_WORLD_WIDTH / 2, y: LAB_WORLD_HEIGHT / 2 };
    return { x: (clientX - rect.left - current.x) / current.scale, y: (clientY - rect.top - current.y) / current.scale };
  }

  function visibleCenter(): { x: number; y: number } {
    const viewport = viewportRef.current;
    if (!viewport) return { x: LAB_WORLD_WIDTH / 2, y: LAB_WORLD_HEIGHT / 2 };
    const rect = viewport.getBoundingClientRect();
    return worldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function openComposer(point = lastCanvasPointRef.current, initialText = "", requestedDomainId?: LabNode["domainId"]) {
    const nextPoint = {
      x: clamp(point.x, LAB_NODE_WIDTH / 2 + 28, LAB_WORLD_WIDTH - LAB_NODE_WIDTH / 2 - 28),
      y: clamp(point.y, LAB_NODE_HEIGHT / 2 + 28, LAB_WORLD_HEIGHT - LAB_NODE_HEIGHT / 2 - 28)
    };
    lastCanvasPointRef.current = nextPoint;
    const containingDomain = boardRef.current.settings.missionStructure
      ? deriveMissionDomains(boardRef.current, language).find((domain) => pointInsideDomain(nextPoint, domain))
      : null;
    setComposer({ ...nextPoint, text: initialText, domainId: requestedDomainId ?? containingDomain?.id });
    setCardMenuId(null);
  }

  function addComposerIdea() {
    if (!composer) return;
    const text = composer.text.trim().replace(/\s+/g, " ");
    if (!text) return;
    const node = createLabNode(
      text.slice(0, 220),
      clamp(composer.x - LAB_NODE_WIDTH / 2, 32, LAB_WORLD_WIDTH - LAB_NODE_WIDTH - 32),
      clamp(composer.y - LAB_NODE_HEIGHT / 2, 32, LAB_WORLD_HEIGHT - LAB_NODE_HEIGHT - 32)
    );
    if (boardRef.current.settings.missionStructure) node.domainId = composer.domainId ?? classifyLabDomain(node.text);
    const next = appendLabAction(
      { ...boardRef.current, nodes: [...boardRef.current.nodes, node] },
      createLabAction("created", `The team created the idea: "${node.text}".`, [node.id])
    );
    commitBoard(next, { organize: next.settings.autoOrganize || next.settings.missionStructure, focusNodeId: node.id });
    setSelectedNodeId(node.id);
    setSelectedRelation(null);
    setSelectedInsightId(null);

    const nextX = composer.x + LAB_NODE_WIDTH + 46;
    const wrapped = nextX > LAB_WORLD_WIDTH - LAB_NODE_WIDTH / 2 - 40;
    const nextPoint = {
      x: wrapped ? LAB_NODE_WIDTH / 2 + 60 : nextX,
      y: wrapped ? clamp(composer.y + LAB_NODE_HEIGHT + 52, 80, LAB_WORLD_HEIGHT - 80) : composer.y
    };
    lastCanvasPointRef.current = nextPoint;
    setComposer({ ...nextPoint, text: "", domainId: composer.domainId });
  }

  function deleteSelection() {
    const current = boardRef.current;
    if (selectedGap) {
      commitBoard({
        ...current,
        gaps: current.gaps.filter((gap) => gap.id !== selectedGap.id),
        dismissedInsightIds: [...new Set([...current.dismissedInsightIds, selectedGap.id])]
      });
      clearSelection();
      return;
    }
    if (selectedInsight) {
      dismissInsight(selectedInsight);
      clearSelection();
      return;
    }
    if (selectedNodeId) {
      const selected = current.nodes.find((node) => node.id === selectedNodeId);
      const next = {
        ...current,
        nodes: current.nodes.filter((node) => node.id !== selectedNodeId),
        links: current.links.filter((link) => link.from !== selectedNodeId && link.to !== selectedNodeId),
        insights: current.insights.filter((insight) => !insight.nodeIds.includes(selectedNodeId))
      };
      commitBoard(appendLabAction(next, createLabAction("deleted", `The team deleted the idea: "${selected?.text ?? selectedNodeId}".`, [selectedNodeId])));
      clearSelection();
      return;
    }
    if (!selectedRelation) return;
    if (selectedRelation.type === "confirmed") {
      const link = current.links.find((item) => item.id === selectedRelation.id);
      commitBoard(appendLabAction(
        { ...current, links: current.links.filter((item) => item.id !== selectedRelation.id) },
        createLabAction("connection-deleted", "The team deleted a confirmed connection.", link ? [link.from, link.to] : [])
      ));
    } else if (!current.dismissedSuggestionIds.includes(selectedRelation.id)) {
      commitBoard(appendLabAction(
        { ...current, dismissedSuggestionIds: [...current.dismissedSuggestionIds, selectedRelation.id] },
        createLabAction("suggestion-rejected", `The team rejected the relation suggestion ${selectedRelation.id}.`)
      ));
    }
    clearSelection();
  }

  function acceptSuggestion(suggestion: LabSuggestion) {
    const current = boardRef.current;
    if (current.links.some((link) => relationPairId(link.from, link.to) === suggestion.id)) return;
    const next = appendLabAction(
      { ...current, links: [...current.links, createLabLink(suggestion.from, suggestion.to)] },
      createLabAction(
        "suggestion-accepted",
        `The team accepted a ${suggestion.source ?? "local"} ${suggestion.kind} relation suggestion.`,
        [suggestion.from, suggestion.to]
      )
    );
    commitBoard(next, { organize: next.settings.autoOrganize || next.settings.missionStructure });
    setSelectedRelation(null);
  }

  function ignoreSuggestion(suggestion: LabSuggestion) {
    const current = boardRef.current;
    if (!current.dismissedSuggestionIds.includes(suggestion.id)) {
      commitBoard(appendLabAction(
        { ...current, dismissedSuggestionIds: [...current.dismissedSuggestionIds, suggestion.id] },
        createLabAction(
          "suggestion-rejected",
          `The team rejected a ${suggestion.source ?? "local"} ${suggestion.kind} relation suggestion.`,
          [suggestion.from, suggestion.to]
        )
      ));
    }
    setSelectedRelation(null);
  }

  function updateSetting(key: keyof LabSettings, value: boolean) {
    if (key === "missionStructure") {
      setMissionStructure(value);
      return;
    }
    const current = boardRef.current;
    const next = { ...current, settings: { ...current.settings, [key]: value } };
    setOrganizationNotice(false);
    commitBoard(next, { organize: value && next.settings.autoOrganize });
  }

  function setMissionStructure(enabled: boolean) {
    const current = cloneBoard(boardRef.current);
    if (current.settings.missionStructure === enabled) {
      if (enabled) arrangeMap();
      return;
    }
    const configured = { ...current, settings: { ...current.settings, missionStructure: enabled }, gaps: enabled ? current.gaps : [] };
    const next = enabled
      ? organizeLabIntoDomains(configured, language)
      : configured;
    commitBoard(appendLabAction(
      next,
      createLabAction(
        "ai-organized",
        enabled ? "The team enabled mission-area organization." : "The team returned to the free canvas.",
        current.nodes.map((node) => node.id),
        "team"
      )
    ), { animateTarget: enabled });
    setOrganizationNotice(enabled);
    window.setTimeout(fitAll, enabled ? 900 : 0);
  }

  function focusDomain(domain: LabDomain) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const scale = clamp(Math.min((rect.width - 90) / domain.width, (rect.height - 100) / domain.height), 0.72, 1.12);
    setTransform({
      scale,
      x: rect.width / 2 - (domain.x + domain.width / 2) * scale,
      y: rect.height / 2 - (domain.y + domain.height / 2) * scale
    });
  }

  function organizeDomain(domain: LabDomain) {
    if (aiConfigured === true) {
      void organizeWithAi(domain);
      return;
    }
    const current = cloneBoard(boardRef.current);
    const organized = organizeLabIntoDomains(current, language);
    const domainNodeIds = new Set(domain.nodeIds);
    const targetById = new Map(organized.nodes.map((node) => [node.id, node]));
    const next = appendLabAction({
      ...organized,
      nodes: current.nodes.map((node) => domainNodeIds.has(node.id) ? targetById.get(node.id) ?? node : node)
    }, createLabAction("ai-organized", `The team organized the mission area ${domain.id}.`, domain.nodeIds, "ai"));
    commitBoard(next, { animateTarget: true });
    window.setTimeout(() => focusDomain(domain), 880);
  }

  function exploreGap(gap: LabGap) {
    const point = labGapPoint(gap, boardRef.current, deriveMissionDomains(boardRef.current, language));
    setSelectedGapId(null);
    openComposer(point, "", gap.domainId);
  }

  function dismissGap(gap: LabGap) {
    const current = boardRef.current;
    commitBoard(appendLabAction({
      ...current,
      gaps: current.gaps.filter((item) => item.id !== gap.id),
      dismissedInsightIds: [...new Set([...current.dismissedInsightIds, gap.id])]
    }, createLabAction("suggestion-rejected", `The team dismissed a missing-context prompt in ${gap.domainId}.`, [gap.afterNodeId, gap.beforeNodeId].filter(Boolean))));
    setSelectedGapId(null);
  }

  function updateMaturity(nodeId: string, maturity: LabMaturity) {
    const current = boardRef.current;
    const previous = current.nodes.find((node) => node.id === nodeId)?.maturity ?? "draft";
    commitBoard(appendLabAction(
      { ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, maturity } : node) },
      createLabAction("maturity-changed", `The team changed idea maturity from ${previous} to ${maturity}.`, [nodeId])
    ));
    setCardMenuId(null);
  }

  function releaseNodePosition(nodeId: string) {
    const current = boardRef.current;
    const next = appendLabAction(
      { ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, pinned: false } : node) },
      createLabAction("moved", "The team allowed automatic adjustments to this idea position.", [nodeId])
    );
    commitBoard(next, { organize: next.settings.autoOrganize || next.settings.missionStructure, focusNodeId: nodeId });
    setCardMenuId(null);
  }

  function openEditor(nodeId: string) {
    const node = boardRef.current.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    setEditor({ nodeId, text: node.text });
    setCardMenuId(null);
  }

  function saveEditor() {
    if (!editor) return;
    const text = editor.text.trim().replace(/\s+/g, " ").slice(0, 220);
    const current = boardRef.current;
    const node = current.nodes.find((item) => item.id === editor.nodeId);
    if (!node || !text) return;
    setEditor(null);
    if (text === node.text) return;
    const next = appendLabAction({
      ...current,
      nodes: current.nodes.map((item) => item.id === node.id ? { ...item, text } : item),
      insights: current.insights.filter((insight) => !insight.nodeIds.includes(node.id))
    }, createLabAction("edited", `The team edited an idea from "${node.text}" to "${text}".`, [node.id]));
    commitBoard(next, { organize: next.settings.autoOrganize || next.settings.missionStructure, focusNodeId: node.id });
  }

  function selectInsight(insight: LabInsight) {
    setSelectedInsightId(insight.id);
    setSelectedRelation(null);
    setCardMenuId(null);
    setSelectedGapId(null);
    setSelectedNodeId(insight.nodeIds.length === 1 ? insight.nodeIds[0] : null);
  }

  function dismissInsight(insight: LabInsight) {
    const current = boardRef.current;
    if (current.dismissedInsightIds.includes(insight.id)) return;
    const next = appendLabAction({
      ...current,
      dismissedInsightIds: [...current.dismissedInsightIds, insight.id],
      insights: current.insights.filter((item) => item.id !== insight.id)
    }, createLabAction("suggestion-rejected", `The team dismissed the AI insight: "${insight.title}".`, insight.nodeIds));
    commitBoard(next);
    setSelectedInsightId(null);
  }

  function arrangeLocally(source = cloneBoard(boardRef.current)) {
    let arrangedNodes = source.nodes.map((node) => ({ ...node }));
    let gaps = source.gaps;
    if (source.settings.missionStructure) {
      const structured = organizeLabIntoDomains(source, language);
      arrangedNodes = structured.nodes;
      gaps = structured.gaps;
    } else for (let pass = 0; pass < 6; pass += 1) {
      const working = { ...source, nodes: arrangedNodes };
      arrangedNodes = computeGentleLabLayout(working, organizationSuggestionsFor(working));
    }
    const next = appendLabAction(
      { ...source, nodes: arrangedNodes, gaps },
      createLabAction("ai-organized", "The map was arranged automatically with the available organization engine.", source.nodes.map((node) => node.id), "ai")
    );
    commitBoard(next, { animateTarget: true });
    setOrganizationNotice(true);
    window.setTimeout(fitAll, 920);
  }

  function arrangeMap() {
    if (boardRef.current.nodes.length < 2 || aiOrganizing) return;
    if (aiConfigured === true) {
      void organizeWithAi();
      return;
    }
    arrangeLocally();
  }

  async function organizeWithAi(focusedDomain?: LabDomain) {
    if (aiConfigured !== true || aiOrganizing || boardRef.current.nodes.length < 2) return;
    const source = cloneBoard(boardRef.current);
    const request = requestFor(source, "organize", focusedDomain?.id);
    const requestFingerprint = brainstormAiRequestFingerprint(request);
    const requestVersion = ++aiRequestVersionRef.current;
    setAiOrganizing(true);
    setAiPhase("analyzing");
    setOrganizationNotice(false);

    try {
      const payload = await auth.api<unknown>("/brainstorm-ai/analyze", {
        method: "POST",
        body: JSON.stringify(request)
      });
      if (requestVersion !== aiRequestVersionRef.current) return;
      const currentFingerprint = brainstormAiRequestFingerprint(requestFor(boardRef.current, "organize", focusedDomain?.id));
      if (currentFingerprint !== requestFingerprint) return;

      const returnedModel = analysisModel(payload) ?? aiModel;
      const analysis = normalizeBrainstormAiAnalysis(payload, request, returnedModel);
      const fullOrganization = applyBrainstormAiOrganization(source, analysis, language);
      const organized = focusedDomain ? applyFocusedDomainOrganization(source, fullOrganization, focusedDomain.id) : fullOrganization;
      const rewrittenCount = organized.nodes.filter((node) => source.nodes.find((item) => item.id === node.id)?.text !== node.text).length;
      const next = appendLabAction(
        organized,
        createLabAction(
          "ai-organized",
          `AI organized ${organized.nodes.length} ideas and conservatively rewrote ${rewrittenCount}; the team can undo this action.`,
          organized.nodes.map((node) => node.id),
          "ai"
        )
      );
      skipAutomaticOrganizationUntilRef.current = Date.now() + 4_000;
      setAiModel(returnedModel);
      setAiAnalysisState({
        fingerprint: brainstormAiRequestFingerprint(requestFor(next)),
        analysis
      });
      commitBoard(next, { animateTarget: true });
      setAiPhase("ready");
      setOrganizationNotice(true);
      window.setTimeout(() => focusedDomain ? focusDomain(focusedDomain) : fitAll(), 920);
    } catch (error) {
      setAiPhase(error instanceof ApiError && error.status === 429 ? "quota" : "error");
      arrangeLocally(cloneBoard(boardRef.current));
    } finally {
      setAiOrganizing(false);
    }
  }

  function startConnection(event: React.PointerEvent<HTMLButtonElement>, node: LabNode, side: ConnectionSide) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    lockSelection();
    cancelAnimation();
    aiRequestVersionRef.current += 1;
    const start = connectionPortPoint(node, side);
    const draft: NonNullable<ConnectionDraft> = {
      fromId: node.id,
      pointerId: event.pointerId,
      side,
      startX: start.x,
      startY: start.y,
      x: start.x,
      y: start.y,
      hoverNodeId: null,
      invalid: false
    };
    connectionRef.current = draft;
    setConnectionDraft(draft);
    setSelectedNodeId(node.id);
    setSelectedRelation(null);
    setSelectedInsightId(null);
    setSelectedGapId(null);
    setCardMenuId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startNodeDrag(event: React.PointerEvent<HTMLDivElement>, node: LabNode) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.stopPropagation();
    lockSelection();
    cancelAnimation();
    const point = worldPoint(event.clientX, event.clientY);
    dragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      startX: node.x,
      startY: node.y,
      before: cloneBoard(boardRef.current),
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingNodeId(node.id);
    setSelectedNodeId(node.id);
    setSelectedRelation(null);
    setSelectedInsightId(null);
    setSelectedGapId(null);
    setCardMenuId(null);
  }

  function startCanvasPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".lab-node, .lab-composer, [data-control]")) return;
    event.preventDefault();
    lockSelection();
    const point = worldPoint(event.clientX, event.clientY);
    lastCanvasPointRef.current = point;
    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
    clearSelection();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const connection = connectionRef.current;
    if (connection?.pointerId === event.pointerId) {
      const point = worldPoint(event.clientX, event.clientY);
      const target = nodeAtPoint(boardRef.current.nodes, point);
      const invalid = Boolean(target && (
        target.id === connection.fromId
        || boardRef.current.links.some((link) => relationPairId(link.from, link.to) === relationPairId(connection.fromId, target.id))
      ));
      const sourceNode = boardRef.current.nodes.find((node) => node.id === connection.fromId);
      const end = target && sourceNode && !invalid ? relationEndpoints(sourceNode, target).end : point;
      const next = { ...connection, x: end.x, y: end.y, hoverNodeId: target?.id ?? null, invalid };
      connectionRef.current = next;
      setConnectionDraft(next);
      return;
    }

    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const point = worldPoint(event.clientX, event.clientY);
      const x = clamp(point.x - drag.offsetX, 24, LAB_WORLD_WIDTH - LAB_NODE_WIDTH - 24);
      const y = clamp(point.y - drag.offsetY, 24, LAB_WORLD_HEIGHT - LAB_NODE_HEIGHT - 24);
      drag.moved ||= Math.hypot(x - drag.startX, y - drag.startY) > 3;
      const current = boardRef.current;
      setLiveBoard({
        ...current,
        nodes: current.nodes.map((node) => node.id === drag.id ? { ...node, x, y, pinned: drag.moved || node.pinned } : node)
      });
      return;
    }

    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      const dx = event.clientX - pan.startClientX;
      const dy = event.clientY - pan.startClientY;
      pan.moved ||= Math.hypot(dx, dy) > 3;
      setTransform({ ...transformRef.current, x: pan.originX + dx, y: pan.originY + dy });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const connection = connectionRef.current;
    if (connection?.pointerId === event.pointerId) {
      if (event.type !== "pointercancel" && connection.hoverNodeId && !connection.invalid) {
        const current = boardRef.current;
        const link = createLabLink(connection.fromId, connection.hoverNodeId);
        const next = appendLabAction(
          { ...current, links: [...current.links, link] },
          createLabAction("connection-created", "The team created a connection without an AI suggestion.", [link.from, link.to])
        );
        commitBoard(next, { organize: next.settings.autoOrganize || next.settings.missionStructure });
        setSelectedRelation({ type: "confirmed", id: link.id });
        setSelectedNodeId(null);
      }
      connectionRef.current = null;
      setConnectionDraft(null);
      unlockSelection();
      return;
    }

    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId && drag.moved) {
      let movedBoard = boardRef.current;
      let movedNode = movedBoard.nodes.find((node) => node.id === drag.id);
      if (movedNode && movedBoard.settings.missionStructure) {
        const centerPoint = { x: movedNode.x + LAB_NODE_WIDTH / 2, y: movedNode.y + LAB_NODE_HEIGHT / 2 };
        const droppedDomain = deriveMissionDomains(movedBoard, language).find((domain) => pointInsideDomain(centerPoint, domain));
        if (droppedDomain && droppedDomain.id !== movedNode.domainId) {
          movedBoard = {
            ...movedBoard,
            nodes: movedBoard.nodes.map((node) => node.id === movedNode?.id ? { ...node, domainId: droppedDomain.id, hierarchyParentId: undefined } : node)
          };
          movedNode = movedBoard.nodes.find((node) => node.id === drag.id);
        }
      }
      const next = appendLabAction(
        movedBoard,
        createLabAction(
          "moved",
          `The team manually moved an idea from (${Math.round(drag.startX)}, ${Math.round(drag.startY)}) to (${Math.round(movedNode?.x ?? drag.startX)}, ${Math.round(movedNode?.y ?? drag.startY)}); this position is intentional evidence.`,
          [drag.id]
        )
      );
      setLiveBoard(next);
      recordHistory(drag.before);
    }
    dragRef.current = null;
    panRef.current = null;
    setDraggingNodeId(null);
    setPanning(false);
    unlockSelection();
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".lab-node, .lab-composer, [data-control]")) return;
    event.preventDefault();
    openComposer(worldPoint(event.clientX, event.clientY));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = transformRef.current;
    const nextScale = clamp(current.scale * (event.deltaY < 0 ? 1.08 : 0.92), 0.24, 1.6);
    const worldX = (event.clientX - rect.left - current.x) / current.scale;
    const worldY = (event.clientY - rect.top - current.y) / current.scale;
    setTransform({
      scale: nextScale,
      x: event.clientX - rect.left - worldX * nextScale,
      y: event.clientY - rect.top - worldY * nextScale
    });
  }

  function zoomBy(factor: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const current = transformRef.current;
    const nextScale = clamp(current.scale * factor, 0.24, 1.6);
    const worldX = (rect.width / 2 - current.x) / current.scale;
    const worldY = (rect.height / 2 - current.y) / current.scale;
    setTransform({ scale: nextScale, x: rect.width / 2 - worldX * nextScale, y: rect.height / 2 - worldY * nextScale });
  }

  function fitAll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const currentNodes = boardRef.current.nodes;
    if (currentNodes.length === 0) {
      const scale = 0.82;
      setTransform({ scale, x: rect.width / 2 - LAB_WORLD_WIDTH * scale / 2, y: rect.height / 2 - LAB_WORLD_HEIGHT * scale / 2 });
      return;
    }
    const currentDomains = boardRef.current.settings.missionStructure ? deriveMissionDomains(boardRef.current, language) : [];
    const minX = Math.min(...currentNodes.map((node) => node.x), ...currentDomains.map((domain) => domain.x));
    const minY = Math.min(...currentNodes.map((node) => node.y), ...currentDomains.map((domain) => domain.y));
    const maxX = Math.max(...currentNodes.map((node) => node.x + LAB_NODE_WIDTH), ...currentDomains.map((domain) => domain.x + domain.width));
    const maxY = Math.max(...currentNodes.map((node) => node.y + LAB_NODE_HEIGHT), ...currentDomains.map((domain) => domain.y + domain.height));
    const width = Math.max(420, maxX - minX);
    const height = Math.max(260, maxY - minY);
    const scale = clamp(Math.min((rect.width - 180) / width, (rect.height - 160) / height), 0.28, 1.12);
    setTransform({ scale, x: rect.width / 2 - (minX + width / 2) * scale, y: rect.height / 2 - (minY + height / 2) * scale });
  }

  function positionSettingsPanel() {
    const button = settingsButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const mainRect = button.closest(".brain-main")?.getBoundingClientRect();
    const availableLeft = Math.max(0, mainRect?.left ?? 0);
    const availableRight = Math.min(window.innerWidth, mainRect?.right ?? window.innerWidth);
    const panelWidth = Math.min(350, availableRight - availableLeft - 24);
    setSettingsPosition({
      left: clamp(rect.right - panelWidth, availableLeft + 12, availableRight - panelWidth - 12),
      top: rect.bottom + 8,
      width: panelWidth,
      maxHeight: Math.max(220, window.innerHeight - rect.bottom - 20)
    });
  }

  function toggleOrganizationSettings() {
    if (!organizationSettingsOpen) positionSettingsPanel();
    setOrganizationSettingsOpen((current) => !current);
  }

  useEffect(() => {
    setToolbarTarget(document.getElementById("brainstorm-lab-toolbar"));
    setStatusTarget(document.getElementById("brainstorm-lab-status"));
  }, []);

  useEffect(() => {
    if (projectIdRef.current === projectId) return;
    projectIdRef.current = projectId;
    setRemoteReady(false);
    aiRequestVersionRef.current += 1;
    cancelAnimation();
    setLiveBoard(loadLabBoard(projectId));
    setHistory({ past: [], future: [] });
    clearSelection();
    setComposer(null);
    setEditor(null);
    connectionRef.current = null;
    setConnectionDraft(null);
    setOrganizationNotice(false);
    setOrganizationSettingsOpen(false);
    setAiAnalysisState(null);
    reportedBoardFingerprintRef.current = "";
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setRemoteReady(false);
    const localBoard = loadLabBoard(projectId);
    void auth.api<{ board: LabBoard | null }>(`/workspace/labs/${encodeURIComponent(projectId)}`)
      .then(async ({ board: remoteBoard }) => {
        if (cancelled) return;
        if (remoteBoard?.schemaVersion === 1 && Array.isArray(remoteBoard.nodes) && Array.isArray(remoteBoard.links)) {
          const normalized = normalizeLabBoard(remoteBoard);
          saveLabBoard(projectId, normalized);
          setLiveBoard(normalized);
        } else if (localBoard.nodes.length > 0 || localBoard.links.length > 0) {
          await auth.api(`/workspace/labs/${encodeURIComponent(projectId)}`, { method: "PUT", body: JSON.stringify(localBoard) });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRemoteReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.api, projectId]);

  useEffect(() => {
    let cancelled = false;
    void auth.api<{ members: TeamMember[] }>("/team/members")
      .then(({ members }) => {
        if (!cancelled) setTeamMembers(members);
      })
      .catch(() => {
        if (!cancelled) setTeamMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.api, project.context.teamId]);

  useEffect(() => {
    if (!remoteReady) return;
    const fingerprint = JSON.stringify({
      nodes: board.nodes.map((node) => ({ id: node.id, text: node.text, maturity: node.maturity, domainId: node.domainId })),
      links: board.links.map((link) => ({ id: link.id, from: link.from, to: link.to }))
    });
    if (reportedBoardFingerprintRef.current === fingerprint) return;
    reportedBoardFingerprintRef.current = fingerprint;
    onBoardChangeRef.current(board);
  }, [board, remoteReady]);

  useEffect(() => {
    if (!organizationSettingsOpen) return;
    const reposition = () => positionSettingsPanel();
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(".lab-auto-settings-panel, .lab-auto-settings-button")) return;
      setOrganizationSettingsOpen(false);
    };
    window.addEventListener("resize", reposition);
    document.addEventListener("pointerdown", closeFromOutside);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("pointerdown", closeFromOutside);
    };
  }, [organizationSettingsOpen]);

  useEffect(() => {
    const controller = new AbortController();
    setAiConfigured(null);
    setAiPhase("checking");
    auth.api<{ configured?: unknown; model?: unknown }>("/brainstorm-ai/status", { signal: controller.signal })
      .then((payload) => {
        const configured = payload.configured === true;
        setAiConfigured(configured);
        if (typeof payload.model === "string") setAiModel(payload.model);
        setAiPhase(configured ? "idle" : "local");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setAiConfigured(false);
        setAiPhase(error instanceof Error ? "error" : "local");
      });
    return () => controller.abort();
  }, [auth.api, projectId]);

  useEffect(() => {
    if (aiOrganizing || aiConfigured !== true || !board.settings.autoOrganize || !board.settings.suggestRelations || board.nodes.length < 2) {
      if (aiConfigured === true && board.nodes.length < 2) setAiPhase("idle");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const requestVersion = ++aiRequestVersionRef.current;
      const request = requestFor(boardRef.current);
      const requestFingerprint = brainstormAiRequestFingerprint(request);
      if (requestFingerprint !== aiFingerprint) return;
      setAiPhase("analyzing");

      try {
        const payload = await auth.api<unknown>("/brainstorm-ai/analyze", {
          method: "POST",
          body: JSON.stringify(request),
          signal: controller.signal
        });
        if (requestVersion !== aiRequestVersionRef.current) return;

        const returnedModel = analysisModel(payload) ?? aiModel;
        const analysis = normalizeBrainstormAiAnalysis(payload, request, returnedModel);
        if (controller.signal.aborted) return;
        const current = boardRef.current;
        const currentFingerprint = brainstormAiRequestFingerprint(requestFor(current));
        if (currentFingerprint !== requestFingerprint) return;
        setAiModel(returnedModel);
        setAiAnalysisState({ fingerprint: requestFingerprint, analysis });
        setAiPhase("ready");
        if (current.settings.autoOrganize && Date.now() >= skipAutomaticOrganizationUntilRef.current) {
          const combined = mergeBrainstormAiSuggestions(deriveLabSuggestions(current), analysis, current);
          animateOrganization(current, undefined, combined);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 429) setAiPhase("quota");
        else if (error instanceof ApiError && error.status === 503) {
          setAiConfigured(false);
          setAiPhase("local");
        } else setAiPhase("error");
      }
    }, 900);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [aiConfigured, aiFingerprint, aiOrganizing, auth.api, board.nodes.length, board.settings.autoOrganize, board.settings.suggestRelations, language]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      saveLabBoard(projectId, board);
      if (remoteReady) void auth.api(`/workspace/labs/${encodeURIComponent(projectId)}`, { method: "PUT", body: JSON.stringify(board) }).catch(() => undefined);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [auth.api, board, projectId, remoteReady]);

  useEffect(() => {
    const flush = () => saveLabBoard(projectIdRef.current, boardRef.current);
    const handleVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitAll());
    return () => cancelAnimationFrame(frame);
  }, [projectId]);

  useEffect(() => {
    if (!composer) return;
    const frame = requestAnimationFrame(() => composerInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [composer?.x, composer?.y]);

  useEffect(() => {
    if (selectedRelation?.type === "suggestion" && !suggestions.some((suggestion) => suggestion.id === selectedRelation.id)) {
      setSelectedRelation(null);
    }
  }, [selectedRelation, suggestions]);

  useEffect(() => {
    if (selectedInsightId && !insights.some((insight) => insight.id === selectedInsightId)) setSelectedInsightId(null);
  }, [insights, selectedInsightId]);

  useEffect(() => {
    if (selectedGapId && !board.gaps.some((gap) => gap.id === selectedGapId)) setSelectedGapId(null);
  }, [board.gaps, selectedGapId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const commandKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const editable = isEditableTarget(event.target);

      if (event.key === "Escape" && organizationSettingsOpen) {
        event.preventDefault();
        setOrganizationSettingsOpen(false);
        return;
      }
      if (commandKey && !event.altKey && !event.shiftKey && key === "n") {
        event.preventDefault();
        openComposer(lastCanvasPointRef.current ?? visibleCenter());
        return;
      }
      if (editable) return;
      if (commandKey && !event.altKey && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (commandKey && !event.altKey && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (!commandKey && !event.altKey && hasSelection && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (!commandKey && !event.altKey && !event.isComposing && event.key.length === 1 && !(event.target as HTMLElement | null)?.closest("button")) {
        event.preventDefault();
        openComposer(lastCanvasPointRef.current ?? visibleCenter(), event.key);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    document.body.classList.remove("workspace-interacting");
  }, []);

  useEffect(() => {
    if (!organizationNotice) return;
    const timeout = window.setTimeout(() => setOrganizationNotice(false), 5200);
    return () => window.clearTimeout(timeout);
  }, [organizationNotice]);

  const relationReason = selectedSuggestion ? reasonLabel(language, selectedSuggestion) : "";
  const aiStatusLabel = aiPhaseLabel(language, aiPhase);
  const assistantStatusLabel = organizationNotice ? copy[language].organizedUndo : aiStatusLabel;

  return (
    <div className="brainstorm-lab">
      {toolbarTarget && createPortal(
        <>
          <button disabled={board.nodes.length < 2 || aiOrganizing || organizing} onClick={arrangeMap}>
            {aiOrganizing || organizing ? copy[language].organizingWithAi : copy[language].arrangeMap}
          </button>
          <button
            className={`lab-structure-button${board.settings.missionStructure ? " active" : ""}`}
            aria-pressed={board.settings.missionStructure}
            title={board.settings.missionStructure ? copy[language].structureActive : copy[language].structureMission}
            disabled={board.nodes.length === 0 || aiOrganizing || organizing}
            onClick={() => setMissionStructure(!board.settings.missionStructure)}
          ><LayoutDashboard aria-hidden="true" />{copy[language].structureMission}</button>
          <button
            className="primary shortcut-button"
            data-shortcut="Ctrl+N"
            title={`${copy[language].newIdea} (Ctrl+N)`}
            onClick={() => openComposer()}
          >{copy[language].newIdea}</button>
          <button
            className="danger shortcut-button"
            data-shortcut="Delete / Backspace"
            title={`${copy[language].delete} (Delete / Backspace)`}
            disabled={!hasSelection}
            onClick={deleteSelection}
          >{copy[language].delete}</button>
          <button
            className={`lab-auto-toolbar-button${board.settings.autoOrganize ? " active" : ""}`}
            aria-label={copy[language].automatic}
            aria-pressed={board.settings.autoOrganize}
            title={copy[language].automatic}
            onClick={() => updateSetting("autoOrganize", !board.settings.autoOrganize)}
          ><i aria-hidden="true" />{copy[language].autoShort}</button>
          <button
            ref={settingsButtonRef}
            className={`lab-auto-settings-button${organizationSettingsOpen ? " active" : ""}`}
            aria-label={copy[language].settings}
            aria-expanded={organizationSettingsOpen}
            aria-controls="lab-auto-settings-panel"
            title={copy[language].settings}
            onClick={toggleOrganizationSettings}
          ><span className="lab-sliders-icon" aria-hidden="true"><i /><i /><i /></span></button>
        </>,
        toolbarTarget
      )}

      {organizationSettingsOpen && createPortal(
        <div
          id="lab-auto-settings-panel"
          className="lab-auto-settings-panel"
          style={{ left: settingsPosition.left, top: settingsPosition.top, width: settingsPosition.width, maxHeight: settingsPosition.maxHeight }}
        >
          <div className="lab-auto-settings-heading">
            <strong>{copy[language].settings}</strong>
            <button aria-label={copy[language].close} title={copy[language].close} onClick={() => setOrganizationSettingsOpen(false)}>×</button>
          </div>
          {organizationSettingSections(language).map((section) => (
            <section key={section.label}>
              <div className="lab-auto-settings-section">{section.label}</div>
              {section.settings.map(({ key, label }) => (
                <label key={key} className="lab-setting-row">
                  <span>{label}</span>
                  <input type="checkbox" checked={board.settings[key]} onChange={(event) => updateSetting(key, event.target.checked)} />
                  <i aria-hidden="true" />
                </label>
              ))}
            </section>
          ))}
        </div>,
        document.body
      )}

      {statusTarget && createPortal(
        <span className={`lab-page-assistant-status ${aiPhase}${organizationNotice ? " notice" : ""}`} role="status" title={assistantStatusLabel}>
          <i aria-hidden="true" />
          <span>{assistantStatusLabel}</span>
          {suggestions.length > 0 && <em>{suggestions.length} {suggestions.length === 1 ? copy[language].suggestion : copy[language].suggestions}</em>}
        </span>,
        statusTarget
      )}

      <div
        ref={viewportRef}
        className={`lab-canvas${panning ? " panning" : ""}${board.settings.missionStructure ? " structured" : ""}${board.settings.missionStructure && board.settings.semanticZoom && transform.scale < 0.56 ? " semantic-overview" : ""}`}
        onPointerDown={startCanvasPan}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        {board.nodes.length === 0 && !composer && (
          <button className="lab-empty-prompt" data-control onClick={() => openComposer()} aria-label={copy[language].newIdea}>
            <span className="lab-empty-plus" aria-hidden="true">+</span>
            <strong>{animatedPrompt}<i aria-hidden="true" /></strong>
          </button>
        )}

        <div className="lab-world" style={{ width: LAB_WORLD_WIDTH, height: LAB_WORLD_HEIGHT, transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
          {domains.map((domain) => (
            <section
              className={`lab-domain domain-${domain.id}`}
              style={{ left: domain.x, top: domain.y, width: domain.width, height: domain.height }}
              data-domain-id={domain.id}
              key={domain.id}
            >
              <header>
                <span><small>{language === "pt" ? "ÁREA DA MISSÃO" : "MISSION AREA"}</small><strong>{domain.label}</strong></span>
                <em>{domain.nodeIds.length} {copy[language].domainIdeas}</em>
                <div data-control>
                  <button type="button" title={copy[language].enterDomain} aria-label={`${copy[language].enterDomain}: ${domain.label}`} onClick={() => focusDomain(domain)}><Maximize2 aria-hidden="true" /></button>
                  <button type="button" title={copy[language].organizeDomain} aria-label={`${copy[language].organizeDomain}: ${domain.label}`} onClick={() => organizeDomain(domain)}><Focus aria-hidden="true" /></button>
                </div>
              </header>
            </section>
          ))}
          <svg className="lab-relations" width={LAB_WORLD_WIDTH} height={LAB_WORLD_HEIGHT} aria-hidden="true">
            <defs>
              <marker id="lab-arrow-confirmed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#8bc9fa" strokeWidth="1.5" />
              </marker>
              <marker id="lab-arrow-suggested" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#aaa3ff" strokeWidth="1.4" />
              </marker>
              <marker id="lab-arrow-invalid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#ef7f8d" strokeWidth="1.5" />
              </marker>
            </defs>
            {insights.filter((insight) => insight.kind === "tension" && insight.nodeIds.length >= 2).map((insight) => {
              const first = board.nodes.find((node) => node.id === insight.nodeIds[0]);
              const second = board.nodes.find((node) => node.id === insight.nodeIds[1]);
              if (!first || !second) return null;
              const path = relationPath(first, second);
              const point = relationMidpoint(first, second);
              const selected = selectedInsightId === insight.id;
              return (
                <g key={insight.id} className={`lab-tension-insight${selected ? " selected" : ""}`}>
                  <path d={path} />
                  <circle className="marker" cx={point.x} cy={point.y} r="10" />
                  <text x={point.x} y={point.y + 3.5}>?</text>
                  <circle className="hit" cx={point.x} cy={point.y} r="19" onPointerDown={(event) => { event.stopPropagation(); selectInsight(insight); }} />
                </g>
              );
            })}
            {!board.settings.missionStructure && suggestions.map((suggestion) => {
              const from = board.nodes.find((node) => node.id === suggestion.from);
              const to = board.nodes.find((node) => node.id === suggestion.to);
              if (!from || !to) return null;
              const path = relationPath(from, to);
              const selected = selectedRelation?.type === "suggestion" && selectedRelation.id === suggestion.id;
              return (
                <g key={suggestion.id} className={`lab-relation-group suggestion ${suggestion.kind}${suggestion.source === "gemini" ? " ai" : ""}${selected ? " selected" : ""}`}>
                  <path className="lab-relation-visible" d={path} markerEnd="url(#lab-arrow-suggested)" />
                  <path className="lab-relation-hit" d={path} onPointerDown={(event) => { event.stopPropagation(); setSelectedRelation({ type: "suggestion", id: suggestion.id }); setSelectedNodeId(null); setSelectedInsightId(null); setSelectedGapId(null); setCardMenuId(null); }} />
                </g>
              );
            })}
            {board.links.map((link) => {
              const from = board.nodes.find((node) => node.id === link.from);
              const to = board.nodes.find((node) => node.id === link.to);
              if (!from || !to) return null;
              const path = relationPath(from, to);
              const selected = selectedRelation?.type === "confirmed" && selectedRelation.id === link.id;
              return (
                <g key={link.id} className={`lab-relation-group confirmed${selected ? " selected" : ""}`}>
                  <path className="lab-relation-visible" d={path} markerEnd="url(#lab-arrow-confirmed)" />
                  <path className="lab-relation-hit" d={path} onPointerDown={(event) => { event.stopPropagation(); setSelectedRelation({ type: "confirmed", id: link.id }); setSelectedNodeId(null); setSelectedInsightId(null); setSelectedGapId(null); setCardMenuId(null); }} />
                </g>
              );
            })}
            {connectionDraft && (
              <path
                className={`lab-connection-preview${connectionDraft.invalid ? " invalid" : ""}`}
                d={connectionPreviewPath(connectionDraft)}
                markerEnd={connectionDraft.invalid ? "url(#lab-arrow-invalid)" : "url(#lab-arrow-confirmed)"}
              />
            )}
          </svg>

          {board.settings.missionStructure && board.gaps.map((gap) => {
            const point = labGapPoint(gap, board, domains);
            return <button
              type="button"
              className={`lab-gap${selectedGapId === gap.id ? " selected" : ""}`}
              style={{ left: point.x, top: point.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => { setSelectedGapId(gap.id); setSelectedNodeId(null); setSelectedRelation(null); setSelectedInsightId(null); setCardMenuId(null); }}
              key={gap.id}
            ><span>{copy[language].missingLink}</span><strong>{gap.prompt}</strong></button>;
          })}

          {board.nodes.map((node) => {
            const nodeInsight = insights.find((insight) => insight.nodeIds.includes(node.id) && insight.kind !== "tension");
            const nodeSuggestion = board.settings.missionStructure ? suggestions.find((suggestion) => suggestion.from === node.id || suggestion.to === node.id) : null;
            const connectionTarget = connectionDraft?.hoverNodeId === node.id;
            const stateClass = node.maturity === "decided" ? "defined" : node.maturity === "forming" ? "hypothesis" : "open";
            return (
              <div
                key={node.id}
                className={`lab-node mission-node ${stateClass} maturity-${node.maturity}${node.pinned ? " pinned" : ""}${selectedNodeId === node.id ? " selected" : ""}${draggingNodeId === node.id ? " dragging" : ""}${connectionTarget ? connectionDraft.invalid ? " connection-invalid" : " connection-target" : ""}`}
                style={{ left: node.x, top: node.y, width: LAB_NODE_WIDTH, height: LAB_NODE_HEIGHT }}
                onPointerDown={(event) => startNodeDrag(event, node)}
                onDoubleClick={(event) => { event.stopPropagation(); openEditor(node.id); }}
              >
                <div className="lab-node-head mission-node-head">
                  <span>{copy[language].idea}</span>
                  <button aria-label={copy[language].ideaState} title={copy[language].ideaState} onPointerDown={(event) => event.stopPropagation()} onClick={() => setCardMenuId((current) => current === node.id ? null : node.id)}>⋯</button>
                </div>
                <div className="lab-node-text mission-node-title">{node.text}</div>
                <div className="lab-node-state mission-node-state"><i />{copy[language][node.maturity]}</div>
                {node.maturity === "decided" && <span className="lab-decision-sync">{copy[language].decisionSent}</span>}
                {nodeInsight && (
                  <button
                    className={`lab-node-insight ${nodeInsight.kind}`}
                    aria-label={nodeInsight.title}
                    title={nodeInsight.title}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => selectInsight(nodeInsight)}
                  >{nodeInsight.kind === "duplicate" ? "=" : "?"}</button>
                )}
                {nodeSuggestion && (
                  <button
                    className={`lab-node-suggestion ${nodeSuggestion.kind}`}
                    aria-label={copy[language].relationSuggested}
                    title={copy[language].relationSuggested}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => { setSelectedRelation({ type: "suggestion", id: nodeSuggestion.id }); setSelectedNodeId(null); setSelectedInsightId(null); setSelectedGapId(null); setCardMenuId(null); }}
                  >↗</button>
                )}
                {selectedNodeId === node.id && !connectionDraft && (["top", "right", "bottom", "left"] as ConnectionSide[]).map((side) => (
                  <button
                    key={side}
                    className={`lab-connection-port ${side}`}
                    aria-label={copy[language].createConnection}
                    title={copy[language].createConnection}
                    onPointerDown={(event) => startConnection(event, node, side)}
                  ><span className="lab-plus-icon" aria-hidden="true" /></button>
                ))}
                {cardMenuId === node.id && (
                  <div className="lab-card-menu" data-control onPointerDown={(event) => event.stopPropagation()}>
                    <button className="edit" onClick={() => openEditor(node.id)}>{copy[language].editIdea}</button>
                    <div>{copy[language].ideaState}</div>
                    {(["draft", "forming", "decided"] as LabMaturity[]).map((maturity) => (
                      <button key={maturity} className={node.maturity === maturity ? "active" : ""} onClick={() => updateMaturity(node.id, maturity)}>{copy[language][maturity]}</button>
                    ))}
                    {node.pinned && <button className="release" onClick={() => releaseNodePosition(node.id)}>{copy[language].releasePosition}</button>}
                  </div>
                )}
              </div>
            );
          })}

          {composer && (
            <div className="lab-composer" data-control style={{ left: composer.x - LAB_NODE_WIDTH / 2, top: composer.y - LAB_NODE_HEIGHT / 2, width: LAB_NODE_WIDTH, minHeight: LAB_NODE_HEIGHT }}>
              <textarea
                ref={composerInputRef}
                rows={2}
                maxLength={220}
                value={composer.text}
                placeholder={copy[language].composer}
                onChange={(event) => setComposer({ ...composer, text: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setComposer(null);
                  } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addComposerIdea();
                  }
                }}
              />
              <button aria-label={copy[language].newIdea} title="Enter" onPointerDown={(event) => event.preventDefault()} onClick={addComposerIdea}><span className="lab-plus-icon" aria-hidden="true" /></button>
            </div>
          )}
        </div>

        {editor && (
          <div className="lab-edit-dialog" data-control onPointerDown={(event) => event.stopPropagation()}>
            <div className="lab-edit-heading">{copy[language].editIdea}</div>
            <textarea
              autoFocus
              rows={4}
              maxLength={220}
              value={editor.text}
              onChange={(event) => setEditor({ ...editor, text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditor(null);
                } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  saveEditor();
                }
              }}
            />
            <div className="lab-edit-actions">
              <button onClick={() => setEditor(null)}>{copy[language].cancel}</button>
              <button className="primary" disabled={!editor.text.trim()} onClick={saveEditor}>{copy[language].save}</button>
            </div>
          </div>
        )}

        {selectedSuggestion && (
          <div className={`lab-relation-review ${selectedSuggestion.kind}`} data-control>
            <div><span>{selectedSuggestion.source === "gemini" ? copy[language].relationSuggestedAi : copy[language].relationSuggested}</span><strong>{relationReason}</strong></div>
            <button onClick={() => ignoreSuggestion(selectedSuggestion)}>{copy[language].ignore}</button>
            <button className="primary" onClick={() => acceptSuggestion(selectedSuggestion)}>{copy[language].accept}</button>
            <button className="icon" aria-label={copy[language].close} title={copy[language].close} onClick={() => setSelectedRelation(null)}>×</button>
          </div>
        )}

        {selectedRelation?.type === "confirmed" && (
          <div className="lab-confirmed-label" data-control><i /><span>{copy[language].relationConfirmed}</span></div>
        )}

        {selectedInsight && (
          <div className={`lab-insight-review ${selectedInsight.kind}`} data-control>
            <div className="lab-insight-copy">
              <span>{selectedInsight.kind === "needs-context" ? copy[language].needsContext : selectedInsight.kind === "duplicate" ? copy[language].possibleDuplicate : copy[language].verifyTension}</span>
              <strong>{selectedInsight.title}</strong>
              <p>{selectedInsight.detail}</p>
              <em>{selectedInsight.question}</em>
            </div>
            {selectedInsight.nodeIds[0] && <button onClick={() => openEditor(selectedInsight.nodeIds[0])}>{copy[language].editToClarify}</button>}
            <button onClick={() => dismissInsight(selectedInsight)}>{copy[language].dismiss}</button>
            <button className="icon" aria-label={copy[language].close} title={copy[language].close} onClick={() => setSelectedInsightId(null)}>×</button>
          </div>
        )}

        {selectedGap && (
          <div className="lab-insight-review lab-gap-review" data-control>
            <div className="lab-insight-copy">
              <span>{copy[language].missingLink}</span>
              <strong>{selectedGap.prompt}</strong>
            </div>
            <button onClick={() => exploreGap(selectedGap)}>{copy[language].exploreGap}</button>
            <button onClick={() => dismissGap(selectedGap)}>{copy[language].dismiss}</button>
            <button className="icon" aria-label={copy[language].close} title={copy[language].close} onClick={() => setSelectedGapId(null)}>×</button>
          </div>
        )}

        <div className="zoom-toolbar lab-zoom-strip" data-control>
          <button aria-label={copy[language].undo} title={`${copy[language].undo} (Ctrl+Z)`} disabled={!historyAvailability.canUndo} onClick={undo}>↶</button>
          <button aria-label={copy[language].redo} title={`${copy[language].redo} (Ctrl+Shift+Z)`} disabled={!historyAvailability.canRedo} onClick={redo}>↷</button>
          <i className="toolbar-divider" />
          <button aria-label={copy[language].zoomOut} title={copy[language].zoomOut} onClick={() => zoomBy(0.9)}>−</button>
          <span className="zoom-value">{Math.round(transform.scale * 100)}%</span>
          <button aria-label={copy[language].zoomIn} title={copy[language].zoomIn} onClick={() => zoomBy(1.1)}>+</button>
          <button aria-label={copy[language].fit} title={copy[language].fit} onClick={fitAll}>⌂</button>
        </div>
      </div>
    </div>
  );
}

function useAnimatedPrompt(phrases: readonly string[]): string {
  const [text, setText] = useState("");

  useEffect(() => {
    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timeout = 0;

    const tick = () => {
      const phrase = phrases[phraseIndex];
      if (!deleting) {
        characterIndex += 1;
        setText(phrase.slice(0, characterIndex));
        if (characterIndex >= phrase.length) {
          deleting = true;
          timeout = window.setTimeout(tick, 1150);
          return;
        }
        timeout = window.setTimeout(tick, 58);
        return;
      }

      characterIndex -= 1;
      setText(phrase.slice(0, Math.max(0, characterIndex)));
      if (characterIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        timeout = window.setTimeout(tick, 260);
        return;
      }
      timeout = window.setTimeout(tick, 30);
    };

    timeout = window.setTimeout(tick, 240);
    return () => window.clearTimeout(timeout);
  }, [phrases]);

  return text;
}

function organizationSettingSections(language: Language): Array<{
  label: string;
  settings: Array<{ key: AdjustableSetting; label: string }>;
}> {
  return [
    {
      label: copy[language].mapAdjustments,
      settings: [
        { key: "missionStructure", label: copy[language].missionStructure },
        { key: "semanticZoom", label: copy[language].semanticZoom },
        { key: "semanticProximity", label: copy[language].semanticProximity },
        { key: "separateAlternatives", label: copy[language].separateAlternatives },
        { key: "placeQuestions", label: copy[language].placeQuestions },
        { key: "stabilizeMature", label: copy[language].stabilizeMature }
      ]
    },
    {
      label: copy[language].contentAdjustments,
      settings: [
        { key: "rewriteIdeas", label: copy[language].rewriteIdeas },
        { key: "flagIncomplete", label: copy[language].flagIncomplete },
        { key: "flagDuplicates", label: copy[language].flagDuplicates }
      ]
    },
    {
      label: copy[language].suggestionAdjustments,
      settings: [
        { key: "suggestRelations", label: copy[language].suggestRelations },
        { key: "highlightTensions", label: copy[language].highlightTensions }
      ]
    }
  ];
}

function relationPath(from: LabNode, to: LabNode): string {
  const { start, end, axis, direction } = relationEndpoints(from, to);
  if (axis === "horizontal") {
    const curve = Math.max(52, Math.abs(end.x - start.x) * 0.5);
    return `M ${start.x} ${start.y} C ${start.x + direction * curve} ${start.y}, ${end.x - direction * curve} ${end.y}, ${end.x} ${end.y}`;
  }
  const curve = Math.max(48, Math.abs(end.y - start.y) * 0.5);
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * curve}, ${end.x} ${end.y - direction * curve}, ${end.x} ${end.y}`;
}

function relationEndpoints(from: LabNode, to: LabNode): {
  start: { x: number; y: number };
  end: { x: number; y: number };
  axis: "horizontal" | "vertical";
  direction: number;
} {
  const fromCenter = { x: from.x + LAB_NODE_WIDTH / 2, y: from.y + LAB_NODE_HEIGHT / 2 };
  const toCenter = { x: to.x + LAB_NODE_WIDTH / 2, y: to.y + LAB_NODE_HEIGHT / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    const direction = dx >= 0 ? 1 : -1;
    const start = { x: fromCenter.x + direction * LAB_NODE_WIDTH / 2, y: fromCenter.y };
    const end = { x: toCenter.x - direction * LAB_NODE_WIDTH / 2, y: toCenter.y };
    return { start, end, axis: "horizontal", direction };
  }
  const direction = dy >= 0 ? 1 : -1;
  const start = { x: fromCenter.x, y: fromCenter.y + direction * LAB_NODE_HEIGHT / 2 };
  const end = { x: toCenter.x, y: toCenter.y - direction * LAB_NODE_HEIGHT / 2 };
  return { start, end, axis: "vertical", direction };
}

function connectionPortPoint(node: LabNode, side: ConnectionSide): { x: number; y: number } {
  if (side === "top") return { x: node.x + LAB_NODE_WIDTH / 2, y: node.y };
  if (side === "right") return { x: node.x + LAB_NODE_WIDTH, y: node.y + LAB_NODE_HEIGHT / 2 };
  if (side === "bottom") return { x: node.x + LAB_NODE_WIDTH / 2, y: node.y + LAB_NODE_HEIGHT };
  return { x: node.x, y: node.y + LAB_NODE_HEIGHT / 2 };
}

function connectionPreviewPath(draft: NonNullable<ConnectionDraft>): string {
  const vertical = draft.side === "top" || draft.side === "bottom";
  const direction = draft.side === "top" || draft.side === "left" ? -1 : 1;
  if (vertical) {
    const curve = Math.max(54, Math.abs(draft.y - draft.startY) * 0.42);
    return `M ${draft.startX} ${draft.startY} C ${draft.startX} ${draft.startY + direction * curve}, ${draft.x} ${draft.y - direction * curve * 0.55}, ${draft.x} ${draft.y}`;
  }
  const curve = Math.max(54, Math.abs(draft.x - draft.startX) * 0.42);
  return `M ${draft.startX} ${draft.startY} C ${draft.startX + direction * curve} ${draft.startY}, ${draft.x - direction * curve * 0.55} ${draft.y}, ${draft.x} ${draft.y}`;
}

function nodeAtPoint(nodes: LabNode[], point: { x: number; y: number }): LabNode | null {
  return [...nodes].reverse().find((node) => (
    point.x >= node.x - 12
    && point.x <= node.x + LAB_NODE_WIDTH + 12
    && point.y >= node.y - 12
    && point.y <= node.y + LAB_NODE_HEIGHT + 12
  )) ?? null;
}

function relationMidpoint(first: LabNode, second: LabNode): { x: number; y: number } {
  return {
    x: (first.x + second.x + LAB_NODE_WIDTH) / 2,
    y: (first.y + second.y + LAB_NODE_HEIGHT) / 2
  };
}

function reasonLabel(language: Language, suggestion: LabSuggestion): string {
  if (suggestion.explanation) return suggestion.explanation;
  if (suggestion.reason === "question-context") return copy[language].questionContext;
  if (suggestion.reason === "competing-paths") return copy[language].competingPaths;
  if (suggestion.reason === "possible-tension") return copy[language].possibleTension;
  if (suggestion.reason === "manual-proximity") return copy[language].manualProximity;
  return copy[language].sharedContext;
}

function aiPhaseLabel(language: Language, phase: AiPhase): string {
  if (phase === "checking") return copy[language].aiChecking;
  if (phase === "local") return copy[language].aiLocal;
  if (phase === "analyzing") return copy[language].aiAnalyzing;
  if (phase === "ready") return copy[language].aiReady;
  if (phase === "quota") return copy[language].aiQuota;
  if (phase === "error") return copy[language].aiError;
  return copy[language].aiIdle;
}

function analysisModel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("model" in payload)) return null;
  return typeof payload.model === "string" ? payload.model : null;
}

function relationPairId(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join("::");
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function pointInsideDomain(point: { x: number; y: number }, domain: LabDomain): boolean {
  return point.x >= domain.x && point.x <= domain.x + domain.width && point.y >= domain.y && point.y <= domain.y + domain.height;
}

function applyFocusedDomainOrganization(source: LabBoard, organized: LabBoard, domainId: LabDomain["id"]): LabBoard {
  const organizedById = new Map(organized.nodes.map((node) => [node.id, node]));
  const focusedNodeIds = new Set(organized.nodes.filter((node) => node.domainId === domainId).map((node) => node.id));
  return {
    ...organized,
    nodes: source.nodes.map((node) => focusedNodeIds.has(node.id) ? organizedById.get(node.id) ?? node : node),
    gaps: [
      ...source.gaps.filter((gap) => gap.domainId !== domainId),
      ...organized.gaps.filter((gap) => gap.domainId === domainId)
    ]
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
