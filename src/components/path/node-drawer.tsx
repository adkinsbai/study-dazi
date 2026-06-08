'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth';
import { X, Check, Flame, Bookmark, Play, PartyPopper, RotateCcw, Clock, ExternalLink, Youtube, Monitor } from 'lucide-react';
import type { TreeNode, NodeStatus, ProgressMap } from './tree-renderer';

interface NodeDrawerProps {
  node: TreeNode | null;
  pathId: string;
  progressMap: ProgressMap;
  onClose: () => void;
  onProgressChange: (nodeId: string, status: NodeStatus) => void;
  readOnly?: boolean;
}

// ── 资源卡片类型 ──────────────────────────────────
interface ResourceItem {
  id: string;
  platform: string;
  title: string;
  url: string;
  instructor: string | null;
  thumbnail: string | null;
  duration: number | null;
  language: string | null;
  difficulty: string | null;
  tags: string[];
  rating: number | null;
  viewCount: number;
  isFree: boolean;
  matched_keywords: number;
}

const platformMeta: Record<string, { icon: string; label: string; color: string }> = {
  youtube: { icon: '▶', label: 'YouTube', color: 'text-red-600 bg-red-50' },
  bilibili: { icon: '📺', label: 'B站', color: 'text-pink-600 bg-pink-50' },
  coursera: { icon: '🎓', label: 'Coursera', color: 'text-blue-600 bg-blue-50' },
  mit_ocw: { icon: '🏛', label: 'MIT OCW', color: 'text-gray-700 bg-gray-100' },
  other: { icon: '🔗', label: '链接', color: 'text-gray-500 bg-gray-50' },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
  return `${m}m`;
}

function formatViewCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// ── 资源卡片组件 ──────────────────────────────────
function ResourceCard({ resource }: { resource: ResourceItem }) {
  const meta = platformMeta[resource.platform] || platformMeta.other;

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all group"
    >
      {/* 缩略图 */}
      {resource.thumbnail ? (
        <div className="relative w-24 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resource.thumbnail}
            alt={resource.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {resource.duration && (
            <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">
              {formatDuration(resource.duration)}
            </span>
          )}
        </div>
      ) : (
        <div className="w-24 h-16 rounded-lg shrink-0 bg-gray-100 flex items-center justify-center text-gray-400 text-lg">
          {meta.icon}
        </div>
      )}

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>
            {meta.label}
          </span>
          {resource.isFree === false && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
              付费
            </span>
          )}
          {resource.rating && resource.rating > 0 && (
            <span className="text-[10px] text-amber-500">★ {resource.rating.toFixed(1)}</span>
          )}
        </div>
        <h4 className="text-sm font-medium text-gray-800 line-clamp-1 group-hover:text-[#f97066] transition-colors">
          {resource.title}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
          {resource.instructor && <span>{resource.instructor}</span>}
          {resource.viewCount > 0 && <span>{formatViewCount(resource.viewCount)}次播放</span>}
          {resource.language && <span>{resource.language === 'zh' ? '中文' : '英文'}</span>}
        </div>
      </div>

      {/* 跳转图标 */}
      <ExternalLink size={14} className="text-gray-300 group-hover:text-[#f97066] shrink-0 mt-1 transition-colors" />
    </a>
  );
}

// ── 主抽屉组件 ──────────────────────────────────
export function NodeDrawer({ node, pathId, progressMap, onClose, onProgressChange, readOnly }: NodeDrawerProps) {
  const token = useAuthStore((s) => s.token);
  const [notes, setNotes] = useState(() => node ? progressMap[node.id]?.notes || '' : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 资源相关状态
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState('');

  // 加载节点关联的资源
  const loadResources = useCallback(async () => {
    if (!node) return;

    setResourcesLoading(true);
    setResourcesError('');

    try {
      // 先从已关联的资源加载
      const linkRes = await fetch(`/api/paths/${pathId}/nodes/${node.id}/resources`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (linkRes.ok) {
        const data = await linkRes.json();
        if (data.resources && data.resources.length > 0) {
          setResources(data.resources);
          setResourcesLoading(false);
          return;
        }
      }

      // 如果没有已关联资源，用 keywords 搜索资源库
      const keywords = (node as TreeNode & { keywords?: string[] }).keywords || [];
      if (keywords.length > 0) {
        const searchRes = await fetch(
          `/api/resources/search?keywords=${encodeURIComponent(keywords.join(','))}&limit=6`,
        );
        if (searchRes.ok) {
          const data = await searchRes.json();
          setResources(data.resources || []);
        }
      } else if (node.resources_hint) {
        // fallback: 没有 keywords 时，用 title 搜索
        const searchRes = await fetch(
          `/api/resources/search?keywords=${encodeURIComponent(node.title)}&limit=6`,
        );
        if (searchRes.ok) {
          const data = await searchRes.json();
          setResources(data.resources || []);
        }
      }
    } catch {
      setResourcesError('加载资源失败');
    } finally {
      setResourcesLoading(false);
    }
  }, [node, pathId, token]);

  useEffect(() => {
    if (node) {
      setNotes(progressMap[node.id]?.notes || '');
      loadResources();
    }
  }, [node, progressMap, loadResources]);

  if (!node) return null;

  const currentStatus: NodeStatus = progressMap[node.id]?.status || 'unlocked';

  const handleStatusChange = async (newStatus: NodeStatus) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/paths/${pathId}/nodes/${node.id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('保存失败');
      onProgressChange(node.id, newStatus);
    } catch {
      setSaveError('保存失败，请重试');
    }
    finally { setSaving(false); }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await fetch(`/api/paths/${pathId}/nodes/${node.id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: currentStatus, notes }),
      });
      onProgressChange(node.id, currentStatus);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[420px] bg-white shadow-xl z-50 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">{node.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Status badge + action */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">状态：</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              currentStatus === 'completed' ? 'bg-emerald-100 text-emerald-700'
                : currentStatus === 'in_progress' ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {currentStatus === 'completed' ? <span className="inline-flex items-center gap-1"><Check size={12} /> 已完成</span>
                : currentStatus === 'in_progress' ? <span className="inline-flex items-center gap-1"><Flame size={12} /> 进行中</span>
                : <span className="inline-flex items-center gap-1"><Bookmark size={12} /> 未开始</span>
              }
            </span>
            {!readOnly && currentStatus === 'unlocked' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={saving}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#f97066] text-white hover:bg-[#e0524a] transition-colors"
              >
                <span className="inline-flex items-center gap-1"><Play size={12} /> 开始学习</span>
              </button>
            )}
            {!readOnly && currentStatus === 'in_progress' && (
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={saving}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
              >
                <span className="inline-flex items-center gap-1"><PartyPopper size={12} /> 标记完成</span>
              </button>
            )}
            {!readOnly && currentStatus === 'completed' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={saving}
                className="px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <span className="inline-flex items-center gap-1"><RotateCcw size={12} /> 重新学习</span>
              </button>
            )}
            {saving && <span className="text-xs text-gray-400">保存中...</span>}
          </div>
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}

          {/* Meta */}
          <div className="flex gap-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1"><Clock size={12} /> ~{node.estimated_hours}h</span>
            <span>
              {node.node_type === 'required' ? '必修'
                : node.node_type === 'optional' ? '可选'
                : node.node_type === 'advanced' ? '进阶'
                : node.is_required === false ? '可选' : '必修'}
            </span>
          </div>

          {/* Description */}
          {node.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">描述</h3>
              <p className="text-sm text-gray-600">{node.description}</p>
            </div>
          )}

          {/* Check criteria */}
          {node.check_criteria && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">检验标准</h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">{node.check_criteria}</p>
            </div>
          )}

          {/* ── 学习资源（核心新增） ─────────────── */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">推荐学习资源</h3>

            {resourcesLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#f97066] rounded-full animate-spin" />
                正在匹配资源...
              </div>
            )}

            {resourcesError && (
              <p className="text-xs text-red-400">{resourcesError}</p>
            )}

            {!resourcesLoading && !resourcesError && resources.length === 0 && (
              <div className="text-sm text-gray-400 py-3">
                <p>暂无匹配资源</p>
                {node.resources_hint && (
                  <p className="mt-1 text-xs text-gray-300">{node.resources_hint}</p>
                )}
              </div>
            )}

            {resources.length > 0 && (
              <div className="space-y-2">
                {resources.map(r => (
                  <ResourceCard key={r.id} resource={r} />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">我的笔记</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="记录学习心得..."
              rows={4}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#f97066]"
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="mt-2 text-xs text-[#f97066] hover:text-[#e0524a]"
            >
              {saving ? '保存中...' : '保存笔记'}
            </button>
          </div>

          {/* Why (for phases) */}
          {node.why && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">为什么要学</h3>
              <p className="text-sm text-gray-500 italic">{node.why}</p>
            </div>
          )}

          {/* Comments */}
          <CommentsSection pathId={pathId} nodeId={node.id} />
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </>
  );
}

// ─── Comments section ──────────────────────────────
interface Comment {
  id: string; content: string; createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
}

function CommentsSection({ pathId, nodeId }: { pathId: string; nodeId: string }) {
  const token = useAuthStore(s => s.token);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?pathId=${pathId}&nodeId=${nodeId}`);
      if (res.ok) { const d = await res.json(); setComments(d.comments || []); }
    } catch { /* ignore */ }
  }, [pathId, nodeId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pathId, nodeId, content: text }),
      });
      if (res.ok) { const d = await res.json(); setComments(prev => [...prev, d.comment]); setText(''); }
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">留言 ({comments.length})</h3>
      <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
        {comments.map(c => (
          <div key={c.id} className="text-sm">
            <span className="font-medium text-gray-700">{c.user.username}</span>
            <span className="text-xs text-gray-400 ml-2">{new Date(c.createdAt).toLocaleDateString('zh-CN')}</span>
            <p className="text-gray-600 mt-0.5">{c.content}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="写留言..." className="flex-1 border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-[#f97066]" />
        <button onClick={handleSubmit} disabled={submitting}
          className="px-2 py-1 bg-[#f97066] text-white text-xs rounded-md">{submitting ? '...' : '发送'}</button>
      </div>
    </div>
  );
}
