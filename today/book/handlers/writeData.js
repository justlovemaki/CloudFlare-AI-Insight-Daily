// src/handlers/writeData.js
import { getISODate, getFetchDate } from '../helpers.js';
import { fetchAllData, fetchDataByCategory, dataSources } from '../dataFetchers.js'; // 导入 fetchDataByCategory 和 dataSources
import { storeInKV } from '../kv.js';

export async function handleWriteData(request, env) {
    const dateParam = getFetchDate();
    const dateStr = dateParam ? dateParam : getISODate();
    console.log(`Starting /writeData process for date: ${dateStr}`);
    let category = null;
    let foloCookie = null;
    
    try {
        // 尝试解析请求体，获取 category 参数
        if (request.headers.get('Content-Type')?.includes('application/json')) {
            const requestBody = await request.json();
            category = requestBody.category;
            foloCookie = requestBody.foloCookie; // 获取 foloCookie
        }

        console.log(`Starting /writeData process for category: ${category || 'all'} with foloCookie presence: ${!!foloCookie}`);

        let dataToStore = {};
        let fetchPromises = [];
        let successMessage = '';

        if (category) {
            // 只抓取指定分类的数据
            const fetchedData = await fetchDataByCategory(env, category, foloCookie); // 传递 foloCookie
            dataToStore[category] = fetchedData;
            fetchPromises.push(storeInKV(env.DATA_KV, `${dateStr}-${category}`, fetchedData));
            successMessage = `Data for category '${category}' fetched and stored.`;
            console.log(`Transformed ${category}: ${fetchedData.length} items.`);
        } else {
            // 抓取所有分类的数据 (现有逻辑)
            const allUnifiedData = await fetchAllData(env, foloCookie); // 传递 foloCookie
            
            for (const sourceType in dataSources) {
                if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                    dataToStore[sourceType] = allUnifiedData[sourceType] || [];
                    fetchPromises.push(storeInKV(env.DATA_KV, `${dateStr}-${sourceType}`, dataToStore[sourceType]));
                    console.log(`Transformed ${sourceType}: ${dataToStore[sourceType].length} items.`);
                }
            }
            successMessage = `All data categories fetched and stored.`;
        }

        await Promise.all(fetchPromises);

        const errors = []; // Placeholder for potential future error aggregation from fetchAllData or fetchDataByCategory

        if (errors.length > 0) {
            console.warn("/writeData completed with errors:", errors);
            return new Response(JSON.stringify({ 
                success: false, 
                message: `${successMessage} Some errors occurred.`, 
                errors: errors, 
                ...Object.fromEntries(Object.entries(dataToStore).map(([key, value]) => [`${key}ItemCount`, value.length]))
            }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        } else {
            console.log("/writeData process completed successfully.");
            return new Response(JSON.stringify({ 
                success: true, 
                message: successMessage,
                ...Object.fromEntries(Object.entries(dataToStore).map(([key, value]) => [`${key}ItemCount`, value.length]))
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error("Unhandled error in /writeData:", error);
        return new Response(JSON.stringify({ success: false, message: "An unhandled error occurred during data processing.", error: error.message, details: error.stack }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
