import { useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "../components/Brand";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { canCloseProblemPhase, createInitialLinks, createInitialNodes, getCheckpoints, getIssues, getProgress, getVisibleNodeIds, limitWords, MAX_CARD_WORDS } from "../lib/missionModel";
import type { Language, MissionIssue, MissionLink, MissionNode, NodeState } from "../lib/types";

type Props = {
  language: Language;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onHome: () => void;
};

type Transform = { scale: number; x: number; y: number };
type ConnectionDraft = { from: number; x: number; y: number } | null;
type NodeMenu = { id: number; x: number; y: number } | null;

const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 1600;
const DEFAULT_NODE_HEIGHT = 110;

export function BrainstormPage({ language, t, onLanguageChange, onHome }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nodes, setNodes] = useState<MissionNode[]>(createInitialNodes);
  const [links, setLinks] = useState<MissionLink[]>(createInitialLinks);
  const [transform, setTransform] = useState<Transform>({ scale: 0.72, x: -70, y: -40 });
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());
  const [nodeMenu, setNodeMenu] = useState<NodeMenu>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [ideaText, setIdeaText] = useState("");
  const [focusRootId, setFocusRootId] = useState<number | null>(null);
  const [pageStack, setPageStack] = useState<(number | null)[]>([]);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>(null);
  const [phaseClosed, setPhaseClosed] = useState(false);
  const [nextNodeId, setNextNodeId] = useState(30);
  const [nextLinkId, setNextLinkId] = useState(200);

  const issues = useMemo(() => getIssues(nodes), [nodes]);
  const checkpoints = useMemo(() => getCheckpoints(nodes), [nodes]);
  const progress = useMemo(() => getProgress(nodes), [nodes]);
  const phaseCanClose = useMemo(() => canCloseProblemPhase(nodes), [nodes]);
  const visibleNodeIds = useMemo(() => getVisibleNodeIds(focusRootId, nodes, links), [focusRootId, links, nodes]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.key === "Delete" || event.key === "Backspace") && selectedLinkId !== null && document.activeElement?.tagName !== "TEXTAREA") deleteLink(selectedLinkId);
      if (event.key === "Escape") closeTransientPanels();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLinkId]);

  function resolveNodeTitle(node: MissionNode): string {
    return node.titleKey ? t(node.titleKey) : node.title ?? "";
  }

  function stateLabel(state: NodeState): string {
    if (state === "defined") return t("common.defined");
    if (state === "hypothesis") return t("common.hypothesis");
    if (state === "closed") return t("common.closed");
    return t("common.open");
  }

  function closeTransientPanels() {
    setNodeMenu(null);
    setProgressOpen(false);
    setIssuesOpen(false);
    setSelectedLinkId(null);
    setSelectedNodeId(null);
    setHighlightIds(new Set());
    setConnectionDraft(null);
  }

  function worldPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - transform.x) / transform.scale, y: (clientY - rect.top - transform.y) / transform.scale };
  }

  function nodeCenter(node: MissionNode): { x: number; y: number } {
    return { x: node.x + node.width / 2, y: node.y + DEFAULT_NODE_HEIGHT / 2 };
  }

  function linkPath(link: MissionLink): string {
    const from = nodes.find((node) => node.id === link.from);
    const to = nodes.find((node) => node.id === link.to);
    if (!from || !to) return "";
    const a = nodeCenter(from);
    const b = nodeCenter(to);
    const midX = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
  }

  function issuePath(issue: MissionIssue): string {
    if (issue.nodeIds.length < 2) return "";
    const from = nodes.find((node) => node.id === issue.nodeIds[0]);
    const to = nodes.find((node) => node.id === issue.nodeIds[1]);
    if (!from || !to) return "";
    const a = nodeCenter(from);
    const b = nodeCenter(to);
    const midY = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
  }

  function setNodeState(id: number, state: NodeState) {
    setNodes((current) => current.map((node) => node.id === id ? { ...node, state } : node));
    setNodeMenu(null);
    setPhaseClosed(false);
  }

  function deleteNode(id: number) {
    setNodes((current) => current.filter((node) => node.id !== id));
    setLinks((current) => current.filter((link) => link.from !== id && link.to !== id));
    setNodeMenu(null);
    setSelectedNodeId(null);
    setPhaseClosed(false);
  }

  function deleteLink(id: number) {
    setLinks((current) => current.filter((link) => link.id !== id));
    setSelectedLinkId(null);
    setPhaseClosed(false);
  }

  function createLink(from: number, to: number, type: "normal" | "suggestion" = "normal") {
    if (from === to) return;
    const exists = links.some((link) => (link.from === from && link.to === to) || (link.from === to && link.to === from));
    if (exists) return;
    const link: MissionLink = { id: nextLinkId, from, to, type };
    setLinks((current) => [...current, link]);
    setNextLinkId((current) => current + 1);
    setPhaseClosed(false);
  }

  function startNodeDrag(event: React.PointerEvent, id: number) {
    event.preventDefault();
    event.stopPropagation();
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    const start = worldPoint(event.clientX, event.clientY);
    const offsetX = start.x - node.x;
    const offsetY = start.y - node.y;
    const pointerId = event.pointerId;
    const nodeWidth = node.width;
    (event.currentTarget as HTMLElement).setPointerCapture(pointerId);

    function move(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      const point = worldPoint(moveEvent.clientX, moveEvent.clientY);
      const x = Math.max(0, Math.min(WORLD_WIDTH - nodeWidth, point.x - offsetX));
      const y = Math.max(0, Math.min(WORLD_HEIGHT - DEFAULT_NODE_HEIGHT, point.y - offsetY));
      setNodes((current) => current.map((item) => item.id === id ? { ...item, x, y } : item));
    }

    function stop(stopEvent: PointerEvent) {
      if (stopEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function startConnection(event: React.PointerEvent, id: number) {
    event.preventDefault();
    event.stopPropagation();
    const point = worldPoint(event.clientX, event.clientY);
    setConnectionDraft({ from: id, x: point.x, y: point.y });
    setSelectedNodeId(id);
    setSelectedLinkId(null);

    function move(moveEvent: PointerEvent) {
      const currentPoint = worldPoint(moveEvent.clientX, moveEvent.clientY);
      setConnectionDraft({ from: id, x: currentPoint.x, y: currentPoint.y });
    }

    function stop(stopEvent: PointerEvent) {
      const element = document.elementFromPoint(stopEvent.clientX, stopEvent.clientY) as HTMLElement | null;
      const nodeElement = element?.closest<HTMLElement>("[data-node-id]");
      const targetId = nodeElement ? Number(nodeElement.dataset.nodeId) : NaN;
      if (Number.isFinite(targetId) && targetId !== id) createLink(id, targetId);
      setConnectionDraft(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function startPan(event: React.PointerEvent) {
    if ((event.target as HTMLElement).closest("[data-node-id], [data-panel], [data-control], path")) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = transform.x;
    const originY = transform.y;
    const pointerId = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(pointerId);

    function move(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      setTransform((current) => ({ ...current, x: originX + moveEvent.clientX - startX, y: originY + moveEvent.clientY - startY }));
    }

    function stop(stopEvent: PointerEvent) {
      if (stopEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }

    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setHighlightIds(new Set());
    setNodeMenu(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function zoomBy(factor: number) {
    setTransform((current) => ({ ...current, scale: Math.max(0.4, Math.min(1.8, current.scale * factor)) }));
  }

  function onWheel(event: React.WheelEvent) {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.08 : 0.92);
  }

  function fitNodeIds(ids: number[]) {
    const viewport = viewportRef.current;
    const selected = nodes.filter((node) => ids.includes(node.id));
    if (!viewport || selected.length === 0) return;
    const rect = viewport.getBoundingClientRect();
    const minX = Math.min(...selected.map((node) => node.x));
    const minY = Math.min(...selected.map((node) => node.y));
    const maxX = Math.max(...selected.map((node) => node.x + node.width));
    const maxY = Math.max(...selected.map((node) => node.y + DEFAULT_NODE_HEIGHT));
    const width = Math.max(320, maxX - minX);
    const height = Math.max(220, maxY - minY);
    const scale = Math.max(0.42, Math.min(1.25, Math.min((rect.width - 180) / width, (rect.height - 150) / height)));
    const x = rect.width / 2 - (minX + width / 2) * scale;
    const y = rect.height / 2 - (minY + height / 2) * scale;
    setTransform({ scale, x, y });
  }

  function fitAll() {
    fitNodeIds(Array.from(visibleNodeIds));
  }

  function focusIssue(issue: MissionIssue) {
    setHighlightIds(new Set(issue.nodeIds));
    setIssuesOpen(false);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    window.setTimeout(() => fitNodeIds(issue.nodeIds), 0);
  }

  function addIssueSuggestion(issue: MissionIssue, suggestionIndex: number) {
    const suggestion = issue.suggestions[suggestionIndex];
    if (!suggestion) return;
    const related = nodes.filter((node) => issue.nodeIds.includes(node.id));
    const x = related.reduce((sum, node) => sum + node.x, 0) / Math.max(related.length, 1) + 300;
    const y = related.reduce((sum, node) => sum + node.y, 0) / Math.max(related.length, 1) + 150;
    const kickerKey = issue.key === "beneficiary" ? "nodes.beneficiaryKicker" : "nodes.resolutionKicker";
    const newNode: MissionNode = { id: nextNodeId, x, y, width: 240, titleKey: suggestion.titleKey, kickerKey, state: "hypothesis", type: "suggestion", issueKey: issue.key };
    const newLinks = issue.nodeIds.map((nodeId, index) => ({ id: nextLinkId + index, from: nodeId, to: nextNodeId, type: "suggestion" as const }));
    setNodes((current) => [...current, newNode]);
    setLinks((current) => [...current, ...newLinks]);
    setNextNodeId((current) => current + 1);
    setNextLinkId((current) => current + newLinks.length);
    setHighlightIds(new Set([...issue.nodeIds, newNode.id]));
    setIssuesOpen(false);
    setPhaseClosed(false);
    window.setTimeout(() => fitNodeIds([...issue.nodeIds, newNode.id]), 0);
  }

  function generatedBranchKeys(node: MissionNode): string[] {
    if (node.titleKey === "nodes.startTitle") return ["generated.detectNew", "generated.followFire"];
    if (node.titleKey === "nodes.responseTitle") return ["generated.immediateAlert", "generated.periodicUpdate"];
    if (node.titleKey === "nodes.coverageTitle") return ["generated.amazon", "generated.otherRegions"];
    if (node.titleKey === "nodes.thermalTitle") return ["generated.thermalAnomaly", "generated.thermalVisual"];
    return ["generated.exploreImpact", "generated.exploreAlternative"];
  }

  function generatedQuestionKey(node: MissionNode): string {
    if (node.titleKey === "nodes.responseTitle") return "generated.timeQuestion";
    if (node.titleKey === "nodes.coverageTitle") return "generated.coverageQuestion";
    if (node.titleKey === "nodes.thermalTitle") return "generated.thermalQuestion";
    if (node.titleKey === "nodes.detectTitle") return "generated.detectionQuestion";
    return "generated.genericQuestion";
  }

  function addBranch(id: number) {
    const parent = nodes.find((node) => node.id === id);
    if (!parent) return;
    const keys = generatedBranchKeys(parent);
    const first: MissionNode = { id: nextNodeId, x: parent.x + parent.width + 120, y: parent.y - 30, width: 240, titleKey: keys[0], kickerKey: "nodes.possibilityKicker", state: "open", type: "normal" };
    const second: MissionNode = { id: nextNodeId + 1, x: parent.x + parent.width + 120, y: parent.y + 150, width: 240, titleKey: keys[1], kickerKey: "nodes.possibilityKicker", state: "open", type: "normal" };
    const firstLink: MissionLink = { id: nextLinkId, from: id, to: first.id, type: "normal" };
    const secondLink: MissionLink = { id: nextLinkId + 1, from: id, to: second.id, type: "normal" };
    setNodes((current) => [...current, first, second]);
    setLinks((current) => [...current, firstLink, secondLink]);
    setNextNodeId((current) => current + 2);
    setNextLinkId((current) => current + 2);
    setNodeMenu(null);
    setPhaseClosed(false);
  }

  function addQuestion(id: number) {
    const parent = nodes.find((node) => node.id === id);
    if (!parent) return;
    const node: MissionNode = { id: nextNodeId, x: parent.x + 60, y: parent.y + 180, width: 240, titleKey: generatedQuestionKey(parent), kickerKey: "nodes.questionKicker", state: "open", type: "question" };
    const link: MissionLink = { id: nextLinkId, from: id, to: node.id, type: "normal" };
    setNodes((current) => [...current, node]);
    setLinks((current) => [...current, link]);
    setNextNodeId((current) => current + 1);
    setNextLinkId((current) => current + 1);
    setNodeMenu(null);
    setPhaseClosed(false);
  }

  function createCheckpointHypothesis(key: string) {
    const root = nodes.find((node) => node.type === "center");
    if (!root) return;
    const map: Record<string, { titleKey: string; kickerKey: string }> = {
      problem: { titleKey: "generated.problemHypothesis", kickerKey: "nodes.problemKicker" },
      result: { titleKey: "generated.resultHypothesis", kickerKey: "nodes.resultKicker" },
      context: { titleKey: "generated.contextHypothesis", kickerKey: "nodes.contextKicker" },
      beneficiary: { titleKey: "generated.beneficiaryHypothesis", kickerKey: "nodes.beneficiaryKicker" },
      time: { titleKey: "generated.timeHypothesis", kickerKey: "nodes.timeKicker" },
      constraints: { titleKey: "generated.constraintsHypothesis", kickerKey: "nodes.constraintKicker" }
    };
    const preset = map[key];
    if (!preset) return;
    const node: MissionNode = { id: nextNodeId, x: root.x + 430, y: root.y + 250, width: 240, titleKey: preset.titleKey, kickerKey: preset.kickerKey, state: "hypothesis", type: "suggestion" };
    const link: MissionLink = { id: nextLinkId, from: root.id, to: node.id, type: "suggestion" };
    setNodes((current) => [...current, node]);
    setLinks((current) => [...current, link]);
    setNextNodeId((current) => current + 1);
    setNextLinkId((current) => current + 1);
    setProgressOpen(false);
    setHighlightIds(new Set([root.id, node.id]));
    setPhaseClosed(false);
    window.setTimeout(() => fitNodeIds([root.id, node.id]), 0);
  }

  function organizeHierarchy() {
    const root = focusRootId !== null ? nodes.find((node) => node.id === focusRootId) : nodes.find((node) => node.type === "center");
    if (!root) return;
    const levels = new Map<number, number[]>();
    const visited = new Set<number>([root.id]);
    const queue: { id: number; depth: number }[] = [{ id: root.id, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const level = levels.get(current.depth) ?? [];
      level.push(current.id);
      levels.set(current.depth, level);
      for (const link of links) {
        if (link.from === current.id && visibleNodeIds.has(link.to) && !visited.has(link.to)) {
          visited.add(link.to);
          queue.push({ id: link.to, depth: current.depth + 1 });
        }
      }
    }

    const remaining = Array.from(visibleNodeIds).filter((id) => !visited.has(id));
    if (remaining.length > 0) levels.set(3, [...(levels.get(3) ?? []), ...remaining]);

    setNodes((current) => current.map((node) => {
      for (const [depth, ids] of levels) {
        const index = ids.indexOf(node.id);
        if (index >= 0) return { ...node, x: 260 + depth * 500, y: 180 + index * 210 };
      }
      return node;
    }));
    window.setTimeout(fitAll, 0);
  }

  function openNodeAsPage(id: number) {
    setPageStack((current) => [...current, focusRootId]);
    setFocusRootId(id);
    setNodeMenu(null);
    setHighlightIds(new Set());
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    const ids = Array.from(getVisibleNodeIds(id, nodes, links));
    window.setTimeout(() => fitNodeIds(ids), 0);
  }

  function backPage() {
    const stack = [...pageStack];
    const previous = stack.pop() ?? null;
    setPageStack(stack);
    setFocusRootId(previous);
    setHighlightIds(new Set());
    const ids = Array.from(getVisibleNodeIds(previous, nodes, links));
    window.setTimeout(() => fitNodeIds(ids), 0);
  }

  function openEdit(id: number) {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    setEditingNodeId(id);
    setIdeaText(resolveNodeTitle(node));
    setIdeaModalOpen(true);
    setNodeMenu(null);
  }

  function saveIdea() {
    const limited = limitWords(ideaText);
    if (!limited) return;

    if (editingNodeId !== null) {
      setNodes((current) => current.map((node) => node.id === editingNodeId ? { ...node, title: limited, titleKey: undefined } : node));
    } else {
      const viewport = viewportRef.current;
      const rect = viewport?.getBoundingClientRect();
      const x = rect ? (rect.width / 2 - transform.x) / transform.scale - 120 : 800;
      const y = rect ? (rect.height / 2 - transform.y) / transform.scale - 50 : 500;
      const node: MissionNode = { id: nextNodeId, x, y, width: 240, title: limited, kickerKey: "nodes.freeIdeaKicker", state: "open", type: "normal" };
      setNodes((current) => [...current, node]);
      if (focusRootId !== null) createLink(focusRootId, node.id);
      setNextNodeId((current) => current + 1);
    }

    setIdeaModalOpen(false);
    setEditingNodeId(null);
    setIdeaText("");
    setPhaseClosed(false);
  }

  function phaseValidationText(): string {
    if (phaseClosed) return t("brainstorm.phaseClosedDescription");
    if (phaseCanClose) return t("brainstorm.allRequired");
    const missing = checkpoints.filter((checkpoint) => checkpoint.mandatory && checkpoint.state !== "defined");
    const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
    const missingText = missing.length > 0 ? `${t("brainstorm.missingPrefix")} ${missing.map((checkpoint) => t(checkpoint.nameKey)).join(", ")}.` : "";
    const issueText = criticalCount > 0 ? ` ${criticalCount} ${criticalCount === 1 ? t("brainstorm.criticalIssueSuffix") : t("brainstorm.criticalIssuesSuffix")}` : "";
    return `${missingText}${issueText}`.trim();
  }

  const issueLinkIds = useMemo(() => {
    const ids = new Set<number>();
    for (const issue of issues) {
      for (const link of links) {
        if ((issue.nodeIds.includes(link.from) || issue.nodeIds.includes(link.to)) && link.type === "normal") ids.add(link.id);
      }
    }
    return ids;
  }, [issues, links]);

  const selectedLink = links.find((link) => link.id === selectedLinkId);
  const draftPath = connectionDraft ? (() => {
    const source = nodes.find((node) => node.id === connectionDraft.from);
    if (!source) return "";
    const a = nodeCenter(source);
    const midX = (a.x + connectionDraft.x) / 2;
    return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${connectionDraft.y}, ${connectionDraft.x} ${connectionDraft.y}`;
  })() : "";

  return (
    <div className="brain-shell">
      <aside className={sidebarOpen ? "brain-sidebar open" : "brain-sidebar"}>
        <Brand />
        <nav className="brain-nav">
          <button className="brain-nav-item" onClick={onHome}>⌂ <span>{t("home.start")}</span></button>
          <button className="brain-nav-item" onClick={onHome}>▱ <span>{t("home.openProject")}</span></button>
          <div className="brain-nav-section">{t("brainstorm.createMission").toUpperCase()}</div>
          <button className="brain-nav-item active">◇ <span>{t("brainstorm.buildFromZero")}</span></button>
          <div className="step-list">
            <div className="step done"><span>01</span>{t("brainstorm.pointStart")}</div>
            <div className={phaseClosed ? "step active done" : "step active"}><span>02</span>{t("brainstorm.problem")}</div>
            <div className="step"><span>03</span>{t("brainstorm.context")}</div>
            <div className="step"><span>04</span>{t("brainstorm.objectives")}</div>
            <div className="step"><span>05</span>{t("brainstorm.concept")}</div>
            <div className="step"><span>06</span>{t("brainstorm.observationPayload")}</div>
            <div className="step"><span>07</span>{t("brainstorm.platform")}</div>
            <div className="step"><span>08</span>{t("brainstorm.orbitOperation")}</div>
            <div className="step"><span>09</span>{t("brainstorm.systemSoftware")}</div>
            <div className="step"><span>10</span>{t("brainstorm.review")}</div>
          </div>
          <button className="brain-nav-item">▤ <span>{t("brainstorm.documentation")}</span></button>
          <button className="brain-nav-item">⚙ <span>{t("brainstorm.settings")}</span></button>
        </nav>
        <div className="brain-sidebar-user"><UserBadge connectedLabel={t("common.connected")} /></div>
      </aside>

      <button className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"} aria-label={t("common.close")} onClick={() => setSidebarOpen(false)} />

      <main className="brain-main">
        <header className="brain-topbar">
          <div className="brain-top-left"><button className="mobile-menu" onClick={() => setSidebarOpen(true)}>☰</button><div className="breadcrumb"><span>{t("brainstorm.createMission")}</span><span>›</span><strong>{t("brainstorm.problem")}</strong>{focusRootId !== null && <><span>›</span><span>{resolveNodeTitle(nodes.find((node) => node.id === focusRootId) ?? nodes[0]).slice(0, 32)}</span></>}</div></div>
          <div className="brain-top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <section className="brain-workspace">
          <div className="brain-title-row">
            <div className="brain-title"><span>{t("brainstorm.phaseStep")}</span><h1>{t("brainstorm.room")}</h1></div>
            <div className="brain-toolbar">
              <button onClick={organizeHierarchy}>{t("brainstorm.organize")}</button>
              <button className="issues-button" onClick={() => { setIssuesOpen(true); setProgressOpen(false); }}>{t("brainstorm.inconsistencies")} {issues.length}</button>
              <button className="progress-button" onClick={() => { setProgressOpen(true); setIssuesOpen(false); }}><span>{t("brainstorm.missionDefinition")}</span><strong>{progress}%</strong><i><b style={{ width: `${progress}%` }} /></i></button>
              <button className="primary" onClick={() => { setEditingNodeId(null); setIdeaText(""); setIdeaModalOpen(true); }}>{t("brainstorm.newIdea")}</button>
            </div>
          </div>

          <div className="board-viewport" ref={viewportRef} onPointerDown={startPan} onWheel={onWheel}>
            <div className="canvas-hint">{t("brainstorm.canvasHint")}</div>
            {focusRootId !== null && <div className="focus-bar" data-control><button onClick={backPage}>{t("brainstorm.focusBack")}</button><span>{resolveNodeTitle(nodes.find((node) => node.id === focusRootId) ?? nodes[0])}</span></div>}
            <div className="board-world" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
              <svg className="board-lines" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}>
                {links.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to)).map((link) => <g key={link.id}><path className={`link-line ${link.type === "suggestion" ? "suggestion" : ""} ${issueLinkIds.has(link.id) ? "issue" : ""} ${selectedLinkId === link.id ? "selected" : ""}`} d={linkPath(link)} /><path className="link-hit" d={linkPath(link)} onPointerDown={(event) => { event.stopPropagation(); setSelectedLinkId(link.id); setSelectedNodeId(null); setHighlightIds(new Set()); }} /></g>)}
                {issues.filter((issue) => issue.nodeIds.every((id) => visibleNodeIds.has(id))).map((issue) => issue.nodeIds.length > 1 ? <g key={`issue-${issue.key}`}><path className="issue-overlay" d={issuePath(issue)} /><path className="issue-hit" d={issuePath(issue)} onPointerDown={(event) => { event.stopPropagation(); focusIssue(issue); }} /></g> : null)}
                {connectionDraft && <path className="draft-line" d={draftPath} />}
              </svg>

              {nodes.filter((node) => visibleNodeIds.has(node.id)).map((node) => (
                <article key={node.id} data-node-id={node.id} className={`board-node ${node.type ?? "normal"} state-${node.state} ${selectedNodeId === node.id ? "selected" : ""} ${highlightIds.has(node.id) ? "highlight" : ""} ${issues.some((issue) => issue.nodeIds.includes(node.id)) ? "problem" : ""}`} style={{ left: node.x, top: node.y, width: node.width }} onPointerDown={(event) => event.stopPropagation()} onClick={() => { if (connectionDraft && connectionDraft.from !== node.id) { createLink(connectionDraft.from, node.id); setConnectionDraft(null); } else { setSelectedNodeId(node.id); setSelectedLinkId(null); } }}>
                  <header><button className="node-drag" onPointerDown={(event) => startNodeDrag(event, node.id)}>{t(node.kickerKey)}</button><button className="node-kebab" onClick={(event) => { event.stopPropagation(); setNodeMenu({ id: node.id, x: event.clientX, y: event.clientY }); }}>⋯</button></header>
                  <div className="node-title">{resolveNodeTitle(node)}</div>
                  <div className={`node-state ${node.state}`}>{stateLabel(node.state)}</div>
                  <button className="connector left" aria-label="Connect" onPointerDown={(event) => startConnection(event, node.id)} />
                  <button className="connector right" aria-label="Connect" onPointerDown={(event) => startConnection(event, node.id)} />
                  <button className="connector top" aria-label="Connect" onPointerDown={(event) => startConnection(event, node.id)} />
                  <button className="connector bottom" aria-label="Connect" onPointerDown={(event) => startConnection(event, node.id)} />
                </article>
              ))}
            </div>

            {selectedLink && <div className="link-toolbar" data-control><span>{t("brainstorm.selectedConnection")}</span><button onClick={() => deleteLink(selectedLink.id)}>{t("common.delete")}</button></div>}
            <div className="zoom-controls" data-control><button aria-label={t("brainstorm.zoomOut")} onClick={() => zoomBy(0.9)}>−</button><span>{Math.round(transform.scale * 100)}%</span><button aria-label={t("brainstorm.zoomIn")} onClick={() => zoomBy(1.1)}>+</button><button aria-label={t("brainstorm.fit")} onClick={fitAll}>⌂</button></div>

            <aside className={progressOpen ? "drawer visible" : "drawer"} data-panel>
              <div className="drawer-head"><h2>{t("brainstorm.criteria")}</h2><button onClick={() => setProgressOpen(false)}>×</button></div>
              {checkpoints.map((checkpoint) => <div className="checkpoint" key={checkpoint.key}><div className="checkpoint-title"><strong>{t(checkpoint.nameKey)}{checkpoint.mandatory ? " *" : ""}</strong><span className={checkpoint.state}>{stateLabel(checkpoint.state)}</span></div><p>{t(checkpoint.descriptionKey)}</p><div className="checkpoint-actions"><button onClick={() => { const ids = checkpoint.evidence.map((node) => node.id); setHighlightIds(new Set(ids)); setProgressOpen(false); if (ids.length > 0) window.setTimeout(() => fitNodeIds(ids), 0); }}>{t("brainstorm.showEvidence")}</button>{checkpoint.state !== "defined" && <button onClick={() => createCheckpointHypothesis(checkpoint.key)}>{t("brainstorm.createHypothesis")}</button>}</div></div>)}
              <div className="phase-validation"><h3>{t("brainstorm.validation")}</h3><p>{phaseValidationText()}</p><button className="primary" disabled={!phaseCanClose || phaseClosed} onClick={() => { if (phaseCanClose) setPhaseClosed(true); }}>{phaseClosed ? t("brainstorm.validated") : t("brainstorm.closePhase")}</button></div>
            </aside>

            <aside className={issuesOpen ? "drawer visible" : "drawer"} data-panel>
              <div className="drawer-head"><h2>{t("brainstorm.issuesAndGaps")}</h2><button onClick={() => setIssuesOpen(false)}>×</button></div>
              {issues.length === 0 && <div className="empty-panel"><strong>{t("brainstorm.noIssues")}</strong><p>{t("brainstorm.noIssuesDescription")}</p></div>}
              {issues.map((issue) => <div className="issue-card" key={issue.key}><button className="issue-main" onClick={() => focusIssue(issue)}><strong>{t(issue.titleKey)}</strong><span>{t(issue.descriptionKey)}</span></button><div className="issue-actions"><button onClick={() => focusIssue(issue)}>{t("brainstorm.showMap")}</button><button onClick={() => setExpandedIssue(expandedIssue === issue.key ? null : issue.key)}>{t("brainstorm.exploreSolutions")}</button></div>{expandedIssue === issue.key && <div className="suggestion-list">{issue.suggestions.map((suggestion, index) => <div className="suggestion-card" key={suggestion.titleKey}><strong>{t(suggestion.titleKey)}</strong><p>{t(suggestion.descriptionKey)}</p><button onClick={() => addIssueSuggestion(issue, index)}>{t("brainstorm.addAsHypothesis")}</button></div>)}</div>}</div>)}
            </aside>
          </div>

          <footer className="brain-footer"><span>{phaseClosed ? t("brainstorm.phaseValidated") : t("brainstorm.canContinue")}</span><div><button>{t("common.back")}</button><button className="primary">{t("common.continue")} →</button></div></footer>
        </section>
      </main>

      {nodeMenu && <div className="node-menu" style={{ left: Math.min(nodeMenu.x + 8, window.innerWidth - 250), top: Math.min(nodeMenu.y + 8, window.innerHeight - 360) }} data-panel><span>{t("brainstorm.cardState")}</span><button onClick={() => setNodeState(nodeMenu.id, "defined")}>{t("common.defined")}</button><button onClick={() => setNodeState(nodeMenu.id, "hypothesis")}>{t("common.hypothesis")}</button><button onClick={() => setNodeState(nodeMenu.id, "open")}>{t("common.open")}</button><button onClick={() => setNodeState(nodeMenu.id, "closed")}>{t("common.closed")}</button><hr /><button onClick={() => openEdit(nodeMenu.id)}>{t("brainstorm.editText")}</button><button onClick={() => addBranch(nodeMenu.id)}>{t("brainstorm.branch")}</button><button onClick={() => addQuestion(nodeMenu.id)}>{t("brainstorm.question")}</button><button onClick={() => openNodeAsPage(nodeMenu.id)}>{t("brainstorm.openPage")}</button><hr /><button onClick={() => deleteNode(nodeMenu.id)}>{t("brainstorm.deleteCard")}</button></div>}

      {ideaModalOpen && <div className="modal-backdrop"><div className="idea-modal"><button className="modal-close" onClick={() => setIdeaModalOpen(false)}>×</button><h2>{editingNodeId !== null ? t("brainstorm.editIdeaTitle") : t("brainstorm.newIdeaTitle")}</h2><textarea value={ideaText} onChange={(event) => setIdeaText(limitWords(event.target.value))} placeholder={t("brainstorm.ideaPlaceholder")} /><div className="word-limit"><span>{t("brainstorm.maxWords")}</span><strong>{ideaText.trim() ? ideaText.trim().split(/\s+/).length : 0} / {MAX_CARD_WORDS}</strong></div><div className="modal-actions"><button onClick={() => setIdeaModalOpen(false)}>{t("common.cancel")}</button><button className="primary" onClick={saveIdea}>{t("common.save")}</button></div></div></div>}
    </div>
  );
}
