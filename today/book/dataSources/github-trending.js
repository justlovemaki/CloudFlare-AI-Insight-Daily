// src/dataSources/projects.js
import { fetchData, getISODate, removeMarkdownCodeBlock, formatDateToChineseWithTime, escapeHtml} from '../helpers.js';
import { callChatAPI } from '../chatapi.js';

const ProjectsDataSource = {
    fetch: async (env) => {
        console.log(`Fetching projects from: ${env.PROJECTS_API_URL}`);
        let projects;
        try {
            projects = await fetchData(env.PROJECTS_API_URL);
        } catch (error) {
            console.error("Error fetching projects data:", error.message);
            return { error: "Failed to fetch projects data", details: error.message, items: [] };
        }

        if (!Array.isArray(projects)) {
            console.error("Projects data is not an array:", projects);
            return { error: "Invalid projects data format", received: projects, items: [] };
        }
         if (projects.length === 0) {
            console.log("No projects fetched from API.");
            return { items: [] };
        }

        if (!env.OPEN_TRANSLATE === "true") {
            console.warn("Skipping paper translations.");
            return projects.map(p => ({ ...p, description_zh: p.description || "" }));
        }

        const descriptionsToTranslate = projects
            .map(p => p.description || "")
            .filter(desc => typeof desc === 'string');

        const nonEmptyDescriptions = descriptionsToTranslate.filter(d => d.trim() !== "");
        if (nonEmptyDescriptions.length === 0) {
            console.log("No non-empty project descriptions to translate.");
            return projects.map(p => ({ ...p, description_zh: p.description || "" }));
        }
        const promptText = `Translate the following English project descriptions to Chinese.
Provide the translations as a JSON array of strings, in the exact same order as the input.
Each string in the output array must correspond to the string at the same index in the input array.
If an input description is an empty string, the corresponding translated string in the output array should also be an empty string.
Input Descriptions (JSON array of strings):
${JSON.stringify(descriptionsToTranslate)}
Respond ONLY with the JSON array of Chinese translations. Do not include any other text or explanations.
JSON Array of Chinese Translations:`;

        let translatedTexts = [];
        try {
            console.log(`Requesting translation for ${descriptionsToTranslate.length} project descriptions.`);
            const chatResponse = await callChatAPI(env, promptText);
            const parsedTranslations = JSON.parse(removeMarkdownCodeBlock(chatResponse)); // Assuming direct JSON array response

            if (parsedTranslations && Array.isArray(parsedTranslations) && parsedTranslations.length === descriptionsToTranslate.length) {
                translatedTexts = parsedTranslations;
            } else {
                console.warn(`Translation count mismatch or parsing error for project descriptions. Expected ${descriptionsToTranslate.length}, received ${parsedTranslations ? parsedTranslations.length : 'null'}. Falling back.`);
                translatedTexts = descriptionsToTranslate.map(() => null);
            }
        } catch (translationError) {
            console.error("Failed to translate project descriptions in batch:", translationError.message);
            translatedTexts = descriptionsToTranslate.map(() => null);
        }

        return projects.map((project, index) => {
            const translated = translatedTexts[index];
            return {
                ...project,
                description_zh: (typeof translated === 'string') ? translated : (project.description || "")
            };
        });
    },
    transform: (projectsData, sourceType) => {
        const unifiedProjects = [];
        const now = getISODate();
        if (Array.isArray(projectsData)) {
            projectsData.forEach((project, index) => {
                unifiedProjects.push({
                    id: index + 1, // Use project.url as ID if available
                    type: sourceType,
                    url: project.url,
                    title: project.name,
                    description: project.description_zh || project.description || "",
                    published_date: now, // Projects don't have a published date, use current date
                    authors: project.owner ? [project.owner] : [],
                    source: "GitHub Trending",
                    details: {
                        owner: project.owner,
                        name: project.name,
                        language: project.language,
                        languageColor: project.languageColor,
                        totalStars: project.totalStars,
                        forks: project.forks,
                        starsToday: project.starsToday,
                        builtBy: project.builtBy || []
                    }
                });
            });
        }
        return unifiedProjects;
    },

    generateHtml: (item) => {
        return `
            <strong>${escapeHtml(item.title)}</strong> (所有者: ${escapeHtml(item.details.owner)})<br>
            <small>星标: ${escapeHtml(item.details.totalStars)} (今日: ${escapeHtml(item.details.starsToday)}) | 语言: ${escapeHtml(item.details.language || 'N/A')}</small>
            描述: ${escapeHtml(item.description) || 'N/A'}<br>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">在 GitHub 上查看</a>
        `;
    }
};

export default ProjectsDataSource;
