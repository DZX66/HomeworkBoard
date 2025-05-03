import { app, BrowserWindow, ipcMain, Menu, clipboard, dialog } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import pkg from 'sqlite3';

const { verbose } = pkg;
const sqlite3 = verbose();
const store = new Store();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEBUG = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当有第二个实例被运行时，激活之前的实例并将焦点置于其窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (DEBUG) {
    store.clear();
    fs.unlink(path.join(app.getPath('userData'), 'history.db'), (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log('history.db deleted');
      }
    });
  }

  // 新建sql
  if (!fs.existsSync(path.join(__dirname, 'history.db'))) {
    const dbPath = path.join(app.getPath('userData'), 'history.db');
    var db = new sqlite3.Database(dbPath);

    // 初始化数据库表
    db.serialize(() => {
      // 创建历史记录表
      db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    content TEXT NOT NULL,
    subjects TEXT NOT NULL
  )`);
    });
  }

  // 全局变量
  let mainWindow = null;
  let config = store.get('config');
  // 检查config合法性
  if (!config || !Array.isArray(config.subjects) || !config.title || !config.caption || !Array.isArray(config.saveTime) || !config.zoom || !config.autoSaveGap) {
    console.warn("config非法或缺失，已重置为默认配置");
    config = {
      subjects: ["语文", "数学", "英语", "物理", "化学", "生物", "政治", "历史", "地理", "信息", "通用"],
      title: "HomeworkBoard",
      caption: "晚自习作业清单",
      style: "",
      saveTime: [1220, 1300],
      zoom: 1,
      autoSaveGap: 10,
    };
    store.set('config', config);
  }


  let lastTime = store.get('lastTime');

  let contentTemp = store.get('contentTemp');

  function formatContent(content) {
    const formattedContent = config.subjects
      .map((subject, index) => {
        const tasks = content[index]
          .filter(task => task.trim()) // 过滤空任务
          .map((task, taskIndex) =>
            `${taskIndex + 1}.${task.replace(/[\n;]/g, ' ').trim()}` // 移除换行和分号
          );

        return tasks.length > 0
          ? `${subject}：${tasks.join('; ')};` // 添加分号结尾
          : null;
      })
      .filter(line => line !== null) // 过滤空科目
      .join('\n');
    return formattedContent;
  }


  // 定义菜单模板
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开用户目录',
          click: () => {
            const userPath = app.getPath('userData');
            exec(`start ${userPath}`);
          }
        },
        {
          label: '导出...',
          submenu: [
            {
              label: '复制到剪贴板',
              click: () => {
                mainWindow.webContents.send('saveTmp');
                ipcMain.once('saveTmpRes', (event, res) => {
                  clipboard.writeText(formatContent(res));
                  mainWindow.webContents.send('message', "已复制到剪贴板。");
                });
              }
            },
            {
              label: '保存为文件...',
              click: () => {
                mainWindow.webContents.send('saveTmp');
                ipcMain.once('saveTmpRes', (event, res) => {
                  const formattedContent = formatContent(res);
                  dialog.showSaveDialog(mainWindow, {
                    title: '保存作业清单',
                    defaultPath: `${config.caption}_${new Date().toISOString().slice(0, 10)}.txt`,
                    filters: [
                      { name: 'Text Files', extensions: ['txt'] },
                      { name: 'All Files', extensions: ['*'] }
                    ]
                  }).then(result => {
                    if (!result.canceled && result.filePath) {
                      fs.writeFile(result.filePath, formattedContent || '无作业内容', (err) => {
                        if (err) {
                          mainWindow.webContents.send('message', `保存失败: ${err.message}`);
                          console.error(err);
                        } else {
                          mainWindow.webContents.send('message', `已保存至 ${path.basename(result.filePath)}`);
                        }
                      });
                    }
                  }).catch(err => {
                    mainWindow.webContents.send('message', `保存失败: ${err.message}`);
                    console.error(err);
                  });
                });
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => app.quit() // 点击事件
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '清空', click: () => mainWindow.webContents.send('clear') },
      ]
    },
    {
      label: '查看',
      submenu: [
        {
          label: '历史记录', click: () => {
            var historyWindow = new BrowserWindow({
              width: 800,
              height: 600,
              show: false,
              parent: mainWindow,
              modal: true,
              maximizable: false,
              minimizable: false,
              resizable: false,
              autoHideMenuBar: true,
              webPreferences: {
                nodeIntegration: true,
                preload: path.resolve(__dirname, './preload.js'),
                spellcheck: false,
              }
            });
            historyWindow.loadFile('./pages/history/history.html');
            if (DEBUG) {
              historyWindow.webContents.openDevTools({ mode: 'bottom' });
            }
            historyWindow.once('ready-to-show', () => {
              historyWindow.show();
            });
            historyWindow.once('closed', () => {
              historyWindow = null;
            });
          }
        }
      ]
    }
  ];

  // 构建菜单
  const menu = Menu.buildFromTemplate(template);
  // 设置应用菜单
  Menu.setApplicationMenu(menu);


  function setupDailyTimer(targetMinute, callback) {
    const checkTime = () => {
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() === targetMinute) {
        callback();
      }
    };

    // 每分钟检查一次时间
    setInterval(checkTime, 60000);

    // 初始检查
    checkTime();
  }




  app.on('ready', () => {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        preload: path.resolve(__dirname, './preload.js'),
        spellcheck: false,
      }
    });
    mainWindow.maximize();
    mainWindow.once('ready-to-show', () => {
      mainWindow.webContents.send('config', config);
      if (lastTime) {
        mainWindow.webContents.send('lastTime', lastTime);
      }
      mainWindow.webContents.send('contentTmp', contentTemp);

      mainWindow.show();
    });

    mainWindow.loadFile('./pages/index/index.html');
    if (DEBUG) {
      mainWindow.webContents.openDevTools({ mode: 'bottom' });
    }




    mainWindow.once('close', (e) => {
      e.preventDefault();
      mainWindow.webContents.send('saveTmp');
      ipcMain.once("saveTmpRes", (event, res) => {
        console.log(res);
        store.set('contentTemp', res);
        store.set('config', config);
        app.quit();
      });
    });


    // 窗口关闭时关闭数据库连接
    mainWindow.on('closed', () => {
      db.close((err) => {
        if (err) console.error("关闭数据库连接失败:", err);
        else console.log("数据库连接已关闭");
      });
    });

    ipcMain.on('zoom', (event, zoom) => {
      mainWindow.webContents.setZoomFactor(zoom);
      config.zoom = zoom;
    });

    config.saveTime.forEach(element => {
      console.log("created timer for ", element);
      setupDailyTimer(element, () => {
        mainWindow.webContents.send('save');
      });
    });


    ipcMain.on("saveRes", (event, res) => {
      console.log(res);
      let previous = store.get('lastTime');
      if (previous) {
        if (previous.length === res.length) {
          for (let i = 0; i < res.length; i++) {
            if (res[i].length > 1 || res[i][0] != "") {
              previous[i] = res[i];
            }
          }
          store.set('lastTime', previous);
        } else {
          store.set('lastTime', res);
        }
      } else {
        store.set('lastTime', res);
      }

      // sql记录
      // 插入历史记录
      db.get(
        "SELECT id FROM history WHERE DATE(datetime(timestamp, '+8 hours')) = DATE('now', 'localtime') LIMIT 1",
        (err, row) => {
          if (err) {
            console.error("查询今日记录失败:", err);
            return;
          }
          if (row) {
            // 存在今日记录，执行UPDATE
            const updateStmt = db.prepare(
              "UPDATE history SET content = ?, subjects = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?"
            );
            updateStmt.run(
              JSON.stringify(res),
              JSON.stringify(config.subjects), // 新增科目配置
              row.id,
              function (updateErr) {
                if (updateErr) {
                  console.error("更新历史记录失败:", updateErr);
                } else {
                  console.log("历史记录已更新，ID:", row.id);
                }
                updateStmt.finalize();
              }
            );
          } else {
            // 不存在今日记录，执行INSERT
            const insertStmt = db.prepare(
              "INSERT INTO history (content, subjects) VALUES (?, ?)"
            );
            insertStmt.run(
              JSON.stringify(res),
              JSON.stringify(config.subjects), // 新增科目配置
              function (insertErr) {
                if (insertErr) {
                  console.error("插入历史记录失败:", insertErr);
                } else {
                  console.log("历史记录已插入，ID:", this.lastID);
                }
                insertStmt.finalize();
              }
            );
          }
        }
      );
      mainWindow.webContents.send('message', "今日已保存。");
      mainWindow.webContents.send('lastTime', store.get('lastTime'));
    });

    setInterval(() => {
      mainWindow.webContents.send('saveTmp');
      ipcMain.once("saveTmpRes", (event, res) => {
        console.log(res);
        store.set('contentTemp', res);
        mainWindow.webContents.send('message', "自动保存成功。");
      });
    }, config.autoSaveGap * 60 * 1000);

    ipcMain.on('captionEdit', (event, caption) => {
      config.caption = caption;
      store.set('config', config);
      mainWindow.webContents.send('message', "标题已修改。");
    });

    ipcMain.on('request-history', (event, { year, month }) => {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

      db.all(
        "SELECT strftime('%Y-%m-%d', datetime(timestamp, '+8 hours')) as date, content " +
        "FROM history " +
        "WHERE date BETWEEN ? AND ? " +
        "GROUP BY date",
        [startDate, endDate],
        (err, rows) => {
          if (err) {
            console.error('查询历史记录失败:', err);
            return;
          }

          const days = rows.map(r => r.date);
          event.reply('history-data', {
            days,
            records: rows.map(r => ({
              date: r.date,
              content: JSON.parse(r.content)
                .map((tasks, i) => tasks.length > 0 ?
                  `${config.subjects[i]}: ${tasks.join('; ')}` : '')
                .filter(Boolean).join('\n')
            }))
          });
        }
      );
    });

    ipcMain.on('request-day-detail', (event, date) => {
      db.get(
        "SELECT content FROM history " +
        "WHERE strftime('%Y-%m-%d', datetime(timestamp, '+8 hours')) = ? " +
        "ORDER BY timestamp DESC LIMIT 1",
        [date],
        (err, row) => {
          if (err || !row) {
            event.reply('day-detail', { date, content: '无记录' });
            return;
          }

          const content = JSON.parse(row.content)
            .map((tasks, i) => tasks.length > 0 ?
              `${config.subjects[i]}: ${tasks.join('; ')}` : '')
            .filter(Boolean).join('\n');

          event.reply('day-detail', { date, content });
        }
      );
    });
  });
}