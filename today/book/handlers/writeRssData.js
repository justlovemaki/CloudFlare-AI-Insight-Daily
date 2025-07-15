import { replaceImageProxy, formatMarkdownText, formatDateToGMT12WithTime } from '../helpers.js';
import { getDailyReportContent } from '../github.js';
import { storeInKV } from '../kv.js';
import { marked } from '../marked.esm.js';

export async function handleWriteRssData(request, env) {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date');

    if (!dateStr) {
        return new Response('Missing date parameter', { status: 400 });
    }

    try {
        const path = `daily/${dateStr}.md`;
        const content = await getDailyReportContent(env, path);
        if (!content) {
            return new Response(`No content found for ${path}`, { status: 404 });
        }

        // 从 "YYYY-MM-DD" 格式的 dateStr 中提取 "YYYY-MM"
        const yearMonth = dateStr.substring(0, 7);
        const report = {
            report_date: dateStr,
            title: dateStr+'日刊',
            link:  '/'+yearMonth+'/'+dateStr+'/',
            content_html: null,
            // 可以添加其他相關欄位，例如作者、來源等
            published_date: formatDateToGMT12WithTime(new Date()) // 記錄保存時間
        }
        report.content_html = marked.parse(formatMarkdownText(replaceImageProxy(env.IMG_PROXY, content)));
        storeInKV(env.DATA_KV, `${dateStr}-report`, report);

        return new Response(JSON.stringify(report), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error) {
        console.error('Error handling daily report:', error.message);
        return new Response(`Error handling daily report: ${error.message}`, { status: 500 });
    }
}