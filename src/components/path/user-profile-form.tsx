'use client';

import { useState } from 'react';

export interface UserProfileData {
  occupation: 'student' | 'employee' | 'freelancer' | 'hobby';
  level: 'zero' | 'beginner' | 'intermediate' | 'advanced';
  goal: 'job' | 'exam' | 'project' | 'improve' | 'understand';
  goalDetail: string;
  hoursPerWeek: number;
  deadline: string;
  learningStyle: string[];
  interests: string[];
}

interface UserProfileFormProps {
  domain: string;
  onSubmit: (data: UserProfileData) => void;
  onBack: () => void;
  loading?: boolean;
}

const OCCUPATIONS = [
  { id: 'student', label: '学生', icon: '🎓', desc: '上课/考试/毕设' },
  { id: 'employee', label: '上班族', icon: '💼', desc: '提升/转行' },
  { id: 'freelancer', label: '自由职业', icon: '🆓', desc: '学习新技能' },
  { id: 'hobby', label: '兴趣爱好', icon: '💡', desc: '纯粹喜欢' },
] as const;

const LEVELS = [
  { id: 'zero', label: '完全没接触过', icon: '🌱' },
  { id: 'beginner', label: '看过一些，没怎么动手', icon: '📖' },
  { id: 'intermediate', label: '做过一些小东西', icon: '✍️' },
  { id: 'advanced', label: '有完整项目经验', icon: '🛠️' },
] as const;

const GOALS = [
  { id: 'job', label: '能找工作', icon: '🎯', needDetail: true, detailPlaceholder: '目标公司/岗位？' },
  { id: 'exam', label: '能应付考试/作业', icon: '📚', needDetail: true, detailPlaceholder: '什么时候考试？' },
  { id: 'project', label: '能做出东西', icon: '🛠️', needDetail: true, detailPlaceholder: '想做什么类型的项目？' },
  { id: 'improve', label: '能提升能力', icon: '📈', needDetail: true, detailPlaceholder: '具体想提升哪方面？' },
  { id: 'understand', label: '了解原理就行', icon: '🔍', needDetail: false },
] as const;

const LEARNING_STYLES = [
  { id: 'video', label: '看视频', icon: '📹' },
  { id: 'docs', label: '看文档/书', icon: '📝' },
  { id: 'project', label: '做项目', icon: '🛠️' },
  { id: 'theory', label: '先搞懂原理', icon: '📖' },
  { id: 'mentor', label: '有人带/问人', icon: '🤝' },
] as const;

// 根据领域生成兴趣选项（示例）
const getInterestsByDomain = (domain: string): string[] => {
  const domainLower = domain.toLowerCase();
  if (domainLower.includes('前端') || domainLower.includes('frontend')) {
    return ['React 生态', 'Vue 生态', '移动端开发', 'UI/UX 设计', '性能优化', '3D/可视化'];
  }
  if (domainLower.includes('后端') || domainLower.includes('backend')) {
    return ['微服务架构', '数据库优化', 'API 设计', '云原生', '安全'];
  }
  if (domainLower.includes('python')) {
    return ['Web 开发', '数据分析', '机器学习', '自动化脚本', '爬虫'];
  }
  // 默认选项
  return [];
};

export default function UserProfileForm({ domain, onSubmit, onBack, loading }: UserProfileFormProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<UserProfileData>>({
    hoursPerWeek: 10,
    learningStyle: [],
    interests: [],
  });

  const interests = getInterestsByDomain(domain);
  const totalSteps = interests.length > 0 ? 3 : 2;

  const updateData = (updates: Partial<UserProfileData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const canNext = () => {
    switch (step) {
      case 1:
        return data.occupation && data.level;
      case 2:
        return data.goal && data.hoursPerWeek && data.hoursPerWeek > 0;
      case 3:
        return true; // 偏好都是可选的
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onSubmit(data as UserProfileData);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onBack();
    }
  };

  const selectedGoal = GOALS.find(g => g.id === data.goal);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      {/* 进度条 */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>第 {step} 步 / 共 {totalSteps} 步</span>
          <span>{Math.round((step / totalSteps) * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#f97066] to-[#e0524a] transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* 第1步：你的情况 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              👋 嗨！聊聊你想学{domain}~
            </h3>
            <p className="text-sm text-gray-500">先了解一下你的情况</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">你目前是？</label>
            <div className="grid grid-cols-2 gap-3">
              {OCCUPATIONS.map(occ => (
                <button
                  key={occ.id}
                  onClick={() => updateData({ occupation: occ.id as UserProfileData['occupation'] })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    data.occupation === occ.id
                      ? 'border-[#f97066] bg-[#fef7f5]'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="text-2xl mb-1">{occ.icon}</div>
                  <div className="font-medium text-gray-900">{occ.label}</div>
                  <div className="text-xs text-gray-500">{occ.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              你对<span className="text-[#f97066]">{domain}</span>了解多少？
            </label>
            <div className="space-y-2">
              {LEVELS.map(level => (
                <button
                  key={level.id}
                  onClick={() => updateData({ level: level.id as UserProfileData['level'] })}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                    data.level === level.id
                      ? 'border-[#f97066] bg-[#fef7f5]'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className="text-xl">{level.icon}</span>
                  <span className="font-medium text-gray-900">{level.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 第2步：你的目标 */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              🎯 学完之后，你最想做什么？
            </h3>
            <p className="text-sm text-gray-500">这会帮助我们设计更有针对性的路径</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">你的主要目标</label>
            <div className="space-y-2">
              {GOALS.map(goal => (
                <div key={goal.id}>
                  <button
                    onClick={() => updateData({ goal: goal.id as UserProfileData['goal'], goalDetail: '' })}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                      data.goal === goal.id
                        ? 'border-[#f97066] bg-[#fef7f5]'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xl">{goal.icon}</span>
                    <span className="font-medium text-gray-900">{goal.label}</span>
                  </button>
                  {/* 追问详情 */}
                  {data.goal === goal.id && goal.needDetail && (
                    <div className="mt-2 ml-12">
                      <input
                        type="text"
                        value={data.goalDetail || ''}
                        onChange={(e) => updateData({ goalDetail: e.target.value })}
                        placeholder={goal.detailPlaceholder}
                        className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#f97066] focus:ring-1 focus:ring-[#f97066] outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">每周可用时间</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={data.hoursPerWeek || ''}
                  onChange={(e) => updateData({ hoursPerWeek: parseInt(e.target.value) || 0 })}
                  placeholder="10"
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#f97066] focus:ring-1 focus:ring-[#f97066] outline-none"
                />
                <span className="absolute right-3 top-2 text-sm text-gray-400">小时/周</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">什么时候要用？<span className="text-gray-400">(可选)</span></label>
              <input
                type="text"
                value={data.deadline || ''}
                onChange={(e) => updateData({ deadline: e.target.value })}
                placeholder="如：3个月内"
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#f97066] focus:ring-1 focus:ring-[#f97066] outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 第3步：你的偏好 */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              ⚡ 最后一步！你的学习偏好
            </h3>
            <p className="text-sm text-gray-500">这会帮助我们推荐更适合你的学习方式</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              你更喜欢怎么学？<span className="text-gray-400">(最多选2个)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {LEARNING_STYLES.map(style => {
                const isSelected = data.learningStyle?.includes(style.id);
                const canSelect = !isSelected && (data.learningStyle?.length || 0) >= 2;
                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      if (canSelect) return;
                      const newStyles = isSelected
                        ? data.learningStyle?.filter(s => s !== style.id) || []
                        : [...(data.learningStyle || []), style.id];
                      updateData({ learningStyle: newStyles });
                    }}
                    disabled={canSelect}
                    className={`px-4 py-2 rounded-full text-sm transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#f97066] text-white'
                        : canSelect
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{style.icon}</span>
                    <span>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {interests.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                有没有特别感兴趣的方向？<span className="text-gray-400">(可选)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {interests.map(interest => {
                  const isSelected = data.interests?.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => {
                        const newInterests = isSelected
                          ? data.interests?.filter(i => i !== interest) || []
                          : [...(data.interests || []), interest];
                        updateData({ interests: newInterests });
                      }}
                      className={`px-4 py-2 rounded-full text-sm transition-all ${
                        isSelected
                          ? 'bg-[#6366f1] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 按钮 */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
        <button
          onClick={handleBack}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {step === 1 ? '返回' : '上一步'}
        </button>
        <button
          onClick={handleNext}
          disabled={!canNext() || loading}
          className="flex-1 rounded-xl bg-[#f97066] px-4 py-3 text-sm font-semibold text-white hover:bg-[#e0524a] disabled:opacity-50 transition-colors"
        >
          {loading ? '生成中...' : step === totalSteps ? '生成画像' : '下一步'}
        </button>
      </div>
    </div>
  );
}
