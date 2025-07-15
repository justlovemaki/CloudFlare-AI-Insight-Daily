// src/index.js
import { handleWriteData } from './handlers/writeData.js';
import { handleGetContent } from './handlers/getContent.js';
import { handleGetContentHtml } from './handlers/getContentHtml.js';
import { handleGenAIContent, handleGenAIPodcastScript, handleGenAIDailyAnalysis } from './handlers/genAIContent.js'; // Import handleGenAIPodcastScript and handleGenAIDailyAnalysis
import { handleCommitToGitHub } from './handlers/commitToGitHub.js';
import { handleRss } from './handlers/getRss.js';
import { handleWriteRssData } from './handlers/writeRssData.js'; 
import { dataSources } from './dataFetchers.js';
import { handleLogin, isAuthenticated, handleLogout } from './auth.js';

export default {
    async fetch(request, env) {
        // Check essential environment variables
        const requiredEnvVars = [
            'DATA_KV', 'GEMINI_API_KEY', 'GEMINI_API_URL', 'DEFAULT_GEMINI_MODEL', 'OPEN_TRANSLATE', 'USE_MODEL_PLATFORM',
            'GITHUB_TOKEN', 'GITHUB_REPO_OWNER', 'GITHUB_REPO_NAME','GITHUB_BRANCH',
            'LOGIN_USERNAME', 'LOGIN_PASSWORD',
            'PODCAST_TITLE','PODCAST_BEGIN','PODCAST_END',
            'FOLO_COOKIE_KV_KEY','FOLO_DATA_API','FOLO_FILTER_DAYS',
            'AIBASE_FEED_ID', 'XIAOHU_FEED_ID', 'HGPAPERS_FEED_ID', 'TWITTER_LIST_ID',
            'AIBASE_FETCH_PAGES', 'XIAOHU_FETCH_PAGES', 'HGPAPERS_FETCH_PAGES', 'TWITTER_FETCH_PAGES',
            //'AIBASE_API_URL', 'XIAOHU_API_URL','PROJECTS_API_URL','HGPAPERS_API_URL', 'TWITTER_API_URL', 'TWITTER_USERNAMES',
        ];
        console.log(env);
        const missingVars = requiredEnvVars.filter(varName => !env[varName]);

        if (missingVars.length > 0) {
            console.error(`CRITICAL: Missing environment variables/bindings: ${missingVars.join(', ')}`);
            const errorPage = `
                <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Configuration Error</title></head>
                <body style="font-family: sans-serif; padding: 20px;"><h1>Server Configuration Error</h1>
                <p>Essential environment variables or bindings are missing: ${missingVars.join(', ')}. The service cannot operate.</p>
                <p>Please contact the administrator.</p></body></html>`;
            return new Response(errorPage, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        
        const url = new URL(request.url);
        const path = url.pathname;
        console.log(`Request received: ${request.method} ${path}`);

        // Handle login path specifically
        if (path === '/login') {
            return await handleLogin(request, env);
        } else if (path === '/logout') { // Handle logout path
            return await handleLogout(request, env);
        } else if (path === '/getContent' && request.method === 'GET') {
            return await handleGetContent(request, env);
        } else if (path.startsWith('/rss') && request.method === 'GET') {
            return await handleRss(request, env);
        } else if (path === '/writeRssData' && request.method === 'GET') {
            return await handleWriteRssData(request, env);
        }

        // Authentication check for all other paths
        const { authenticated, cookie: newCookie } = await isAuthenticated(request, env);
        if (!authenticated) {
            // Redirect to login page, passing the original URL as a redirect parameter
            const loginUrl = new URL('/login', url.origin);
            loginUrl.searchParams.set('redirect', url.pathname + url.search);
            return Response.redirect(loginUrl.toString(), 302);
        }

        // Original routing logic for authenticated requests
        let response;
        try {
            if (path === '/writeData' && request.method === 'POST') {
                response = await handleWriteData(request, env);
            } else if (path === '/getContentHtml' && request.method === 'GET') {
                // Prepare dataCategories for the HTML generation
                const dataCategories = Object.keys(dataSources).map(key => ({
                    id: key,
                    name: dataSources[key].name
                }));
                response = await handleGetContentHtml(request, env, dataCategories);
            } else if (path === '/genAIContent' && request.method === 'POST') {
                response = await handleGenAIContent(request, env);
            } else if (path === '/genAIPodcastScript' && request.method === 'POST') { // New route for podcast script
                response = await handleGenAIPodcastScript(request, env);
            } else if (path === '/genAIDailyAnalysis' && request.method === 'POST') { // New route for AI Daily Analysis
                response = await handleGenAIDailyAnalysis(request, env);
            } else if (path === '/commitToGitHub' && request.method === 'POST') {
                response = await handleCommitToGitHub(request, env);
            } else {
                return new Response(null, { status: 404, headers: {'Content-Type': 'text/plain; charset=utf-8'} });
            }
        } catch (e) {
            console.error("Unhandled error in fetch handler:", e);
            return new Response(`Internal Server Error: ${e.message}`, { status: 500 });
        }

        // Renew cookie for authenticated requests
        if (newCookie) {
            response.headers.append('Set-Cookie', newCookie);
        }
        return response;
    }
};
