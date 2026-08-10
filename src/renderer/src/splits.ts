export type SplitDirection = 'vertical' | 'horizontal'

export interface SplitLeaf {
  type: 'leaf'
  tabId: string
}

export interface SplitNode {
  type: 'node'
  id: string
  direction: SplitDirection
  ratio: number
  children: [SplitPane, SplitPane]
}

export type SplitPane = SplitLeaf | SplitNode

export type SplitTree = SplitPane | null

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SplitHandleInfo {
  path: number[]
  direction: SplitDirection
  barRect: Rect
  nodeRect: Rect
}

export interface SplitLayout {
  leaves: Map<string, Rect>
  handles: SplitHandleInfo[]
}

const MIN_RATIO = 0.15
const MAX_RATIO = 0.85

let nodeCounter = 0

function genNodeId(): string {
  nodeCounter += 1
  return `sn-${nodeCounter}-${Date.now().toString(36)}`
}

export function createLeaf(tabId: string): SplitLeaf {
  return { type: 'leaf', tabId }
}

export function isNode(pane: SplitPane): pane is SplitNode {
  return pane.type === 'node'
}

/**
 * First split ever: pair two tabs into a node.
 */
export function createInitialSplit(tabA: string, tabB: string, direction: SplitDirection): SplitNode {
  return {
    type: 'node',
    id: genNodeId(),
    direction,
    ratio: 0.5,
    children: [createLeaf(tabA), createLeaf(tabB)]
  }
}

/**
 * Replace the leaf at `path` with a node whose children are the old leaf
 * and the new tab (ratio 0.5). `newTabIndex` decides which child the new
 * tab occupies (0 = left/top, 1 = right/bottom). Returns a brand-new tree.
 * Throws if path does not point at a leaf.
 */
export function splitPaneAt(
  root: SplitTree,
  path: number[],
  newTabId: string,
  direction: SplitDirection,
  newTabIndex: 0 | 1 = 1
): SplitTree {
  if (path.length === 0) {
    throw new Error('splitPaneAt: empty path')
  }
  if (!root) {
    throw new Error('splitPaneAt: cannot split an empty tree — use createInitialSplit')
  }
  if (path.length === 1) {
    if (!isNode(root)) {
      throw new Error(`splitPaneAt: path ${path.join('.')} does not point at a node`)
    }
    const children: [SplitPane, SplitPane] = [...root.children] as [SplitPane, SplitPane]
    children[path[0]] = wrapLeaf(children[path[0]], newTabId, direction, newTabIndex)
    return { ...root, children }
  }
  if (!isNode(root)) {
    throw new Error(`splitPaneAt: path ${path.join('.')} does not point at a leaf`)
  }
  const [head, ...rest] = path
  const children: [SplitPane, SplitPane] = [...root.children] as [SplitPane, SplitPane]
  children[head] = splitPaneAt(children[head], rest, newTabId, direction, newTabIndex)
  return { ...root, children }
}

function wrapLeaf(
  pane: SplitPane,
  newTabId: string,
  direction: SplitDirection,
  newTabIndex: 0 | 1
): SplitNode {
  if (pane.type !== 'leaf') {
    throw new Error('splitPaneAt: path does not point at a leaf')
  }
  return {
    type: 'node',
    id: genNodeId(),
    direction,
    ratio: 0.5,
    children:
      newTabIndex === 0
        ? [createLeaf(newTabId), pane]
        : [pane, createLeaf(newTabId)]
  }
}

/**
 * Split a standalone tab (not in the tree) with the new tab, keeping the
 * existing tree intact: the standalone+new pair becomes a node that is
 * placed side by side with the old tree under a fresh root node.
 */
export function attachStandalone(
  root: SplitTree,
  standaloneTabId: string,
  newTabId: string,
  direction: SplitDirection,
  newTabIndex: 0 | 1 = 1
): SplitTree {
  const inner: SplitNode = {
    type: 'node',
    id: genNodeId(),
    direction,
    ratio: 0.5,
    children:
      newTabIndex === 0
        ? [createLeaf(newTabId), createLeaf(standaloneTabId)]
        : [createLeaf(standaloneTabId), createLeaf(newTabId)]
  }
  if (!root) return inner
  return {
    type: 'node',
    id: genNodeId(),
    direction,
    ratio: 0.5,
    children: [inner, root]
  }
}

/**
 * Unified split entry used by the UI.
 * - Pulls `newTabId` out of the tree first if it is already split
 *   (re-parenting a split tab).
 * - No tree → pair the two tabs (createInitialSplit).
 * - Target in tree → split that pane in place.
 * - Target standalone → attachStandalone.
 */
export function splitTreeAt(
  root: SplitTree,
  targetTabId: string,
  newTabId: string,
  direction: SplitDirection,
  newTabIndex: 0 | 1 = 1
): SplitTree {
  let base = root
  if (base && findPath(base, newTabId)) {
    base = removeTab(base, newTabId)
  }
  if (!base) {
    return createInitialSplit(
      newTabIndex === 0 ? newTabId : targetTabId,
      newTabIndex === 0 ? targetTabId : newTabId,
      direction
    )
  }
  const path = findPath(base, targetTabId)
  if (path) {
    return splitPaneAt(base, path, newTabId, direction, newTabIndex)
  }
  return attachStandalone(base, targetTabId, newTabId, direction, newTabIndex)
}

/**
 * Remove the leaf containing `tabId`. A node whose children collapse to a
 * single pane is replaced by that pane. Returns null when the tree is empty.
 */
export function removeTab(root: SplitTree, tabId: string): SplitTree {
  if (!root) return null
  if (root.type === 'leaf') {
    return root.tabId === tabId ? null : root
  }
  const [a, b] = root.children
  const newA = removeTab(a, tabId)
  const newB = removeTab(b, tabId)

  if (newA === a && newB === b) return root
  if (newA && newB) return { ...root, children: [newA, newB] }
  return newA ?? newB
}

/**
 * Update ratio of the node at `path` (clamped to 0.15–0.85).
 * `[]` targets the root itself; `[1]` targets root.children[1], etc.
 */
export function updateRatio(root: SplitTree, path: number[], ratio: number): SplitTree {
  if (!root) return root
  const clamped = Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio))
  if (path.length === 0) {
    if (!isNode(root)) return root
    return { ...root, ratio: clamped }
  }
  if (!isNode(root)) return root
  const [head, ...rest] = path
  const children: [SplitPane, SplitPane] = [...root.children] as [SplitPane, SplitPane]
  children[head] = updateRatio(children[head], rest, clamped)
  return { ...root, children }
}

/**
 * Locate the path (array of child indices from root) of the leaf holding
 * `tabId`. Returns null when absent.
 */
export function findPath(root: SplitTree, tabId: string): number[] | null {
  if (!root) return null
  if (root.type === 'leaf') return root.tabId === tabId ? [] : null
  for (let i = 0; i < 2; i++) {
    const sub = findPath(root.children[i], tabId)
    if (sub) return [i, ...sub]
  }
  return null
}

export function getTabIds(root: SplitTree): string[] {
  if (!root) return []
  if (root.type === 'leaf') return [root.tabId]
  return [...getTabIds(root.children[0]), ...getTabIds(root.children[1])]
}

/**
 * Recursively compute absolute rects for every leaf and a handle rect for
 * every internal node, given the root container rect.
 */
export function computeLayout(root: SplitTree, container: Rect): SplitLayout {
  const leaves = new Map<string, Rect>()
  const handles: SplitHandleInfo[] = []

  function visit(pane: SplitPane, path: number[], rect: Rect): void {
    if (pane.type === 'leaf') {
      leaves.set(pane.tabId, rect)
      return
    }
    const [a, b] = pane.children
    const isVertical = pane.direction === 'vertical'
    if (isVertical) {
      const leftW = rect.w * pane.ratio
      const rightW = rect.w - leftW
      visit(a, [...path, 0], { x: rect.x, y: rect.y, w: leftW, h: rect.h })
      visit(b, [...path, 1], { x: rect.x + leftW, y: rect.y, w: rightW, h: rect.h })
      handles.push({
        path,
        direction: 'vertical',
        nodeRect: rect,
        barRect: { x: rect.x + leftW - 2, y: rect.y, w: 4, h: rect.h }
      })
    } else {
      const topH = rect.h * pane.ratio
      const bottomH = rect.h - topH
      visit(a, [...path, 0], { x: rect.x, y: rect.y, w: rect.w, h: topH })
      visit(b, [...path, 1], { x: rect.x, y: rect.y + topH, w: rect.w, h: bottomH })
      handles.push({
        path,
        direction: 'horizontal',
        nodeRect: rect,
        barRect: { x: rect.x, y: rect.y + topH - 2, w: rect.w, h: 4 }
      })
    }
  }

  if (root) {
    visit(root, [], container)
  }
  return { leaves, handles }
}
