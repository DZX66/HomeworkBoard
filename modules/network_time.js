import axios from 'axios';

let cachedOffset = 0; // 网络时间 - 本地时间 的差值（毫秒）

/**
 * 从指定URL获取网络时间偏移量
 * @param {string} url - 时间服务器URL
 * @returns {Promise<number|null>} 偏移量（毫秒），失败返回null
 */
export async function fetchTimeOffset(url) {
    try {
        console.log(`Fetching network time from: ${url}`);
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        let networkTimeMs = null;

        // 尝试从 worldtimeapi.org 格式解析 (unixtime 是秒)
        if (response.data && typeof response.data.unixtime === 'number') {
            networkTimeMs = response.data.unixtime * 1000;
            console.log('Parsed time from worldtimeapi format');
        }
        // 尝试从 taobao API 格式解析 (data.t 是毫秒)
        else if (response.data && response.data.data && response.data.data.t) {
            networkTimeMs = parseInt(response.data.data.t);
            console.log('Parsed time from taobao API format');
        }
        // 尝试从 Date 响应头解析
        else {
            const dateHeader = response.headers['date'];
            if (dateHeader) {
                networkTimeMs = new Date(dateHeader).getTime();
                if (!isNaN(networkTimeMs)) {
                    console.log('Parsed time from Date response header');
                } else {
                    networkTimeMs = null;
                }
            }
        }

        if (networkTimeMs !== null && !isNaN(networkTimeMs)) {
            cachedOffset = networkTimeMs - Date.now();
            console.log(`Network time offset set: ${cachedOffset}ms (network: ${new Date(networkTimeMs).toISOString()})`);
            return cachedOffset;
        }

        throw new Error('无法从响应中提取时间信息');
    } catch (error) {
        console.error('获取网络时间失败:', error.message);
        return null;
    }
}

/**
 * 获取网络时间（同步方式，使用缓存的偏移量）
 * @returns {Date} 调整后的Date对象
 */
export function getNetworkDate() {
    return new Date(Date.now() + cachedOffset);
}

/**
 * 获取缓存的偏移量
 * @returns {number}
 */
export function getCachedOffset() {
    return cachedOffset;
}

/**
 * 手动设置偏移量
 * @param {number} offset
 */
export function setCachedOffset(offset) {
    cachedOffset = offset;
}

export default {
    fetchTimeOffset,
    getNetworkDate,
    getCachedOffset,
    setCachedOffset
};
