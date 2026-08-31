import { useMemo, useRef, useState } from "react";
import { Brand } from "../components/Brand";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { getVisibleNodeIds, layoutTopDown, limitWords, MAX_CARD_WORDS } from "../lib/missionModel";
import { buildVirtualProjectFiles, exportProject } from "../lib/projectStore";
import type { MissionProject } from "../lib/projectStore";
import type { Language, MissionLink, MissionNode, NodeBucket, NodeState } from "../lib/types";
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
type Drawer = "files" | null;
type NodeMenu = { id: number; x: number; y: number } | null;
type PanState = { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null;
type ConnectionState = { from: number; pointerId: number; x: number; y: number } | null;

const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 1600;
const NODE_HEIGHT = 112;

export function BrainstormPage({ language, project, t, onLanguageChange, onProjectChange, onHome, onBackSetup }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<PanState>(null);
  const connectionRef = useRef<ConnectionState>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transform, setTransform] = useState<Transform>({ scale: 0.72, x: -80, y: -35 });
  const [panning, setPanning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [nodeMenu, setNodeMenu] = useState<NodeMenu>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [focusRootId, setFocusRootId] = useState<number | null>(null);
  const [pageStack, setPageStack] = useState<(number | null)[]>([]);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionState>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [cardText, setCardText] = useState("");

  const nodes = project.board.nodes;
  const links = project.board.links;
  const visibleNodeIds = useMemo(() => getVisibleNodeIds(focusRootId, nodes, links), [focusRootId, links, nodes]);
  const visibleNodes = useMemo(() => nodes.filter((node) => visibleNodeIds.has(node.id)), [nodes, visibleNodeIds]);
  const files = useMemo(() => buildVirtualProjectFiles(project), [project]);

  function updateProject(patch: Partial<MissionProject>) {
    onProjectChange({ ...project, ...patch });
  }

  function updateBoard(nextNodes: MissionNode[], nextLinks = links) {
    updateProject({ board: { nodes: nextNodes, links: nextLinks } });
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

  function linkPath(link: MissionLink): string {
    const from = nodes.find((node) => node.id === link.from);
    const to = nodes.find((node) => node.id === link.to);
    if (!from || !to) return "";
    const a = nodeCenter(from);
    const b = nodeCenter(to);
    const midY = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
  }

  function lockSelection() {
    document.body.classList.add("workspace-interacting");
  }

  function unlockSelection() {
    document.body.classList.remove("workspace-interacting");
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-node-id], [data-panel], [data-control], path")) return;
    event.preventDefault();
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: transform.x, originY: transform.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setNodeMenu(null);
    lockSelection();
  }

  function startConnection(event: React.PointerEvent<HTMLButtonElement>, from: number) {
    event.preventDefault();
    event.stopPropagation();
    const point = worldPoint(event.clientX, event.clientY);
    const draft = { from, pointerId: event.pointerId, x: point.x, y: point.y };
    connectionRef.current = draft;
    setConnectionDraft(draft);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(from);
    setSelectedLinkId(null);
    lockSelection();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
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
      const next = { ...connection, x: point.x, y: point.y };
      connectionRef.current = next;
      setConnectionDraft(next);
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const connection = connectionRef.current;
    if (connection && connection.pointerId === event.pointerId) {
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const card = element?.closest<HTMLElement>("[data-node-id]");
      const targetId = card ? Number(card.dataset.nodeId) : NaN;
      if (Number.isFinite(targetId) && targetId !== connection.from) createLink(connection.from, targetId);
    }

    panRef.current = null;
    connectionRef.current = null;
    setConnectionDraft(null);
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

  function fitNodeIds(ids: number[]) {
    const viewport = viewportRef.current;
    const selected = nodes.filter((node) => ids.includes(node.id));
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

  function createLink(from: number, to: number) {
    if (from === to) return;
    const exists = links.some((link) => (link.from === from && link.to === to) || (link.from === to && link.to === from));
    if (exists) return;
    const id = Math.max(199, ...links.map((link) => link.id)) + 1;
    updateBoard(nodes, [...links, { id, from, to, type: "normal" }]);
  }

  function deleteLink(id: number) {
    updateBoard(nodes, links.filter((link) => link.id !== id));
    setSelectedLinkId(null);
  }

  function setNodeState(id: number, state: NodeState) {
    updateBoard(nodes.map((node) => node.id === id ? { ...node, state } : node));
    setNodeMenu(null);
  }

  function setNodeBucket(id: number, bucket: NodeBucket) {
    updateBoard(nodes.map((node) => node.id === id ? { ...node, bucket } : node));
    setNodeMenu(null);
  }

  function deleteNode(id: number) {
    updateBoard(nodes.filter((node) => node.id !== id), links.filter((link) => link.from !== id && link.to !== id));
    setNodeMenu(null);
    setSelectedNodeId(null);
  }

  function addNode(title: string, bucket: NodeBucket = "ideas", parentId: number | null = null, kickerKey = "nodes.freeIdeaKicker") {
    const id = Math.max(29, ...nodes.map((node) => node.id)) + 1;
    const parent = parentId ? nodes.find((node) => node.id === parentId) : null;
    const viewportRect = viewportRef.current?.getBoundingClientRect();
    const center = worldPoint((viewportRect?.left ?? 0) + (viewportRef.current?.clientWidth ?? 1000) / 2, (viewportRect?.top ?? 0) + (viewportRef.current?.clientHeight ?? 700) / 2);
    const newNode: MissionNode = { id, x: parent ? parent.x : center.x - 120, y: parent ? parent.y + 210 : center.y - 55, width: 240, title: limitWords(title), kickerKey, state: "open", type: bucket === "questions" ? "question" : "normal", bucket };
    const nextLinks = parentId ? [...links, { id: Math.max(199, ...links.map((link) => link.id)) + 1, from: parentId, to: id, type: "normal" as const }] : links;
    updateBoard([...nodes, newNode], nextLinks);
    setSelectedNodeId(id);
  }

  function addBranch(id: number) {
    const parent = nodes.find((node) => node.id === id);
    if (!parent) return;
    const firstText = language === "pt" ? "Explorar uma consequência desta ideia" : "Explore one consequence of this idea";
    const secondText = language === "pt" ? "Explorar uma interpretação alternativa" : "Explore an alternative interpretation";
    const firstId = Math.max(29, ...nodes.map((node) => node.id)) + 1;
    const secondId = firstId + 1;
    const linkId = Math.max(199, ...links.map((link) => link.id)) + 1;
    const first: MissionNode = { id: firstId, x: parent.x - 150, y: parent.y + 220, width: 240, title: firstText, kickerKey: "nodes.possibilityKicker", state: "open", type: "normal", bucket: "main" };
    const second: MissionNode = { id: secondId, x: parent.x + 170, y: parent.y + 220, width: 240, title: secondText, kickerKey: "nodes.possibilityKicker", state: "open", type: "normal", bucket: "main" };
    updateBoard([...nodes, first, second], [...links, { id: linkId, from: id, to: firstId, type: "normal" }, { id: linkId + 1, from: id, to: secondId, type: "normal" }]);
    setNodeMenu(null);
  }

  function addQuestion(id: number) {
    const title = language === "pt" ? "Que informação falta para decidir este ponto?" : "What information is missing to decide this point?";
    addNode(title, "questions", id, "nodes.questionKicker");
    setNodeMenu(null);
  }

  function organize() {
    updateBoard(layoutTopDown(nodes, links, focusRootId, visibleNodeIds));
    window.setTimeout(fitAll, 0);
  }

  function openPage(id: number) {
    setPageStack((current) => [...current, focusRootId]);
    setFocusRootId(id);
    setDrawer(null);
    setNodeMenu(null);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    window.setTimeout(() => fitNodeIds(Array.from(getVisibleNodeIds(id, nodes, links))), 0);
  }

  function backPage() {
    const previous = pageStack.length > 0 ? pageStack[pageStack.length - 1] : null;
    setPageStack((current) => current.slice(0, -1));
    setFocusRootId(previous);
    setDrawer(null);
    window.setTimeout(() => fitNodeIds(Array.from(getVisibleNodeIds(previous, nodes, links))), 0);
  }

  function openCardMenu(event: React.MouseEvent<HTMLButtonElement>, id: number) {
    event.stopPropagation();
    setSelectedNodeId(id);
    setSelectedLinkId(null);
    setNodeMenu({ id, x: Math.min(window.innerWidth - 260, event.clientX + 8), y: Math.min(window.innerHeight - 430, event.clientY + 8) });
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
    else addNode(text, "ideas");
    setCardModalOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.key === "Delete" || event.key === "Backspace") && selectedLinkId !== null && !(event.target as HTMLElement).matches("input,textarea")) {
      event.preventDefault();
      deleteLink(selectedLinkId);
    }
  }

  const focusNode = focusRootId !== null ? nodes.find((node) => node.id === focusRootId) ?? null : null;
  const nodeMenuNode = nodeMenu ? nodes.find((node) => node.id === nodeMenu.id) ?? null : null;

  return (
    <div className="brain-shell brain-v2" onKeyDown={handleKeyDown} tabIndex={-1}>
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
          <div className="brain-nav-section">{ux(language, "projectStructure")}</div>
          <button className="brain-nav-item" onClick={() => { setDrawer("files"); setSidebarOpen(false); }}><span>▤</span><span>{ux(language, "files")}</span></button>
          <button className="brain-nav-item"><span>□</span><span>{t("brainstorm.documentation")}</span></button>
        </nav>
        <div className="brain-sidebar-user"><UserBadge connectedLabel={t("common.connected")} /></div>
      </aside>

      <button className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"} aria-label={t("common.close")} onClick={() => setSidebarOpen(false)} />

      <main className="brain-main">
        <header className="brain-topbar">
          <div className="brain-top-left">
            <button className="mobile-menu" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="brain-breadcrumb"><span>{project.name}</span><span>›</span><strong>{focusNode ? resolveNodeTitle(focusNode) : t("brainstorm.problem")}</strong></div>
          </div>
          <div className="brain-top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <section className="brain-workspace">
          <div className="brain-title-row">
            <div className="brain-title"><span>{ux(language, "problemPhase")}</span><h1>{ux(language, "conceptionRoom")}</h1></div>
            <div className="brain-toolbar" data-control>
              <button onClick={organize}>{ux(language, "organizeTopDown")}</button>
              <button className="primary" onClick={openNewCard}>{ux(language, "newIdea")}</button>
            </div>
          </div>

          <div ref={viewportRef} className={panning ? "mission-canvas panning" : "mission-canvas"} onPointerDown={startPan} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={onWheel}>
            <div className="canvas-hint">{ux(language, "dragHint")}</div>
            {focusRootId !== null && <div className="focus-chip" data-control><button onClick={backPage}>← {ux(language, "back")}</button><span>{ux(language, "currentScope")}</span><strong>{focusNode ? resolveNodeTitle(focusNode) : ""}</strong></div>}

            <div className="canvas-world" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, width: WORLD_WIDTH, height: WORLD_HEIGHT }}>
              <div className="bucket-guide ideas"><span>{ux(language, "freeIdeas")}</span></div>
              <div className="bucket-guide questions"><span>{ux(language, "openQuestions")}</span></div>

              <svg className="graph-lines" width={WORLD_WIDTH} height={WORLD_HEIGHT}>
                {links.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to)).map((link) => (
                  <g key={link.id}>
                    <path className={`graph-line ${link.type === "suggestion" ? "suggestion" : ""} ${selectedLinkId === link.id ? "selected" : ""}`} d={linkPath(link)} />
                    <path className="graph-line-hit" d={linkPath(link)} onPointerDown={(event) => { event.stopPropagation(); setSelectedLinkId(link.id); setSelectedNodeId(null); setNodeMenu(null); }} />
                  </g>
                ))}
                {connectionDraft && (() => {
                  const from = nodes.find((node) => node.id === connectionDraft.from);
                  if (!from) return null;
                  const a = nodeCenter(from);
                  const midY = (a.y + connectionDraft.y) / 2;
                  return <path className="connection-draft" d={`M ${a.x} ${a.y} C ${a.x} ${midY}, ${connectionDraft.x} ${midY}, ${connectionDraft.x} ${connectionDraft.y}`} />;
                })()}
              </svg>

              {visibleNodes.map((node) => (
                <div key={node.id} data-node-id={node.id} className={`mission-node ${node.type ?? "normal"} ${node.bucket ?? "main"} ${node.state} ${selectedNodeId === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y, width: node.width }} onPointerDown={() => { setSelectedNodeId(node.id); setSelectedLinkId(null); }}>
                  <div className="mission-node-head"><span>{resolveKicker(node)}</span><button aria-label={ux(language, "cardMenu")} onClick={(event) => openCardMenu(event, node.id)}>⋯</button></div>
                  <div className="mission-node-title">{resolveNodeTitle(node)}</div>
                  <div className="mission-node-state"><i />{stateLabel(node.state)}</div>
                  <button className="node-connector top" aria-label={ux(language, "connect")} onPointerDown={(event) => startConnection(event, node.id)} />
                  <button className="node-connector right" aria-label={ux(language, "connect")} onPointerDown={(event) => startConnection(event, node.id)} />
                  <button className="node-connector bottom" aria-label={ux(language, "connect")} onPointerDown={(event) => startConnection(event, node.id)} />
                  <button className="node-connector left" aria-label={ux(language, "connect")} onPointerDown={(event) => startConnection(event, node.id)} />
                </div>
              ))}
            </div>

            {selectedLinkId !== null && <div className="selected-link-toolbar" data-control><span>{ux(language, "connectionSelected")}</span><button onClick={() => deleteLink(selectedLinkId)}>{ux(language, "deleteConnection")}</button></div>}

            <div className="zoom-toolbar" data-control>
              <button aria-label={ux(language, "zoomOut")} onClick={() => zoomBy(0.9)}>−</button>
              <span>{Math.round(transform.scale * 100)}%</span>
              <button aria-label={ux(language, "zoomIn")} onClick={() => zoomBy(1.1)}>+</button>
              <button aria-label={ux(language, "fit")} onClick={fitAll}>⌂</button>
            </div>

            {drawer !== null && <button className="drawer-scrim" data-panel onClick={() => setDrawer(null)} aria-label={ux(language, "closePanel")} />}

            {drawer === "files" && (
              <aside className="workspace-drawer" data-panel>
                <header><div><small>{ux(language, "autosaved")}</small><h2>{ux(language, "projectFiles")}</h2></div><button className="drawer-close-button" onClick={() => setDrawer(null)}>×</button></header>
                <p className="drawer-lead">{ux(language, "filesPanelDescription")}</p>
                <div className="virtual-file-list">
                  {files.map((file) => <div className="virtual-file" key={file.path}><span>FILE</span><div><strong>{file.path}</strong><small>{file.description}</small></div></div>)}
                </div>
                <div className="template-note"><strong>{ux(language, "standardTemplate")}</strong><p>{ux(language, "templateLocked")}</p></div>
                <button className="technical-button primary export-button" onClick={() => exportProject(project)}>{ux(language, "exportProject")}</button>
                <small className="export-hint">{ux(language, "exportHint")}</small>
              </aside>
            )}
          </div>

          <footer className="brain-footer"><span>{t("brainstorm.canContinue")}</span><div><button onClick={onBackSetup}>{ux(language, "back")}</button><button className="primary">{t("common.continue")} →</button></div></footer>
        </section>
      </main>

      {nodeMenu && nodeMenuNode && (
        <div className="node-menu-v2" style={{ left: nodeMenu.x, top: nodeMenu.y }} data-panel>
          <div className="node-menu-label">{t("brainstorm.cardState")}</div>
          <button onClick={() => setNodeState(nodeMenuNode.id, "defined")}>{t("common.defined")}</button>
          <button onClick={() => setNodeState(nodeMenuNode.id, "hypothesis")}>{t("common.hypothesis")}</button>
          <button onClick={() => setNodeState(nodeMenuNode.id, "open")}>{t("common.open")}</button>
          <button onClick={() => setNodeState(nodeMenuNode.id, "closed")}>{t("common.closed")}</button>
          <hr />
          <button onClick={() => openEditCard(nodeMenuNode.id)}>{ux(language, "edit")}</button>
          <button onClick={() => addBranch(nodeMenuNode.id)}>{t("brainstorm.branch")}</button>
          <button onClick={() => addQuestion(nodeMenuNode.id)}>{t("brainstorm.question")}</button>
          <button onClick={() => openPage(nodeMenuNode.id)}>{ux(language, "openAsPage")}</button>
          <hr />
          <button onClick={() => setNodeBucket(nodeMenuNode.id, "ideas")}>{ux(language, "moveToIdeas")}</button>
          <button onClick={() => setNodeBucket(nodeMenuNode.id, "questions")}>{ux(language, "moveToQuestions")}</button>
          <button onClick={() => setNodeBucket(nodeMenuNode.id, "main")}>{ux(language, "moveToMain")}</button>
          <hr />
          <button className="danger" onClick={() => deleteNode(nodeMenuNode.id)}>{t("brainstorm.deleteCard")}</button>
        </div>
      )}

      {cardModalOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setCardModalOpen(false); }}>
          <div className="idea-modal">
            <button className="modal-close" onClick={() => setCardModalOpen(false)}>×</button>
            <div className="modal-eyebrow">{editingNodeId !== null ? ux(language, "editCard") : ux(language, "newCard")}</div>
            <h2>{ux(language, "cardText")}</h2>
            <textarea rows={4} value={cardText} onChange={(event) => setCardText(limitWords(event.target.value))} />
            <div className="word-limit"><span>{ux(language, "cardWords")}</span><strong>{cardText.trim() ? cardText.trim().split(/\s+/).length : 0} / {MAX_CARD_WORDS}</strong></div>
            <div className="modal-actions"><button className="technical-button" onClick={() => setCardModalOpen(false)}>{ux(language, "cancel")}</button><button className="technical-button primary" onClick={saveCard}>{ux(language, "saveCard")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
