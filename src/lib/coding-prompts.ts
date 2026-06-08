export const GENERATE_CODING_PROBLEMS_PROMPT = `你是一位资深编程面试出题专家。根据给定的学习节点，生成高质量的编程题。

学习领域：{domain}
节点名称：{nodeName}
关键词：{keywords}
难度要求：{difficulty}
生成数量：{count}

请返回纯 JSON 数组（不要 markdown 代码块），格式如下：
[
  {
    "title": "题目标题",
    "description": "题目描述（Markdown 格式，包含详细的问题描述和背景说明）",
    "difficulty": "easy",
    "tags": ["标签1", "标签2"],
    "examples": [
      {
        "input": "示例输入",
        "output": "示例输出",
        "explanation": "解释为什么输入得到该输出"
      }
    ],
    "constraints": "约束条件",
    "hints": ["提示1", "提示2"],
    "solution": "参考代码（Python）",
    "language": "python"
  }
]

要求：
1. difficulty 只能是 "easy"、"medium"、"hard"
2. 每题至少 1 个示例，最多 3 个
3. description 使用 Markdown 格式，清晰描述问题
4. solution 必须是完整可运行的 Python 代码，并包含注释解释思路
5. hints 给出 1-3 个渐进式提示，不要直接给出答案
6. constraints 列出输入范围、数据规模等限制
7. tags 包含 2-4 个相关知识点标签
8. 题目必须与节点主题和关键词紧密相关
9. 难度要准确：easy 考基础概念，medium 需要一定算法思维，hard 需要复杂算法或优化

注意：只返回 JSON 数组，不要返回任何其他文字！`;

export const GENERATE_PROJECT_PROMPT = `你是一位资深项目导师。根据给定的学习节点，设计一个实战项目。

学习领域：{domain}
节点名称：{nodeName}
关键词：{keywords}

请返回纯 JSON（不要 markdown 代码块），格式如下：
{
  "title": "项目标题",
  "description": "项目简介（200-300字，说明项目做什么、有什么价值）",
  "requirements": [
    "需求1：具体的功能或技术要求",
    "需求2：..."
  ],
  "difficulty": "medium",
  "estimatedHours": 20,
  "techStack": ["技术1", "技术2"],
  "hints": [
    "实现提示1",
    "实现提示2"
  ],
  "evaluationCriteria": [
    {
      "criterion": "评估维度名称",
      "weight": 0.3,
      "description": "这个维度评估什么、怎么评分"
    }
  ],
  "resources": [
    {
      "title": "参考资源名称",
      "url": "https://example.com"
    }
  ]
}

要求：
1. difficulty 只能是 "easy"、"medium"、"hard"
2. requirements 3-6 个，按优先级排列
3. techStack 列出项目需要用到的技术栈（2-5 个）
4. evaluationCriteria 总权重之和必须等于 1.0，3-5 个评估维度
5. hints 给出 3-5 个实现方向的提示
6. resources 推荐 2-4 个相关学习资源（使用真实可用的 URL）
7. 项目必须与节点主题和关键词紧密相关
8. estimatedHours 基于一个中等水平学习者的完成速度估算

注意：只返回 JSON，不要返回任何其他文字！`;

export const EVALUATE_PROJECT_PROMPT = `你是一位资深项目评审专家。请评估用户提交的项目。

项目标题：{projectTitle}
项目需求：
{requirements}

评估标准：
{evaluationCriteria}

用户提交内容：
{userContent}

请返回纯 JSON（不要 markdown 代码块），格式如下：
{
  "score": 85,
  "feedback": "总体评价（200-300字，指出优点和需要改进的地方）",
  "criteriaScores": [
    {
      "criterion": "评估维度名称",
      "score": 80,
      "feedback": "针对这个维度的具体评价"
    }
  ]
}

要求：
1. score 为 0-100 的整数
2. criteriaScores 中每个维度的 score 也是 0-100
3. 最终 score 应该是各维度加权平均（根据权重计算）
4. feedback 要具体、有建设性，既肯定优点也指出不足
5. 每个 criteriaScores 的 feedback 要针对该维度给出具体评价
6. 如果用户提交内容过于简单或不符合要求，要适当扣分

注意：只返回 JSON，不要返回任何其他文字！`;
