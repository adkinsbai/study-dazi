'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';
import { Clock, Users, Plus, ChevronDown, BookOpen } from 'lucide-react';

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
  is_required?: boolean; node_type?: string; children?: TreeNode[];
}
interface ProgressMap {
  [userId: string]: { [nodeId: string]: { status: string } };
}

// ─── Avatar ───────────────────────────────────────
function Avatar({ username, avatarUrl }: { username: string; avatarUrl?: string | null }) {
  const colors = ['bg-[#f97066]','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-violet-500'];
  const idx = username.charCodeAt(0) % colors.length;
  return (
    <div className={`w-8 h-8 rounded-full ${colors[idx]} flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden ring-2 ring-white`}>
      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : username[0]?.toUpperCase()}
    </div>
  );
}

// ─── Progress ring ────────────────────────────────
function ProgressRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#8b5cf6" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="600"
        transform={`rotate(90 ${size / 2} ${size / 2})`}>{pct}%</text>
    </svg>
  );
}

// ─── Progress bar ─────────────────────────────────
function ProgressBar({ pct, color = 'bg-purple-500' }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Status dot ────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-500 ring-emerald-200',
    in_progress: 'bg-amber-400 ring-amber-200',
    unlocked: 'bg-gray-300 ring-gray-100',
    locked: 'bg-gray-200 ring-gray-100',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ring-2 ${colors[status] || 'bg-gray-200 ring-gray-100'}`} title={status} />;
}

// ─── Node row ──────────────────────────────────────
function NodeRow({
  node, members, progressMap, depth, isLast,
}: {
  node: TreeNode; members: Member[]; progressMap: ProgressMap; depth: number; isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 hover:bg-gray-50/60 rounded-md px-2 transition-colors group" style={{ paddingLeft: depth * 20 + 8 }}>
        {/* Tree lines */}
        {depth > 0 && (
          <div className="relative w-4 shrink-0 self-stretch">
            <div className={`absolute left-1.5 top-0 ${isLast ? 'h-1/2' : 'h-full'} w-px bg-gray-200`} />
            <div className="absolute left-1.5 top-1/2 w-2 h-px bg-gray-200" />
          </div>
        )}

        {/* Toggle */}
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={`shrink-0 w-4 text-center ${hasChildren ? 'text-gray-400 hover:text-purple-600 cursor-pointer' : 'text-gray-300 cursor-default'}`}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : '·'}
        </button>

        {/* Title + type badge */}
        <span className="text-xs text-gray-800 flex-1 min-w-0 truncate">{node.title}</span>
        {node.node_type === 'optional' && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-600 shrink-0">可选</span>}
        {node.node_type === 'advanced' && <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 shrink-0">进阶</span>}

        {/* Member status dots */}
        <div className="flex items-center gap-1 shrink-0">
          {members.map(m => (
            <StatusDot key={m.id} status={progressMap[m.id]?.[node.id]?.status || 'locked'} />
          ))}
        </div>
      </div>

      {expanded && hasChildren && node.children!.map((child, i) => (
        <NodeRow key={child.id} node={child} members={members} progressMap={progressMap}
          depth={depth + 1} isLast={i === node.children!.length - 1} />
      ))}
    </div>
  );
}

// ─── Group card ────────────────────────────────────
function GroupCard({ group, onNudge, index }: { group: GroupData; onNudge: (id: string) => void; index: number }) {
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

  const progress = detail?.progress || {};
  const memberStats = group.members.map(m => {
    const nodes = progress[m.id] || {};
    const completed = Object.values(nodes).filter(s => s.status === 'completed').length;
    const total = Object.keys(nodes).length;
    return { ...m, completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  });

  const phases: TreeNode[] = detail?.path?.treeData?.phases || [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden hover:shadow-md transition-shadow card-lift stagger-item" style={{ '--i': index } as React.CSSProperties}>
      {/* Header */}
      <button onClick={toggleExpand} className="w-full p-5 text-left hover:bg-purple-50/30 transition-colors btn-press">
        <div className="flex items-start gap-4">
          {/* Avatar stack */}
          <div className="flex -space-x-3 shrink-0">
            {group.members.slice(0, 5).map(m => (
              <Avatar key={m.id} username={m.username} avatarUrl={m.avatarUrl} />
            ))}
            {group.members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-[10px] font-medium text-gray-500">
                +{group.members.length - 5}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900">{group.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {group.domain} · {group.members.length} 位搭子
              {detail?.path && <> · <BookOpen size={12} className="text-gray-400 inline" /> {detail.path.title}</>}
            </p>

            {/* Member progress bars */}
            {memberStats.some(s => s.total > 0) && (
              <div className="mt-3 space-y-1.5">
                {memberStats.map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-16 truncate shrink-0">{s.username}</span>
                    <ProgressBar pct={s.pct} />
                    <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">{s.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); onNudge(group.id); }}
              className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors btn-press flex items-center gap-1">
              <Clock size={12} /> 催更
            </button>
            <span className={`text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`}><ChevronDown size={12} /></span>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-purple-100 bg-purple-50/20">
          {loading ? (
            <div className="text-center py-10">
              <div className="w-6 h-6 border-2 border-purple-300 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">加载进度数据...</p>
            </div>
          ) : !detail?.path ? (
            <div className="text-center py-10">
              <BookOpen size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">暂无共享路径</p>
              <p className="text-xs text-gray-400 mt-1">在好友页面邀请搭子时可选择共享路径</p>
            </div>
          ) : (
            <div>
              {/* Legend */}
              <div className="px-5 py-2 flex items-center gap-4 text-[10px] text-gray-400 border-b border-purple-100/50">
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 align-middle mr-1" /> 已完成</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200 align-middle mr-1" /> 进行中</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 ring-2 ring-gray-100 align-middle mr-1" /> 未开始</span>
              </div>

              {/* Path link */}
              <div className="px-5 py-2 border-b border-purple-100/50">
                <Link href={`/paths/${detail.path.id}`} className="text-xs text-purple-600 hover:underline font-medium flex items-center gap-1">
                  <BookOpen size={12} /> 查看完整路径：{detail.path.title} →
                </Link>
              </div>

              {/* Progress tree */}
              <div className="py-2 px-1">
                {phases.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">路径中没有节点</p>
                ) : (
                  phases.map((phase, i) => (
                    <NodeRow key={phase.id} node={phase} members={group.members}
                      progressMap={progress} depth={0} isLast={i === phases.length - 1} />
                  ))
                )}
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
    Promise.all([
      fetch('/api/paths', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch('/api/buddies', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([pData, bData]) => {
      if (pData) setPaths(pData.paths || []);
      if (bData) setBuddies((bData.buddies || []).map((b: any) => ({ id: b.buddy.id, username: b.buddy.username })));
    });
  }, []);

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleCreate = async () => {
    if (!name.trim() || !domain.trim()) { setError('请填写组名和领域'); return; }
    if (selected.size === 0) { setError('请至少选择一个搭子'); return; }
    setSending(true); setError('');
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 w-full space-y-4 shadow-xl max-h-[85vh] overflow-y-auto modal-enter" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Plus size={18} className="text-purple-500" /> 创建学习小组</h3>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">小组名称</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：前端冲刺小分队"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">学习领域</label>
            <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="如：前端开发"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">共享路径（可选）</label>
            <select value={pathId} onChange={e => setPathId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent">
              <option value="">不共享路径</option>
              {paths.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">选择搭子加入</p>
          {buddies.length === 0 ? (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">还没有搭子，去好友页邀请 →</p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {buddies.map(b => (
                <label key={b.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selected.has(b.id) ? 'bg-purple-50 border border-purple-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="rounded accent-purple-600" />
                  <Avatar username={b.username} />
                  <span className="text-sm font-medium">{b.username}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">取消</button>
          <button onClick={handleCreate} disabled={sending}
            className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-500 disabled:opacity-50 transition-colors">
            {sending ? '创建中...' : '创建小组'}
          </button>
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fef7f5]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-300 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">加载搭子数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#fef7f5] bg-dots bg-purple-glow min-h-screen page-enter">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Groups */}
        {groups.map((g, i) => (
          <GroupCard key={g.id} group={g} onNudge={handleNudge} index={i} />
        ))}

        {/* Solo buddies */}
        {soloBuddies.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 card-lift">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">未加入小组的搭子</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {soloBuddies.map((b: any, i: number) => (
                <div key={b.buddyId} className="flex items-center gap-3 p-3 rounded-xl bg-[#fef7f5] card-lift stagger-item" style={{ '--i': i } as React.CSSProperties}>
                  <Avatar username={b.buddy.username} avatarUrl={b.buddy.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{b.buddy.username}</p>
                    <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">{b.domain}</span>
                  </div>
                  {b.sharedPathId && <BookOpen size={14} className="text-gray-400 shrink-0" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">创建小组即可开始多人进度对比</p>
          </div>
        )}

        {/* Empty state */}
        {groups.length === 0 && soloBuddies.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center card-lift">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">还没有搭子小组</h3>
            <p className="text-sm text-gray-500">邀请好友成为搭子，创建小组一起学习</p>
            <div className="flex gap-3 justify-center mt-5">
              <Link href="/friends" className="px-5 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition-colors btn-press">
                去邀请搭子
              </Link>
              <button onClick={() => setShowCreate(true)}
                className="px-5 py-2 rounded-full border border-purple-300 text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors btn-press">
                创建小组
              </button>
            </div>
          </div>
        )}
      </main>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
