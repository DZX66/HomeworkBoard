import { app, BrowserWindow, ipcMain, Menu, clipboard, dialog } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import pkg from 'sqlite3';
import Config from './modules/config.js';

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


  // 全局变量
  /**
   * @type {BrowserWindow}
   */
  let mainWindow = null;
  let config = Config.init();
  let db = null;



  let lastTime = null;

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
        {
          label: '清空', click: () => {
            mainWindow.webContents.send('clear');
            Menu.getApplicationMenu().getMenuItemById("undoClear").enabled = true;
          }
        },
        {
          label: '撤销清空', click: () => {
            mainWindow.webContents.send('undoClear');
            Menu.getApplicationMenu().getMenuItemById("undoClear").enabled = false;
          }, enabled: false, id: "undoClear"
        },
        { type: 'separator' },
        { label: '修改标题...', click: () => mainWindow.webContents.send('editCaption') },
        {
          label: '编辑模板...', click: () => {
            let templateWindow = new BrowserWindow({
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

            templateWindow.loadFile('./pages/template/template.html');
            if (DEBUG) {
              templateWindow.webContents.openDevTools({ mode: 'bottom' });
            }

            templateWindow.once('ready-to-show', () => {
              // 发送当前模板数据到窗口
              templateWindow.webContents.send('init-templates', config);
              templateWindow.show();
            });

            // 监听模板保存事件
            ipcMain.on('save-templates', (event, templates) => {
              config.templates = templates;
              store.set('config', config);
              mainWindow.webContents.send('message', "模板已保存");
              mainWindow.webContents.send('load-templates', templates);
            });

            templateWindow.once('closed', () => {
              templateWindow = null;
              ipcMain.removeAllListeners('save-templates');
            });


          }
        },
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
    },
    {
      label: '关于',
      submenu: [
        {
          label: 'github',
          click: () => {
            exec(`start https://github.com/DZX66/HomeworkBoard`);
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
      backgroundColor: '#baf4cc',
      webPreferences: {
        nodeIntegration: true,
        preload: path.resolve(__dirname, './preload.js'),
        spellcheck: false,
      }
    });
    mainWindow.maximize();
    mainWindow.once('maximize', () => { mainWindow.show() });
    mainWindow.once('ready-to-show', () => {
      mainWindow.webContents.send('config', config);

      mainWindow.webContents.send('contentTmp', contentTemp);

      // mainWindow.show();

      lastTime = store.get('lastTime');
      if (lastTime) {
        mainWindow.webContents.send('lastTime', lastTime);
      }
      // 初始化数据库
      const dbPath = path.join(app.getPath('userData'), 'history.db');
      db = new sqlite3.Database(dbPath);

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

      if (DEBUG || config.debug) {
        mainWindow.webContents.openDevTools({ mode: 'bottom' });
      }

      config.saveTime.forEach(element => {
        console.log("created timer for ", element);
        setupDailyTimer(element, () => {
          mainWindow.webContents.send('save');
        });
      });


      setInterval(() => {
        mainWindow.webContents.send('saveTmp');
        ipcMain.once("saveTmpRes", (event, res) => {
          console.log(res);
          store.set('contentTemp', res);
          mainWindow.webContents.send('message', "自动保存成功。");
        });
      }, config.autoSaveGap * 60 * 1000);

    });

    mainWindow.loadFile('./pages/index/index.html');


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
        if (err) console.error("error closing database connection:", err);
        else console.log("database connection closed");
      });
    });

    ipcMain.on('zoom', (event, zoom) => {
      mainWindow.webContents.setZoomFactor(zoom);
      config.zoom = zoom;
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
            console.error("error selecting last history record:", err);
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
                  console.error("error updating history record:", updateErr);
                } else {
                  console.log("history record updated, ID:", row.id);
                }
                updateStmt.finalize();
              }
            );
            mainWindow.webContents.send('message', "今日已保存（覆盖）。");
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
                  console.error("error inserting history record:", insertErr);
                } else {
                  console.log("history record inserted, ID:", this.lastID);
                }
                insertStmt.finalize();
              }
            );
            mainWindow.webContents.send('message', "今日已保存。");
          }
        }
      );
      mainWindow.webContents.send('lastTime', store.get('lastTime'));
    });


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
            console.error('error selecting history records:', err);
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