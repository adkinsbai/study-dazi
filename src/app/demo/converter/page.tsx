'use client';

import { useState, useCallback, useRef } from 'react';

type FileFormat = 'pdf' | 'docx' | 'pptx' | 'html' | 'unknown';

function detectFormat(name: string): FileFormat {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'html' || ext === 'htm') return 'html';
  return 'unknown';
}

/** PDF → Markdown (pdfjs-dist) */
async function convertPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  // 使用 unpkg CDN 加载 worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        lines.push('\n');
      }
      lines.push(item.str);
      lastY = y;
    }

    const pageText = lines.join('').replace(/\n{3,}/g, '\n\n').trim();
    if (pageText) {
      parts.push(`## 第 ${i} 页\n\n${pageText}`);
    }
  }

  return parts.join('\n\n---\n\n') || '(未提取到文本内容)';
}

/** DOCX → Markdown (mammoth) */
async function convertDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  // HTML → Markdown
  const turndown = (await import('turndown')).default;
  const td = new turndown({ headingStyle: 'atx' });
  return td.turndown(result.value) || '(未提取到文本内容)';
}

/** PPTX → Markdown (jszip + xml 解析) */
async function convertPptx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slideFiles = Object.keys(zip.files)
    .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort();

  const parts: string[] = [];
  let slideNum = 0;

  for (const path of slideFiles) {
    slideNum++;
    const xml = await zip.files[path].async('string');
    const texts = extractTextFromXml(xml);
    if (texts.length > 0) {
      parts.push(`## 幻灯片 ${slideNum}\n\n${texts.join('\n\n')}`);
    }
  }

  return parts.join('\n\n---\n\n') || '(未提取到文本内容)';
}

/** 从 PPTX XML 中提取文本 */
function extractTextFromXml(xml: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const texts: string[] = [];

  // PPTX 文本在 <a:t> 标签中
  const tNodes = doc.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/drawingml/2006/main',
    't'
  );

  // 按段落分组
  const paragraphs = doc.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p'
  );

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const tElements = p.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main',
      't'
    );
    const lineParts: string[] = [];
    for (let j = 0; j < tElements.length; j++) {
      const text = tElements[j].textContent?.trim();
      if (text) lineParts.push(text);
    }
    if (lineParts.length > 0) {
      texts.push(lineParts.join(''));
    }
  }

  // 兜底：如果段落解析没结果，直接取所有 <a:t>
  if (texts.length === 0 && tNodes.length > 0) {
    for (let i = 0; i < tNodes.length; i++) {
      const text = tNodes[i].textContent?.trim();
      if (text) texts.push(text);
    }
  }

  return texts;
}

/** HTML → Markdown (turndown) */
async function convertHtml(file: File): Promise<string> {
  const turndown = (await import('turndown')).default;
  const td = new turndown({ headingStyle: 'atx' });
  const html = await file.text();
  return td.turndown(html) || '(未提取到文本内容)';
}

export default function ConverterDemo() {
  const [markdown, setMarkdown] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const format = detectFormat(file.name);
    if (format === 'unknown') {
      setError(`不支持的文件格式: ${file.name}`);
      return;
    }

    setFileName(file.name);
    setLoading(true);
    setError('');
    setMarkdown('');

    try {
      let result = '';
      switch (format) {
        case 'pdf':
          result = await convertPdf(file);
          break;
        case 'docx':
          result = await convertDocx(file);
          break;
        case 'pptx':
          result = await convertPptx(file);
          break;
        case 'html':
          result = await convertHtml(file);
          break;
      }
      setMarkdown(result);
    } catch (err) {
      setError(`转换失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">文件转 Markdown 测试</h1>
        <p className="text-gray-500">支持 PDF、DOCX、PPTX、HTML，转换在浏览器本地完成</p>

        {/* 拖拽区域 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,.html,.htm"
            onChange={handleChange}
            className="hidden"
          />
          <div className="text-4xl mb-3">📄</div>
          <p className="text-gray-600 font-medium">拖拽文件到这里，或点击选择</p>
          <p className="text-gray-400 text-sm mt-1">PDF / DOCX / PPTX / HTML</p>
        </div>

        {/* 状态 */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
            ⏳ 正在转换 {fileName}...
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* 结果 */}
        {markdown && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">转换结果：{fileName}</h2>
              <span className="text-sm text-gray-400">{markdown.length} 字符</span>
            </div>

            {/* 原始 Markdown */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Markdown 源码</h3>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words max-h-96 overflow-auto bg-gray-50 rounded p-3">
                {markdown}
              </pre>
            </div>

            {/* 渲染预览 */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">渲染预览</h3>
              <div
                className="prose prose-sm max-w-none max-h-96 overflow-auto"
                dangerouslySetInnerHTML={{
                  __html: simpleMarkdownToHtml(markdown),
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 简单的 Markdown → HTML（避免引入整个 markdown 解析库） */
function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
