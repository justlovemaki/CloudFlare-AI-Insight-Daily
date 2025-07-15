// src/dataSources/huggingface-papers.js
import { getRandomUserAgent, sleep, isDateWithinLastDays, stripHtml, removeMarkdownCodeBlock, formatDateToChineseWithTime, escapeHtml} from '../helpers.js';
import { callChatAPI } from '../chatapi.js';

const PapersDataSource = {
    fetch: async (env, foloCookie) => {
        const feedId = env.HGPAPERS_FEED_ID;
        const fetchPages = parseInt(env.HGPAPERS_FETCH_PAGES || '3', 10);
        const allPapersItems = [];
        const filterDays = parseInt(env.FOLO_FILTER_DAYS || '3', 10);

        if (!feedId) {
            console.error('HGPAPERS_FEED_ID is not set in environment variables.');
            return {
                version: "https://jsonfeed.org/version/1.1",
                title: "Huggingface Daily Papers Feeds",
                home_page_url: "https://huggingface.co/papers",
                description: "Aggregated Huggingface Daily Papers feeds",
                language: "zh-cn",
                items: []
            };
        }

        let publishedAfter = null;
        for (let i = 0; i < fetchPages; i++) {
            const userAgent = getRandomUserAgent();
            const headers = {
                'User-Agent': userAgent,
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'accept-language': 'zh-CN,zh;q=0.9',
                'baggage': 'sentry-environment=stable,sentry-release=5251fa921ef6cbb6df0ac4271c41c2b4a0ce7c50,sentry-public_key=e5bccf7428aa4e881ed5cb713fdff181,sentry-trace_id=2da50ca5ad944cb794670097d876ada8,sentry-sampled=true,sentry-sample_rand=0.06211835167903246,sentry-sample_rate=1',
                'origin': 'https://app.follow.is',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'x-app-name': 'Folo Web',
                'x-app-version': '0.4.9',
            };

            // 直接使用传入的 foloCookie
            if (foloCookie) {
                headers['Cookie'] = foloCookie;
            }

            const body = {
                feedId: feedId,
                view: 1,
                withContent: true,
            };

            if (publishedAfter) {
                body.publishedAfter = publishedAfter;
            }

            try {
                console.log(`Fetching Huggingface Papers data, page ${i + 1}...`);
                const response = await fetch(env.FOLO_DATA_API, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    console.error(`Failed to fetch Huggingface Papers data, page ${i + 1}: ${response.statusText}`);
                    break;
                }
                const data = await response.json();
                if (data && data.data && data.data.length > 0) {
                    const filteredItems = data.data.filter(entry => isDateWithinLastDays(entry.entries.publishedAt, filterDays));
                    allPapersItems.push(...filteredItems.map(entry => ({
                        id: entry.entries.id,
                        url: entry.entries.url,
                        title: entry.entries.title,
                        content_html: entry.entries.content,
                        date_published: entry.entries.publishedAt,
                        authors: [{ name: entry.entries.author }],
                        source: `huggingface-papers`,
                    })));
                    publishedAfter = data.data[data.data.length - 1].entries.publishedAt;
                } else {
                    console.log(`No more data for Huggingface Papers, page ${i + 1}.`);
                    break;
                }
            } catch (error) {
                console.error(`Error fetching Huggingface Papers data, page ${i + 1}:`, error);
                break;
            }

            // Random wait time between 0 and 5 seconds to avoid rate limiting
            await sleep(Math.random() * 5000);
        }

        const papersData = {
            version: "https://jsonfeed.org/version/1.1",
            title: "Huggingface Daily Papers Feeds",
            home_page_url: "https://huggingface.co/papers",
            description: "Aggregated Huggingface Daily Papers feeds",
            language: "zh-cn",
            items: allPapersItems
        };

        if (papersData.items.length === 0) {
            console.log("No hgpapers found for today or after filtering.");
            return papersData;
        }

        if (!env.OPEN_TRANSLATE === "true") {
            console.warn("Skipping hgpapers translations.");
            papersData.items = papersData.items.map(item => ({
                ...item,
                title_zh: item.title || "",
                content_html_zh: item.content_html || ""
            }));
            return papersData;
        }

        const itemsToTranslate = papersData.items.map((item, index) => ({
            id: index,
            original_title: item.title || ""
        }));

        const hasContentToTranslate = itemsToTranslate.some(item => item.original_title.trim() !== "");
        if (!hasContentToTranslate) {
            console.log("No non-empty hgpapers titles to translate for today's papers.");
            papersData.items = papersData.items.map(item => ({ ...item, title_zh: item.title || "", content_html_zh: item.content_html || "" }));
            return papersData;
        }

        const promptText = `You will be given a JSON array of paper data objects. Each object has an "id" and "original_title".
Translate "original_title" into Chinese.
Return a JSON array of objects. Each output object MUST have:
- "id": The same id from the input.
- "title_zh": Chinese translation of "original_title". Empty if original is empty.
Input: ${JSON.stringify(itemsToTranslate)}
Respond ONLY with the JSON array.`;

        let translatedItemsMap = new Map();
        try {
            console.log(`Requesting translation for ${itemsToTranslate.length} hgpapers titles for today.`);
            const chatResponse = await callChatAPI(env, promptText);
            const parsedTranslations = JSON.parse(removeMarkdownCodeBlock(chatResponse)); // Assuming direct JSON array response

            if (parsedTranslations) {
                parsedTranslations.forEach(translatedItem => {
                    if (translatedItem && typeof translatedItem.id === 'number' &&
                        typeof translatedItem.title_zh === 'string') {
                        translatedItemsMap.set(translatedItem.id, translatedItem);
                    }
                });
            }
        } catch (translationError) {
            console.error("Failed to translate hgpapers titles in batch:", translationError.message);
        }

        papersData.items = papersData.items.map((originalItem, index) => {
            const translatedData = translatedItemsMap.get(index);
            return {
                ...originalItem,
                title_zh: translatedData ? translatedData.title_zh : (originalItem.title || "")
            };
        });

        return papersData;
    },
    transform: (papersData,sourceType) => {
        const unifiedPapers = [];
        if (papersData && Array.isArray(papersData.items)) {
            papersData.items.forEach((item, index) => {
                unifiedPapers.push({
                    id: item.id, // Use item.id from Folo data
                    type: sourceType,
                    url: item.url,
                    title: item.title_zh || item.title,
                    description: stripHtml(item.content_html || ""),
                    published_date: item.date_published,
                    authors: typeof item.authors === 'string' ? item.authors.split(',').map(s => s.trim()) : (item.authors ? item.authors.map(a => a.name) : []),
                    source: item.source || "Huggingface Papers", // Use existing source or default
                    details: {
                        content_html: item.content_html || ""
                    }
                });
            });
        }
        return unifiedPapers;
    },

    generateHtml: (item) => {
        return `
            <strong>${escapeHtml(item.title)}</strong><br>
            <small>来源: ${escapeHtml(item.source || '未知')} | 发布日期: ${formatDateToChineseWithTime(item.published_date)}</small>
            <div class="content-html">
                 ${item.details.content_html || '无内容。'}<hr>
            </div>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">在 ArXiv/来源 阅读</a>
        `;
    }
};

export default PapersDataSource;
