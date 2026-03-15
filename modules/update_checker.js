import { app } from 'electron';
import axios from 'axios';
import semver from 'semver';

async function checkForUpdates(mainWindow) {
  try {
    console.log('Checking for updates...');
    const currentVersion = app.getVersion();
    
    // 调用 GitHub API 获取最新 release
    const response = await axios.get(
      'https://api.github.com/repos/DZX66/HomeworkBoard/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    const latestVersion = response.data.tag_name.replace('v', '');
    
    console.log(`currentVersion: ${currentVersion}, latestVersion: ${latestVersion}`);
    // 比较版本
    if (semver.gt(latestVersion, currentVersion)) {
      mainWindow.webContents.send('message', `有新版本 ${latestVersion} 可用。`);
      
    }
  } catch (error) {
      mainWindow.webContents.send('message', `检查版本出错：${error.message}`);
    console.error('check update error:', error);
  }
}

export default checkForUpdates;