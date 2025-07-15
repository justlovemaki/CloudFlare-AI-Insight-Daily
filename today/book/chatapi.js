// src/chatapi.js

/**
 * Calls the Gemini Chat API (non-streaming).
 *
 * @param {object} env - Environment object containing GEMINI_API_URL.
 * @param {string} promptText - The user's prompt.
 * @param {string | null} [systemPromptText=null] - Optional system prompt text.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If GEMINI_API_URL is not set, or if API call fails or returns blocked/empty content.
 */
async function callGeminiChatAPI(env, promptText, systemPromptText = null) {
    if (!env.GEMINI_API_URL) {
        throw new Error("GEMINI_API_URL environment variable is not set.");
    }
    if (!env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set for Gemini models.");
    }
    const modelName = env.DEFAULT_GEMINI_MODEL;
    const url = `${env.GEMINI_API_URL}/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }],
    };

    if (systemPromptText && typeof systemPromptText === 'string' && systemPromptText.trim() !== '') {
        payload.systemInstruction = {
            parts: [{ text: systemPromptText }]
        };
        console.log("System instruction included in Chat API call.");
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBodyText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorBodyText);
            } catch (e) {
                errorData = errorBodyText;
            }
            console.error("Gemini Chat API Error Response Body:", typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : errorData);
            const message = typeof errorData === 'object' && errorData.error?.message
                ? errorData.error.message
                : (typeof errorData === 'string' ? errorData : 'Unknown Gemini Chat API error');
            throw new Error(`Gemini Chat API error (${response.status}): ${message}`);
        }

        const data = await response.json();

        // 1. Check for prompt-level blocking first
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            const blockReason = data.promptFeedback.blockReason;
            const safetyRatings = data.promptFeedback.safetyRatings ? JSON.stringify(data.promptFeedback.safetyRatings) : 'N/A';
            console.error(`Gemini Chat prompt blocked: ${blockReason}. Safety ratings: ${safetyRatings}`, JSON.stringify(data, null, 2));
            throw new Error(`Gemini Chat prompt blocked: ${blockReason}. Safety ratings: ${safetyRatings}`);
        }

        // 2. Check candidates and their content
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];

            // Check finishReason for issues other than STOP
            // Common finishReasons: STOP, MAX_TOKENS, SAFETY, RECITATION, OTHER
            if (candidate.finishReason && candidate.finishReason !== "STOP") {
                const reason = candidate.finishReason;
                const safetyRatings = candidate.safetyRatings ? JSON.stringify(candidate.safetyRatings) : 'N/A';
                console.error(`Gemini Chat content generation finished with reason: ${reason}. Safety ratings: ${safetyRatings}`, JSON.stringify(data, null, 2));
                if (reason === "SAFETY") {
                     throw new Error(`Gemini Chat content generation blocked due to safety (${reason}). Safety ratings: ${safetyRatings}`);
                }
                throw new Error(`Gemini Chat content generation finished due to: ${reason}. Safety ratings: ${safetyRatings}`);
            }

            // If finishReason is STOP, try to extract text
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 && candidate.content.parts[0].text) {
                return candidate.content.parts[0].text;
            } else {
                // finishReason was STOP (or not present, implying success), but no text.
                console.warn("Gemini Chat API response has candidate with 'STOP' finishReason but no text content, or content structure is unexpected.", JSON.stringify(data, null, 2));
                throw new Error("Gemini Chat API returned a candidate with 'STOP' finishReason but no text content.");
            }
        } else {
            // No candidates, and no promptFeedback block reason either (handled above).
            // This means the response is empty or malformed in an unexpected way.
            console.warn("Gemini Chat API response format unexpected: No candidates found and no prompt block reason.", JSON.stringify(data, null, 2));
            throw new Error("Gemini Chat API returned an empty or malformed response with no candidates.");
        }
    } catch (error) {
        // Log the full error object if it's not one we constructed, or just re-throw
        if (!(error instanceof Error && error.message.startsWith("Gemini Chat"))) {
            console.error("Error calling Gemini Chat API (Non-streaming):", error);
        }
        throw error;
    }
}


/**
 * Calls the Gemini Chat API with streaming.
 *
 * @param {object} env - Environment object containing GEMINI_API_URL.
 * @param {string} promptText - The user's prompt.
 * @param {string | null} [systemPromptText=null] - Optional system prompt text.
 * @returns {AsyncGenerator<string, void, undefined>} An async generator yielding text chunks.
 * @throws {Error} If GEMINI_API_URL is not set, or if API call fails or returns blocked/empty content.
 */
async function* callGeminiChatAPIStream(env, promptText, systemPromptText = null) {
    if (!env.GEMINI_API_URL) {
        throw new Error("GEMINI_API_URL environment variable is not set.");
    }
    if (!env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set for Gemini models.");
    }
    const modelName = env.DEFAULT_GEMINI_MODEL;
    const url = `${env.GEMINI_API_URL}/v1beta/models/${modelName}:streamGenerateContent?key=${env.GEMINI_API_KEY}&alt=sse`;

    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }],
    };

    if (systemPromptText && typeof systemPromptText === 'string' && systemPromptText.trim() !== '') {
        payload.systemInstruction = {
            parts: [{ text: systemPromptText }]
        };
        console.log("System instruction included in Chat API call.");
    }

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBodyText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorBodyBody);
            } catch (e) {
                errorData = errorBodyText;
            }
            console.error("Gemini Chat API Error (Stream Initial) Response Body:", typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : errorData);
            const message = typeof errorData === 'object' && errorData.error?.message
                ? errorData.error.message
                : (typeof errorData === 'string' ? errorData : 'Unknown Gemini Chat API error');
            throw new Error(`Gemini Chat API error (${response.status}): ${message}`);
        }

        if (!response.body) {
            throw new Error("Response body is null, cannot stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let hasYieldedContent = false;
        let overallFinishReason = null; // To track the final finish reason if available
        let finalSafetyRatings = null;

        const processJsonChunk = (jsonString) => {
            if (jsonString.trim() === "") return null;
            try {
                return JSON.parse(jsonString);
            } catch (e) {
                console.warn("Failed to parse JSON chunk from stream:", jsonString, e.message);
                return null; // Or throw, depending on how strictly you want to handle malformed JSON
            }
        };

        const handleChunkLogic = (chunk) => {
            if (!chunk) return false; // Not a valid chunk to process

            // 1. Check for prompt-level blocking (might appear in first chunk)
            if (chunk.promptFeedback && chunk.promptFeedback.blockReason) {
                const blockReason = chunk.promptFeedback.blockReason;
                const safetyRatings = chunk.promptFeedback.safetyRatings ? JSON.stringify(chunk.promptFeedback.safetyRatings) : 'N/A';
                console.error(`Gemini Chat prompt blocked during stream: ${blockReason}. Safety ratings: ${safetyRatings}`, JSON.stringify(chunk, null, 2));
                throw new Error(`Gemini Chat prompt blocked: ${blockReason}. Safety ratings: ${safetyRatings}`);
            }

            // 2. Check candidates
            if (chunk.candidates && chunk.candidates.length > 0) {
                const candidate = chunk.candidates[0];
                if (candidate.finishReason) {
                    overallFinishReason = candidate.finishReason; // Store the latest finish reason
                    finalSafetyRatings = candidate.safetyRatings;

                    if (candidate.finishReason !== "STOP") {
                        const reason = candidate.finishReason;
                        const sr = candidate.safetyRatings ? JSON.stringify(candidate.safetyRatings) : 'N/A';
                        console.error(`Gemini Chat stream candidate finished with reason: ${reason}. Safety ratings: ${sr}`, JSON.stringify(chunk, null, 2));
                        if (reason === "SAFETY") {
                            throw new Error(`Gemini Chat content generation blocked due to safety (${reason}). Safety ratings: ${sr}`);
                        }
                        throw new Error(`Gemini Chat stream finished due to: ${reason}. Safety ratings: ${sr}`);
                    }
                }

                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    const textPart = candidate.content.parts[0].text;
                    if (textPart && typeof textPart === 'string') {
                        hasYieldedContent = true;
                        return textPart; // This is the text to yield
                    }
                }
            } else if (chunk.error) { // Check for explicit error object in stream
                console.error("Gemini Chat API Stream Error Chunk:", JSON.stringify(chunk.error, null, 2));
                throw new Error(`Gemini Chat API stream error: ${chunk.error.message || 'Unknown error in stream'}`);
            }
            return null; // No text to yield from this chunk
        };


        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            let eventBoundary;
            while ((eventBoundary = buffer.indexOf('\n\n')) !== -1 || (eventBoundary = buffer.indexOf('\n')) !== -1) {
                const separatorLength = (buffer.indexOf('\n\n') === eventBoundary) ? 2 : 1;
                let message = buffer.substring(0, eventBoundary);
                buffer = buffer.substring(eventBoundary + separatorLength);

                if (message.startsWith("data: ")) {
                    message = message.substring(5).trim();
                } else {
                    message = message.trim();
                }

                if (message === "" || message === "[DONE]") {
                    continue;
                }
                
                const parsedChunk = processJsonChunk(message);
                if (parsedChunk) {
                    const textToYield = handleChunkLogic(parsedChunk);
                    if (textToYield !== null) {
                        yield textToYield;
                    }
                }
            }
        }

        // Process any remaining data in the buffer (if not ending with newline(s))
        if (buffer.trim()) {
            let finalMessage = buffer.trim();
             if (finalMessage.startsWith("data: ")) {
                finalMessage = finalMessage.substring(5).trim();
            }
            if (finalMessage !== "" && finalMessage !== "[DONE]") {
                const parsedChunk = processJsonChunk(finalMessage);
                 if (parsedChunk) {
                    const textToYield = handleChunkLogic(parsedChunk);
                    if (textToYield !== null) {
                        yield textToYield;
                    }
                }
            }
        }

        // After the stream has finished, check if any content was yielded and the overall outcome
        if (!hasYieldedContent) {
            if (overallFinishReason && overallFinishReason !== "STOP") {
                const sr = finalSafetyRatings ? JSON.stringify(finalSafetyRatings) : 'N/A';
                console.warn(`Gemini Chat stream ended with reason '${overallFinishReason}' and no content was yielded. Safety: ${sr}`);
                throw new Error(`Gemini Chat stream completed due to ${overallFinishReason} without yielding content. Safety ratings: ${sr}`);
            } else if (overallFinishReason === "STOP") {
                console.warn("Gemini Chat stream finished with 'STOP' but no content was yielded.", JSON.stringify({overallFinishReason, finalSafetyRatings}, null, 2));
                throw new Error("Gemini Chat stream completed with 'STOP' but yielded no content.");
            } else if (!overallFinishReason) {
                console.warn("Gemini Chat stream ended without yielding any content or a clear finish reason.");
                throw new Error("Gemini Chat stream completed without yielding any content.");
            }
        }

    } catch (error) {
         if (!(error instanceof Error && error.message.startsWith("Gemini Chat"))) {
            console.error("Error calling or streaming from Gemini Chat API:", error);
        }
        throw error;
    }
}

/**
 * Calls the OpenAI Chat API (non-streaming).
 *
 * @param {object} env - Environment object containing OPENAI_API_URL and OPENAI_API_KEY.
 * @param {string} promptText - The user's prompt.
 * @param {string | null} [systemPromptText=null] - Optional system prompt text.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If OPENAI_API_URL or OPENAI_API_KEY is not set, or if API call fails.
 */
async function callOpenAIChatAPI(env, promptText, systemPromptText = null) {
    if (!env.OPENAI_API_URL) {
        throw new Error("OPENAI_API_URL environment variable is not set.");
    }
    if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set for OpenAI models.");
    }
    const url = `${env.OPENAI_API_URL}/v1/chat/completions`;
    
    const messages = [];
    if (systemPromptText && typeof systemPromptText === 'string' && systemPromptText.trim() !== '') {
        messages.push({ role: "system", content: systemPromptText });
        console.log("System instruction included in OpenAI Chat API call.");
    }
    messages.push({ role: "user", content: promptText });

    const modelName = env.DEFAULT_OPEN_MODEL;
    const payload = {
        model: modelName,
        messages: messages,
        temperature: 1,
        max_tokens: 2048,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBodyText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorBodyText);
            } catch (e) {
                errorData = errorBodyText;
            }
            console.error("OpenAI Chat API Error Response Body:", typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : errorData);
            const message = typeof errorData === 'object' && errorData.error?.message
                ? errorData.error.message
                : (typeof errorData === 'string' ? errorData : 'Unknown OpenAI Chat API error');
            throw new Error(`OpenAI Chat API error (${response.status}): ${message}`);
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content;
        } else {
            console.warn("OpenAI Chat API response format unexpected: No choices or content found.", JSON.stringify(data, null, 2));
            throw new Error("OpenAI Chat API returned an empty or malformed response.");
        }
    } catch (error) {
        if (!(error instanceof Error && error.message.startsWith("OpenAI Chat"))) {
            console.error("Error calling OpenAI Chat API (Non-streaming):", error);
        }
        throw error;
    }
}

/**
 * Calls the OpenAI Chat API with streaming.
 *
 * @param {object} env - Environment object containing OPENAI_API_URL and OPENAI_API_KEY.
 * @param {string} promptText - The user's prompt.
 * @param {string | null} [systemPromptText=null] - Optional system prompt text.
 * @returns {AsyncGenerator<string, void, undefined>} An async generator yielding text chunks.
 * @throws {Error} If OPENAI_API_URL or OPENAI_API_KEY is not set, or if API call fails.
 */
async function* callOpenAIChatAPIStream(env, promptText, systemPromptText = null) {
    if (!env.OPENAI_API_URL) {
        throw new Error("OPENAI_API_URL environment variable is not set.");
    }
    if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is not set for OpenAI models.");
    }
    const url = `${env.OPENAI_API_URL}/v1/chat/completions`;

    const messages = [];
    if (systemPromptText && typeof systemPromptText === 'string' && systemPromptText.trim() !== '') {
        messages.push({ role: "system", content: systemPromptText });
        console.log("System instruction included in OpenAI Chat API call.");
    }
    messages.push({ role: "user", content: promptText });

    const modelName = env.DEFAULT_OPEN_MODEL;
    const payload = {
        model: modelName,
        messages: messages,
        temperature: 1,
        max_tokens: 2048,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: true,
    };

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBodyText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorBodyText);
            } catch (e) {
                errorData = errorBodyText;
            }
            console.error("OpenAI Chat API Error (Stream Initial) Response Body:", typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : errorData);
            const message = typeof errorData === 'object' && errorData.error?.message
                ? errorData.error.message
                : (typeof errorData === 'string' ? errorData : 'Unknown OpenAI Chat API error');
            throw new Error(`OpenAI Chat API error (${response.status}): ${message}`);
        }

        if (!response.body) {
            throw new Error("Response body is null, cannot stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let hasYieldedContent = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            // OpenAI streaming uses data: {JSON}\n\n
            let eventBoundary;
            while ((eventBoundary = buffer.indexOf('\n\n')) !== -1) {
                let message = buffer.substring(0, eventBoundary);
                buffer = buffer.substring(eventBoundary + 2); // +2 for '\n\n'

                if (message.startsWith("data: ")) {
                    message = message.substring(5).trim();
                } else {
                    message = message.trim();
                }

                if (message === "" || message === "[DONE]") {
                    continue;
                }
                
                try {
                    const parsedChunk = JSON.parse(message);
                    if (parsedChunk.choices && parsedChunk.choices.length > 0) {
                        const delta = parsedChunk.choices[0].delta;
                        if (delta && delta.content) {
                            hasYieldedContent = true;
                            yield delta.content;
                        }
                    } else if (parsedChunk.error) {
                        console.error("OpenAI Chat API Stream Error Chunk:", JSON.stringify(parsedChunk.error, null, 2));
                        throw new Error(`OpenAI Chat API stream error: ${parsedChunk.error.message || 'Unknown error in stream'}`);
                    }
                } catch (e) {
                    console.warn("Failed to parse JSON chunk from OpenAI stream:", message, e.message);
                    // Continue processing, might be an incomplete chunk
                }
            }
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
            let finalMessage = buffer.trim();
            if (finalMessage.startsWith("data: ")) {
                finalMessage = finalMessage.substring(5).trim();
            }
            if (finalMessage !== "" && finalMessage !== "[DONE]") {
                try {
                    const parsedChunk = JSON.parse(finalMessage);
                    if (parsedChunk.choices && parsedChunk.choices.length > 0) {
                        const delta = parsedChunk.choices[0].delta;
                        if (delta && delta.content) {
                            hasYieldedContent = true;
                            yield delta.content;
                        }
                    } else if (parsedChunk.error) {
                        console.error("OpenAI Chat API Stream Error Chunk:", JSON.stringify(parsedChunk.error, null, 2));
                        throw new Error(`OpenAI Chat API stream error: ${parsedChunk.error.message || 'Unknown error in stream'}`);
                    }
                } catch (e) {
                    console.warn("Failed to parse final JSON chunk from OpenAI stream:", finalMessage, e.message);
                }
            }
        }

        if (!hasYieldedContent) {
            console.warn("OpenAI Chat stream finished but no content was yielded.");
            throw new Error("OpenAI Chat stream completed but yielded no content.");
        }

    } catch (error) {
        if (!(error instanceof Error && error.message.startsWith("OpenAI Chat"))) {
            console.error("Error calling or streaming from OpenAI Chat API:", error);
        }
        throw error;
    }
}


/**
 * Main function to call the appropriate chat API (Gemini or OpenAI) based on model name.
 * Defaults to Gemini if no specific API is indicated in the model name.
 *
 * @param {object} env - Environment object.
 * @param {string} promptText - The user's prompt.
 * @param {string | null} [systemPromptText=null] - Optional system prompt text.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If API keys/URLs are not set, or if API call fails.
 */
export async function callChatAPI(env, promptText, systemPromptText = null) {
    const platform = env.USE_MODEL_PLATFORM;
    if (platform.startsWith("OPEN")) {
        return callOpenAIChatAPI(env, promptText, systemPromptText);
    } else { // Default to Gemini
        return callGeminiChatAPI(env, promptText, systemPromptText);
    }
}

/**
 * Main function to call the appropriate chat API (Gemini or OpenAI) with streaming.
 * Defaults to Gemini if no specific API is indicated in the model name.
 *
 * @param {object} env - Environment object.
 * @param {string} promptText - The user's prompt.
 * @param {string | null} [systemPromptText=null] - Optional system prompt text.
 * @returns {AsyncGenerator<string, void, undefined>} An async generator yielding text chunks.
 * @throws {Error} If API keys/URLs are not set, or if API call fails.
 */
export async function* callChatAPIStream(env, promptText, systemPromptText = null) {
    const platform = env.USE_MODEL_PLATFORM;
    if (platform.startsWith("OPEN")) {
        yield* callOpenAIChatAPIStream(env, promptText, systemPromptText);
    } else { // Default to Gemini
        yield* callGeminiChatAPIStream(env, promptText, systemPromptText);
    }
}
