// src/helpers.js

/**
 * 全域參數，用於指定資料抓取的日期。
 * 預設為當前日期，格式為 YYYY-MM-DD。
 */
export let fetchDate = getISODate();

export function setFetchDate(date) {
    fetchDate = date;
}

export function getFetchDate() {
    return fetchDate;
}

/**
 * Gets the current date or a specified date in YYYY-MM-DD format.
 * @param {Date} [dateObj] - Optional Date object. Defaults to current date.
 * @returns {string} Date string in YYYY-MM-DD format.
 */
export function getISODate(dateObj = new Date()) {
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Shanghai'
    };
    // 使用 'en-CA' 語言環境，因為它通常會產生 YYYY-MM-DD 格式的日期字串
    const dateString = dateObj.toLocaleDateString('en-CA', options);
    return dateString;
}

/**
 * Escapes HTML special characters in a string.
 * @param {*} unsafe The input to escape. If not a string, it's converted. Null/undefined become empty string.
 * @returns {string} The escaped string.
 */
export function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') {
        return '';
    }
    const str = String(unsafe);
    const map = {
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generic fetch wrapper with JSON parsing and error handling.
 * @param {string} url - The URL to fetch.
 * @param {object} [options] - Fetch options.
 * @returns {Promise<object>} The JSON response or text for non-JSON.
 * @throws {Error} If the fetch fails or response is not ok.
 */
export async function fetchData(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}, url: ${url}`);
    }
    return response.json();
}

/**
 * Removes markdown code block fences (```json or ```) from a string.
 * @param {string} text - The input string potentially containing markdown code fences.
 * @returns {string} The string with markdown code fences removed.
 */
export function removeMarkdownCodeBlock(text) {
    if (!text) return '';
    let cleanedText = text.trim();

    const jsonFence = "```json";
    const genericFence = "```";

    if (cleanedText.startsWith(jsonFence)) {
        cleanedText = cleanedText.substring(jsonFence.length);
    } else if (cleanedText.startsWith(genericFence)) {
        cleanedText = cleanedText.substring(genericFence.length);
    }

    if (cleanedText.endsWith(genericFence)) {
        cleanedText = cleanedText.substring(0, cleanedText.length - genericFence.length);
    }
    return cleanedText.trim();
}

/**
 * Strips HTML tags from a string and normalizes whitespace.
 * @param {string} html - The HTML string.
 * @returns {string} The text content without HTML tags.
 */
export function stripHtml(html) {
    if (!html) return "";

    // 處理 img 標籤，保留其 src 和 alt 屬性
    let processedHtml = html.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, (match, src, alt) => {
        return alt ? `[图片: ${alt} ${src}]` : `[图片: ${src}]`;
    });
    processedHtml = processedHtml.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '[图片: $1]');

    // 处理 video 标签，保留其 src 属性
    processedHtml = processedHtml.replace(/<video[^>]*src="([^"]*)"[^>]*>.*?<\/video>/gi, '[视频: $1]');

    // 移除所有其他 HTML 标签，并规范化空白
    return processedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks if a given date string is within the last specified number of days (inclusive of today).
 * @param {string} dateString - The date string to check (YYYY-MM-DD).
 * @param {number} days - The number of days to look back (e.g., 3 for today and the past 2 days).
 * @returns {boolean} True if the date is within the last 'days', false otherwise.
 */
/**
 * Converts a date string to a Date object representing the time in Asia/Shanghai timezone.
 * This is crucial for consistent date comparisons across different environments.
 * @param {string} dateString - The date string to convert.
 * @returns {Date} A Date object set to the specified date in Asia/Shanghai timezone.
 */
export function convertToShanghaiTime(dateString) {
    // Create a Date object from the ISO string.
    const date = new Date(dateString);

    // Get the date components in Asia/Shanghai timezone
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZone: 'Asia/Shanghai'
    };

    // Format the date to a string in Shanghai timezone, then parse it back to a Date object.
    // This is a common workaround to get a Date object representing a specific timezone.
    const shanghaiDateString = new Intl.DateTimeFormat('en-US', options).format(date);
    return new Date(shanghaiDateString);
}

export function getShanghaiTime() {
    // Create a Date object from the ISO string.
    const date = new Date();

    // Get the date components in Asia/Shanghai timezone
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZone: 'Asia/Shanghai'
    };

    // Format the date to a string in Shanghai timezone, then parse it back to a Date object.
    // This is a common workaround to get a Date object representing a specific timezone.
    const shanghaiDateString = new Intl.DateTimeFormat('en-US', options).format(date);
    return new Date(shanghaiDateString);
}

/**
 * Checks if a given date string is within the last specified number of days (inclusive of today).
 * @param {string} dateString - The date string to check (YYYY-MM-DD or ISO format).
 * @param {number} days - The number of days to look back (e.g., 3 for today and the past 2 days).
 * @returns {boolean} True if the date is within the last 'days', false otherwise.
 */
export function isDateWithinLastDays(dateString, days) {
    // Convert both dates to Shanghai time for consistent comparison
    const itemDate = convertToShanghaiTime(dateString);
    const today = new Date(fetchDate);

    // Normalize today to the start of its day in Shanghai time
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - itemDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 && diffDays < days;
}

/**
 * Formats an ISO date string to "YYYY年M月D日" format.
 * @param {string} isoDateString - The date string in ISO format (e.g., "2025-05-30T08:24:52.000Z").
 * @returns {string} Formatted date string (e.g., "2025年5月30日").
 */
export function formatDateToChinese(isoDateString) {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'Asia/Shanghai'
    };
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
}

/**
 * Formats an ISO date string to "YYYY年M月D日 HH:MM:SS" format.
 * @param {string} isoDateString - The date string in ISO format (e.g., "2025-05-30T08:24:52.000Z").
 * @returns {string} Formatted date string (e.g., "2025年5月30日 08:24:52").
 */
export function formatDateToChineseWithTime(isoDateString) {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // 使用24小时制
        timeZone: 'Asia/Shanghai' // 指定东8时区
    };
    // 使用 'zh-CN' 语言环境以确保中文格式
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
}

/**
 * 將日期物件格式化為 RSS 2.0 規範的日期字串 (RFC 822)
 * 例如: "Thu, 01 Jan 1970 00:00:00 GMT"
 * @param {Date} date - 日期物件
 * @returns {string} 格式化後的日期字串
 */
export function formatRssDate(date) {
    if (!date) return new Date().toUTCString();
    
    return date.toUTCString();
  }


  export function formatDateToGMT0WithTime(isoDateString) {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // 使用24小时制
        timeZone: 'GMT'
    };
    // 使用 'zh-CN' 语言环境以确保中文格式
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
}  

  export function formatDateToGMT12WithTime(isoDateString) {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // 使用24小时制
        timeZone: 'Asia/Kamchatka'// 指定东12时区
    };
    // 使用 'zh-CN' 语言环境以确保中文格式
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
}  

/**
 * Converts English double quotes (") to Chinese double quotes (“”).
 * @param {string} text - The input string.
 * @returns {string} The string with Chinese double quotes.
 */
export function convertEnglishQuotesToChinese(text) {
    const str = String(text);
    return str.replace(/"/g, '“');
}

export function formatMarkdownText(text) {
    const str = String(text);
    return str.replace(/“/g, '"');
}

/**
 * Generates a random User-Agent string.
 * @returns {string} A random User-Agent string.
 */
export function getRandomUserAgent() {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
        "Mozilla/5.0 (X11; Linux x86_64; rv:108.0) Gecko/20100101 Firefox/108.0",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified time.
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function replaceImageProxy(proxy, content) {
    const str = String(content);
    return str.replace(/upload.chinaz.com/g, 'pic.chinaz.com').replace(/https:\/\/pic.chinaz.com/g, proxy+'https:\/\/pic.chinaz.com');
}