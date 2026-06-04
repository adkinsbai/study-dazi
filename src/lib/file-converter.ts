/**
 * 客户端文件转 Markdown 工具
 * 所有转换在浏览器本地完成，不上传原文件
 */

export type SupportedFormat = 'pdf' | 'docx' | 'pptx' | 'html';

export function detectFormat(name: string): SupportedFormat | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'html' || ext === 'htm') return 'html';
  return null;
}

/** PDF → Markdown */
async function convertPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
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
      parts.push(pageText);
    }
  }

  return parts.join('\n\n') || '';
}

/** DOCX → Markdown */
async function convertDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const TurndownService = (await import('turndown')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const td = new TurndownService({ headingStyle: 'atx' });
  return td.turndown(result.value) || '';
}

/** PPTX → Markdown */
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
    const texts = extractTextFromPptxXml(xml);
    if (texts.length > 0) {
      parts.push(`[幻灯片 ${slideNum}] ${texts.join(' / ')}`);
    }
  }

  return parts.join('\n') || '';
}

function extractTextFromPptxXml(xml: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const texts: string[] = [];

  const paragraphs = doc.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/drawingml/2006/main', 'p'
  );

  for (let i = 0; i < paragraphs.length; i++) {
    const tElements = paragraphs[i].getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main', 't'
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

  if (texts.length === 0) {
    const tNodes = doc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main', 't'
    );
    for (let i = 0; i < tNodes.length; i++) {
      const text = tNodes[i].textContent?.trim();
      if (text) texts.push(text);
    }
  }

  return texts;
}

/** HTML → Markdown */
async function convertHtml(file: File): Promise<string> {
  const TurndownService = (await import('turndown')).default;
  const td = new TurndownService({ headingStyle: 'atx' });
  const html = await file.text();
  return td.turndown(html) || '';
}

/** 统一入口：将文件转为 Markdown */
export async function convertFileToMarkdown(file: File): Promise<{ name: string; markdown: string }> {
  const format = detectFormat(file.name);
  if (!format) {
    throw new Error(`不支持的文件格式: ${file.name}`);
  }

  let markdown = '';
  switch (format) {
    case 'pdf':
      markdown = await convertPdf(file);
      break;
    case 'docx':
      markdown = await convertDocx(file);
      break;
    case 'pptx':
      markdown = await convertPptx(file);
      break;
    case 'html':
      markdown = await convertHtml(file);
      break;
  }

  return { name: file.name, markdown };
}
