/**
 * 资源爬虫模块 — 统一接口
 * 支持 YouTube / B站 平台资源搜索
 */

export interface CrawledResource {
  platform: 'youtube' | 'bilibili';
  externalId: string;
  title: string;
  url: string;
  instructor: string;
  thumbnail: string;
  duration: number | null; // 秒
  language: 'zh' | 'en';
  viewCount: number;
  tags: string[];
  isFree: true;
}

export async function searchYouTube(
  query: string,
  maxResults = 10,
): Promise<CrawledResource[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[Crawler] YOUTUBE_API_KEY not configured, skipping YouTube search');
    return [];
  }

  try {
    // Step 1: 搜索视频
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('relevanceLanguage', 'zh');
    searchUrl.searchParams.set('videoDuration', 'long'); // > 20 分钟的长视频（课程）

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      const err = await searchRes.text();
      console.error('[Crawler] YouTube search error:', err);
      return [];
    }

    const searchData = await searchRes.json();
    const videoIds = (searchData.items || [])
      .map((item: { id: { videoId: string } }) => item.id.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) return [];

    // Step 2: 获取视频详情（时长、播放量）
    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.searchParams.set('part', 'snippet,statistics,contentDetails');
    detailsUrl.searchParams.set('id', videoIds.join(','));
    detailsUrl.searchParams.set('key', apiKey);

    const detailsRes = await fetch(detailsUrl.toString());
    if (!detailsRes.ok) return [];

    const detailsData = await detailsRes.json();

    return (detailsData.items || []).map((item: {
      id: string;
      snippet: {
        title: string;
        channelTitle: string;
        thumbnails: { high?: { url: string } };
        tags?: string[];
      };
      statistics: { viewCount?: string };
      contentDetails: { duration?: string };
    }) => ({
      platform: 'youtube' as const,
      externalId: item.id,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      instructor: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.high?.url || '',
      duration: parseISODuration(item.contentDetails.duration || ''),
      language: detectLanguage(item.snippet.title),
      viewCount: parseInt(item.statistics.viewCount || '0'),
      tags: item.snippet.tags || [],
      isFree: true as const,
    }));
  } catch (err) {
    console.error('[Crawler] YouTube error:', err);
    return [];
  }
}

export async function searchBilibili(
  query: string,
  maxResults = 10,
): Promise<CrawledResource[]> {
  try {
    // B站搜索 API（公开，不需要 key）
    const searchUrl = new URL('https://api.bilibili.com/x/web-interface/search/type');
    searchUrl.searchParams.set('search_type', 'video');
    searchUrl.searchParams.set('keyword', query);
    searchUrl.searchParams.set('page', '1');
    searchUrl.searchParams.set('pagesize', String(maxResults));
    searchUrl.searchParams.set('order', 'click'); // 按播放量排序

    const res = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
      },
    });

    if (!res.ok) {
      console.error('[Crawler] Bilibili search error:', res.status);
      return [];
    }

    const data = await res.json();
    const results = data?.data?.result || [];

    return results.map((item: {
      bvid: string;
      title: string;
      author: string;
      pic: string;
      duration: string; // "HH:MM:SS" or "MM:SS"
      play: number;
      tag?: string;
    }) => ({
      platform: 'bilibili' as const,
      externalId: item.bvid,
      title: stripHtmlTags(item.title),
      url: `https://www.bilibili.com/video/${item.bvid}`,
      instructor: item.author,
      thumbnail: item.pic?.startsWith('//') ? `https:${item.pic}` : item.pic,
      duration: parseBilibiliDuration(item.duration),
      language: 'zh' as const,
      viewCount: item.play || 0,
      tags: item.tag ? item.tag.split(',').map(t => t.trim()) : [],
      isFree: true as const,
    }));
  } catch (err) {
    console.error('[Crawler] Bilibili error:', err);
    return [];
  }
}

// ── helpers ──────────────────────────────────────────────

/** 解析 ISO 8601 时长 (PT1H2M3S → 秒) */
function parseISODuration(iso: string): number | null {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  return h * 3600 + m * 60 + s;
}

/** 解析 B站时长 (HH:MM:SS 或 MM:SS → 秒) */
function parseBilibiliDuration(dur: string): number | null {
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** 去除 HTML 标签 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** 简单语言检测 */
function detectLanguage(text: string): 'zh' | 'en' {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  return chineseChars && chineseChars.length > text.length * 0.2 ? 'zh' : 'en';
}
