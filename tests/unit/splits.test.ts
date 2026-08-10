import { describe, it, expect } from 'vitest'
import {
  createLeaf,
  createInitialSplit,
  splitPaneAt,
  splitTreeAt,
  attachStandalone,
  removeTab,
  updateRatio,
  findPath,
  getTabIds,
  computeLayout,
  isNode,
  SplitTree
} from '../../src/renderer/src/splits'

const RECT = { x: 0, y: 0, w: 800, h: 600 }

describe('splits tree', () => {
  // ─── createInitialSplit ──────────────────────────────────────────

  it('creates a vertical node with two leaves, ratio 0.5', () => {
    const tree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    expect(tree.type).toBe('node')
    expect(isNode(tree)).toBe(true)
    if (isNode(tree)) {
      expect(tree.direction).toBe('vertical')
      expect(tree.ratio).toBe(0.5)
      expect(tree.children.map((c) => (c.type === 'leaf' ? c.tabId : null))).toEqual(['tab-1', 'tab-2'])
    }
  })

  // ─── splitPaneAt ─────────────────────────────────────────────────

  it('splits a leaf in the right half (path [1]) horizontally → 2x2 grid', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    expect(getTabIds(tree)).toEqual(['tab-1', 'tab-2', 'tab-3'])
    // Root stays vertical, right child is now a horizontal node
    if (isNode(tree)) {
      expect(tree.direction).toBe('vertical')
      expect(isNode(tree.children[1])).toBe(true)
      if (isNode(tree.children[1])) {
        expect(tree.children[1].direction).toBe('horizontal')
      }
    }
  })

  it('splits a leaf in the left half (path [0])', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [0], 'tab-3', 'vertical')
    // Old leaf stays first child of the new node
    expect(getTabIds(tree)).toEqual(['tab-1', 'tab-3', 'tab-2'])
  })

  it('splits deep nested leaf (path [1,0])', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    tree = splitPaneAt(tree, [1, 0], 'tab-4', 'vertical')
    expect(getTabIds(tree)).toEqual(['tab-1', 'tab-2', 'tab-4', 'tab-3'])
  })

  it('throws when splitting a non-leaf path', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    expect(() => splitPaneAt(tree, [], 'tab-4', 'vertical')).toThrow()
    expect(() => splitPaneAt(tree, [1, 0, 0], 'tab-4', 'vertical')).toThrow()
  })

  it('throws when splitting an empty tree', () => {
    expect(() => splitPaneAt(null, [0], 'tab-1', 'vertical')).toThrow()
  })

  it('puts the new tab first with newTabIndex=0 (left/top)', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [0], 'tab-3', 'vertical', 0)
    expect(getTabIds(tree)).toEqual(['tab-3', 'tab-1', 'tab-2'])
    if (isNode(tree) && isNode(tree.children[0])) {
      expect(tree.children[0].children.map((c) => (c.type === 'leaf' ? c.tabId : null)))
        .toEqual(['tab-3', 'tab-1'])
    }
  })

  // ─── splitTreeAt ──────────────────────────────────────────────────

  it('splitTreeAt pairs two tabs when tree is null (newTab second)', () => {
    const tree = splitTreeAt(null, 'tab-1', 'tab-2', 'vertical')
    expect(getTabIds(tree)).toEqual(['tab-1', 'tab-2'])
  })

  it('splitTreeAt pairs two tabs when tree is null (newTab first)', () => {
    const tree = splitTreeAt(null, 'tab-1', 'tab-2', 'vertical', 0)
    expect(getTabIds(tree)).toEqual(['tab-2', 'tab-1'])
  })

  it('splitTreeAt splits a target already in the tree', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitTreeAt(tree, 'tab-2', 'tab-3', 'horizontal')
    expect(getTabIds(tree)).toEqual(['tab-1', 'tab-2', 'tab-3'])
    if (isNode(tree) && isNode(tree.children[1])) {
      expect(tree.children[1].direction).toBe('horizontal')
    }
  })

  it('splitTreeAt attaches a standalone target next to the existing tree', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitTreeAt(tree, 'tab-9', 'tab-3', 'vertical')
    expect(getTabIds(tree)).toEqual(['tab-9', 'tab-3', 'tab-1', 'tab-2'])
    // Root has two children: inner pair node + old tree
    if (isNode(tree)) {
      expect(tree.children[0].type).toBe('node')
      expect(tree.children[1].type).toBe('node')
    }
  })

  it('splitTreeAt re-parents a tab already inside the tree', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitTreeAt(tree, 'tab-3', 'tab-2', 'horizontal')
    // tab-2 pulled out of the tree first, then pairs with tab-3
    expect(getTabIds(tree)).toEqual(['tab-3', 'tab-2', 'tab-1'])
  })

  // ─── attachStandalone ────────────────────────────────────────────

  it('attachStandalone returns just the pair when tree is null', () => {
    const tree = attachStandalone(null, 'tab-1', 'tab-2', 'vertical')
    expect(getTabIds(tree)).toEqual(['tab-1', 'tab-2'])
  })

  it('attachStandalone keeps the existing tree intact', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = attachStandalone(tree, 'tab-9', 'tab-3', 'horizontal')
    expect(getTabIds(tree)).toEqual(['tab-9', 'tab-3', 'tab-1', 'tab-2'])
  })

  // ─── removeTab / collapse ────────────────────────────────────────

  it('removes a leaf and collapses the parent node', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = removeTab(tree, 'tab-2')
    // Collapsed back to single leaf
    expect(tree?.type).toBe('leaf')
    if (tree && tree.type === 'leaf') {
      expect(tree.tabId).toBe('tab-1')
    }
  })

  it('collapses to the surviving subtree when removing one of two children', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    // Remove tab-2 → right node collapses to leaf tab-3, root stays
    tree = removeTab(tree, 'tab-2')
    expect(getTabIds(tree)).toEqual(['tab-1', 'tab-3'])
    if (isNode(tree)) {
      expect(tree.children[1].type).toBe('leaf')
    }
  })

  it('returns null when the last tab is removed', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = removeTab(tree, 'tab-1')
    tree = removeTab(tree, 'tab-2')
    expect(tree).toBeNull()
  })

  it('leaves the tree untouched when tab is not in tree', () => {
    const tree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    const next = removeTab(tree, 'tab-99')
    expect(next).toBe(tree)
  })

  // ─── updateRatio ─────────────────────────────────────────────────

  it('clamps ratio to [0.15, 0.85]', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = updateRatio(tree, [], 0.02)
    if (isNode(tree)) expect(tree.ratio).toBe(0.15)
    tree = updateRatio(tree, [], 0.99)
    if (isNode(tree)) expect(tree.ratio).toBe(0.85)
    tree = updateRatio(tree, [], 0.6)
    if (isNode(tree)) expect(tree.ratio).toBe(0.6)
  })

  it('updates ratio of a nested node by path', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    tree = updateRatio(tree, [1], 0.7)
    if (isNode(tree) && isNode(tree.children[1])) {
      expect(tree.children[1].ratio).toBe(0.7)
    }
  })

  // ─── findPath / getTabIds ────────────────────────────────────────

  it('finds paths for leaves', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    // Root: node → children[0]=tab-1, children[1]=node(tab-2, tab-3)
    expect(findPath(tree, 'tab-1')).toEqual([0])
    expect(findPath(tree, 'tab-2')).toEqual([1, 0])
    expect(findPath(tree, 'tab-3')).toEqual([1, 1])
    expect(findPath(tree, 'nope')).toBeNull()
    expect(findPath(null, 'tab-1')).toBeNull()
  })

  it('getTabIds on empty tree returns []', () => {
    expect(getTabIds(null)).toEqual([])
  })

  // ─── computeLayout ───────────────────────────────────────────────

  it('lays out a single leaf filling the container', () => {
    const layout = computeLayout(createLeaf('tab-1'), RECT)
    expect(layout.leaves.get('tab-1')).toEqual(RECT)
    expect(layout.handles).toHaveLength(0)
  })

  it('lays out a vertical split 50/50', () => {
    const tree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    const layout = computeLayout(tree, RECT)
    expect(layout.leaves.get('tab-1')).toEqual({ x: 0, y: 0, w: 400, h: 600 })
    expect(layout.leaves.get('tab-2')).toEqual({ x: 400, y: 0, w: 400, h: 600 })
    expect(layout.handles).toHaveLength(1)
    expect(layout.handles[0].direction).toBe('vertical')
    expect(layout.handles[0].barRect).toEqual({ x: 398, y: 0, w: 4, h: 600 })
  })

  it('lays out a horizontal split 50/50', () => {
    const tree = createInitialSplit('tab-1', 'tab-2', 'horizontal')
    const layout = computeLayout(tree, RECT)
    expect(layout.leaves.get('tab-1')).toEqual({ x: 0, y: 0, w: 800, h: 300 })
    expect(layout.leaves.get('tab-2')).toEqual({ x: 0, y: 300, w: 800, h: 300 })
    expect(layout.handles[0].direction).toBe('horizontal')
    expect(layout.handles[0].barRect).toEqual({ x: 0, y: 298, w: 800, h: 4 })
  })

  it('lays out a 2x2 grid (vertical root, right side split horizontally)', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    const layout = computeLayout(tree, RECT)
    expect(layout.leaves.get('tab-1')).toEqual({ x: 0, y: 0, w: 400, h: 600 })
    expect(layout.leaves.get('tab-2')).toEqual({ x: 400, y: 0, w: 400, h: 300 })
    expect(layout.leaves.get('tab-3')).toEqual({ x: 400, y: 300, w: 400, h: 300 })
    expect(layout.handles).toHaveLength(2)
    // Root handle has path [], nested handle has path [1]
    expect(layout.handles.find((h) => h.path.length === 0)?.direction).toBe('vertical')
    expect(layout.handles.find((h) => h.path.length === 1)?.direction).toBe('horizontal')
  })

  it('respects custom ratios in layout', () => {
    let tree: SplitTree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    tree = updateRatio(tree, [], 0.25)
    const layout = computeLayout(tree, RECT)
    expect(layout.leaves.get('tab-1')).toEqual({ x: 0, y: 0, w: 200, h: 600 })
    expect(layout.leaves.get('tab-2')).toEqual({ x: 200, y: 0, w: 600, h: 600 })
  })

  it('empty tree layout is empty', () => {
    const layout = computeLayout(null, RECT)
    expect(layout.leaves.size).toBe(0)
    expect(layout.handles).toHaveLength(0)
  })

  // ─── immutability ────────────────────────────────────────────────

  it('does not mutate the original tree on split', () => {
    const tree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    const snapshot = JSON.stringify(tree)
    splitPaneAt(tree, [1], 'tab-3', 'horizontal')
    expect(JSON.stringify(tree)).toBe(snapshot)
  })

  it('does not mutate the original tree on remove', () => {
    const tree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    const snapshot = JSON.stringify(tree)
    removeTab(tree, 'tab-2')
    expect(JSON.stringify(tree)).toBe(snapshot)
  })

  it('does not mutate the original tree on ratio update', () => {
    const tree = createInitialSplit('tab-1', 'tab-2', 'vertical')
    const snapshot = JSON.stringify(tree)
    updateRatio(tree, [], 0.7)
    expect(JSON.stringify(tree)).toBe(snapshot)
  })
})
