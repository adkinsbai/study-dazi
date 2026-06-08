export function extractJSON(raw: string): object {
  try { return JSON.parse(raw); } catch { /* continue */ }

  const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) {
    try { return JSON.parse(match[1]); } catch { /* continue */ }
  }

  const start = raw.indexOf('{');
  if (start !== -1) {
    // 用括号计数找到匹配的 }，感知字符串字面量避免误判
    let depth = 0;
    let end = -1;
    let inString = false;
    let escape = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth === 0) { end = i; break; }
    }
    if (end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* continue */ }
    }
  }

  // 兜底：尝试提取裸数组 [{...}, ...]
  const arrStart = raw.indexOf('[');
  if (arrStart !== -1) {
    let depth = 0;
    let arrEnd = -1;
    let inString = false;
    let escape = false;
    for (let i = arrStart; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      if (depth === 0) { arrEnd = i; break; }
    }
    if (arrEnd > arrStart) {
      try { return JSON.parse(raw.slice(arrStart, arrEnd + 1)); } catch { /* continue */ }
    }
  }

  throw new Error('AI 返回了无法解析的内容，请重试');
}

/** 检测文本是否包含被截断的 JSON（括号不匹配） */
export function isTruncatedJSON(text: string): boolean {
  // 找到第一个 { 或 [
  const start = text.search(/[\[{]/);
  if (start === -1) return false;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
  }
  return depth > 0;
}
