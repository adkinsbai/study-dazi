import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { chatCompletion } from '@/lib/ai';
import { GRADE_SUBJECTIVE_PROMPT } from '@/lib/test-prompts';
import { authenticate } from '@/lib/auth';
import { DEFAULT_PROVIDER } from '@/lib/ai-providers';

const AnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string(), // 用户答案
  timeSpent: z.number().int().min(0).optional(), // 用时（秒）
});

const BodySchema = z.object({
  answers: z.array(AnswerSchema).min(1, '请至少提交一道题的答案'),
  provider: z.string().optional(),
});

/** 判断是否为主观题 */
function isSubjectiveType(type: string): boolean {
  return type === 'short_answer' || type === 'coding';
}

/** 客观题判分 */
function gradeObjective(question: any, userAnswer: string): { isCorrect: boolean; score: number; feedback: string } {
  const correctAnswer = question.answer;
  const type = question.type;

  if (type === 'single_choice' || type === 'true_false') {
    // 单选/判断：直接比对
    const isCorrect = userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? '回答正确！' : `正确答案是 ${correctAnswer}`,
    };
  }

  if (type === 'multi_choice') {
    // 多选：比对集合
    try {
      const correct = JSON.parse(correctAnswer);
      const user = userAnswer.split(',').map((s: string) => s.trim().toUpperCase()).sort();
      const correctSorted = (Array.isArray(correct) ? correct : [correct])
        .map((s: string) => s.trim().toUpperCase())
        .sort();
      const isCorrect = JSON.stringify(user) === JSON.stringify(correctSorted);
      return {
        isCorrect,
        score: isCorrect ? 100 : 0,
        feedback: isCorrect ? '回答正确！' : `正确答案是 ${correctSorted.join(',')}`,
      };
    } catch {
      const isCorrect = userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
      return {
        isCorrect,
        score: isCorrect ? 100 : 0,
        feedback: isCorrect ? '回答正确！' : `正确答案是 ${correctAnswer}`,
      };
    }
  }

  if (type === 'fill_blank') {
    // 填空：比对（忽略首尾空格和大小写）
    try {
      const answers = JSON.parse(correctAnswer);
      if (Array.isArray(answers)) {
        const userParts = userAnswer.split(',').map((s: string) => s.trim());
        let correctCount = 0;
        for (let i = 0; i < answers.length; i++) {
          if (userParts[i]?.toLowerCase() === answers[i]?.toString().toLowerCase()) {
            correctCount++;
          }
        }
        const ratio = correctCount / answers.length;
        return {
          isCorrect: ratio >= 0.8,
          score: Math.round(ratio * 100),
          feedback: ratio >= 0.8 ? '回答正确！' : `正确答案是 ${answers.join(', ')}`,
        };
      }
    } catch { /* continue */ }
    const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? '回答正确！' : `正确答案是 ${correctAnswer}`,
    };
  }

  // 默认
  return { isCorrect: false, score: 0, feedback: '未知题型' };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    const { sessionId } = await params;
    const body = BodySchema.parse(await req.json());

    // 获取测试会话
    const session = await prisma.testSession.findFirst({
      where: { id: sessionId, userId: auth.sub },
      include: {
        questions: {
          include: { question: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: '测试会话不存在' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: '该测试已经完成' }, { status: 400 });
    }

    // 获取 API Key（用于主观题批改）
    const provider = body.provider || DEFAULT_PROVIDER;
    const userApiKey = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: auth.sub, provider } },
    });
    const user = await prisma.user.findUnique({ where: { id: auth.sub } });
    const apiKey =
      userApiKey?.apiKey ||
      (provider === 'deepseek' ? user?.deepseekApiKey : null) ||
      (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : null);
    const baseUrl = userApiKey?.baseUrl || undefined;

    const details: any[] = [];
    let totalScore = 0;
    let correctCount = 0;
    const totalQuestions = session.questions.length;

    // 记录开始时间
    const startTime = Date.now();

    // 遍历答案
    for (const ans of body.answers) {
      const sq = session.questions.find((q) => q.questionId === ans.questionId);
      if (!sq) continue;

      const question = sq.question;
      let result: { isCorrect: boolean; score: number; feedback: string };

      if (isSubjectiveType(question.type)) {
        // 主观题：调用 LLM 批改
        if (!apiKey) {
          result = { isCorrect: false, score: 0, feedback: '未配置 API Key，无法批改主观题' };
        } else {
          try {
            const prompt = GRADE_SUBJECTIVE_PROMPT
              .replace('{question}', question.title + '\n' + JSON.stringify(question.content))
              .replace('{standardAnswer}', question.answer)
              .replace('{userAnswer}', ans.answer);

            const rawResponse = await chatCompletion(provider, apiKey, prompt, '', {
              temperature: 0.1,
              maxTokens: 1024,
              baseUrl,
            });

            // 解析批改结果
            let gradeResult: any;
            try {
              gradeResult = JSON.parse(rawResponse);
            } catch {
              const match = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
              if (match) {
                gradeResult = JSON.parse(match[1]);
              } else {
                const start = rawResponse.indexOf('{');
                if (start !== -1) {
                  let depth = 0;
                  let end = -1;
                  for (let i = start; i < rawResponse.length; i++) {
                    if (rawResponse[i] === '{') depth++;
                    else if (rawResponse[i] === '}') depth--;
                    if (depth === 0) { end = i; break; }
                  }
                  if (end > start) gradeResult = JSON.parse(rawResponse.slice(start, end + 1));
                }
              }
            }

            result = {
              isCorrect: gradeResult?.isCorrect ?? (gradeResult?.score >= 60),
              score: gradeResult?.score ?? 0,
              feedback: gradeResult?.feedback || '批改完成',
            };
          } catch (e) {
            result = { isCorrect: false, score: 0, feedback: 'AI 批改失败，请稍后重试' };
          }
        }
      } else {
        // 客观题：直接判分
        result = gradeObjective(question, ans.answer);
      }

      if (result.isCorrect) correctCount++;
      totalScore += result.score;

      // 保存 UserAnswer
      const userAnswer = await prisma.userAnswer.create({
        data: {
          userId: auth.sub,
          questionId: ans.questionId,
          answer: ans.answer,
          isCorrect: result.isCorrect,
          score: result.score,
          feedback: result.feedback,
          timeSpent: ans.timeSpent || null,
        },
      });

      // 更新 TestSessionQuestion
      await prisma.testSessionQuestion.update({
        where: { id: sq.id },
        data: {
          userAnswerId: userAnswer.id,
          isCorrect: result.isCorrect,
        },
      });

      details.push({
        questionId: ans.questionId,
        isCorrect: result.isCorrect,
        score: result.score,
        feedback: result.feedback,
      });
    }

    // 计算总用时
    const duration = Math.round((Date.now() - startTime) / 1000);
    // 累加用户在每题上花费的时间
    const totalTimeSpent = body.answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
    const finalDuration = totalTimeSpent > 0 ? totalTimeSpent : duration;

    // 计算总分（平均分）
    const avgScore = totalQuestions > 0 ? Math.round(totalScore / totalQuestions) : 0;

    // 更新 TestSession
    await prisma.testSession.update({
      where: { id: sessionId },
      data: {
        score: avgScore,
        correctCount,
        status: 'completed',
        completedAt: new Date(),
        duration: finalDuration,
      },
    });

    return NextResponse.json({
      score: avgScore,
      correctCount,
      totalQuestions,
      details,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
