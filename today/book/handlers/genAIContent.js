// src/handlers/genAIContent.js
import { getISODate, escapeHtml, stripHtml, removeMarkdownCodeBlock, formatDateToChinese, convertEnglishQuotesToChinese} from '../helpers.js';
import { getFromKV } from '../kv.js';
import { callChatAPIStream } from '../chatapi.js';
import { generateGenAiPageHtml } from '../htmlGenerators.js';
import { dataSources } from '../dataFetchers.js'; // Import dataSources
import { getSystemPromptSummarizationStepOne } from "../prompt/summarizationPromptStepOne";
import { getSystemPromptSummarizationStepTwo } from "../prompt/summarizationPromptStepTwo";
import { getSystemPromptSummarizationStepThree } from "../prompt/summarizationPromptStepThree";
import { getSystemPromptPodcastFormatting, getSystemPromptShortPodcastFormatting } from '../prompt/podcastFormattingPrompt.js';
import { getSystemPromptDailyAnalysis } from '../prompt/dailyAnalysisPrompt.js'; // Import new prompt
import { insertFoot } from '../foot.js';

export async function handleGenAIPodcastScript(request, env) {
    let dateStr;
    let selectedItemsParams = [];
    let formData;
    let outputOfCall1 = null; // This will be the summarized content from Call 1

    let userPromptPodcastFormattingData = null;
    let fullPromptForCall3_System = null;
    let fullPromptForCall3_User = null;
    let finalAiResponse = null;

    try {
        formData = await request.formData();
        dateStr = formData.get('date');
        selectedItemsParams = formData.getAll('selectedItems');
        outputOfCall1 = formData.get('summarizedContent'); // Get summarized content from form data

        if (!outputOfCall1) {
            const errorHtml = generateGenAiPageHtml(env, '生成AI播客脚本出错', '<p><strong>Summarized content is missing.</strong> Please go back and generate AI content first.</p>', dateStr, true, null, null, null, null, null, null, outputOfCall1, null);
            return new Response(errorHtml, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }


        fullPromptForCall3_System = getSystemPromptPodcastFormatting(env);
        userPromptPodcastFormattingData = outputOfCall1;
        fullPromptForCall3_User = userPromptPodcastFormattingData;

        console.log("Call 3 to Chat (Podcast Formatting): User prompt length:", userPromptPodcastFormattingData.length);
        try {
            let podcastChunks = [];
            for await (const chunk of callChatAPIStream(env, userPromptPodcastFormattingData, fullPromptForCall3_System)) {
                podcastChunks.push(chunk);
            }
            finalAiResponse = podcastChunks.join('');
            if (!finalAiResponse || finalAiResponse.trim() === "") throw new Error("Chat podcast formatting call returned empty content.");
            finalAiResponse = removeMarkdownCodeBlock(finalAiResponse); // Clean the output
            console.log("Call 3 (Podcast Formatting) successful. Final output length:", finalAiResponse.length);
        } catch (error) {
            console.error("Error in Chat API Call 3 (Podcast Formatting):", error);
            const errorHtml = generateGenAiPageHtml(env, '生成AI播客脚本出错(播客文案)', `<p><strong>Failed during podcast formatting:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, dateStr, true, selectedItemsParams, null, null, fullPromptForCall3_System, fullPromptForCall3_User, null, outputOfCall1, null);
            return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        let finalAiResponseOut =  `## Full: Podcast Formatting ` + `\n\n` + finalAiResponse;
        let promptsMarkdownContent = `# Prompts for ${dateStr}\n\n`;
        promptsMarkdownContent += `## Call 3: Podcast Formatting\n\n`;
        if (fullPromptForCall3_System) promptsMarkdownContent += `### System One Instruction\n\`\`\`\n${fullPromptForCall3_System}\n\`\`\`\n\n`;
        

        let fullPromptForCall4_System = getSystemPromptShortPodcastFormatting(env);
        console.log("Call 4 to Chat (Podcast Formatting): User prompt length:", userPromptPodcastFormattingData.length);
        try {
            let podcastChunks = [];
            for await (const chunk of callChatAPIStream(env, userPromptPodcastFormattingData, fullPromptForCall4_System)) {
                podcastChunks.push(chunk);
            }
            finalAiResponse = podcastChunks.join('');
            if (!finalAiResponse || finalAiResponse.trim() === "") throw new Error("Chat podcast formatting call returned empty content.");
            finalAiResponse = removeMarkdownCodeBlock(finalAiResponse); // Clean the output
            console.log("Call 4 (Podcast Formatting) successful. Final output length:", finalAiResponse.length);
        } catch (error) {
            console.error("Error in Chat API Call 4 (Podcast Formatting):", error);
            const errorHtml = generateGenAiPageHtml(env, '生成AI播客脚本出错(播客文案)', `<p><strong>Failed during podcast formatting:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, dateStr, true, selectedItemsParams, null, null, fullPromptForCall3_System, fullPromptForCall3_User, null, outputOfCall1, null);
            return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        finalAiResponseOut += `\n\n` + `## Short: Podcast Formatting ` + `\n\n` + finalAiResponse;
        let fullPromptForCallSystem =  fullPromptForCall3_System + `\n\n` + fullPromptForCall4_System;

        promptsMarkdownContent += `## Call 4: Podcast Formatting\n\n`;
        if (fullPromptForCall4_System) promptsMarkdownContent += `### System Two Instruction\n\`\`\`\n${fullPromptForCall4_System}\n\`\`\`\n\n`;
        if (fullPromptForCall3_User) promptsMarkdownContent += `### User Input (Output of Call 1)\n\`\`\`\n${fullPromptForCall3_User}\n\`\`\`\n\n`;

        let podcastScriptMarkdownContent = `# ${env.PODCAST_TITLE} ${formatDateToChinese(dateStr)}\n\n${removeMarkdownCodeBlock(finalAiResponseOut)}`;

        const successHtml = generateGenAiPageHtml(
            env, 
            'AI播客脚本',
            escapeHtml(finalAiResponseOut), 
            dateStr, false, selectedItemsParams,
            null, null, // No Call 1 prompts for this page
            fullPromptForCallSystem, fullPromptForCall3_User,
            convertEnglishQuotesToChinese(removeMarkdownCodeBlock(promptsMarkdownContent)), 
            outputOfCall1, // No daily summary for this page
            convertEnglishQuotesToChinese(podcastScriptMarkdownContent)
        );
        return new Response(successHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    } catch (error) {
        console.error("Error in /genAIPodcastScript (outer try-catch):", error);
        const pageDateForError = dateStr || getISODate(); 
        const itemsForActionOnError = Array.isArray(selectedItemsParams) ? selectedItemsParams : [];
        const errorHtml = generateGenAiPageHtml(env, '生成AI播客脚本出错', `<p><strong>Unexpected error:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, pageDateForError, true, itemsForActionOnError, null, null, fullPromptForCall3_System, fullPromptForCall3_User);
        return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}

export async function handleGenAIContent(request, env) {
    let dateStr;
    let selectedItemsParams = [];
    let formData;

    let userPromptSummarizationData = null;
    let fullPromptForCall1_System = null;
    let fullPromptForCall1_User = null;
    let outputOfCall1 = null;

    try {
        formData = await request.formData();
        const dateParam = formData.get('date');
        dateStr = dateParam ? dateParam : getISODate();
        selectedItemsParams = formData.getAll('selectedItems');

        if (selectedItemsParams.length === 0) {
            const errorHtml = generateGenAiPageHtml(env, '生成AI日报出错，未选生成条目', '<p><strong>No items were selected.</strong> Please go back and select at least one item.</p>', dateStr, true, null);
            return new Response(errorHtml, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        
        console.log(`Generating AI content for ${selectedItemsParams.length} selected item references from date ${dateStr}`);

        const allFetchedData = {};
        const fetchPromises = [];
        for (const sourceType in dataSources) {
            if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                fetchPromises.push(
                    getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`).then(data => {
                        allFetchedData[sourceType] = data || [];
                    })
                );
            }
        }
        await Promise.allSettled(fetchPromises);

        const selectedContentItems = [];
        let validItemsProcessedCount = 0;

        for (const selection of selectedItemsParams) {
            const [type, idStr] = selection.split(':');
            const itemsOfType = allFetchedData[type];
            const item = itemsOfType ? itemsOfType.find(dataItem => String(dataItem.id) === idStr) : null;

            if (item) {
                let itemText = "";
                // Dynamically generate itemText based on item.type
                // Add new data sources
                switch (item.type) {
                    case 'news':
                        itemText = `News Title: ${item.title}\nPublished: ${item.published_date}\nContent Summary: ${stripHtml(item.details.content_html)}`;
                        break;
                    case 'project':
                        itemText = `Project Name: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nDescription: ${item.description}\nStars: ${item.details.totalStars}`;
                        break;
                    case 'paper':
                        itemText = `Papers Title: ${item.title}\nPublished: ${item.published_date}\nUrl: ${item.url}\nAbstract/Content Summary: ${stripHtml(item.details.content_html)}`;
                        break;
                    case 'socialMedia':
                        itemText = `socialMedia Post by ${item.authors}：Published: ${item.published_date}\nUrl: ${item.url}\nContent: ${stripHtml(item.details.content_html)}`;
                        break;
                    default:
                        // Fallback for unknown types or if more specific details are not available
                        itemText = `Type: ${item.type}\nTitle: ${item.title || 'N/A'}\nDescription: ${item.description || 'N/A'}\nURL: ${item.url || 'N/A'}`;
                        if (item.published_date) itemText += `\nPublished: ${item.published_date}`;
                        if (item.source) itemText += `\nSource: ${item.source}`;
                        if (item.details && item.details.content_html) itemText += `\nContent: ${stripHtml(item.details.content_html)}`;
                        break;
                }
                
                if (itemText) {
                    selectedContentItems.push(itemText);
                    validItemsProcessedCount++;
                }
            } else {
                console.warn(`Could not find item for selection: ${selection} on date ${dateStr}.`);
            }
        }

        if (validItemsProcessedCount === 0) {
            const errorHtml = generateGenAiPageHtml(env, '生成AI日报出错，可生成条目为空', '<p><strong>Selected items could not be retrieved or resulted in no content.</strong> Please check the data or try different selections.</p>', dateStr, true, selectedItemsParams);
            return new Response(errorHtml, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        
        //提示词内不能有英文引号，否则会存储数据缺失。
        fullPromptForCall1_System = getSystemPromptSummarizationStepOne();
        fullPromptForCall1_User = '\n\n------\n\n'+selectedContentItems.join('\n\n------\n\n')+'\n\n------\n\n'; // Keep this for logging/error reporting if needed

        console.log("Call 1 to Chat (Summarization): User prompt length:", fullPromptForCall1_User.length);
        try {
            const chunkSize = 3;
            const summaryPromises = [];
            
            for (let i = 0; i < selectedContentItems.length; i += chunkSize) {
                const chunk = selectedContentItems.slice(i, i + chunkSize);
                const chunkPrompt = chunk.join('\n\n---\n\n'); // Join selected items with the separator
                
                summaryPromises.push((async () => {
                    let summarizedChunks = [];
                    for await (const streamChunk of callChatAPIStream(env, chunkPrompt, fullPromptForCall1_System)) {
                        summarizedChunks.push(streamChunk);
                    }
                    return summarizedChunks.join('');
                })());
            }

            const allSummarizedResults = await Promise.all(summaryPromises);
            outputOfCall1 = allSummarizedResults.join('\n\n'); // Join all summarized parts

            if (!outputOfCall1 || outputOfCall1.trim() === "") throw new Error("Chat summarization call returned empty content.");
            outputOfCall1 = removeMarkdownCodeBlock(outputOfCall1); // Clean the output
            console.log("Call 1 (Summarization) successful. Output length:", outputOfCall1.length);
        } catch (error) {
            console.error("Error in Chat API Call 1 (Summarization):", error);
            const errorHtml = generateGenAiPageHtml(env, '生成AI日报出错(分段处理)', `<p><strong>Failed during summarization:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, dateStr, true, selectedItemsParams, fullPromptForCall1_System, fullPromptForCall1_User);
            return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // Call 2: Process outputOfCall1
        let outputOfCall2 = null;
        let fullPromptForCall2_System = getSystemPromptSummarizationStepTwo(); // Re-using summarization prompt for now
        let fullPromptForCall2_User = outputOfCall1; // Input for Call 2 is output of Call 1

        console.log("Call 2 to Chat (Processing Call 1 Output): User prompt length:", fullPromptForCall2_User.length);
        try {
            let processedChunks = [];
            for await (const chunk of callChatAPIStream(env, fullPromptForCall2_User, fullPromptForCall2_System)) {
                processedChunks.push(chunk);
            }
            outputOfCall2 = processedChunks.join('');
            if (!outputOfCall2 || outputOfCall2.trim() === "") throw new Error("Chat processing call returned empty content.");
            outputOfCall2 = removeMarkdownCodeBlock(outputOfCall2); // Clean the output
            console.log("Call 2 (Processing Call 1 Output) successful. Output length:", outputOfCall2.length);
        } catch (error) {
            console.error("Error in Chat API Call 2 (Processing Call 1 Output):", error);
            const errorHtml = generateGenAiPageHtml(env, '生成AI日报出错(格式化)', `<p><strong>Failed during processing of summarized content:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, dateStr, true, selectedItemsParams, fullPromptForCall1_System, fullPromptForCall1_User, fullPromptForCall2_System, fullPromptForCall2_User);
            return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        
        let promptsMarkdownContent = `# Prompts for ${dateStr}\n\n`;
        promptsMarkdownContent += `## Call 1: Content Summarization\n\n`;
        if (fullPromptForCall1_System) promptsMarkdownContent += `### System Instruction\n\`\`\`\n${fullPromptForCall1_System}\n\`\`\`\n\n`;
        if (fullPromptForCall1_User) promptsMarkdownContent += `### User Input\n\`\`\`\n${fullPromptForCall1_User}\n\`\`\`\n\n`;
        promptsMarkdownContent += `## Call 2: Summarized Content Format\n\n`;
        if (fullPromptForCall2_System) promptsMarkdownContent += `### System Instruction\n\`\`\`\n${fullPromptForCall2_System}\n\`\`\`\n\n`;
        if (fullPromptForCall2_User) promptsMarkdownContent += `### User Input (Output of Call 1)\n\`\`\`\n${fullPromptForCall2_User}\n\`\`\`\n\n`;

        let dailySummaryMarkdownContent = `## ${env.DAILY_TITLE} ${formatDateToChinese(dateStr)}` + '\n\n';
        dailySummaryMarkdownContent += '> '+ env.DAILY_TITLE_MIN + '\n\n';
        let outputOfCall3 = null;
        console.log("Call 3 to Chat (Processing Call 2 Output): User prompt length:", outputOfCall2.length);
        try {
            let processedChunks = [];
            for await (const chunk of callChatAPIStream(env, outputOfCall2, getSystemPromptSummarizationStepThree())) {
                processedChunks.push(chunk);
            }
            outputOfCall3 = processedChunks.join('');
            if (!outputOfCall3 || outputOfCall3.trim() === "") throw new Error("Chat processing call returned empty content.");
            outputOfCall3 = removeMarkdownCodeBlock(outputOfCall3); // Clean the output
            console.log("Call 3 (Processing Call 2 Output) successful. Output length:", outputOfCall3.length);
        } catch (error) {
            console.error("Error in Chat API Call 3 (Processing Call 2 Output):", error);
            const errorHtml = generateGenAiPageHtml(env, '生成AI日报出错(摘要)', `<p><strong>Failed during processing of summarized content:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, dateStr, true, selectedItemsParams, fullPromptForCall1_System, fullPromptForCall1_User, fullPromptForCall2_System, fullPromptForCall2_User);
            return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        dailySummaryMarkdownContent += '\n\n### **AI内容摘要**\n\n```\n' + outputOfCall3 + '\n```\n\n';

        dailySummaryMarkdownContent += `\n\n${removeMarkdownCodeBlock(outputOfCall2)}`;
        if (env.INSERT_FOOT=='true') dailySummaryMarkdownContent += insertFoot() +`\n\n`;

        const successHtml = generateGenAiPageHtml(
            env, 
            'AI日报', // Title for Call 1 page
            escapeHtml(dailySummaryMarkdownContent), 
            dateStr, false, selectedItemsParams,
            fullPromptForCall1_System, fullPromptForCall1_User,
            null, null, // Pass Call 2 prompts
            convertEnglishQuotesToChinese(removeMarkdownCodeBlock(promptsMarkdownContent)), 
            convertEnglishQuotesToChinese(dailySummaryMarkdownContent), 
            null, // No podcast script for this page
            outputOfCall1 // Pass summarized content for the next step (original outputOfCall1)
        );
        return new Response(successHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    } catch (error) {
        console.error("Error in /genAIContent (outer try-catch):", error);
        const pageDateForError = dateStr || getISODate(); 
        const itemsForActionOnError = Array.isArray(selectedItemsParams) ? selectedItemsParams : [];
        const errorHtml = generateGenAiPageHtml(env, '生成AI日报出错', `<p><strong>Unexpected error:</strong> ${escapeHtml(error.message)}</p>${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`, pageDateForError, true, itemsForActionOnError, fullPromptForCall1_System, fullPromptForCall1_User, fullPromptForCall2_System, fullPromptForCall2_User);
        return new Response(errorHtml, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}

export async function handleGenAIDailyAnalysis(request, env) {
    let dateStr;
    let userPromptDailyAnalysisData = '';
    let fullPromptForDailyAnalysis_System = null;
    let finalAiResponse = null;

    try {
        const requestBody = await request.json();
        dateStr = requestBody.date || getISODate();
        const summarizedContent = requestBody.summarizedContent; // Get summarized content from request body

        if (!summarizedContent || !summarizedContent.trim()) {
            return new Response('未提供摘要内容进行分析。', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        userPromptDailyAnalysisData = summarizedContent; // Use summarized content as user prompt

        console.log(`Generating AI daily analysis for date: ${dateStr} using summarized content.`);
        fullPromptForDailyAnalysis_System = getSystemPromptDailyAnalysis();

        console.log("Call to Chat (Daily Analysis): User prompt length:", userPromptDailyAnalysisData.length);
        try {
            let analysisChunks = [];
            for await (const chunk of callChatAPIStream(env, userPromptDailyAnalysisData, fullPromptForDailyAnalysis_System)) {
                analysisChunks.push(chunk);
            }
            finalAiResponse = analysisChunks.join('');
            if (!finalAiResponse || finalAiResponse.trim() === "") throw new Error("Chat daily analysis call returned empty content.");
            finalAiResponse = removeMarkdownCodeBlock(finalAiResponse); // Clean the output
            console.log("Daily Analysis successful. Final output length:", finalAiResponse.length);
        } catch (error) {
            console.error("Error in Chat API Call (Daily Analysis):", error);
            return new Response(`AI 日报分析失败: ${escapeHtml(error.message)}`, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        return new Response(finalAiResponse, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

    } catch (error) {
        console.error("Error in /genAIDailyAnalysis (outer try-catch):", error);
        return new Response(`服务器错误: ${escapeHtml(error.message)}`, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}
