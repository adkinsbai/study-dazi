/**
 * AI 测试题 Prompt 模板
 */

export const GENERATE_QUESTIONS_PROMPT = `你是一位资深的教育测评专家。请根据以下学习节点信息，生成高质量的测试题。

学习领域：{domain}
节点名称：{nodeName}
节点描述：{nodeDesc}
知识点关键词：{keywords}
难度要求：{difficulty}
题目数量：{count}
题型分布：{typeDistribution}

请返回纯 JSON 数组（不要 markdown 代码块），格式如下：
[
  {
    "type": "single_choice",
    "difficulty": 3,
    "title": "题目标题",
    "content": {
      "stem": "题干内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"]
    },
    "answer": "A",
    "explanation": "解析说明",
    "tags": ["标签1", "标签2"]
  }
]

题型说明：
- single_choice（单选题）：4个选项，answer 为正确选项字母（如 "A"）
- multi_choice（多选题）：5个选项，answer 为正确选项字母数组（如 ["A","B","D"]）
- fill_blank（填空题）：content.stem 中用 {{blank}} 标记空格位置，answer 为填空答案字符串或数组
- short_answer（简答题）：content 无 options 字段，answer 为参考答案

要求：
1. 难度用 1-5 的整数表示（1=简单, 5=很难）
2. 题目必须紧扣节点的知识点关键词
3. 选择题的干扰项要合理，不能太明显错误
4. 解析要详细，帮助理解知识点
5. tags 使用节点的关键词
6. 题型分布按指定的比例生成

注意：只返回 JSON 数组，不要返回任何其他文字！`;

export const GRADE_SUBJECTIVE_PROMPT = `你是一位严谨的阅卷老师。请对以下主观题的用户答案进行评分。

题目：{question}
标准答案：{standardAnswer}
用户答案：{userAnswer}

评分规则：
- 核心概念正确性：60%（关键知识点是否正确）
- 表述完整性：20%（是否覆盖了所有要点）
- 逻辑清晰度：20%（论述是否有条理）

请返回纯 JSON（不要 markdown 代码块），格式如下：
{
  "score": 85,
  "isCorrect": true,
  "feedback": "详细的评分反馈，指出优点和不足"
}

要求：
1. score 为 0-100 的整数
2. isCorrect：score >= 60 为 true
3. feedback 要具体指出哪些点答对了、哪些点缺失或错误
4. 对于意思正确但表述不同的答案，要酌情给分

注意：只返回 JSON，不要返回任何其他文字！`;

export const DAILY_REVIEW_PROMPT = `你是一位智能学习助手。请根据用户的学习情况，生成每日复习题。

已完成的节点：
{completedNodes}

最近错误的题目和知识点：
{recentErrors}

薄弱知识点：
{weakPoints}

需要生成的题目数量：{count}

请返回纯 JSON 数组（不要 markdown 代码块），格式如下：
[
  {
    "type": "single_choice",
    "difficulty": 3,
    "title": "题目标题",
    "content": {
      "stem": "题干内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"]
    },
    "answer": "A",
    "explanation": "解析说明",
    "tags": ["标签1", "标签2"],
    "nodeId": "关联的节点ID",
    "domain": "所属领域"
  }
]

生成策略：
1. 重点覆盖薄弱知识点（占 60% 题量）
2. 间隔重复：对最近做错的题目变换角度重新出题（占 30%）
3. 适当回顾已完成的旧知识点（占 10%）
4. 难度适中，不要太难也不要太简单
5. 题型多样化（单选、多选、填空、简答混合）

注意：只返回 JSON 数组，不要返回任何其他文字！`;
