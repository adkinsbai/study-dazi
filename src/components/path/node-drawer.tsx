'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth';
import { X, Check, Flame, Bookmark, Play, PartyPopper, RotateCcw, Clock } from 'lucide-react';
import type { TreeNode, NodeStatus, ProgressMap } from './tree-renderer';

interface NodeDrawerProps {
  node: TreeNode | null;
  pathId: string;
  progressMap: ProgressMap;
  onClose: () => void;
  onProgressChange: (nodeId: string, status: NodeStatus) => void;
  readOnly?: boolean;
}

export function NodeDrawer({ node, pathId, progressMap, onClose, onProgressChange, readOnly }: NodeDrawerProps) {
  const token = useAuthStore((s) => s.token);
  const [notes, setNotes] = useState(() => node ? progressMap[node.id]?.notes || '' : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
                : <span className="inline-flex items-center gap-1"><Bookmark size={12} /> 未开始</span>}
            </span>
            {!readOnly && currentStatus === 'unlocked' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={saving}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
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

          {/* Resources hint */}
          {node.resources_hint && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">学习资源建议</h3>
              <p className="text-sm text-gray-600">{node.resources_hint}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">我的笔记</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="记录学习心得..."
              rows={4}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400"
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="mt-2 text-xs text-indigo-600 hover:text-indigo-500"
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
          placeholder="写留言..." className="flex-1 border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-indigo-400" />
        <button onClick={handleSubmit} disabled={submitting}
          className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-md">{submitting ? '...' : '发送'}</button>
      </div>
    </div>
  );
}
