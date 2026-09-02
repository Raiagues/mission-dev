import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Lightbulb, Network } from "lucide-react";
import { Brand } from "../components/Brand";
import { ConceptionTimeline } from "../components/ConceptionTimeline";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { BrainstormLab } from "./BrainstormLab";
import { loadLabBoard } from "../lib/brainstormLab";
import type { LabBoard } from "../lib/brainstormLab";
import { boardsEqual, cloneBoardSnapshot, createBoardHistory, recordBoardSnapshot, redoBoardChange, undoBoardChange } from "../lib/boardHistory";
import type { BoardSnapshot } from "../lib/boardHistory";
import { syncDecisionsToMissionBoard } from "../lib/conceptionSync";
import { countWords, layoutTopDown, limitWords, MAX_CARD_WORDS, orderLinksTopDown } from "../lib/missionModel";
import type { MissionProject } from "../lib/projectStore";
import type { Language, MissionLink, MissionNode, NodeState } from "../lib/types";
import { ux } from "../lib/uxCopy";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onProjectChange: (project: MissionProject) => void;
  onHome: () => void;
  onBackSetup: () => void;
};

type Transform = { scale: number; x: number; y: number };
type NodeMenu = { id: number; x: number; y: number } | null;
type DragState = { id: number; pointerId: number; offsetX: number; offsetY: number; startX: number; startY: number; before: BoardSnapshot } | null;
type PanState = { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null;
type SelectionBoxState = { pointerId: number; startX: number; startY: number; x: number; y: number; additive: boolean } | null;
type AnchorSide = "top" | "right" | "bottom" | "left";
type LinkRole = "source" | "destination";
type InvalidConnectionReason = "same-node" | "duplicate";
type NewConnectionAnchor = { nodeId: number; side: AnchorSide; x: number; y: number };
type ConnectionState = {
  from: number;
  pointerId: number;
  startSide: AnchorSide;
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetNodeId: number | null;
  hoveredNodeId: number | null;
  targetSide: AnchorSide | null;
  sourceOrder: number | null;
  targetOrder: number | null;
  invalidReason: InvalidConnectionReason | null;
} | null;
type ActivePortDrag = { linkId: number; nodeId: number; role: LinkRole; pointerId: number; initialSide: AnchorSide; initialOrder: number };
type PortDragState = ActivePortDrag | null;
type PortDragPreview = (ActivePortDrag & {
  x: number;
  y: number;
  targetNodeId: number | null;
  hoveredNodeId: number | null;
  targetSide: AnchorSide | null;
  targetOrder: number | null;
  invalidReason: InvalidConnectionReason | null;
}) | null;
type NodePort = { key: string; linkId: number | null; role: LinkRole | "new"; side: AnchorSide; x: number; y: number; connected: boolean };
type LinkEndpoint = { link: MissionLink; role: LinkRole; otherNode: MissionNode };
type PortInsertion = { linkId: number; role: LinkRole; side: AnchorSide; index: number };
type UpdateBoardOptions = { recordHistory?: boolean };
type WorkspaceMode = "timeline" | "lab" | "map";

const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 1600;
const NODE_HEIGHT = 158;
const DRAG_MARGIN = 520;
const DRAFT_LINK_ID = -1;
const NEW_CONNECTION_GAP = 24;

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function BrainstormPage({ language, project, t, onLanguageChange, onProjectChange, onHome, onBackSetup }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const panRef = useRef<PanState>(null);
  const selectionBoxRef = useRef<SelectionBoxState>(null);
  const connectionRef = useRef<ConnectionState>(null);
  const portDragRef = useRef<PortDragState>(null);
  const projectRef = useRef(project);
  const boardHistoryRef = useRef(createBoardHistory());
  const historyProjectIdRef = useRef(project.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested === "timeline") return "timeline";
    if (requested === "system" || requested === "map") return "map";
    return "lab";
  });
  const [labSummary, setLabSummary] = useState(() => {
    const lab = loadLabBoard(project.id);
    return { ideas: lab.nodes.length, decisions: lab.nodes.filter((node) => node.maturity === "decided").length };
  });
  const [transform, setTransform] = useState<Transform>({ scale: 0.72, x: -80, y: -35 });
  const [panning, setPanning] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<number>>(() => new Set());
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState>(null);
  const [historyAvailability, setHistoryAvailability] = useState({ canUndo: false, canRedo: false });
  const [nodeMenu, setNodeMenu] = useState<NodeMenu>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionState>(null);
  const [portDragPreview, setPortDragPreview] = useState<PortDragPreview>(null);
  const [newConnectionAnchor, setNewConnectionAnchor] = useState<NewConnectionAnchor | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [cardText, setCardText] = useState("");

  projectRef.current = project;

  const nodes = project.board.nodes;
  const links = project.board.links;
  const visibleNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const portPreviewLinks = linksForPortPreview(links, portDragPreview);
  const displayLinks = linksForConnectionPreview(portPreviewLinks, connectionDraft);
  const singleSelectedNodeId = selectedNodeIds.size === 1 ? selectedNodeIds.values().next().value ?? null : null;
  const hasBoardSelection = selectedLinkId !== null || selectedNodeIds.size > 0;

  function setBoardHistory(nextHistory: ReturnType<typeof createBoardHistory>) {
    boardHistoryRef.current = nextHistory;
    setHistoryAvailability({ canUndo: nextHistory.past.length > 0, canRedo: nextHistory.future.length > 0 });
  }

  useEffect(() => {
    if (historyProjectIdRef.current === project.id) return;
    historyProjectIdRef.current = project.id;
    setBoardHistory(createBoardHistory());
    const lab = loadLabBoard(project.id);
    setLabSummary({ ideas: lab.nodes.length, decisions: lab.nodes.filter((node) => node.maturity === "decided").length });
    clearBoardSelection();
  }, [project.id]);

  function updateProject(patch: Partial<MissionProject>) {
    const nextProject = { ...projectRef.current, ...patch };
    projectRef.current = nextProject;
    onProjectChange(nextProject);
  }

  function updateBoard(nextNodes: MissionNode[], nextLinks = links, options: UpdateBoardOptions = {}) {
    const currentBoard = projectRef.current.board;
    const nextBoard = { nodes: nextNodes, links: nextLinks };
    if (options.recordHistory !== false) {
      if (boardsEqual(currentBoard, nextBoard)) return;
      setBoardHistory(recordBoardSnapshot(boardHistoryRef.current, currentBoard));
    }
    updateProject({ board: nextBoard });
  }

  function clearBoardSelection() {
    setSelectedNodeIds(new Set());
    setSelectedLinkId(null);
    setNodeMenu(null);
    setNewConnectionAnchor(null);
  }

  function selectOnlyNode(id: number) {
    setSelectedNodeIds(new Set([id]));
    setSelectedLinkId(null);
  }

  function toggleNodeSelection(id: number) {
    setSelectedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedLinkId(null);
  }

  function undoLastBoardChange() {
    if (dragRef.current || panRef.current || connectionRef.current || portDragRef.current) return;
    const step = undoBoardChange(boardHistoryRef.current, projectRef.current.board);
    if (!step) return;
    setBoardHistory(step.history);
    updateProject({ board: step.board });
    clearBoardSelection();
  }

  function redoLastBoardChange() {
    if (dragRef.current || panRef.current || connectionRef.current || portDragRef.current) return;
    const step = redoBoardChange(boardHistoryRef.current, projectRef.current.board);
    if (!step) return;
    setBoardHistory(step.history);
    updateProject({ board: step.board });
    clearBoardSelection();
  }

  function resolveNodeTitle(node: MissionNode): string {
    return node.titleKey ? t(node.titleKey) : node.title ?? "";
  }

  function resolveKicker(node: MissionNode): string {
    return node.kickerKey.startsWith("nodes.") ? t(node.kickerKey) : node.kickerKey;
  }

  function stateLabel(state: NodeState): string {
    if (state === "defined") return t("common.defined");
    if (state === "hypothesis") return t("common.hypothesis");
    if (state === "closed") return t("common.closed");
    return t("common.open");
  }

  function worldPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - transform.x) / transform.scale, y: (clientY - rect.top - transform.y) / transform.scale };
  }

  function nodeCenter(node: MissionNode): { x: number; y: number } {
    return { x: node.x + node.width / 2, y: node.y + NODE_HEIGHT / 2 };
  }

  function destinationSide(source: MissionNode, destination: MissionNode): AnchorSide {
    const sourceCenter = nodeCenter(source);
    const destinationCenter = nodeCenter(destination);
    const dx = sourceCenter.x - destinationCenter.x;
    const verticalOverlap = Math.min(source.y + NODE_HEIGHT, destination.y + NODE_HEIGHT) - Math.max(source.y, destination.y);
    const destinationStartsNearSourceBottom = destination.y < source.y + NODE_HEIGHT + 48;
    const mostlyBeside = Math.abs(dx) > destination.width * 0.85 && (verticalOverlap > NODE_HEIGHT * 0.22 || destinationStartsNearSourceBottom);

    if (mostlyBeside) return dx < 0 ? "left" : "right";
    return "top";
  }

  function anchorPoint(node: MissionNode, side: AnchorSide, index: number, count: number): { x: number; y: number } {
    const fraction = (index + 1) / (count + 1);
    if (side === "top") return { x: node.x + node.width * fraction, y: node.y };
    if (side === "bottom") return { x: node.x + node.width * fraction, y: node.y + NODE_HEIGHT };
    if (side === "left") return { x: node.x, y: node.y + NODE_HEIGHT * fraction };
    return { x: node.x + node.width, y: node.y + NODE_HEIGHT * fraction };
  }

  function pointOnSide(node: MissionNode, side: AnchorSide, point: { x: number; y: number }, inset = 0): { x: number; y: number } {
    const x = Math.max(node.x + inset, Math.min(node.x + node.width - inset, point.x));
    const y = Math.max(node.y + inset, Math.min(node.y + NODE_HEIGHT - inset, point.y));
    if (side === "top") return { x, y: node.y };
    if (side === "bottom") return { x, y: node.y + NODE_HEIGHT };
    if (side === "left") return { x: node.x, y };
    return { x: node.x + node.width, y };
  }

  function linkSide(link: MissionLink, node: MissionNode, other: MissionNode, role: LinkRole): AnchorSide {
    if (role === "source") return "bottom";
    return link.targetSide ?? destinationSide(other, node);
  }

  function linkOrder(link: MissionLink, role: LinkRole): number | undefined {
    return role === "source" ? link.sourceOrder : link.targetOrder;
  }

  function linkSideField(role: LinkRole): "sourceSide" | "targetSide" {
    return role === "source" ? "sourceSide" : "targetSide";
  }

  function linkOrderField(role: LinkRole): "sourceOrder" | "targetOrder" {
    return role === "source" ? "sourceOrder" : "targetOrder";
  }

  function nodeLinkEndpoints(currentLinks: MissionLink[], node: MissionNode): LinkEndpoint[] {
    const endpoints: LinkEndpoint[] = [];
    currentLinks.forEach((link) => {
      if (link.from === node.id) {
        const otherNode = nodes.find((candidate) => candidate.id === link.to);
        if (otherNode) endpoints.push({ link, role: "source", otherNode });
      }
      if (link.to === node.id) {
        const otherNode = nodes.find((candidate) => candidate.id === link.from);
        if (otherNode) endpoints.push({ link, role: "destination", otherNode });
      }
    });
    return endpoints;
  }

  function linkAnchor(link: MissionLink, node: MissionNode, other: MissionNode, role: LinkRole, currentLinks = links): { point: { x: number; y: number }; side: AnchorSide; index: number; count: number } {
    const side = linkSide(link, node, other, role);
    const sideLinks = nodeLinkEndpoints(currentLinks, node)
      .filter((item) => linkSide(item.link, node, item.otherNode, item.role) === side)
      .sort((a, b) => {
        const orderA = linkOrder(a.link, a.role);
        const orderB = linkOrder(b.link, b.role);
        if (orderA !== undefined || orderB !== undefined) return (orderA ?? 9999) - (orderB ?? 9999);
        const nodeCenterPoint = nodeCenter(node);
        const aCenter = nodeCenter(a.otherNode);
        const bCenter = nodeCenter(b.otherNode);
        const primary = side === "bottom" && a.role === "source" && b.role === "source"
          ? Math.atan2(aCenter.x - nodeCenterPoint.x, Math.max(1, aCenter.y - nodeCenterPoint.y)) - Math.atan2(bCenter.x - nodeCenterPoint.x, Math.max(1, bCenter.y - nodeCenterPoint.y))
          : side === "top" || side === "bottom" ? aCenter.x - bCenter.x : aCenter.y - bCenter.y;
        return primary || a.link.id - b.link.id;
      });
    const index = Math.max(0, sideLinks.findIndex((item) => item.link.id === link.id && item.role === role));

    return { point: anchorPoint(node, side, index, sideLinks.length), side, index, count: sideLinks.length };
  }

  function controlPoint(point: { x: number; y: number }, side: AnchorSide, distance: number): { x: number; y: number } {
    if (side === "top") return { x: point.x, y: point.y - distance };
    if (side === "bottom") return { x: point.x, y: point.y + distance };
    if (side === "left") return { x: point.x - distance, y: point.y };
    return { x: point.x + distance, y: point.y };
  }

  function edgePath(link: MissionLink, from: MissionNode, to: MissionNode, currentLinks = links): string {
    const a = linkAnchor(link, from, to, "source", currentLinks);
    const b = linkAnchor(link, to, from, "destination", currentLinks);
    const preview = portDragPreview?.linkId === link.id ? portDragPreview : null;
    const floating = preview?.targetNodeId === null;
    const startPoint = floating && preview.role === "source" ? { x: preview.x, y: preview.y } : a.point;
    const endPoint = floating && preview.role === "destination" ? { x: preview.x, y: preview.y } : b.point;
    const startSide = floating && preview.role === "source" ? preview.targetSide ?? "bottom" : a.side;
    const endSide = floating && preview.role === "destination" ? preview.targetSide ?? nearestSide(to, endPoint) : b.side;
    const distance = Math.max(80, Math.min(190, Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) * 0.34));
    let startDistance = distance;
    let endDistance = distance;
    const verticalGap = endPoint.y - startPoint.y;

    if (!floating && startSide === "bottom" && endSide === "top" && verticalGap > 24) {
      const maximumDistance = Math.max(0.5, (a.count - 1) / 2);
      const extremity = Math.abs(a.index - (a.count - 1) / 2) / maximumDistance;
      const normalDistance = Math.min(distance, Math.max(72, verticalGap * 1.1));
      const centerStart = Math.max(26, Math.min(normalDistance * 0.58, verticalGap * 0.44));
      const centerEnd = Math.max(34, Math.min(normalDistance * 0.72, verticalGap * 0.58));
      const outerStart = Math.max(38, Math.min(normalDistance * 0.8, verticalGap * 0.72));
      const outerEnd = Math.max(42, Math.min(normalDistance * 0.9, verticalGap * 0.82));

      if (extremity <= 0.5) {
        const blend = extremity / 0.5;
        startDistance = centerStart + (normalDistance - centerStart) * blend;
        endDistance = centerEnd + (normalDistance - centerEnd) * blend;
      } else {
        const blend = (extremity - 0.5) / 0.5;
        startDistance = normalDistance + (outerStart - normalDistance) * blend;
        endDistance = normalDistance + (outerEnd - normalDistance) * blend;
      }
    }

    const controlA = controlPoint(startPoint, startSide, startDistance);
    const controlB = controlPoint(endPoint, endSide, endDistance);

    return `M ${startPoint.x} ${startPoint.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${endPoint.x} ${endPoint.y}`;
  }

  function selectedLink(currentLinks = displayLinks): MissionLink | null {
    return selectedLinkId !== null ? currentLinks.find((link) => link.id === selectedLinkId) ?? null : null;
  }

  function isSelectedLinkNode(nodeId: number): boolean {
    const link = selectedLink();
    return link ? link.from === nodeId || link.to === nodeId : false;
  }

  function nodePorts(node: MissionNode, currentLinks = displayLinks): NodePort[] {
    const visibleLinks = currentLinks.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to));
    const ports: NodePort[] = [];

    visibleLinks.forEach((link) => {
      if (link.from === node.id) {
        if (portDragPreview?.targetNodeId === null && portDragPreview.linkId === link.id && portDragPreview.role === "source") return;
        const target = nodes.find((item) => item.id === link.to);
        if (!target) return;
        const anchor = linkAnchor(link, node, target, "source", currentLinks);
        ports.push({ key: `${link.id}-source`, linkId: link.id, role: "source", side: anchor.side, x: anchor.point.x - node.x, y: anchor.point.y - node.y, connected: selectedLinkId === link.id || link.id === DRAFT_LINK_ID });
        return;
      }

      if (link.to === node.id) {
        if (portDragPreview?.targetNodeId === null && portDragPreview.linkId === link.id && portDragPreview.role === "destination") return;
        const source = nodes.find((item) => item.id === link.from);
        if (!source) return;
        const anchor = linkAnchor(link, node, source, "destination", currentLinks);
        ports.push({ key: `${link.id}-destination`, linkId: link.id, role: "destination", side: anchor.side, x: anchor.point.x - node.x, y: anchor.point.y - node.y, connected: selectedLinkId === link.id || link.id === DRAFT_LINK_ID });
      }
    });

    if (ports.length > 0) return ports;
    return [];
  }

  function nearestSide(node: MissionNode, point: { x: number; y: number }): AnchorSide {
    const distances = [
      { side: "top" as const, value: Math.abs(point.y - node.y) },
      { side: "right" as const, value: Math.abs(point.x - (node.x + node.width)) },
      { side: "bottom" as const, value: Math.abs(point.y - (node.y + NODE_HEIGHT)) },
      { side: "left" as const, value: Math.abs(point.x - node.x) }
    ];
    return distances.sort((a, b) => a.value - b.value)[0].side;
  }

  function nearestInputSide(node: MissionNode, point: { x: number; y: number }): Exclude<AnchorSide, "bottom"> {
    const distances = [
      { side: "top" as const, value: Math.abs(point.y - node.y) },
      { side: "right" as const, value: Math.abs(point.x - (node.x + node.width)) },
      { side: "left" as const, value: Math.abs(point.x - node.x) }
    ];
    return distances.sort((a, b) => a.value - b.value)[0].side;
  }

  function connectionAnchorAtSide(node: MissionNode, side: AnchorSide): NewConnectionAnchor {
    if (side === "top") return { nodeId: node.id, side, x: node.width / 2, y: -NEW_CONNECTION_GAP };
    if (side === "bottom") return { nodeId: node.id, side, x: node.width / 2, y: NODE_HEIGHT + NEW_CONNECTION_GAP };
    if (side === "left") return { nodeId: node.id, side, x: -NEW_CONNECTION_GAP, y: NODE_HEIGHT / 2 };
    return { nodeId: node.id, side, x: node.width + NEW_CONNECTION_GAP, y: NODE_HEIGHT / 2 };
  }

  function connectionAnchorNearPointer(node: MissionNode, point: { x: number; y: number }): NewConnectionAnchor | null {
    const side = nearestSide(node, point);
    const edgeDistance = side === "top" ? Math.abs(point.y - node.y)
      : side === "bottom" ? Math.abs(point.y - (node.y + NODE_HEIGHT))
        : side === "left" ? Math.abs(point.x - node.x)
          : Math.abs(point.x - (node.x + node.width));
    const hoverDistance = NODE_HEIGHT * 0.48;
    if (edgeDistance > hoverDistance) return null;
    return connectionAnchorAtSide(node, side);
  }

  function sideFraction(node: MissionNode, side: AnchorSide, point: { x: number; y: number }): number {
    if (side === "top" || side === "bottom") return Math.max(0, Math.min(1, (point.x - node.x) / node.width));
    return Math.max(0, Math.min(1, (point.y - node.y) / NODE_HEIGHT));
  }

  function invalidPortTarget(currentLinks: MissionLink[], drag: NonNullable<PortDragState>, targetNodeId: number): InvalidConnectionReason | null {
    const selected = currentLinks.find((link) => link.id === drag.linkId);
    if (!selected) return "same-node";
    const fixedNodeId = drag.role === "source" ? selected.to : selected.from;
    if (targetNodeId === fixedNodeId) return "same-node";

    const duplicate = currentLinks.some((link) => link.id !== selected.id && (
      (link.from === targetNodeId && link.to === fixedNodeId)
      || (link.from === fixedNodeId && link.to === targetNodeId)
    ));
    return duplicate ? "duplicate" : null;
  }

  function canMovePortTo(currentLinks: MissionLink[], drag: NonNullable<PortDragState>, targetNodeId: number): boolean {
    return invalidPortTarget(currentLinks, drag, targetNodeId) === null;
  }

  function nearestDropNode(point: { x: number; y: number }): MissionNode | null {
    const snapDistance = 28;
    return nodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((node) => {
        const dx = Math.max(node.x - point.x, 0, point.x - (node.x + node.width));
        const dy = Math.max(node.y - point.y, 0, point.y - (node.y + NODE_HEIGHT));
        return { node, distance: Math.hypot(dx, dy) };
      })
      .filter((candidate) => candidate.distance <= snapDistance)
      .sort((a, b) => a.distance - b.distance)[0]?.node ?? null;
  }

  function invalidConnectionTarget(from: number, targetNodeId: number): InvalidConnectionReason | null {
    if (from === targetNodeId) return "same-node";
    const duplicate = links.some((link) => (
      (link.from === from && link.to === targetNodeId)
      || (link.from === targetNodeId && link.to === from)
    ));
    return duplicate ? "duplicate" : null;
  }

  function portDropSide(node: MissionNode, role: LinkRole, point: { x: number; y: number }): AnchorSide {
    return role === "source" ? "bottom" : nearestInputSide(node, point);
  }

  function portInsertionIndex(currentLinks: MissionLink[], drag: NonNullable<PortDragState>, node: MissionNode, side: AnchorSide, point: { x: number; y: number }): number {
    const existingCount = nodeLinkEndpoints(currentLinks, node).filter((endpoint) => {
      if (endpoint.link.id === drag.linkId && endpoint.role === drag.role) return false;
      return linkSide(endpoint.link, node, endpoint.otherNode, endpoint.role) === side;
    }).length;
    const rawIndex = Math.round(sideFraction(node, side, point) * (existingCount + 1) - 0.5);
    return Math.max(0, Math.min(existingCount, rawIndex));
  }

  function createPortDragPreview(drag: NonNullable<PortDragState>, point: { x: number; y: number }): NonNullable<PortDragPreview> {
    const target = nearestDropNode(point);
    if (!target) return { ...drag, ...point, targetNodeId: null, hoveredNodeId: null, targetSide: null, targetOrder: null, invalidReason: null };
    const side = portDropSide(target, drag.role, point);
    const snappedPoint = pointOnSide(target, side, point);
    const invalidReason = invalidPortTarget(links, drag, target.id);
    if (invalidReason) {
      return { ...drag, ...snappedPoint, targetNodeId: null, hoveredNodeId: target.id, targetSide: side, targetOrder: null, invalidReason };
    }
    const order = portInsertionIndex(links, drag, target, side, point);
    return { ...drag, ...snappedPoint, targetNodeId: target.id, hoveredNodeId: target.id, targetSide: side, targetOrder: order, invalidReason: null };
  }

  function createConnectionPreview(connection: NonNullable<ConnectionState>, point: { x: number; y: number }): NonNullable<ConnectionState> {
    const source = nodes.find((node) => node.id === connection.from);
    const target = nearestDropNode(point);
    if (!source || !target) return { ...connection, ...point, targetNodeId: null, hoveredNodeId: null, targetSide: null, sourceOrder: null, targetOrder: null, invalidReason: null };

    const targetSide = nearestInputSide(target, point);
    const snappedPoint = pointOnSide(target, targetSide, point);
    const invalidReason = invalidConnectionTarget(connection.from, target.id);
    if (invalidReason) {
      return { ...connection, ...snappedPoint, targetNodeId: null, hoveredNodeId: target.id, targetSide, sourceOrder: null, targetOrder: null, invalidReason };
    }
    const sourceDrag: ActivePortDrag = { linkId: DRAFT_LINK_ID, nodeId: source.id, role: "source", pointerId: connection.pointerId, initialSide: "bottom", initialOrder: 0 };
    const targetDrag: ActivePortDrag = { linkId: DRAFT_LINK_ID, nodeId: target.id, role: "destination", pointerId: connection.pointerId, initialSide: targetSide, initialOrder: 0 };
    const sourceOrder = portInsertionIndex(links, sourceDrag, source, "bottom", nodeCenter(target));
    const targetOrder = portInsertionIndex(links, targetDrag, target, targetSide, point);

    return { ...connection, ...snappedPoint, targetNodeId: target.id, hoveredNodeId: target.id, targetSide, sourceOrder, targetOrder, invalidReason: null };
  }

  function resolvedPortOrder(node: MissionNode, port: NodePort): number {
    if (port.linkId === null || port.role === "new") return 0;
    const sameSidePorts = nodePorts(node)
      .filter((item) => item.linkId !== null && item.side === port.side)
      .sort((a, b) => sideFraction(node, port.side, { x: node.x + a.x, y: node.y + a.y }) - sideFraction(node, port.side, { x: node.x + b.x, y: node.y + b.y }));
    return Math.max(0, sameSidePorts.findIndex((item) => item.linkId === port.linkId && item.role === port.role));
  }

  function normalizePortOrders(currentLinks: MissionLink[], nodeId: number, insertion?: PortInsertion): MissionLink[] {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return currentLinks;
    const grouped = new Map<AnchorSide, LinkEndpoint[]>();

    nodeLinkEndpoints(currentLinks, node)
      .forEach((endpoint) => {
        const side = linkSide(endpoint.link, node, endpoint.otherNode, endpoint.role);
        const group = grouped.get(side) ?? [];
        group.push(endpoint);
        grouped.set(side, group);
      });

    const orderByEndpoint = new Map<string, number>();
    grouped.forEach((group, side) => {
      const ordered = group.sort((a, b) => {
        const orderA = linkOrder(a.link, a.role);
        const orderB = linkOrder(b.link, b.role);
        if (orderA !== undefined || orderB !== undefined) return (orderA ?? 9999) - (orderB ?? 9999);
        const centerA = nodeCenter(a.otherNode);
        const centerB = nodeCenter(b.otherNode);
        const primary = side === "top" || side === "bottom" ? centerA.x - centerB.x : centerA.y - centerB.y;
        return primary || a.link.id - b.link.id;
      });

      if (insertion?.side === side) {
        const insertedEndpoint = ordered.find((endpoint) => endpoint.link.id === insertion.linkId && endpoint.role === insertion.role);
        if (insertedEndpoint) {
          const withoutInserted = ordered.filter((endpoint) => endpoint !== insertedEndpoint);
          withoutInserted.splice(Math.min(insertion.index, withoutInserted.length), 0, insertedEndpoint);
          withoutInserted.forEach((endpoint, index) => orderByEndpoint.set(`${endpoint.link.id}-${endpoint.role}`, index));
          return;
        }
      }

      ordered.forEach((endpoint, index) => orderByEndpoint.set(`${endpoint.link.id}-${endpoint.role}`, index));
    });

    return currentLinks.map((link) => {
      const sourceOrder = orderByEndpoint.get(`${link.id}-source`);
      const targetOrder = orderByEndpoint.get(`${link.id}-destination`);
      if (sourceOrder === undefined && targetOrder === undefined) return link;
      return {
        ...link,
        ...(sourceOrder === undefined ? {} : { sourceOrder }),
        ...(targetOrder === undefined ? {} : { targetOrder })
      };
    });
  }

  function movePortEndpoint(currentLinks: MissionLink[], drag: NonNullable<PortDragState>, targetNodeId: number, side: AnchorSide, order: number): MissionLink[] {
    const selected = currentLinks.find((link) => link.id === drag.linkId);
    if (!selected || !canMovePortTo(currentLinks, drag, targetNodeId)) return currentLinks;

    const sideField = linkSideField(drag.role);
    const orderField = linkOrderField(drag.role);
    const movedLinks = currentLinks.map((link) => link.id === selected.id ? {
      ...link,
      from: drag.role === "source" ? targetNodeId : link.from,
      to: drag.role === "destination" ? targetNodeId : link.to,
      [sideField]: side,
      [orderField]: order
    } : link);

    const withoutOldGap = drag.nodeId === targetNodeId ? movedLinks : normalizePortOrders(movedLinks, drag.nodeId);
    return normalizePortOrders(withoutOldGap, targetNodeId, { linkId: selected.id, role: drag.role, side, index: order });
  }

  function linksForPortPreview(currentLinks: MissionLink[], preview: PortDragPreview): MissionLink[] {
    if (!preview || preview.targetNodeId === null || preview.targetSide === null || preview.targetOrder === null) return currentLinks;
    return movePortEndpoint(currentLinks, preview, preview.targetNodeId, preview.targetSide, preview.targetOrder);
  }

  function linksForConnectionPreview(currentLinks: MissionLink[], preview: ConnectionState): MissionLink[] {
    if (!preview || preview.targetNodeId === null || preview.targetSide === null || preview.sourceOrder === null || preview.targetOrder === null) return currentLinks;
    const draftLink: MissionLink = {
      id: DRAFT_LINK_ID,
      from: preview.from,
      to: preview.targetNodeId,
      type: "normal",
      sourceSide: "bottom",
      targetSide: preview.targetSide,
      sourceOrder: preview.sourceOrder,
      targetOrder: preview.targetOrder
    };
    const withDraft = [...currentLinks, draftLink];
    const normalizedSource = normalizePortOrders(withDraft, preview.from, { linkId: DRAFT_LINK_ID, role: "source", side: "bottom", index: preview.sourceOrder });
    return normalizePortOrders(normalizedSource, preview.targetNodeId, { linkId: DRAFT_LINK_ID, role: "destination", side: preview.targetSide, index: preview.targetOrder });
  }

  function linkPath(link: MissionLink, currentLinks = displayLinks): string {
    const from = nodes.find((node) => node.id === link.from);
    const to = nodes.find((node) => node.id === link.to);
    if (!from || !to) return "";
    return edgePath(link, from, to, currentLinks);
  }

  function lockSelection() {
    document.body.classList.add("workspace-interacting");
  }

  function unlockSelection() {
    document.body.classList.remove("workspace-interacting");
  }

  function startNodeDrag(event: React.PointerEvent<HTMLDivElement>, id: number) {
    if ((event.target as HTMLElement).closest("button, .node-connector")) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      toggleNodeSelection(id);
      setNodeMenu(null);
      setNewConnectionAnchor(null);
      return;
    }
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    const point = worldPoint(event.clientX, event.clientY);
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      startX: node.x,
      startY: node.y,
      before: cloneBoardSnapshot(projectRef.current.board)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    selectOnlyNode(id);
    setNodeMenu(null);
    setNewConnectionAnchor(null);
    lockSelection();
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-node-id], [data-panel], [data-control], path")) return;
    event.preventDefault();
    if (selectionMode || event.ctrlKey || event.metaKey) {
      const point = worldPoint(event.clientX, event.clientY);
      const nextSelection: NonNullable<SelectionBoxState> = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        x: point.x,
        y: point.y,
        additive: event.ctrlKey || event.metaKey
      };
      selectionBoxRef.current = nextSelection;
      setSelectionBox(nextSelection);
      if (!nextSelection.additive) setSelectedNodeIds(new Set());
      setSelectedLinkId(null);
      setNodeMenu(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      lockSelection();
      return;
    }
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: transform.x, originY: transform.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
    setSelectedNodeIds(new Set());
    setSelectedLinkId(null);
    setNodeMenu(null);
    lockSelection();
  }

  function updateNewConnectionAnchor(event: React.PointerEvent<HTMLDivElement>, node: MissionNode) {
    if (dragRef.current || panRef.current || connectionRef.current || portDragRef.current) return;
    if ((event.target as HTMLElement).closest(".new-connection-trigger")) return;
    const anchor = connectionAnchorNearPointer(node, worldPoint(event.clientX, event.clientY));
    setNewConnectionAnchor((current) => (
      anchor && current?.nodeId === anchor.nodeId && current.side === anchor.side ? current : anchor
    ));
  }

  function clearNewConnectionAnchor(nodeId: number) {
    if (connectionRef.current) return;
    setNewConnectionAnchor((current) => current?.nodeId === nodeId ? null : current);
  }

  function startConnection(event: React.PointerEvent<HTMLButtonElement>, from: number, anchor: NewConnectionAnchor) {
    event.preventDefault();
    event.stopPropagation();
    const point = worldPoint(event.clientX, event.clientY);
    const source = nodes.find((node) => node.id === from);
    if (!source) return;
    const draft: NonNullable<ConnectionState> = {
      from,
      pointerId: event.pointerId,
      startSide: anchor.side,
      startX: source.x + anchor.x,
      startY: source.y + anchor.y,
      x: point.x,
      y: point.y,
      targetNodeId: null,
      hoveredNodeId: null,
      targetSide: null,
      sourceOrder: null,
      targetOrder: null,
      invalidReason: null
    };
    connectionRef.current = draft;
    setConnectionDraft(draft);
    setNewConnectionAnchor(anchor);
    event.currentTarget.setPointerCapture(event.pointerId);
    selectOnlyNode(from);
    lockSelection();
  }

  function startPortDrag(event: React.PointerEvent<HTMLButtonElement>, port: NodePort, nodeId: number) {
    if (port.linkId === null || port.role === "new") {
      startConnection(event, nodeId, { nodeId, side: port.side, x: port.x, y: port.y });
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const node = nodes.find((item) => item.id === nodeId);
    const initialOrder = node ? resolvedPortOrder(node, port) : 0;
    const drag = { linkId: port.linkId, nodeId, role: port.role, pointerId: event.pointerId, initialSide: port.side, initialOrder };
    portDragRef.current = drag;
    setPortDragPreview({ ...drag, x: node ? node.x + port.x : 0, y: node ? node.y + port.y : 0, targetNodeId: nodeId, hoveredNodeId: nodeId, targetSide: port.side, targetOrder: initialOrder, invalidReason: null });
    setNewConnectionAnchor(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedLinkId(port.linkId);
    setSelectedNodeIds(new Set());
    setNodeMenu(null);
    lockSelection();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const portDrag = portDragRef.current;
    if (portDrag && portDrag.pointerId === event.pointerId) {
      event.preventDefault();
      setPortDragPreview(createPortDragPreview(portDrag, worldPoint(event.clientX, event.clientY)));
      return;
    }

    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      event.preventDefault();
      const point = worldPoint(event.clientX, event.clientY);
      const node = nodes.find((item) => item.id === drag.id);
      if (!node) return;
      const x = Math.max(-DRAG_MARGIN, Math.min(WORLD_WIDTH + DRAG_MARGIN - node.width, point.x - drag.offsetX));
      const y = Math.max(-DRAG_MARGIN, Math.min(WORLD_HEIGHT + DRAG_MARGIN - NODE_HEIGHT, point.y - drag.offsetY));
      if (x === node.x && y === node.y) return;
      const nextNodes = nodes.map((item) => item.id === drag.id ? { ...item, x, y } : item);
      updateBoard(nextNodes, links, { recordHistory: false });
      return;
    }

    const activeSelection = selectionBoxRef.current;
    if (activeSelection && activeSelection.pointerId === event.pointerId) {
      event.preventDefault();
      const point = worldPoint(event.clientX, event.clientY);
      const nextSelection = { ...activeSelection, x: point.x, y: point.y };
      selectionBoxRef.current = nextSelection;
      setSelectionBox(nextSelection);
      return;
    }

    const pan = panRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      event.preventDefault();
      setTransform((current) => ({ ...current, x: pan.originX + event.clientX - pan.startX, y: pan.originY + event.clientY - pan.startY }));
      return;
    }

    const connection = connectionRef.current;
    if (connection && connection.pointerId === event.pointerId) {
      event.preventDefault();
      const point = worldPoint(event.clientX, event.clientY);
      const next = createConnectionPreview(connection, point);
      connectionRef.current = next;
      setConnectionDraft(next);
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const portDrag = portDragRef.current;
    if (portDrag && portDrag.pointerId === event.pointerId) {
      event.preventDefault();
      const point = worldPoint(event.clientX, event.clientY);
      const drop = createPortDragPreview(portDrag, point);
      if (drop.targetNodeId !== null && drop.targetSide !== null && drop.targetOrder !== null) {
        updateBoard(nodes, movePortEndpoint(links, portDrag, drop.targetNodeId, drop.targetSide, drop.targetOrder));
      }
    }

    const connection = connectionRef.current;
    if (connection && connection.pointerId === event.pointerId) {
      const drop = createConnectionPreview(connection, worldPoint(event.clientX, event.clientY));
      if (drop.targetNodeId !== null && drop.targetSide !== null && drop.sourceOrder !== null && drop.targetOrder !== null) {
        createLink(drop.from, drop.targetNodeId, drop.targetSide, drop.sourceOrder, drop.targetOrder);
      }
    }

    const nodeDrag = dragRef.current;
    if (nodeDrag && nodeDrag.pointerId === event.pointerId) {
      const currentNode = projectRef.current.board.nodes.find((node) => node.id === nodeDrag.id);
      if (currentNode && (currentNode.x !== nodeDrag.startX || currentNode.y !== nodeDrag.startY)) {
        setBoardHistory(recordBoardSnapshot(boardHistoryRef.current, nodeDrag.before));
      }
    }

    const completedSelection = selectionBoxRef.current;
    if (completedSelection && completedSelection.pointerId === event.pointerId) {
      const minX = Math.min(completedSelection.startX, completedSelection.x);
      const maxX = Math.max(completedSelection.startX, completedSelection.x);
      const minY = Math.min(completedSelection.startY, completedSelection.y);
      const maxY = Math.max(completedSelection.startY, completedSelection.y);
      const matchedIds = nodes
        .filter((node) => node.x < maxX && node.x + node.width > minX && node.y < maxY && node.y + NODE_HEIGHT > minY)
        .map((node) => node.id);
      setSelectedNodeIds((current) => {
        const next = completedSelection.additive ? new Set(current) : new Set<number>();
        matchedIds.forEach((id) => next.add(id));
        return next;
      });
    }

    dragRef.current = null;
    panRef.current = null;
    selectionBoxRef.current = null;
    connectionRef.current = null;
    portDragRef.current = null;
    setConnectionDraft(null);
    setPortDragPreview(null);
    setSelectionBox(null);
    setPanning(false);
    unlockSelection();
  }

  function zoomBy(factor: number) {
    setTransform((current) => ({ ...current, scale: Math.max(0.38, Math.min(1.8, current.scale * factor)) }));
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.08 : 0.92);
  }

  function fitNodeIds(ids: number[], currentNodes = nodes) {
    const viewport = viewportRef.current;
    const selected = currentNodes.filter((node) => ids.includes(node.id));
    if (!viewport || selected.length === 0) return;
    const rect = viewport.getBoundingClientRect();
    const minX = Math.min(...selected.map((node) => node.x));
    const minY = Math.min(...selected.map((node) => node.y));
    const maxX = Math.max(...selected.map((node) => node.x + node.width));
    const maxY = Math.max(...selected.map((node) => node.y + NODE_HEIGHT));
    const width = Math.max(320, maxX - minX);
    const height = Math.max(220, maxY - minY);
    const scale = Math.max(0.4, Math.min(1.2, Math.min((rect.width - 210) / width, (rect.height - 170) / height)));
    setTransform({ scale, x: rect.width / 2 - (minX + width / 2) * scale, y: rect.height / 2 - (minY + height / 2) * scale });
  }

  function fitAll() {
    fitNodeIds(Array.from(visibleNodeIds));
  }

  function createLink(from: number, to: number, preferredTargetSide?: AnchorSide, preferredSourceOrder?: number, preferredTargetOrder?: number) {
    if (from === to) return;
    const exists = links.some((link) => (link.from === from && link.to === to) || (link.from === to && link.to === from));
    if (exists) return;
    const id = Math.max(199, ...links.map((link) => link.id)) + 1;
    const target = nodes.find((node) => node.id === to);
    const source = nodes.find((node) => node.id === from);
    const targetSide = preferredTargetSide ?? (source && target ? destinationSide(source, target) : undefined);
    const sourceOrder = preferredSourceOrder ?? (source ? nodeLinkEndpoints(links, source).filter((endpoint) => linkSide(endpoint.link, source, endpoint.otherNode, endpoint.role) === "bottom").length : 0);
    const targetOrder = preferredTargetOrder ?? 0;
    const withLink = [...links, { id, from, to, type: "normal" as const, sourceSide: "bottom" as const, targetSide, sourceOrder, targetOrder }];
    const normalizedSource = normalizePortOrders(withLink, from, { linkId: id, role: "source", side: "bottom", index: sourceOrder });
    const nextLinks = targetSide
      ? normalizePortOrders(normalizedSource, to, { linkId: id, role: "destination", side: targetSide, index: targetOrder })
      : normalizePortOrders(normalizedSource, to);
    updateBoard(nodes, nextLinks);
  }

  function deleteLink(id: number) {
    updateBoard(nodes, links.filter((link) => link.id !== id));
    setSelectedLinkId(null);
  }

  function setNodeState(id: number, state: NodeState) {
    updateBoard(nodes.map((node) => node.id === id ? { ...node, state } : node));
    setNodeMenu(null);
  }

  function deleteNodes(ids: Set<number>) {
    if (ids.size === 0) return;
    updateBoard(
      nodes.filter((node) => !ids.has(node.id)),
      links.filter((link) => !ids.has(link.from) && !ids.has(link.to))
    );
    setNodeMenu(null);
    setSelectedNodeIds(new Set());
    setSelectedLinkId(null);
  }

  function deleteNode(id: number) {
    deleteNodes(new Set([id]));
  }

  function deleteBoardSelection() {
    if (selectedLinkId !== null) {
      deleteLink(selectedLinkId);
      return;
    }
    deleteNodes(selectedNodeIds);
  }

  function addNode(title: string) {
    const id = Math.max(29, ...nodes.map((node) => node.id)) + 1;
    const viewportRect = viewportRef.current?.getBoundingClientRect();
    const center = worldPoint((viewportRect?.left ?? 0) + (viewportRef.current?.clientWidth ?? 1000) / 2, (viewportRect?.top ?? 0) + (viewportRef.current?.clientHeight ?? 700) / 2);
    const newNode: MissionNode = { id, x: center.x - 120, y: center.y - 55, width: 240, title: limitWords(title), kickerKey: "nodes.possibilityKicker", state: "open", type: "normal", bucket: "main" };
    updateBoard([...nodes, newNode]);
    selectOnlyNode(id);
  }

  function organize() {
    const arrangedNodes = layoutTopDown(nodes, links, null, visibleNodeIds);
    const arrangedLinks = orderLinksTopDown(arrangedNodes, links);
    updateBoard(arrangedNodes, arrangedLinks);
    window.setTimeout(() => fitNodeIds(Array.from(visibleNodeIds), arrangedNodes), 0);
  }

  function openCardMenu(event: React.MouseEvent<HTMLButtonElement>, id: number) {
    event.stopPropagation();
    selectOnlyNode(id);
    setNodeMenu({ id, x: Math.min(window.innerWidth - 260, event.clientX + 8), y: Math.min(window.innerHeight - 290, event.clientY + 8) });
  }

  function openNewCard() {
    setEditingNodeId(null);
    setCardText("");
    setCardModalOpen(true);
  }

  function openEditCard(id: number) {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    setEditingNodeId(id);
    setCardText(resolveNodeTitle(node));
    setCardModalOpen(true);
    setNodeMenu(null);
  }

  function saveCard() {
    const text = limitWords(cardText);
    if (!text) return;
    if (editingNodeId !== null) updateBoard(nodes.map((node) => node.id === editingNodeId ? { ...node, title: text, titleKey: undefined } : node));
    else addNode(text);
    setCardModalOpen(false);
  }

  function changeWorkspaceMode(mode: WorkspaceMode) {
    setWorkspaceMode(mode);
    setCardModalOpen(false);
    clearBoardSelection();
    const url = new URL(window.location.href);
    url.searchParams.set("view", mode === "map" ? "system" : mode === "lab" ? "discovery" : "timeline");
    window.history.replaceState(window.history.state, "", url);
  }

  function syncExplorationBoard(labBoard: LabBoard) {
    const decidedNodes = labBoard.nodes.filter((node) => node.maturity === "decided");
    setLabSummary({ ideas: labBoard.nodes.length, decisions: decidedNodes.length });
    const currentProject = projectRef.current;
    const currentBoard = currentProject.board;
    const nextBoard = syncDecisionsToMissionBoard(currentBoard, labBoard, language);
    if (boardsEqual(currentBoard, nextBoard)) return;
    updateProject({ board: nextBoard });
  }

  useEffect(() => {
    if (workspaceMode !== "map") return;
    const frame = window.requestAnimationFrame(() => fitAll());
    return () => window.cancelAnimationFrame(frame);
  }, [project.id, nodes.length, workspaceMode]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (workspaceMode !== "map") return;
      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;

      if (commandKey && !event.altKey && !event.shiftKey && key === "n") {
        event.preventDefault();
        if (!cardModalOpen) openNewCard();
        return;
      }

      if (cardModalOpen || isEditableKeyboardTarget(event.target)) return;

      if (commandKey && !event.altKey && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redoLastBoardChange();
        else undoLastBoardChange();
        return;
      }

      if (commandKey && !event.altKey && key === "y") {
        event.preventDefault();
        redoLastBoardChange();
        return;
      }

      if (!commandKey && !event.altKey && hasBoardSelection && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        deleteBoardSelection();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  });

  const nodeMenuNode = nodeMenu ? nodes.find((node) => node.id === nodeMenu.id) ?? null : null;

  return (
    <div className="brain-shell brain-v2">
      <aside className={sidebarOpen ? "brain-sidebar open" : "brain-sidebar"}>
        <div className="sidebar-brand-row"><Brand /><button className="sidebar-close-mobile" onClick={() => setSidebarOpen(false)}>×</button></div>
        <nav className="brain-nav">
          <button className="brain-nav-item" onClick={onHome}><span>⌂</span><span>{t("home.start")}</span></button>
          <button className="brain-nav-item active" onClick={onBackSetup}><span>◇</span><span>{t("brainstorm.buildFromZero")}</span></button>
          <div className="brain-nav-section">{t("home.createMission")}</div>
          <div className="step-list">
            <div className="step done"><span>01</span>{t("brainstorm.pointStart")}</div>
            <div className="step active"><span>02</span>{t("brainstorm.problem")}</div>
            <div className="step"><span>03</span>{t("brainstorm.context")}</div>
            <div className="step"><span>04</span>{t("brainstorm.objectives")}</div>
            <div className="step"><span>05</span>{t("brainstorm.concept")}</div>
            <div className="step"><span>06</span>{t("brainstorm.observationPayload")}</div>
            <div className="step"><span>07</span>{t("brainstorm.platform")}</div>
            <div className="step"><span>08</span>{t("brainstorm.orbitOperation")}</div>
            <div className="step"><span>09</span>{t("brainstorm.systemSoftware")}</div>
            <div className="step"><span>10</span>{t("brainstorm.review")}</div>
          </div>
          <button className="brain-nav-item"><span>□</span><span>{t("brainstorm.documentation")}</span></button>
        </nav>
        <div className="brain-sidebar-user"><UserBadge connectedLabel={t("common.connected")} /></div>
      </aside>

      <button className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"} aria-label={t("common.close")} onClick={() => setSidebarOpen(false)} />

      <main className="brain-main">
        <header className="brain-topbar">
          <div className="brain-top-left">
            <button className="mobile-menu" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="brain-breadcrumb"><span>{project.name}</span><span>›</span><strong>{language === "pt" ? "Concepção" : "Conception"}</strong></div>
          </div>
          <div className="brain-top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <section className="brain-workspace">
          <div className="brain-title-row">
            <div className="brain-title-stack">
              <div className="brain-title"><h1>{ux(language, "conceptionRoom")}</h1></div>
              <div className="brain-mode-tabs" role="tablist" aria-label={ux(language, "conceptionRoom")}>
                <button role="tab" aria-selected={workspaceMode === "timeline"} className={workspaceMode === "timeline" ? "active" : ""} onClick={() => changeWorkspaceMode("timeline")}><CalendarDays aria-hidden="true" />{language === "pt" ? "Cronograma" : "Timeline"}</button>
                <button role="tab" aria-selected={workspaceMode === "lab"} className={workspaceMode === "lab" ? "active" : ""} onClick={() => changeWorkspaceMode("lab")}><Lightbulb aria-hidden="true" />{language === "pt" ? "Descoberta" : "Discovery"}<em>BETA</em><span className="tab-count">{labSummary.ideas}</span></button>
                <button role="tab" aria-selected={workspaceMode === "map"} className={workspaceMode === "map" ? "active" : ""} onClick={() => changeWorkspaceMode("map")}><Network aria-hidden="true" />{language === "pt" ? "Sistema consolidado" : "Consolidated system"}<span className="tab-count">{labSummary.decisions}</span></button>
              </div>
            </div>
            {workspaceMode === "map" && (
              <div className="brain-toolbar" data-control>
                <button onClick={organize}>{ux(language, "organizeTopDown")}</button>
                <button className="primary shortcut-button" data-shortcut="Ctrl+N" title={`${ux(language, "newIdea")} (Ctrl+N)`} onClick={openNewCard}>{ux(language, "newIdea")}</button>
                <button className="danger shortcut-button" data-shortcut="Delete / Backspace" title={`${ux(language, "deleteSelection")} (Delete / Backspace)`} disabled={!hasBoardSelection} onClick={deleteBoardSelection}>{ux(language, "deleteSelection")}</button>
              </div>
            )}
            {workspaceMode === "lab" && <div id="brainstorm-lab-toolbar" className="brain-toolbar" data-control />}
          </div>

          {workspaceMode === "timeline" ? <ConceptionTimeline language={language} project={project} /> : workspaceMode === "map" ? <div ref={viewportRef} className={`mission-canvas${panning ? " panning" : ""}${selectionMode ? " selecting" : ""}`} onPointerDown={startPan} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={onWheel}>
            <div className="canvas-world" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, width: WORLD_WIDTH, height: WORLD_HEIGHT }}>
              <div className="bucket-guide ideas"><span>{ux(language, "freeIdeas")}</span></div>
              <div className="bucket-guide questions"><span>{ux(language, "openQuestions")}</span></div>

              <svg className="graph-lines" width={WORLD_WIDTH} height={WORLD_HEIGHT}>
                <defs>
                  <marker id="connection-arrow" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1.5 1.5 L 10.5 6 L 1.5 10.5" fill="none" stroke="#78b8ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker>
                  <marker id="connection-arrow-selected" viewBox="0 0 12 12" markerWidth="13" markerHeight="13" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1.5 1.5 L 10.5 6 L 1.5 10.5" fill="none" stroke="#b7e4ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></marker>
                  <marker id="connection-arrow-draft" viewBox="0 0 12 12" markerWidth="13" markerHeight="13" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1.5 1.5 L 10.5 6 L 1.5 10.5" fill="none" stroke="#33d4a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></marker>
                  <marker id="connection-arrow-invalid" viewBox="0 0 12 12" markerWidth="13" markerHeight="13" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1.5 1.5 L 10.5 6 L 1.5 10.5" fill="none" stroke="#ff6f7d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></marker>
                </defs>
                {displayLinks.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to)).map((link) => {
                  const path = linkPath(link, displayLinks);
                  const invalid = portDragPreview?.linkId === link.id && portDragPreview.invalidReason !== null;
                  const markerId = invalid ? "connection-arrow-invalid"
                    : link.id === DRAFT_LINK_ID ? "connection-arrow-draft"
                      : selectedLinkId === link.id ? "connection-arrow-selected"
                        : "connection-arrow";
                  return (
                    <g key={link.id}>
                      <path
                        className={`graph-line ${link.type === "suggestion" ? "suggestion" : ""} ${selectedLinkId === link.id ? "selected" : ""} ${link.id === DRAFT_LINK_ID ? "connection-preview" : ""} ${invalid ? "invalid" : ""}`}
                        d={path}
                        markerEnd={`url(#${markerId})`}
                      />
                      {link.id !== DRAFT_LINK_ID && <path className="graph-line-hit" d={path} onPointerDown={(event) => { event.stopPropagation(); setSelectedLinkId(link.id); setSelectedNodeIds(new Set()); setNodeMenu(null); }} />}
                    </g>
                  );
                })}
                {connectionDraft?.targetNodeId === null && (() => {
                  const a = { x: connectionDraft.startX, y: connectionDraft.startY };
                  const end = { x: connectionDraft.x, y: connectionDraft.y };
                  const distance = Math.max(70, Math.min(170, Math.hypot(connectionDraft.x - a.x, connectionDraft.y - a.y) * 0.3));
                  const dx = end.x - a.x;
                  const dy = end.y - a.y;
                  const endSide = connectionDraft.targetSide ?? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "left" : "right") : (dy > 0 ? "top" : "bottom"));
                  const controlA = controlPoint(a, connectionDraft.startSide, distance);
                  const controlB = controlPoint(end, endSide, distance);
                  const invalid = connectionDraft.invalidReason !== null;
                  return (
                    <path
                      className={`connection-draft ${invalid ? "invalid" : ""}`}
                      d={`M ${a.x} ${a.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${end.x} ${end.y}`}
                      markerEnd={`url(#connection-arrow-${invalid ? "invalid" : "draft"})`}
                    />
                  );
                })()}
              </svg>

              {nodes.filter((node) => visibleNodeIds.has(node.id)).map((node) => {
                const linkSelected = isSelectedLinkNode(node.id);
                const dropPreview = portDragPreview?.targetNodeId === node.id || connectionDraft?.targetNodeId === node.id;
                const invalidDrop = (portDragPreview?.hoveredNodeId === node.id && portDragPreview.invalidReason !== null)
                  || (connectionDraft?.hoveredNodeId === node.id && connectionDraft.invalidReason !== null);
                const activeAnchor: NewConnectionAnchor | null = connectionDraft?.from === node.id ? {
                  nodeId: node.id,
                  side: connectionDraft.startSide,
                  x: connectionDraft.startX - node.x,
                  y: connectionDraft.startY - node.y
                } : null;
                const addAnchor = portDragPreview ? null
                  : connectionDraft ? activeAnchor
                    : newConnectionAnchor?.nodeId === node.id ? newConnectionAnchor
                      : singleSelectedNodeId === node.id ? connectionAnchorAtSide(node, "bottom")
                        : null;
                return (
                  <div
                    key={node.id}
                    data-node-id={node.id}
                    className={`mission-node ${node.type ?? "normal"} ${node.bucket ?? "main"} ${node.state} ${selectedNodeIds.has(node.id) ? "selected" : ""} ${linkSelected ? "link-selected" : ""} ${dropPreview ? "drop-preview" : ""} ${invalidDrop ? "drop-invalid" : ""}`}
                    style={{ left: node.x, top: node.y, width: node.width }}
                    onPointerDown={(event) => startNodeDrag(event, node.id)}
                    onPointerMove={(event) => updateNewConnectionAnchor(event, node)}
                    onPointerLeave={() => clearNewConnectionAnchor(node.id)}
                  >
                    <div className="mission-node-head"><span>{resolveKicker(node)}</span><button aria-label={ux(language, "cardMenu")} onClick={(event) => openCardMenu(event, node.id)}>⋯</button></div>
                    <div className="mission-node-title">{resolveNodeTitle(node)}</div>
                    <div className="mission-node-state"><i />{stateLabel(node.state)}</div>
                    {nodePorts(node).map((port) => (
                      <button
                        key={port.key}
                        className={`node-connector ${port.side} ${port.role} ${port.connected ? "connected" : ""}`}
                        style={{ left: port.x, top: port.y }}
                        aria-label={ux(language, "connect")}
                        onPointerDown={(event) => startPortDrag(event, port, node.id)}
                      />
                    ))}
                    {addAnchor && (
                      <button
                        className={`new-connection-trigger ${connectionDraft ? "active" : ""} ${addAnchor.side}`}
                        style={{ left: addAnchor.x, top: addAnchor.y }}
                        aria-label={ux(language, "newConnection")}
                        title={ux(language, "newConnection")}
                        onPointerDown={(event) => startConnection(event, node.id, addAnchor)}
                      ><span>+</span></button>
                    )}
                  </div>
                );
              })}

              {portDragPreview?.targetNodeId === null && (
                <div className={`dragged-port-preview ${portDragPreview.invalidReason ? "invalid" : ""}`} style={{ left: portDragPreview.x, top: portDragPreview.y }} />
              )}
              {connectionDraft?.targetNodeId === null && connectionDraft.invalidReason && (
                <div className="dragged-port-preview invalid" style={{ left: connectionDraft.x, top: connectionDraft.y }} />
              )}
              {selectionBox && (
                <div
                  className="selection-marquee"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.x),
                    top: Math.min(selectionBox.startY, selectionBox.y),
                    width: Math.abs(selectionBox.x - selectionBox.startX),
                    height: Math.abs(selectionBox.y - selectionBox.startY)
                  }}
                />
              )}
            </div>

            <div className="zoom-toolbar" data-control>
              <button aria-label={ux(language, "undo")} title={`${ux(language, "undo")} (Ctrl+Z)`} disabled={!historyAvailability.canUndo} onClick={undoLastBoardChange}>↶</button>
              <button aria-label={ux(language, "redo")} title={`${ux(language, "redo")} (Ctrl+Shift+Z)`} disabled={!historyAvailability.canRedo} onClick={redoLastBoardChange}>↷</button>
              <i className="toolbar-divider" />
              <button className={selectionMode ? "selection-tool active" : "selection-tool"} aria-label={ux(language, "selectRegion")} title={`${ux(language, "selectRegion")} (Ctrl+arrastar)`} aria-pressed={selectionMode} onClick={() => setSelectionMode((current) => !current)}><i /></button>
              <i className="toolbar-divider" />
              <button aria-label={ux(language, "zoomOut")} title={ux(language, "zoomOut")} onClick={() => zoomBy(0.9)}>−</button>
              <span className="zoom-value">{Math.round(transform.scale * 100)}%</span>
              <button aria-label={ux(language, "zoomIn")} title={ux(language, "zoomIn")} onClick={() => zoomBy(1.1)}>+</button>
              <button aria-label={ux(language, "fit")} title={ux(language, "fit")} onClick={fitAll}>⌂</button>
            </div>
          </div> : <BrainstormLab language={language} project={project} onBoardChange={syncExplorationBoard} />}

          <footer className="brain-footer">
            {workspaceMode === "lab" && <output id="brainstorm-lab-status" className="brain-lab-page-status" />}
            <span>{t("brainstorm.canContinue")}</span>
            <div><button onClick={onBackSetup}>{ux(language, "back")}</button><button className="primary">{t("common.continue")} →</button></div>
          </footer>
        </section>
      </main>

      {workspaceMode === "map" && nodeMenu && nodeMenuNode && (
        <div className="node-menu-v2" style={{ left: nodeMenu.x, top: nodeMenu.y }} data-panel>
          <div className="node-menu-label">{t("brainstorm.cardState")}</div>
          <button onClick={() => setNodeState(nodeMenuNode.id, "defined")}>{t("common.defined")}</button>
          <button onClick={() => setNodeState(nodeMenuNode.id, "hypothesis")}>{t("common.hypothesis")}</button>
          <button onClick={() => setNodeState(nodeMenuNode.id, "open")}>{t("common.open")}</button>
          <button onClick={() => setNodeState(nodeMenuNode.id, "closed")}>{t("common.closed")}</button>
          <hr />
          <button onClick={() => openEditCard(nodeMenuNode.id)}>{ux(language, "edit")}</button>
          <hr />
          <button className="danger" onClick={() => deleteNode(nodeMenuNode.id)}>{t("brainstorm.deleteCard")}</button>
        </div>
      )}

      {workspaceMode === "map" && cardModalOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setCardModalOpen(false); }}>
          <div className="idea-modal">
            <button className="modal-close" onClick={() => setCardModalOpen(false)}>×</button>
            <div className="modal-eyebrow">{editingNodeId !== null ? ux(language, "editCard") : ux(language, "newCard")}</div>
            <h2>{ux(language, "cardText")}</h2>
            <textarea
              autoFocus
              rows={4}
              value={cardText}
              onChange={(event) => { if (countWords(event.target.value) <= MAX_CARD_WORDS) setCardText(event.target.value); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  saveCard();
                }
              }}
            />
            <div className="word-limit"><span>{ux(language, "cardWords")}</span><strong>{countWords(cardText)} / {MAX_CARD_WORDS}</strong></div>
            <div className="modal-actions"><button className="technical-button" onClick={() => setCardModalOpen(false)}>{ux(language, "cancel")}</button><button className="technical-button primary" onClick={saveCard}>{ux(language, "saveCard")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
