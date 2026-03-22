import { app } from 'electron';
import axios from 'axios';

async function getWeatherData(mainWindow, url) {
    try {
        console.log('Getting weather data...');
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        
        // 解析天气数据
        const weatherData = parseWeatherData(html);
        
        if (weatherData) {
            mainWindow.webContents.send('weather-data', weatherData);
            console.log('Weather data sent to renderer');
        } else {
            mainWindow.webContents.send('weather-data', { error: '解析天气数据失败' });
            console.error('Failed to parse weather data');
        }
    } catch (error) {
        mainWindow.webContents.send('message', `获取天气数据出错：${error.message}`);
        console.error('Getting weather data error:', error);
        mainWindow.webContents.send('weather-data', { error: error.message });
    }
}

function parseWeatherData(html) {
    try {
        // 提取 tplData
        let tplData = null;
        let modifyData = null;
        
        // 匹配 window.tplData = {...};
        const tplMatch = html.match(/window\.tplData\s*=\s*({[\s\S]*?});\s*<\/script>/);
        if (tplMatch && tplMatch[1]) {
            try {
                // 处理 Unicode 转义
                const jsonStr = tplMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
                    return String.fromCharCode(parseInt(grp, 16));
                });
                tplData = eval('(' + jsonStr + ')');
            } catch (e) {
                console.error('Failed to parse tplData:', e);
            }
        }
        
        // 匹配 window.modifyData = {...};
        const modifyMatch = html.match(/window\.modifyData\s*=\s*({[\s\S]*?});\s*<\/script>/);
        if (modifyMatch && modifyMatch[1]) {
            try {
                const jsonStr = modifyMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
                    return String.fromCharCode(parseInt(grp, 16));
                });
                modifyData = eval('(' + jsonStr + ')');
            } catch (e) {
                console.error('Failed to parse modifyData:', e);
            }
        }
        
        // 优先使用 modifyData 中的数据
        const data = modifyData || tplData;
        if (!data) {
            console.error('No weather data found');
            return null;
        }
        
        // 获取小时预报
        let hourlyForecast = null;
        if (data['24_hour_forecast'] && data['24_hour_forecast'].info) {
            hourlyForecast = data['24_hour_forecast'].info;
        } else if (tplData && tplData['24_hour_forecast'] && tplData['24_hour_forecast'].info) {
            hourlyForecast = tplData['24_hour_forecast'].info;
        }
        
        // 获取天数预报
        let dailyForecast = null;
        if (data.long_day_forecast && data.long_day_forecast.info) {
            dailyForecast = data.long_day_forecast.info;
        } else if (tplData && tplData.long_day_forecast && tplData.long_day_forecast.info) {
            dailyForecast = tplData.long_day_forecast.info;
        }
        
        // 获取更新时间
        let updateTime = null;
        if (data['24_hour_forecast'] && data['24_hour_forecast'].update_time) {
            updateTime = data['24_hour_forecast'].update_time;
        } else if (data.long_day_forecast && data.long_day_forecast.update_time) {
            updateTime = data.long_day_forecast.update_time;
        } else if (data.weather && data.weather.update_time) {
            updateTime = data.weather.update_time;
        }
        
        // 获取当前天气
        let currentWeather = null;
        if (data.weather) {
            currentWeather = {
                temperature: data.weather.temperature,
                weather: data.weather.weather,
                humidity: data.weather.humidity,
                wind_direction: data.weather.wind_direction,
                wind_power: data.weather.wind_power
            };
        }
        
        return {
            hourlyForecast: hourlyForecast || [],
            dailyForecast: dailyForecast || [],
            updateTime: updateTime,
            currentWeather: currentWeather,
            position: data.position
        };
        
    } catch (error) {
        console.error('Error parsing weather data:', error);
        return null;
    }
}

export default getWeatherData;