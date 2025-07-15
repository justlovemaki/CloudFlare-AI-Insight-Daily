// src/auth.js
import { storeInKV, getFromKV} from './kv.js';

const SESSION_COOKIE_NAME = 'session_id_89757';
const SESSION_EXPIRATION_SECONDS = 60 * 60; // 1 hour

// Function to generate the login page HTML
function generateLoginPage(redirectUrl) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f4f4f4; margin: 0; }
                .login-container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
                h2 { color: #333; margin-bottom: 20px; }
                .form-group { margin-bottom: 15px; text-align: left; }
                label { display: block; margin-bottom: 5px; color: #555; }
                input[type="text"], input[type="password"] { width: calc(100% - 20px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
                button { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; width: 100%; }
                button:hover { background-color: #0056b3; }
                .error-message { color: red; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h2>Login</h2>
                <form id="loginForm" method="POST" action="/login">
                    <div class="form-group">
                        <label for="username">Username:</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <input type="hidden" name="redirect" value="${redirectUrl}">
                    <button type="submit">Login</button>
                    <p id="errorMessage" class="error-message"></p>
                </form>
                <script>
                    const form = document.getElementById('loginForm');
                    const errorMessage = document.getElementById('errorMessage');
                    form.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const formData = new FormData(form);
                        const response = await fetch('/login', {
                            method: 'POST',
                            body: new URLSearchParams(formData).toString(),
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        });
                        if (response.ok) {
                            const redirectUrl = response.headers.get('X-Redirect-Url');
                            if (redirectUrl && redirectUrl !== '/') {
                                window.location.href = redirectUrl;
                            } else {
                                window.location.href = '/getContentHtml'; // Fallback to home
                            }
                        } else {
                            const errorText = await response.text();
                            errorMessage.textContent = errorText || 'Login failed. Please try again.';
                        }
                    });
                </script>
            </div>
        </body>
        </html>
    `;
}

// Function to set or renew the session cookie
function setSessionCookie(sessionId) {
    const expirationDate = new Date(Date.now() + SESSION_EXPIRATION_SECONDS * 1000);
    return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; Expires=${expirationDate.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
}

// Function to handle login requests
async function handleLogin(request, env) {
    if (request.method === 'GET') {
        const url = new URL(request.url);
        const redirectUrl = url.searchParams.get('redirect') || '/getContentHtml';
        return new Response(generateLoginPage(redirectUrl), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } else if (request.method === 'POST') {
        const formData = await request.formData();
        const username = formData.get('username');
        const password = formData.get('password');
        const redirect = formData.get('redirect') || '/';

        if (username === env.LOGIN_USERNAME && password === env.LOGIN_PASSWORD) {
            const sessionId = crypto.randomUUID(); // Generate a simple session ID
            
            // Store sessionId in KV store for persistent sessions
            await storeInKV(env.DATA_KV, `session:${sessionId}`, 'valid', SESSION_EXPIRATION_SECONDS);

            const cookie = setSessionCookie(sessionId);

            return new Response('Login successful', {
                status: 200,
                headers: {
                    'Set-Cookie': cookie,
                    'X-Redirect-Url': redirect, // Custom header for client-side redirect
                },
            });
        } else {
            return new Response('Invalid username or password', { status: 401 });
        }
    }
    return new Response('Method Not Allowed', { status: 405 });
}

// Function to check and renew session cookie
async function isAuthenticated(request, env) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        return { authenticated: false, cookie: null };
    }

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(cookie => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

    if (!sessionCookie) {
        return { authenticated: false, cookie: null };
    }

    const sessionId = sessionCookie.split('=')[1];

    // Validate sessionId against KV store
    const storedSession = await getFromKV(env.DATA_KV, `session:${sessionId}`);
    if (storedSession !== 'valid') {
        return { authenticated: false, cookie: null };
    }

    // Store sessionId in KV store for persistent sessions
    await storeInKV(env.DATA_KV, `session:${sessionId}`, 'valid', SESSION_EXPIRATION_SECONDS);
    // Renew the session cookie
    const newCookie = setSessionCookie(sessionId);
    return { authenticated: true, cookie: newCookie };
}

// Function to handle logout requests
async function handleLogout(request, env) {
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const sessionCookie = cookies.find(cookie => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
        if (sessionCookie) {
            const sessionId = sessionCookie.split('=')[1];
            // Delete session from KV store
            await env.DATA_KV.delete(`session:${sessionId}`);
        }
    }

    const expiredDate = new Date(0); // Set expiration to a past date
    const cookie = `${SESSION_COOKIE_NAME}=; Path=/; Expires=${expiredDate.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;

    const url = new URL(request.url);
    const redirectUrl = url.searchParams.get('redirect') || '/login'; // Redirect to login page by default

    return new Response('Logged out', {
        status: 302,
        headers: {
            'Set-Cookie': cookie,
            'Location': redirectUrl,
        },
    });
}

export {
    handleLogin,
    isAuthenticated,
    handleLogout,
    SESSION_COOKIE_NAME,
    SESSION_EXPIRATION_SECONDS,
};
