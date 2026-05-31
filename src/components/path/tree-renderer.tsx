'use client';

import React from 'react';

// ─── types ────────────────────────────────────────────
export interface TreeNode {
  id: string;
  title: string;
  description: string;
  estimated_hours: number;
  node_type: 'required' | 'optional' | 'advanced';
  resources_hint?: string;
  check_criteria?: string;
  children?: TreeNode[];
  // top-level phase fields (used for phase nodes)
  is_required?: boolean;
  why?: string;
}

export type NodeStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed';

export interface ProgressMap {
  [nodeId: string]: { status: NodeStatus; notes?: string };
}

// ─── status helpers ───────────────────────────────────
const statusIcon: Record<NodeStatus, string> = {
  locked: '🔒',
  unlocked: '◌',
  in_progress: '⬤',
  completed: '✓',
};

const statusColors: Record<NodeStatus, string> = {
  locked: 'border-gray-200 bg-white text-gray-400',
  unlocked: 'border-indigo-300 bg-white text-indigo-700',
  in_progress: 'border-amber-400 bg-amber-50 text-amber-700',
  completed: 'border-emerald-400 bg-emerald-50 text-emerald-700',
};

const iconColors: Record<NodeStatus, string> = {
  locked: 'text-gray-300',
  unlocked: 'text-indigo-400',
  in_progress: 'text-amber-500 animate-pulse',
  completed: 'text-emerald-500',
};

// ─── dependency helpers ──────────────────────────────

/** 判断节点是否为必修（兼容 phase 的 is_required 和子节点的 node_type） */
function isRequiredNode(node: TreeNode): boolean {
  if (node.is_required !== undefined) return node.is_required;
  return node.node_type === 'required';
}

/** 计算节点真实状态：自己的进度 > 祖先链 > 同级排序 */
function computeNodeStatus(
  node: TreeNode,
  progressMap: ProgressMap,
  ancestorNodes: TreeNode[],
  siblingIndex: number,
  siblings: TreeNode[],
): NodeStatus {
  // 1. 自己的进度优先
  const own = progressMap[node.id];
  if (own?.status === 'completed') return 'completed';
  if (own?.status === 'in_progress') return 'in_progress';

  // 2. 所有必修祖先必须完成
  for (const ancestor of ancestorNodes) {
    if (!isRequiredNode(ancestor)) continue;
    const ap = progressMap[ancestor.id];
    if (!ap || ap.status !== 'completed') return 'locked';
  }

  // 3. 所有排在前面的必修同级必须完成
  for (let i = 0; i < siblingIndex; i++) {
    const sibling = siblings[i];
    if (!isRequiredNode(sibling)) continue;
    const sp = progressMap[sibling.id];
    if (!sp || sp.status !== 'completed') return 'locked';
  }

  // 4. 前置条件全部满足
  return 'unlocked';
}

// ─── component ────────────────────────────────────────
interface TreeRendererProps {
  nodes: TreeNode[];
  level?: number;
  progressMap: ProgressMap;
  onNodeClick: (node: TreeNode) => void;
  defaultExpanded?: boolean;
  /** 当前节点层级以上的所有祖先节点（用于依赖解锁判断） */
  ancestorNodes?: TreeNode[];
}

export function TreeRenderer({
  nodes,
  level = 0,
  progressMap,
  onNodeClick,
  defaultExpanded = true,
  ancestorNodes = [],
}: TreeRendererProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    // 默认展开：第一层 + 包含进行中节点的链
    const init: Record<string, boolean> = {};
    if (level === 0 || defaultExpanded) {
      for (const n of nodes) {
        init[n.id] = true;
        // 如果有进行中的子节点，也展开
        if (n.children?.some(c => progressMap[c.id]?.status === 'in_progress')) {
          init[n.id] = true;
        }
      }
    }
    return init;
  });

  if (!nodes.length) return null;

  return (
    <div className="tree-branch" style={{ paddingLeft: level > 0 ? 24 : 0 }}>
      {nodes.map((node, i) => {
        const status = computeNodeStatus(node, progressMap, ancestorNodes, i, nodes);
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expanded[node.id] !== false;
        const isLast = i === nodes.length - 1;

        return (
          <div key={node.id} className="tree-node-wrapper relative">
            {/* Connector lines (CSS-only) */}
            {level > 0 && (
              <>
                <div
                  className={`absolute left-3 w-px bg-gray-200 ${isLast ? 'h-1/2 top-0' : 'h-full top-0'}`}
                />
                <div className="absolute left-3 top-1/2 w-3 h-px bg-gray-200" />
              </>
            )}

            {/* Node card */}
            <div
              onClick={() => onNodeClick(node)}
              className={`relative ml-8 mb-1 rounded-lg border px-4 py-3 cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.01] ${statusColors[status]}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm shrink-0 ${iconColors[status]}`}>
                  {statusIcon[status]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{node.title}</span>
                    <span className="text-xs opacity-60 shrink-0">~{node.estimated_hours}h</span>
                    {node.node_type === 'optional' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 shrink-0">可选</span>
                    )}
                    {node.node_type === 'advanced' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 shrink-0">进阶</span>
                    )}
                    {node.is_required === false && !node.node_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">可选</span>
                    )}
                  </div>
                  {node.description && (
                    <p className="text-xs opacity-70 mt-0.5 line-clamp-1">{node.description}</p>
                  )}
                </div>
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((prev) => ({ ...prev, [node.id]: !isExpanded }));
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    {isExpanded ? '收起 ▲' : '展开 ▼'}
                  </button>
                )}
              </div>
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
              <TreeRenderer
                nodes={node.children!}
                level={level + 1}
                progressMap={progressMap}
                onNodeClick={onNodeClick}
                defaultExpanded={false}
                ancestorNodes={[...ancestorNodes, node]}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
