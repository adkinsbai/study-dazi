'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';
import { TreeRenderer, type TreeNode, type ProgressMap, type NodeStatus } from '@/components/path/tree-renderer';
import { NodeDrawer } from '@/components/path/node-drawer';
import { Pencil, Save, Share2, Trash2, GitFork, ArrowLeft, Plus, X } from 'lucide-react';

interface PathData {
  id: string;
  title: string;
  domain: string;
  userId: string;
  isPublic: boolean;
  isTemplate: boolean;
  treeData: {
    domain: string;
    level: string;
    phases: (TreeNode & { is_required?: boolean; why?: string })[];
  };
  createdAt: string;
}

export default function PathDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const router = useRouter();
  const [path, setPath] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingNode, setEditingNode] = useState<TreeNode | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', estimated_hours: 0 });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Load path + progress
  useEffect(() => {
    if (token && id) {
      loadData();
    }
  }, [token, id]);

  const loadData = async () => {
    try {
      const [pathRes, progRes] = await Promise.all([
        fetch(`/api/paths/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/paths/${id}/progress`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!pathRes.ok) throw new Error('加载失败');
      const pathData = await pathRes.json();
      setPath(pathData.path);
      if (progRes.ok) {
        const progData = await progRes.json();
        setProgressMap(progData.progress || {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = useCallback((node: TreeNode) => {
    if (editMode) {
      setEditingNode(node);
      setEditForm({ title: node.title, description: node.description || '', estimated_hours: node.estimated_hours || 0 });
    } else {
      setSelectedNode(node);
    }
  }, [editMode]);

  const handleProgressChange = useCallback((nodeId: string, status: NodeStatus) => {
    setProgressMap((prev) => ({
      ...prev,
      [nodeId]: { status, notes: prev[nodeId]?.notes },
    }));
  }, []);

  const handleShare = async () => {
    const newVal = !path?.isTemplate;
    try {
      await fetch(`/api/paths/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPublic: newVal, isTemplate: newVal }),
      });
      setPath(prev => prev ? { ...prev, isPublic: newVal, isTemplate: newVal } : null);
    } catch { /* ignore */ }
  };

  const handleSaveEdit = () => {
    if (!editingNode || !path) return;
    const updateNode = (nodes: TreeNode[]): TreeNode[] => nodes.map(n => {
      if (n.id === editingNode.id) return { ...n, title: editForm.title, description: editForm.description, estimated_hours: editForm.estimated_hours };
      if (n.children) return { ...n, children: updateNode(n.children) };
      return n;
    });
    const newPhases = updateNode(phases);
    const newTree = { ...path.treeData, phases: newPhases };
    setPath({ ...path, treeData: newTree });
    setEditingNode(null);
    setDirty(true);
  };

  const handleDeleteNode = () => {
    if (!editingNode || !path || !confirm('删除这个节点？')) return;
    const deleteNode = (nodes: TreeNode[]): TreeNode[] =>
      nodes.filter(n => n.id !== editingNode.id).map(n => n.children ? { ...n, children: deleteNode(n.children) } : n);
    const newPhases = deleteNode(phases);
    const newTree = { ...path.treeData, phases: newPhases };
    setPath({ ...path, treeData: newTree });
    setDirty(true);
    setEditingNode(null);
  };

  const handleAddChild = () => {
    if (!editingNode || !path) return;
    const newId = 'node-' + Date.now();
    const newNode: TreeNode = { id: newId, title: '新节点', description: '', estimated_hours: 1, node_type: 'required', children: [] };
    const addChild = (nodes: TreeNode[]): TreeNode[] => nodes.map(n => {
      if (n.id === editingNode.id) return { ...n, children: [...(n.children || []), newNode] };
      if (n.children) return { ...n, children: addChild(n.children) };
      return n;
    });
    const newPhases = addChild(phases);
    const newTree = { ...path.treeData, phases: newPhases };
    setPath({ ...path, treeData: newTree });
    setEditingNode(null);
  };

  const handleSaveAll = async () => {
    if (!path) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/paths/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tree_data: path.treeData }),
      });
      if (!res.ok) throw new Error('保存失败');
      setEditMode(false);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally { setSaving(false); }
  };

  const handleFork = async () => {
    try {
      const res = await fetch(`/api/paths/${id}/fork`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); router.push(`/paths/${d.id}`); }
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个学习路径吗？此操作不可撤销。')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/paths/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('删除失败');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fef7f5]">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fef7f5]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm">{error}</div>
          <button onClick={() => router.push('/')} className="mt-4 text-sm text-[#6366f1]"><ArrowLeft size={14} /> 返回首页</button>
        </div>
      </div>
    );
  }

  if (!path) return null;

  const isOwner = currentUser?.id === path.userId;
  const phases = path.treeData?.phases || [];
  const totalHours = phases.reduce((sum, p) => sum + (p.estimated_hours || 0), 0);

  // Count completed nodes
  const countCompleted = (nodes: TreeNode[]): number => {
    let count = 0;
    for (const n of nodes) {
      if (progressMap[n.id]?.status === 'completed') count++;
      if (n.children) count += countCompleted(n.children);
    }
    return count;
  };
  const countAll = (nodes: TreeNode[]): number => {
    let count = 0;
    for (const n of nodes) {
      count++;
      if (n.children) count += countAll(n.children);
    }
    return count;
  };
  const completedCount = countCompleted(phases);
  const totalCount = countAll(phases);
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-[#fef7f5] min-h-screen page-enter">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{path.title}</h1>
            <p className="text-xs text-gray-400">{path.domain} · {new Date(path.createdAt).toLocaleDateString('zh-CN')}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mini progress ring */}
            {totalCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center relative">
                  <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90 absolute">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f97066" strokeWidth="3"
                      strokeDasharray={`${progressPct * 0.88} 88`} strokeLinecap="round" />
                  </svg>
                  <span className="text-[10px] font-bold text-[#f97066]">{progressPct}%</span>
                </div>
                <span className="text-xs">{completedCount}/{totalCount}</span>
              </div>
            )}
            <span className="text-sm text-gray-400">~{totalHours}h</span>
            {isOwner ? (
              <>
                <button onClick={() => editMode ? handleSaveAll() : setEditMode(true)}
                  className={`text-sm btn-press ${editMode ? 'text-emerald-600' : 'text-gray-400'} hover:text-emerald-500`}>
                  {editMode ? (saving ? '保存中...' : dirty ? <><Save size={14} /> 保存 *</> : <><Save size={14} /> 保存</>) : <><Pencil size={14} /> 编辑</>}
                </button>
                {editMode && (
                  <button onClick={() => setEditMode(false)} className="text-sm text-gray-400 hover:text-gray-600 btn-press">取消</button>
                )}
                <button onClick={handleShare}
                  className={`text-sm btn-press ${path.isTemplate ? 'text-amber-600' : 'text-gray-400'} hover:text-amber-500`}>
                  {path.isTemplate ? <><Share2 size={14} /> 已分享</> : <><Share2 size={14} /> 分享</>}
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50 btn-press">
                  {deleting ? '删除中...' : <><Trash2 size={14} /> 删除</>}
                </button>
              </>
            ) : (
              <button onClick={handleFork}
                className="px-4 py-1.5 rounded-full bg-[#f97066] text-white text-sm hover:bg-[#e0524a] btn-press">
                <GitFork size={14} className="inline mr-1" /> Fork 到我的路径
              </button>
            )}
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={14} className="inline mr-0.5" /> 返回</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {editMode && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-700">
            <Pencil size={14} className="inline mr-1" /> 编辑模式：点击节点修改，修改后记得保存
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 card-lift">
          {phases.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>该路径没有内容</p>
            </div>
          ) : (
            <TreeRenderer
              nodes={phases}
              progressMap={progressMap}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>
      </main>

      {/* Edit node modal */}
      {editingNode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 fade-in" onClick={() => setEditingNode(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 w-full space-y-3 modal-enter" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900">编辑节点</h3>
            <input type="text" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6]" placeholder="节点名称" />
            <input type="text" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6]" placeholder="描述" />
            <input type="number" value={editForm.estimated_hours} onChange={e => setEditForm(p => ({ ...p, estimated_hours: +e.target.value }))}
              className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#fde8e6]" placeholder="小时" />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="flex-1 py-2 rounded-full bg-[#f97066] text-sm text-white hover:bg-[#e0524a] btn-press">确认</button>
              <button onClick={handleAddChild} className="py-2 px-3 rounded-full border border-gray-200 text-sm hover:bg-gray-50 btn-press"><Plus size={14} className="inline mr-0.5" /> 子节点</button>
              <button onClick={handleDeleteNode} className="py-2 px-3 rounded-full border border-gray-200 text-sm text-red-500 hover:bg-red-50 btn-press"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Node drawer — 仅所有者可修改进度 */}
      {!editMode && <NodeDrawer
        node={selectedNode}
        pathId={id}
        progressMap={progressMap}
        onClose={() => setSelectedNode(null)}
        onProgressChange={isOwner ? handleProgressChange : () => {}}
        readOnly={!isOwner}
      />}
    </div>
  );
}
