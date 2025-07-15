import { stripHtml, getShanghaiTime, formatRssDate } from '../helpers.js';
import { getFromKV } from '../kv.js';

function minifyHTML(htmlString) {
  if (typeof htmlString !== 'string') {
    return '';
  }

  return htmlString
    .replace(/>\s+</g, '><') // 移除标签之间的空白
    .trim();                 // 移除字符串两端的空白
}

/**
 * 處理 Supabase RSS 請求
 * @param {Request} request - 傳入的請求物件
 * @param {object} env - Cloudflare Workers 環境變數
 * @returns {Response} RSS Feed 的回應
 */
export async function handleRss(request, env) {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days')) || 7; // 預設查詢 7 天內的資料

  const allData = [];
  const today = getShanghaiTime(); // 加上東八時區的偏移量

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${dateStr}-report`;
    const data = await getFromKV(env.DATA_KV, key);
    if (data) {
      allData.push(data);
    }
  }

  // 扁平化數據，因為每個 report 可能包含多個項目
  const data = allData.flat();

  if (!data || data.length === 0) {
    return new Response('沒有找到相關資料', { status: 200 });
  }

  // 建立 RSS Feed
  let rssItems = '';
  if (data && data.length > 0) {
    const filteredData = {};
    data.forEach(item => {
      const reportDate = item.report_date;
      const publishedDate = new Date(item.published_date);

      if (!filteredData[reportDate] || publishedDate > new Date(filteredData[reportDate].published_date)) {
        filteredData[reportDate] = item;
      }
    });
    const finalData = Object.values(filteredData);

    finalData.forEach(item => {
      const pubDate = formatRssDate(new Date(item.published_date));
      const content = minifyHTML(item.content_html);
      const title = item.title || '无标题';
      const link = env.BOOK_LINK+item.link || '#';
      const description = stripHtml(item.content_html).substring(0, 200); // 移除 HTML 標籤並截取 200 字元

      rssItems += `
        <item>
          <title><![CDATA[${title}]]></title>
          <link>${link}</link>
          <guid>${item.id || link}</guid>
          <pubDate>${pubDate}</pubDate>
          <content:encoded><![CDATA[${content}]]></content:encoded>
          <description><![CDATA[${description}]]></description>
        </item>
      `;
    });
  }

  const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI洞察日报 RSS Feed</title>
    <link>${env.BOOK_LINK}</link>
    <description> 近 ${days} 天的AI日报</description>
    <language>zh-cn</language>
    <lastBuildDate>${formatRssDate()}</lastBuildDate>
    <atom:link href="${url.origin}/rss" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rssFeed, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600' // 快取一小時
    }
  });
}
