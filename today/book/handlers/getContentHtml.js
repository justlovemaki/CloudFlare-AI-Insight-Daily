// src/handlers/getContentHtml.js
import { getISODate, escapeHtml, setFetchDate } from '../helpers.js';
import { getFromKV } from '../kv.js';
import { generateContentSelectionPageHtml } from '../htmlGenerators.js';

export async function handleGetContentHtml(request, env, dataCategories) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const dateStr = dateParam ? dateParam : getISODate();
    setFetchDate(dateStr);
    console.log(`Getting HTML content for date: ${dateStr}`);

    try {
        const allData = {};
        // Dynamically fetch data for each category based on dataCategories
        for (const category of dataCategories) {
            allData[category.id] = await getFromKV(env.DATA_KV, `${dateStr}-${category.id}`) || [];
        }
        
        const html = generateContentSelectionPageHtml(env, dateStr, allData, dataCategories);

        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    } catch (error) {
        console.error("Error in /getContentHtml:", error);
        // Ensure escapeHtml is used for error messages displayed in HTML
        return new Response(`<h1>Error generating HTML content</h1><p>${escapeHtml(error.message)}</p><pre>${escapeHtml(error.stack)}</pre>`, {
            status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
}
