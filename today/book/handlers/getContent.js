// src/handlers/getContent.js
import { getISODate } from '../helpers.js';
import { getFromKV } from '../kv.js';
import { dataSources } from '../dataFetchers.js'; // Import dataSources

export async function handleGetContent(request, env) {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const dateStr = dateParam ? dateParam : getISODate();
    console.log(`Getting content for date: ${dateStr}`);
    try {
        const responseData = {
            date: dateStr,
            message: `Successfully retrieved data for ${dateStr}.`
        };

        const fetchPromises = [];
        for (const sourceType in dataSources) {
            if (Object.hasOwnProperty.call(dataSources, sourceType)) {
                fetchPromises.push(
                    getFromKV(env.DATA_KV, `${dateStr}-${sourceType}`).then(data => {
                        responseData[sourceType] = data || [];
                    })
                );
            }
        }
        await Promise.allSettled(fetchPromises);
        
        return new Response(JSON.stringify(responseData), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error("Error in /getContent:", error);
        return new Response(JSON.stringify({ success: false, message: "Failed to get content.", error: error.message, date: dateStr }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
