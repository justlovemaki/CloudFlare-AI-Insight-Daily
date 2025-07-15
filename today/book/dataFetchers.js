// src/dataFetchers.js
import AibaseDataSource from './dataSources/aibase.js';
import GithubTrendingDataSource from './dataSources/github-trending.js';
import HuggingfacePapersDataSource from './dataSources/huggingface-papers.js';
import XinZhiYuanDataSource from './dataSources/xinzhiyuan.js';
import QBitDataSource from './dataSources/qbit.js';
import JiqizhixinDataSource from './dataSources/jiqizhixin.js';
import XiaohuDataSource from './dataSources/xiaohu.js';
import TwitterDataSource from './dataSources/twitter.js';

// Register data sources as arrays to support multiple sources per type
export const dataSources = {
    news: { name: '新闻', sources: [AibaseDataSource, XiaohuDataSource] },
    project: { name: '项目', sources: [GithubTrendingDataSource] },
    paper: { name: '论文', sources: [HuggingfacePapersDataSource, XinZhiYuanDataSource, QBitDataSource, JiqizhixinDataSource] },
    socialMedia: { name: '社交平台', sources: [TwitterDataSource] },
    // Add new data sources here as arrays, e.g.,
    // newType: { name: '新类型', sources: [NewTypeDataSource1, NewTypeDataSource2] },
};

/**
 * Fetches and transforms data from all data sources for a specified type.
 * @param {string} sourceType - The type of data source (e.g., 'news', 'projects', 'papers').
 * @param {object} env - The environment variables.
 * @param {string} [foloCookie] - The Folo authentication cookie.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of unified data objects from all sources of that type.
 */
export async function fetchAndTransformDataForType(sourceType, env, foloCookie) {
    const sources = dataSources[sourceType].sources;
    if (!sources || !Array.isArray(sources)) {
        console.error(`No data sources registered for type: ${sourceType}`);
        return [];
    }

    let allUnifiedDataForType = [];
    for (const dataSource of sources) {
        try {
            // Pass foloCookie to the fetch method of the data source
            const rawData = await dataSource.fetch(env, foloCookie);
            const unifiedData = dataSource.transform(rawData, sourceType);
            allUnifiedDataForType = allUnifiedDataForType.concat(unifiedData);
        } catch (error) {
            console.error(`Error fetching or transforming data from source ${dataSource.type} for type ${sourceType}:`, error.message);
            // Continue to next data source even if one fails
        }
    }

    // Sort by published_date in descending order for each type
    allUnifiedDataForType.sort((a, b) => {
        const dateA = new Date(a.published_date);
        const dateB = new Date(b.published_date);
        return dateB.getTime() - dateA.getTime();
    });

    return allUnifiedDataForType;
}

/**
 * Fetches and transforms data from all registered data sources across all types.
 * @param {object} env - The environment variables.
 * @param {string} [foloCookie] - The Folo authentication cookie.
 * @returns {Promise<object>} A promise that resolves to an object containing unified data for each source type.
 */
export async function fetchAllData(env, foloCookie) {
    const allUnifiedData = {};
    const fetchPromises = [];

    for (const sourceType in dataSources) {
        if (Object.hasOwnProperty.call(dataSources, sourceType)) {
            fetchPromises.push(
                fetchAndTransformDataForType(sourceType, env, foloCookie).then(data => {
                    allUnifiedData[sourceType] = data;
                })
            );
        }
    }
    await Promise.allSettled(fetchPromises); // Use allSettled to ensure all promises complete
    return allUnifiedData;
}

/**
 * Fetches and transforms data from all data sources for a specific category.
 * @param {object} env - The environment variables.
 * @param {string} category - The category to fetch data for (e.g., 'news', 'project', 'paper', 'twitter').
 * @param {string} [foloCookie] - The Folo authentication cookie.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of unified data objects for the specified category.
 */
export async function fetchDataByCategory(env, category, foloCookie) {
    if (!dataSources[category]) {
        console.warn(`Attempted to fetch data for unknown category: ${category}`);
        return [];
    }
    return await fetchAndTransformDataForType(category, env, foloCookie);
}
