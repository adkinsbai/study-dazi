'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { ProgressBar } from '@/components/ui/progress-bar';
import UserProfileForm, { UserProfileData } from '@/components/path/user-profile-form';
import UserProfileViewer from '@/components/path/user-profile-viewer';
import { convertFileToMarkdown, detectFormat } from '@/lib/file-converter';

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'mimo', name: 'MIMO' },
  { id: 'openai', name: 'GPT' },
  { id: 'openai-relay', name: 'GPT 中转站' },
] as const;

type Step = 'profile' | 'intent' | 'framework' | 'nodes' | 'ready';

interface Phase {
  id: string;
  title: string;
  description: string;
  estimated_hours: number;
  is_required: boolean;
  why: string;
}

interface TreeNode {
  id: string;
  title: string;
  description: string;
  estimated_hours: number;
  node_type: 'required' | 'optional' | 'advanced';
  resources_hint: string;
  check_criteria: string;
}

export default function NewPathPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  const [step, setStep] = useState<Step>('profile');
  const [domain, setDomain] = useState('');
  const [level, setLevel] = useState<'零基础' | '有基础' | '进阶'>('零基础');
  const [goal, setGoal] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('deepseek');
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);

  // 用户画像相关状态
  const [userProfile, setUserProfile] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileProgress, setProfileProgress] = useState(0);
  const [profileProgressStatus, setProfileProgressStatus] = useState('');

  useEffect(() => {
    if (token) {
      fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.apiKeys) {
            const ids = d.apiKeys.map((k: { provider: string }) => k.provider);
            setConfiguredProviders(ids);
            // 如果当前 provider 没配置，自动切换到第一个已配置的
            if (ids.length > 0 && !ids.includes(provider)) {
              setProvider(ids[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const [publicTemplate, setPublicTemplate] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  // expandedPhases = 节点数据缓存（展开后永久保留，不清除）
  const [expandedPhases, setExpandedPhases] = useState<Record<string, TreeNode[]>>({});
  // visibleExpanded = 当前展开可见的阶段 id 集合
  const [visibleExpanded, setVisibleExpanded] = useState<Set<string>>(new Set());
  // 支持多个并行展开的进度状态
  const [expandingPhases, setExpandingPhases] = useState<Set<string>>(new Set());
  const [nodeProgressMap, setNodeProgressMap] = useState<Record<string, { progress: number; status: string }>>({});
  // 用户选择的子节点：{ phaseId: Set<nodeId> }
  const [selectedNodes, setSelectedNodes] = useState<Record<string, Set<string>>>({});

  // 上传的学习资料
  const [materials, setMaterials] = useState<{ name: string; markdown: string }[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 进度条状态
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  /** 消费 SSE 流式响应，返回最终 result */
  const consumeSSE = useCallback(async (
    res: Response,
    onProgress: (chunks: number) => void,
    onRetry?: (attempt: number) => void,
  ): Promise<unknown> => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (eventType === 'progress') {
            try { onProgress(JSON.parse(data).chunks); } catch { /* ignore */ }
          } else if (eventType === 'retry') {
            try { onRetry?.(JSON.parse(data).attempt); } catch { /* ignore */ }
          } else if (eventType === 'done') {
            return JSON.parse(data).result;
          } else if (eventType === 'error') {
            throw new Error(JSON.parse(data).message);
          }
          eventType = '';
        }
      }
    }
    throw new Error('AI 响应中断');
  }, []);

  // 处理文件上传转换
  const handleFiles = useCallback(async (files: FileList) => {
    setMaterialsError('');
    setMaterialsLoading(true);
    const newMaterials: { name: string; markdown: string }[] = [];
    for (const file of Array.from(files)) {
      if (!detectFormat(file.name)) {
        setMaterialsError(`不支持: ${file.name}（支持 PDF/DOCX/PPTX/HTML）`);
        continue;
      }
      try {
        const result = await convertFileToMarkdown(file);
        if (result.markdown.trim()) {
          newMaterials.push(result);
        } else {
          setMaterialsError(`${file.name}: 未提取到内容`);
        }
      } catch (err) {
        setMaterialsError(`${file.name}: ${err instanceof Error ? err.message : '转换失败'}`);
      }
    }
    if (newMaterials.length > 0) {
      setMaterials(prev => [...prev, ...newMaterials]);
    }
    setMaterialsLoading(false);
  }, []);

  const removeMaterial = useCallback((index: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== index));
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  // 生成用户画像
  const handleGenerateProfile = async (data: UserProfileData) => {
    if (!domain.trim()) {
      setError('请先填写学习领域');
      return;
    }

    setError('');
    setProfileLoading(true);
    setProfileProgress(5);
    setProfileProgressStatus('正在连接 AI...');
    try {
      const res = await fetch('/api/paths/generate/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Stream': 'true',
        },
        body: JSON.stringify({
          domain,
          ...data,
          provider,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '生成画像失败');
      }

      const result = await consumeSSE(res, (chunks) => {
        const pct = Math.min(95, Math.round(5 + chunks / 120 * 90));
        setProfileProgress(pct);
        setProfileProgressStatus(`AI 正在生成中... (${chunks} tokens)`);
      }) as { profile?: string };
      setProfileProgress(100);
      setProfileProgressStatus('完成！');
      setUserProfile(result.profile || '');
      setProfileData(data);
      // 根据问卷数据自动填充原有字段
      const levelMap: Record<string, '零基础' | '有基础' | '进阶'> = {
        zero: '零基础',
        beginner: '有基础',
        intermediate: '有基础',
        advanced: '进阶',
      };
      setLevel(levelMap[data.level] || '零基础');
      setHoursPerWeek(String(data.hoursPerWeek));
      const goalMap: Record<string, string> = {
        job: '找工作',
        exam: '考试/作业',
        project: '做项目',
        improve: '提升能力',
        understand: '了解原理',
      };
      setGoal(data.goalDetail || goalMap[data.goal] || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成画像失败');
      setProfileProgress(0);
      setProfileProgressStatus('');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleGenerateFramework = async () => {
    setError('');
    setLoading(true);
    // 重新生成时清空节点缓存
    setExpandedPhases({});
    setVisibleExpanded(new Set());
    setProgress(5);
    setProgressStatus('正在连接 AI...');
    try {
      const res = await fetch('/api/paths/generate/framework', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Stream': 'true',
        },
        body: JSON.stringify({
          domain,
          level,
          goal: goal || undefined,
          hours_per_week: hoursPerWeek ? parseInt(hoursPerWeek) : undefined,
          provider,
          userProfile: userProfile || undefined,
          materials: materials.length > 0
            ? materials.map(m => `【${m.name}】\n${m.markdown}`).join('\n\n---\n\n')
            : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '生成失败');
      }
      const data = await consumeSSE(res, (chunks) => {
        const pct = Math.min(95, Math.round(5 + chunks / 180 * 90));
        setProgress(pct);
        setProgressStatus(`AI 正在生成中... (${chunks} tokens)`);
      }, (attempt) => {
        setProgress(5);
        setProgressStatus(`响应被截断，正在重试 (第${attempt + 1}次)...`);
      }) as { phases?: Record<string, unknown>[] };
      // DeepSeek 可能返回数字 id，统一转字符串
      let phases: Phase[] = [];
      try {
        const raw = Array.isArray(data.phases) ? data.phases : [];
        phases = raw.map((p) => ({
          ...p,
          id: String(p.id ?? ''),
        })) as Phase[];
      } catch {
        setError('数据格式异常，请重试');
        setLoading(false);
        return;
      }
      setPhases(phases);
      setStep('framework');
      setProgress(100);
      setProgressStatus('完成！');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      setProgress(0);
      setProgressStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandPhase = async (phaseId: string, phaseTitle: string) => {
    // 缓存命中：直接展开，无需请求
    if (expandedPhases[phaseId]) {
      setVisibleExpanded((prev) => new Set(prev).add(phaseId));
      return;
    }

    setExpandingPhases(prev => new Set(prev).add(phaseId));
    setError('');
    setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: 5, status: '正在连接 AI...' } }));
    try {
      const res = await fetch('/api/paths/generate/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Stream': 'true',
        },
        body: JSON.stringify({
          domain,
          phases_json: JSON.stringify(phases),
          phase_id: phaseId,
          phase_title: phaseTitle,
          provider,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '展开失败');
      }
      const data = await consumeSSE(res, (chunks) => {
        const pct = Math.min(95, Math.round(5 + chunks / 120 * 90));
        setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: pct, status: `AI 正在生成中... (${chunks} tokens)` } }));
      }, (attempt) => {
        setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: 5, status: `响应被截断，正在重试 (第${attempt + 1}次)...` } }));
      }) as { nodes?: TreeNode[] };
      const nodes: TreeNode[] = data.nodes || [];
      // 写入缓存 + 设为可见
      setExpandedPhases((prev) => ({ ...prev, [phaseId]: nodes }));
      setVisibleExpanded((prev) => new Set(prev).add(phaseId));
      // 默认全选所有子节点
      setSelectedNodes((prev) => ({
        ...prev,
        [phaseId]: new Set(nodes.map((n) => n.id)),
      }));
      setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: 100, status: '完成！' } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '展开失败');
      setNodeProgressMap(prev => ({ ...prev, [phaseId]: { progress: 0, status: '' } }));
    } finally {
      setExpandingPhases(prev => {
        const next = new Set(prev);
        next.delete(phaseId);
        return next;
      });
    }
  };

  // 切换子节点选中状态
  const toggleNodeSelection = (phaseId: string, nodeId: string) => {
    setSelectedNodes((prev) => {
      const phaseSelected = prev[phaseId] || new Set();
      const next = new Set(phaseSelected);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return { ...prev, [phaseId]: next };
    });
  };

  const handleSave = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. 收集已缓存的子节点，找出未展开的阶段
      const allChildren: Record<string, TreeNode[]> = { ...expandedPhases };
      const unexpanded = phases.filter((p) => !allChildren[p.id]);
      const total = phases.length;
      let completed = total - unexpanded.length;

      // 2. 自动为所有未展开阶段生成子节点
      if (unexpanded.length > 0) {
        for (const phase of unexpanded) {
          setProgress(Math.round((completed / total) * 100));
          setProgressStatus(`正在生成「${phase.title}」的子节点 (${completed + 1}/${total})`);

          try {
            const res = await fetch('/api/paths/generate/nodes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'X-Stream': 'true',
              },
              body: JSON.stringify({
                domain,
                phases_json: JSON.stringify(phases),
                phase_id: phase.id,
                phase_title: phase.title,
                provider,
              }),
            });
            if (res.ok) {
              const data = await consumeSSE(res, () => {}) as { nodes?: TreeNode[] };
              allChildren[phase.id] = data.nodes || [];
            }
          } catch {
            // 单个阶段失败不阻塞整体保存
          }
          completed++;
        }
      }

      // 3. 构建完整树（只包含用户选中的子节点）
      const tree = {
        domain,
        level,
        phases: phases.map((p) => {
          const allNodes = allChildren[p.id] || [];
          const selected = selectedNodes[p.id];
          // 如果用户没有手动选择，则保留所有节点
          const children = selected ? allNodes.filter(n => selected.has(n.id)) : allNodes;
          return {
            ...p,
            children,
          };
        }),
      };

      setProgress(100);
      setProgressStatus('正在保存路径...');

      // 4. 保存
      const res = await fetch('/api/paths', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: `${domain}学习路径`,
          domain,
          tree_data: tree,
          isPublic: publicTemplate,
          isTemplate: publicTemplate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存失败');
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">生成失败</p>
              <p className="text-sm text-red-600 mt-0.5 break-words">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 text-sm shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Step 1: 用户画像问卷 */}
        {step === 'profile' && !userProfile && (
          <div>
            {/* 领域输入（先填写领域再开始问卷） */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold mb-4">你想学什么？</h2>

              {/* 模型选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">AI 模型</label>
                <div className="flex gap-2">
                  {PROVIDERS.map(p => {
                    const isConfigured = configuredProviders.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setProvider(p.id)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors relative ${
                          provider === p.id
                            ? 'bg-[#f97066] text-white'
                            : isConfigured
                              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        {p.name}
                        {isConfigured && provider !== p.id && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {!configuredProviders.includes(provider) && (
                  <p className="text-xs text-amber-500 mt-1">
                    ⚠️ 该模型未配置 API Key，请先去<a href="/settings" className="underline ml-1">设置</a>页面配置
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">学习领域</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="如：前端开发、Python、UI 设计"
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f97066] focus:ring-1 focus:ring-[#f97066]"
                />
              </div>
            </div>

            {/* 用户画像问卷 */}
            {domain.trim() && (
              <UserProfileForm
                domain={domain}
                onSubmit={handleGenerateProfile}
                onBack={() => router.push('/')}
                loading={profileLoading}
              />
            )}

            {/* 画像生成中的进度提示 */}
            {profileLoading && (
              <div className="bg-white rounded-2xl shadow-sm p-6 mt-4">
                <ProgressBar progress={profileProgress} status={profileProgressStatus || 'AI 正在分析你的信息，生成个性化画像...'} />
              </div>
            )}
          </div>
        )}

        {/* Step 1.5: 展示用户画像 */}
        {step === 'profile' && userProfile && (
          <UserProfileViewer
            profile={userProfile}
            onConfirm={() => setStep('intent')}
            onBack={() => setUserProfile(null)}
            loading={false}
          />
        )}

        {/* Step 2: Intent */}
        {step === 'intent' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">你想学什么？</h2>

            {/* 模型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI 模型</label>
              <div className="flex gap-2">
                {PROVIDERS.map(p => {
                  const isConfigured = configuredProviders.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors relative ${
                        provider === p.id
                          ? 'bg-[#f97066] text-white'
                          : isConfigured
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {p.name}
                      {isConfigured && provider !== p.id && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              {!configuredProviders.includes(provider) && (
                <p className="text-xs text-amber-500 mt-1">
                  ⚠️ 该模型未配置 API Key，请先去<a href="/settings" className="underline ml-1">设置</a>页面配置
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">领域</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="如：前端开发、Python、UI 设计"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">当前水平</label>
              <div className="mt-1 flex gap-2">
                {(['零基础', '有基础', '进阶'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      level === l
                        ? 'bg-[#f97066] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">目标（可选）</label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="如：转行找工作、做副业"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">每周可投入（小时，可选）</label>
              <input
                type="number"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="如：15"
                className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 上传学习资料（可选） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                学习资料（可选）
              </label>
              <p className="text-xs text-gray-400 mb-2">
                上传课程大纲、教材目录等，AI 会参考这些内容生成更精准的路径
              </p>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.html,.htm"
                  multiple
                  onChange={(e) => {
                    if (e.target.files?.length) handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                {materialsLoading ? (
                  <p className="text-sm text-blue-500">⏳ 正在转换...</p>
                ) : (
                  <p className="text-sm text-gray-400">📄 点击或拖拽上传 PDF / DOCX / PPTX / HTML</p>
                )}
              </div>
              {materialsError && (
                <p className="text-xs text-red-500 mt-1">{materialsError}</p>
              )}
              {materials.length > 0 && (
                <div className="mt-2 space-y-1">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-green-50 rounded px-3 py-1.5 text-sm">
                      <span className="text-green-700 truncate flex-1">
                        ✅ {m.name} <span className="text-green-400">({m.markdown.length} 字)</span>
                      </span>
                      <button
                        onClick={() => removeMaterial(i)}
                        className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading && (
              <div className="bg-[#fef4f3] rounded-lg p-4">
                <ProgressBar progress={progress} status={progressStatus} />
              </div>
            )}

            <button
              onClick={handleGenerateFramework}
              disabled={!domain.trim() || loading}
              className="w-full rounded-md bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50"
            >
              {loading ? '⏳ AI 正在生成学习路径...' : '✨ 生成学习框架'}
            </button>
          </div>
        )}

        {/* Step 2: Framework Review */}
        {step === 'framework' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">学习框架</h2>
            <p className="text-sm text-gray-500">
              点击展开每个阶段的子节点
            </p>

            {phases.length === 0 && !loading && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-400 text-sm">未生成任何阶段</p>
                <p className="text-gray-400 text-xs mt-1">请返回上一步重新生成</p>
              </div>
            )}

            <div className="space-y-3">
              {phases.map((phase) => (
                <div key={phase.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${phase.is_required ? 'bg-[#fde8e6] text-[#e0524a]' : 'bg-gray-100 text-gray-500'}`}>
                          {phase.is_required ? '必修' : '可选'}
                        </span>
                        <h3 className="font-medium">{phase.title}</h3>
                        <span className="text-xs text-gray-400">~{phase.estimated_hours}h</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{phase.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{phase.why}</p>
                    </div>
                  </div>

                  {/* Expanded children */}
                  {visibleExpanded.has(phase.id) && expandedPhases[phase.id] && (
                    <div className="mt-3 ml-4 border-l-2 border-[#fde8e6] pl-4 space-y-2">
                      {expandedPhases[phase.id].map((node) => {
                        const isSelected = selectedNodes[phase.id]?.has(node.id) ?? true;
                        return (
                          <div key={node.id} className={`text-sm p-2 rounded-lg transition-colors ${isSelected ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleNodeSelection(phase.id, node.id)}
                                className="rounded border-gray-300 text-[#f97066] focus:ring-[#f97066]"
                              />
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                node.node_type === 'required' ? 'bg-[#fef4f3] text-[#f97066]' :
                                node.node_type === 'optional' ? 'bg-amber-50 text-amber-600' :
                                'bg-purple-50 text-purple-600'
                              }`}>
                                {node.node_type === 'required' ? '必修' : node.node_type === 'optional' ? '可选' : '进阶'}
                              </span>
                              <span className={`font-medium ${isSelected ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{node.title}</span>
                              <span className="text-gray-400">~{node.estimated_hours}h</span>
                            </div>
                            <p className={`mt-0.5 ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}>{node.description}</p>
                            <p className={`text-xs mt-0.5 ${isSelected ? 'text-gray-400' : 'text-gray-300'}`}>✅ {node.check_criteria}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 展开中进度条 */}
                  {expandingPhases.has(phase.id) && nodeProgressMap[phase.id] && (
                    <div className="mt-3 bg-[#fef4f3] rounded-lg p-3">
                      <ProgressBar progress={nodeProgressMap[phase.id].progress} status={nodeProgressMap[phase.id].status} />
                    </div>
                  )}

                  {/* Expand button or collapse */}
                  {!visibleExpanded.has(phase.id) ? (
                    <button
                      onClick={() => handleExpandPhase(phase.id, phase.title)}
                      disabled={expandingPhases.has(phase.id) || loading}
                      className="mt-3 text-sm text-[#f97066] hover:text-[#e0524a] font-medium disabled:opacity-50"
                    >
                      {expandingPhases.has(phase.id)
                        ? '⏳ AI 正在生成子节点...'
                        : '+ 展开子节点'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setVisibleExpanded((prev) => {
                          const next = new Set(prev);
                          next.delete(phase.id);
                          return next;
                        });
                      }}
                      className="mt-3 text-sm text-gray-400 hover:text-gray-600"
                    >
                      收起
                    </button>
                  )}
                </div>
              ))}
            </div>

            {loading && (
              <div className="bg-[#fef4f3] rounded-lg p-4">
                <ProgressBar progress={progress} status={progressStatus} />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={publicTemplate} onChange={e => setPublicTemplate(e.target.checked)}
                className="rounded border-gray-300 text-[#f97066] focus:ring-indigo-500" />
              公开为模板（其他人可以在广场 Fork）
            </label>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('intent')}
                disabled={loading}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ← 返回
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 rounded-md bg-[#f97066] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50"
              >
                {loading ? '⏳ 正在生成并保存...' : '💾 保存路径'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
