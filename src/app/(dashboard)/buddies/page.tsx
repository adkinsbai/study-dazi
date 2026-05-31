'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────
interface Member {
  id: string; username: string; avatarUrl: string | null; role: string;
}
interface GroupData {
  id: string; name: string; domain: string; sharedPathId: string | null;
  createdBy: string; members: Member[];
}
interface TreeNode {
  id: string; title: string; description?: string; estimated_hours?: number;
  is_required?: boolean; children?: TreeNode[];
}
interface ProgressMap {
  [userId: string]: { [nodeId: string]: string };
}

// ─── Progress bar ─────────────────────────────────
function MiniBar({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-500', in_progress: 'bg-amber-400',
    unlocked: 'bg-gray-300', locked: 'bg-gray-200',
  };
  return <span className={`inline-block w-3 h-3 rounded-sm ${colors[status] || 'bg-gray-200'}`} title={status} />;
}

// ─── Node row in progress tree ────────────────────
function NodeRow({
  node, members, progressMap, depth, isLast,
}: {
  node: TreeNode; members: Member[]; progressMap: ProgressMap; depth: number; isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 24;

  return (
    <div>
      {/* Node row */}
      <div className="flex items-center gap-2 py-1.5 hover:bg-gray-50/50 rounded px-1 group" style={{ paddingLeft: indent + 4 }}>
        {/* Vertical line connector */}
        {depth > 0 && (
          <div className="relative w-5 shrink-0 self-stretch">
            <div className="absolute top-0 bottom-0 left-2 w-px bg-gray-200" />
            <div className="absolute top-1/2 left-2 w-3 h-px bg-gray-200" />
            {!isLast && depth > 0 && <div className="absolute top-1/2 bottom-0 left-2 w-px bg-gray-200" />}
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={`shrink-0 text-xs ${hasChildren ? 'text-gray-500 hover:text-indigo-600 cursor-pointer' : 'text-gray-300 cursor-default'}`}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '•'}
        </button>

        {/* Node title */}
        <span className="text-xs font-medium text-gray-800 flex-1 min-w-0 truncate" title={node.title}>
          {node.title}
        </span>

        {/* Per-member progress dots */}
        <div className="flex items-center gap-1.5 shrink-0">
          {members.map(m => {
            const status = progressMap[m.id]?.[node.id] || 'locked';
            return <MiniBar key={m.id} status={status} />;
          })}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && node.children!.map((child, i) => (
        <NodeRow
          key={child.id}
          node={child}
          members={members}
          progressMap={progressMap}
          depth={depth + 1}
          isLast={i === node.children!.length - 1}
        />
      ))}
    </div>
  );
}

// ─── Group card ────────────────────────────────────
function GroupCard({
  group, onNudge,
}: {
  group: GroupData; onNudge: (id: string) => void;
}) {
  const token = useAuthStore(s => s.token);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<{ path: { id: string; title: string; treeData: any } | null; progress: ProgressMap } | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !detail) {
      setLoading(true);
      setExpanded(true);
      const res = await fetch(`/api/buddy-groups/${group.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setDetail({ path: d.path, progress: d.progress });
      }
      setLoading(false);
    } else {
      setExpanded(!expanded);
    }
  };

  // Count completed nodes per member
  const progress = detail?.progress || {};
  const memberStats = group.members.map(m => {
    const nodes = progress[m.id] || {};
    const completed = Object.values(nodes).filter(s => s === 'completed').length;
    const total = Object.keys(nodes).length;
    return { ...m, completed, total };
  });

  // All phases from tree data
  const phases: TreeNode[] = detail?.path?.treeData?.phases || [];

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Group header */}
      <button onClick={toggleExpand} className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
        <div className="flex -space-x-2 shrink-0">
          {group.members.slice(0, 4).map(m => (
            <div key={m.id} className="w-7 h-7 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center text-[10px] font-medium text-purple-600 overflow-hidden" title={m.username}>
              {m.avatarUrl ? <img src={m.avatarUrl} className="w-full h-full object-cover" /> : m.username[0]}
            </div>
          ))}
          {group.members.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] text-gray-500">+{group.members.length - 4}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{group.name}</p>
          <p className="text-[10px] text-gray-400">{group.domain} · {group.members.length}人</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onNudge(group.id); }}
            className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100">
            ⏰ 催更
          </button>
          <span className="text-xs text-gray-300">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded progress tree */}
      {expanded && (
        <div className="border-t border-gray-100">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-6">加载中...</p>
          ) : !detail?.path ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">暂无共享路径</p>
              <p className="text-xs text-gray-300 mt-1">在好友页面邀请搭子时选择共享路径</p>
            </div>
          ) : (
            <div>
              {/* Member legend */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-3 overflow-x-auto">
                <span className="text-[10px] text-gray-400 shrink-0">成员:</span>
                {group.members.map(m => (
                  <Link key={m.id} href={`/profile/${m.id}`} className="flex items-center gap-1 shrink-0 hover:underline">
                    <MiniBar status={progress[m.id]?.['__any__'] || 'unlocked'} />
                    <span className="text-[10px] text-gray-600">{m.username}</span>
                    <span className="text-[10px] text-gray-400">
                      ({memberStats.find(s => s.id === m.id)?.completed || 0})
                    </span>
                  </Link>
                ))}
              </div>

              {/* Legend bar */}
              <div className="px-4 py-1.5 flex items-center gap-3 text-[10px] text-gray-400 border-b border-gray-50">
                <span><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500 align-middle mr-0.5" /> 已完成</span>
                <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-400 align-middle mr-0.5" /> 进行中</span>
                <span><span className="inline-block w-3 h-3 rounded-sm bg-gray-300 align-middle mr-0.5" /> 未开始</span>
              </div>

              {/* Path link */}
              <div className="px-4 py-2 border-b border-gray-50">
                <Link href={`/paths/${detail.path.id}`} className="text-xs text-indigo-600 hover:underline">
                  📚 {detail.path.title}
                </Link>
              </div>

              {/* Progress tree */}
              <div className="py-2">
                {phases.map((phase, i) => (
                  <NodeRow
                    key={phase.id}
                    node={phase}
                    members={group.members}
                    progressMap={progress}
                    depth={0}
                    isLast={i === phases.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create group modal ────────────────────────────
function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const token = useAuthStore(s => s.token);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [pathId, setPathId] = useState('');
  const [paths, setPaths] = useState<{ id: string; title: string }[]>([]);
  const [buddies, setBuddies] = useState<{ id: string; username: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load paths and buddies
    Promise.all([
      fetch('/api/paths', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/buddies', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([pData, bData]) => {
      if (pData) setPaths(pData.paths || []);
      if (bData) setBuddies((bData.buddies || []).map((b: any) => ({ id: b.buddy.id, username: b.buddy.username })));
    });
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || !domain.trim()) { setError('请填写组名和领域'); return; }
    if (selected.size === 0) { setError('请至少选择一个搭子'); return; }
    setSending(true);
    setError('');
    const res = await fetch('/api/buddy-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, domain, sharedPathId: pathId || undefined, memberIds: [...selected] }),
    });
    if (res.ok) { onCreated(); onClose(); }
    else { const d = await res.json(); setError(d.error || '创建失败'); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 max-w-sm mx-4 w-full space-y-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-sm">创建学习小组</h3>
        {error && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="小组名称 *" className="w-full border rounded-md px-3 py-2 text-sm" />
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="学习领域 *" className="w-full border rounded-md px-3 py-2 text-sm" />
        <select value={pathId} onChange={e => setPathId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
          <option value="">选择共享路径（可选）</option>
          {paths.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>

        {buddies.length === 0 ? (
          <p className="text-xs text-gray-400">还没有搭子，先去好友页邀请搭子</p>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-1">选择搭子加入小组:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {buddies.map(b => (
                <label key={b.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="rounded" />
                  <span className="text-sm">{b.username}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-1.5 border rounded-md text-sm">取消</button>
          <button onClick={handleCreate} disabled={sending} className="flex-1 py-1.5 bg-purple-600 text-white rounded-md text-sm disabled:opacity-50">{sending ? '创建中' : '创建小组'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────
export default function BuddiesPage() {
  const token = useAuthStore(s => s.token);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [soloBuddies, setSoloBuddies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const res = await fetch('/api/buddy-groups', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json();
      setGroups(d.groups || []);
      setSoloBuddies(d.soloBuddies || []);
    }
    setLoading(false);
  };

  useEffect(() => { if (token) load(); }, [token]);

  const handleNudge = async (groupId: string) => {
    await fetch(`/api/buddy-groups/${groupId}/nudge`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">加载中...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">🤝 搭子看板</h1>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(true)} className="text-sm text-purple-600 hover:text-purple-500">+ 创建小组</button>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">返回</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Groups */}
        {groups.map(g => (
          <GroupCard key={g.id} group={g} onNudge={handleNudge} />
        ))}

        {/* Solo buddies (no group yet) */}
        {soloBuddies.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-2">未加入小组的搭子</p>
            <div className="space-y-1">
              {soloBuddies.map((b: any) => (
                <div key={b.buddyId} className="flex items-center gap-2 text-sm py-1">
                  <span>🤝 {b.buddy.username}</span>
                  <span className="text-xs bg-purple-100 text-purple-600 px-1 py-0.5 rounded">{b.domain}</span>
                  {b.sharedPathId && <span className="text-xs text-gray-400">· 有共享路径</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-300 mt-2">创建小组即可开始多人进度对比</p>
          </div>
        )}

        {groups.length === 0 && soloBuddies.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 text-sm">还没有搭子小组</p>
            <p className="text-gray-400 text-xs mt-1">在好友页面邀请搭子，然后创建学习小组</p>
            <div className="flex gap-3 justify-center mt-4">
              <Link href="/friends" className="text-sm text-indigo-600 hover:text-indigo-500">去邀请搭子 →</Link>
              <button onClick={() => setShowCreate(true)} className="text-sm text-purple-600 hover:text-purple-500">+ 创建小组</button>
            </div>
          </div>
        )}
      </main>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
