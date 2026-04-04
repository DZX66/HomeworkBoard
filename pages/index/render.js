function test() {
    return api.version;
}

let subjects = null;
let content = null;
let contentTmp = null;
let config = null;
let lastTime = null;
let msgHistory = [];
let imageLayout = 'column'; // 'column' 或 'row'
let unsaved = false;
let weatherData = null;
let weatherCard = null;
let hasReceivedWeatherData = false;

function setUnsaved(value) {
    unsaved = value;
    api.setUnsaved(value);
    document.title = config.title + (unsaved ? " *" : "");
}

api.setRenderUnsaved((value) => {
    unsaved = value;
    document.title = config.title + (unsaved ? " *" : "");
});

// 模块化编辑对话框
const EditDialog = (() => {
    let dialogElement = null;

    const createDialog = (currentValue) => {
        const dialog = document.createElement('div');
        dialog.id = 'edit-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>修改标题</h3>
                <input type="text" id="edit-input" value="${currentValue}">
                <div class="dialog-buttons">
                    <button id="dialog-reset">重置</button>
                    <button id="dialog-confirm">确定</button>
                    <button id="dialog-cancel">取消</button>
                </div>
            </div>
        `;
        return dialog;
    };

    return {
        show: (currentValue, defaultValue, callback) => {
            if (dialogElement) return;

            dialogElement = createDialog(currentValue);
            document.body.appendChild(dialogElement);

            // 添加动画
            setTimeout(() => {
                dialogElement.classList.add('show');
            }, 10);


            // 修改点1：使用箭头函数
            const handleConfirm = () => {
                const newValue = document.getElementById('edit-input').value;
                callback(newValue);
                EditDialog.hide(); // 修改点2：直接通过模块名调用
            };

            // 修改点3：添加遮罩层点击关闭
            const handleBackgroundClick = (e) => {
                if (e.target === dialogElement) EditDialog.hide();
            };

            dialogElement.addEventListener('click', handleBackgroundClick);
            dialogElement.querySelector('#dialog-confirm')
                .addEventListener('click', handleConfirm);
            dialogElement.querySelector('#dialog-cancel')
                .addEventListener('click', EditDialog.hide); // 修改点4
            dialogElement.querySelector('#dialog-reset')
                .addEventListener('click', EditDialog.reset.bind(null, defaultValue));
        },

        hide: () => {
            if (dialogElement) {
                dialogElement.classList.remove('show');
                // 等待动画完成再移除元素
                setTimeout(() => {
                    dialogElement.remove();
                    dialogElement = null;
                }, 300);
            }
        },
        reset: (defaultValue) => {
            if (dialogElement) {
                dialogElement.querySelector('#edit-input').value = defaultValue;
            }
        }
    };
})();

api.config((_config) => {
    subjects = _config.subjects;
    document.getElementById('caption').innerHTML = _config.caption;
    document.getElementById('title').innerHTML = _config.title;
    zoomLevel = _config.zoom;
    updateZoom();

    var style = document.createElement('style');
    document.head.appendChild(style);
    style.innerHTML = _config.style;

    config = _config;

    // 初始化数据结构
    content = subjects.map(() => []); // 每个科目初始化一个空任务

    // 获取容器并清空现有内容
    const container = document.querySelector('.right-panel > ol');
    container.innerHTML = '';

    // 动态生成科目列表
    subjects.forEach((subject, index) => {
        const subjectItem = document.createElement('li');
        subjectItem.className = 'subject-item';

        // 科目标签
        const label = document.createElement('label');
        label.className = 'subject-label';
        label.textContent = subject;
        label.htmlFor = "subject-" + index;

        // 任务列表
        const taskList = document.createElement('ol');
        taskList.className = 'tasks-list';

        // 组装元素
        subjectItem.append(label, taskList);
        container.appendChild(subjectItem);
    });

    api.contentTmp((value) => {
        if (value) {
            // 应用临时数据
            console.log("加载临时数据:", value);
            value.forEach((subjectTasks, index) => {
                const taskList = document.querySelectorAll('.tasks-list')[index];
                if (!taskList) return;

                // 清空现有任务项
                taskList.innerHTML = '';
                content[index] = [];

                // 重新创建所有任务项
                subjectTasks.forEach((taskText, taskIndex) => {
                    const node = createLine(index, taskIndex);
                    const textarea = node.querySelector('textarea');

                    // 填充内容并更新状态
                    textarea.value = taskText;
                    content[index][taskIndex] = taskText;

                    // 触发初始调整
                    autoResize(textarea);
                    taskList.appendChild(node);
                });
            });
        } else {
            document.querySelectorAll('.tasks-list').forEach((taskList, index) => {
                let node = createLine(index);
                taskList.appendChild(node);
            });
        }

        // 初始化自动调整
        setTimeout(() => {
            // 初始化逻辑
            document.querySelectorAll('textarea').forEach(textarea => {
                // 立即执行一次自动调整
                autoResize(textarea);
            });

            // 优化后的resize监听
            window.addEventListener('resize', () => {
                document.querySelectorAll('textarea').forEach(autoResize);
            });
        }, 0);

    });
    // 初始化图片卡片
    if (config.imageEnable) {
        let imagePaths = config.imagePaths;
        renderImageCard(imagePaths || []);
    } else {
        document.getElementById('image-card').style.display = 'none';
    }

    if (config.weatherEnable) {
        initWeatherCard();
        api.onWeatherData(handleWeatherData);
        // 请求初始天气数据（主进程会自动获取，但为了确保，可以手动请求一次）
        setTimeout(() => api.refreshWeather(), 500);
    } else {
        const weatherCard = document.querySelector('.weather-card');
        if (weatherCard) weatherCard.style.display = 'none';
    }
});

/**
 * 
 * @param {HTMLElement} textarea 
 * @returns 
 */
function getCursorPosition(textarea) {
    const start = textarea.selectionStart;
    const value = textarea.value;
    const tempDiv = document.createElement('div');
    const styles = window.getComputedStyle(textarea);

    // 复制样式
    tempDiv.style.whiteSpace = 'pre-wrap';
    tempDiv.style.wordWrap = 'break-word';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = textarea.getBoundingClientRect().left + 'px';
    tempDiv.style.top = textarea.getBoundingClientRect().top + 'px';

    // 复制所有影响布局的样式
    [
        'font', 'fontSize', 'fontFamily', 'lineHeight',
        'padding', 'margin', 'border', 'width', 'height'
    ].forEach(prop => {
        tempDiv.style[prop] = styles[prop];
    });

    // 模拟内容
    const text = value.substring(0, start);
    tempDiv.textContent = text.replace(/\n/g, '\n') + ''; // 添加字符确保光标位置

    document.body.appendChild(tempDiv);

    const span = document.createElement('span');
    span.textContent = '‍'; // 占位字符（零宽字符）
    tempDiv.appendChild(span);

    const rect = span.getBoundingClientRect();
    document.body.removeChild(tempDiv);

    return {
        left: rect.right,  // 光标右侧
        top: rect.top,
        height: rect.height,
        bottom: rect.bottom
    };
}


// 改进版自动高度调整
function autoResize(textarea) {
    // 重置高度后获取精确高度
    textarea.style.height = 'auto';

    // 获取计算样式
    const computed = window.getComputedStyle(textarea);

    // 计算单行高度（包含padding）
    const lineHeight = parseInt(computed.lineHeight);
    const padding = parseInt(computed.paddingTop) + parseInt(computed.paddingBottom);

    // 设置最小高度为单行高度
    textarea.style.minHeight = `${lineHeight + padding}px`;

    // 精确设置高度（scrollHeight已包含padding）
    textarea.style.height = `${Math.max(textarea.scrollHeight, lineHeight + padding)}px`;
}

function createLineDOM(index, nodeI) {
    let node = document.createElement('li');
    let textarea = document.createElement('textarea');

    node.i = nodeI;
    if (nodeI == 0) { textarea.id = "subject-" + index; }
    // textarea.addEventListener('keydown', (event) => {
    // if (event.key === '(') {
    //     event.preventDefault();
    //     // 手动插入字符
    //     const start = textarea.selectionStart;
    //     const end = textarea.selectionEnd;
    //     textarea.value = textarea.value.substring(0, start) + '(' + 
    //                     textarea.value.substring(end);
    //     textarea.selectionStart = textarea.selectionEnd = start + 1;
    // }
    // });
    textarea.addEventListener('input', (e) => {
        content[index][node.i] = textarea.value;
        setUnsaved(true); // 设置为未保存状态
        // 检测中文左括号
        const cursorPos = textarea.selectionStart;
        if (cursorPos > 0 && textarea.value[cursorPos - 1] === "（") {
            triggerCoplit(index, node, "（");
        }
        triggerCoplit(index, node);
    });
    textarea.addEventListener('compositionend', (e) => {
        if (e.data === "（") {
            triggerCoplit(index, node, "（");
        }
    });
    textarea.addEventListener('keydown', (e) => {
        if (e.key == 'Enter') {
            e.preventDefault();
            if (textarea.value.trim() != "") {
                let new_node = createLine(index, node.i + 1);
                node.insertAdjacentElement('afterend', new_node);
                new_node.children[0].focus();
            }
        } else if (e.key == 'Backspace' && textarea.value == "" && content[index].length > 1) {
            e.preventDefault();
            let prev_node = node.previousSibling;
            if (prev_node) {
                prev_node.children[0].focus();
            } else {
                node.nextElementSibling.children[0].focus();
            }
            node.remove();
            content[index].splice(node.i, 1);
            const event = new CustomEvent('delete', { detail: { index: index, i: node.i } });
            document.dispatchEvent(event);
        } else if (e.key == ' ' && textarea.value == "") {
            e.preventDefault();
        }
    });
    textarea.addEventListener('focus', () => {
        triggerCoplit(index, node);
    });
    textarea.addEventListener('blur', () => {
        if (textarea.value.trim() === "" && content[index].length > 1) {
            node.remove();
            content[index].splice(node.i, 1);
            const event = new CustomEvent('delete', { detail: { index: index, i: node.i } });
            document.dispatchEvent(event);
        }
        hideCoplit();
    });
    textarea.addEventListener('input', () => autoResize(textarea));
    textarea.addEventListener('compositionupdate', () => autoResize(textarea));
    document.addEventListener('insert', (e) => {
        if (e.detail.index == index && e.detail.insert < node.i) {
            node.i++;
        }
    });

    document.addEventListener('delete', (e) => {
        if (e.detail.index == index && e.detail.i < node.i) {
            node.i--;
        }
    });
    textarea.rows = 1;
    node.appendChild(textarea);
    return node;
}


function createLine(index, insert = -1) {
    if (insert == -1) {
        var nodeI = content[index].length;
        content[index].push("");
    } else {
        var nodeI = insert;
        content[index].splice(insert, 0, "");
        const event = new CustomEvent('insert', { detail: { index: index, insert: insert } });
        document.dispatchEvent(event);
    }
    let node = createLineDOM(index, nodeI);
    return node;
}

var coplit = null;

function generateCoplit(options, rect) {
    if (options.length > 0) {
        const coplit = document.createElement('div');
        coplit.className = 'coplit-container';

        options.forEach(opt => {
            const optionItem = document.createElement('div');
            optionItem.className = 'coplit-option';
            const tip = document.createElement('div');
            tip.className = 'coplit-hint';
            tip.textContent = opt.label;
            const apply_hint = document.createElement('div');
            apply_hint.className = 'coplit-apply-hint';
            apply_hint.textContent = opt.hint;
            optionItem.addEventListener('click', opt.handler);
            optionItem.addEventListener("mousedown", (e) => e.preventDefault());
            optionItem.appendChild(tip);
            optionItem.appendChild(apply_hint);
            coplit.appendChild(optionItem);
        });

        // 定位逻辑
        coplit.style.position = 'fixed';
        coplit.style.left = `${rect.left}px`;
        if (rect.bottom + coplit.offsetHeight + 5 > window.innerHeight / 2) {
            coplit.style.bottom = `${window.innerHeight - rect.top + 5}px`; // 向上定位
        } else {
            coplit.style.top = `${rect.bottom + 5}px`; // 向下定位
        }
        // 边界检测（防止超出屏幕）
        document.body.appendChild(coplit);
        const rightEdge = rect.left + coplit.offsetWidth;
        if (rightEdge > window.innerWidth) {
            coplit.style.left = `${window.innerWidth - coplit.offsetWidth - 5}px`;
        }

        return coplit;
    }
}

/**
 * @param {number} index 
 * @param {HTMLElement} node 
 * @param {string} key
 */
function triggerCoplit(index, node, key) {
    hideCoplit(); // 先清除旧的coplit

    const textarea = node.querySelector('textarea');

    let options = [];
    if (key === "（") {
        // 中文括号触发选项
        options.push(
            {
                label: "（交）",
                hint: "点击插入",
                handler: () => {
                    const cursorPos = textarea.selectionStart;
                    const text = textarea.value;
                    // 在光标位置插入，替换最后的左括号
                    textarea.value = text.slice(0, cursorPos - 1) + "（交）" + text.slice(cursorPos);
                    // 移动光标到插入内容后
                    textarea.selectionStart = textarea.selectionEnd = cursorPos + 2;
                    autoResize(textarea);
                    hideCoplit();
                    content[index][node.i] = textarea.value;
                    setUnsaved(true); // 设置为未保存状态
                }
            },
            {
                label: "（不交）",
                hint: "点击插入",
                handler: () => {
                    const cursorPos = textarea.selectionStart;
                    const text = textarea.value;
                    textarea.value = text.slice(0, cursorPos - 1) + "（不交）" + text.slice(cursorPos);
                    textarea.selectionStart = textarea.selectionEnd = cursorPos + 3;
                    autoResize(textarea);
                    hideCoplit();
                    content[index][node.i] = textarea.value;
                    setUnsaved(true); // 设置为未保存状态
                }
            }
        );

    }
    if (content[index].length === 1 && textarea.value === "") {
        // 原有历史记录逻辑
        if (lastTime && lastTime[index][0]) {
            options.push({
                label: lastTime[index][0] + (lastTime[index].length > 1 ? "..." : ""),
                hint: "点击应用上一次",
                handler: () => {
                    // 原有历史记录应用逻辑
                    const historyTasks = lastTime[index];
                    const taskList = document.querySelectorAll('.tasks-list')[index];
                    taskList.innerHTML = '';
                    content[index] = [];
                    historyTasks.forEach((taskText, taskIndex) => {
                        const node = createLine(index, taskIndex);
                        const textarea = node.querySelector('textarea');
                        textarea.value = taskText;
                        content[index][taskIndex] = taskText;
                        taskList.appendChild(node);
                        autoResize(textarea);
                    });
                    hideCoplit();
                    setUnsaved(true); // 设置为未保存状态
                }
            });
        }
    }
    if (textarea.value == "") {
        // 模板功能
        if (config.templates[config.subjects[index]] && config.templates[config.subjects[index]].length > 0) {
            config.templates[config.subjects[index]].forEach(template => {
                options.push({
                    label: template,
                    hint: "点击应用模板",
                    handler: () => {
                        textarea.value = template;
                        autoResize(textarea);
                        hideCoplit();
                        content[index][node.i] = template;
                        setUnsaved(true); // 设置为未保存状态
                    }
                });
            });
        }
    }
    coplit = generateCoplit(options, getCursorPosition(textarea));

}

function hideCoplit() {
    if (coplit) {
        coplit.remove();
        coplit = null;
    }
}

api.lastTime((value) => {
    lastTime = value;
});

api.save(() => {
    api.saveRes(content);
});

api.saveTmp(() => {
    api.saveTmpRes(content);
});

api.clear(() => {
    contentTmp = content.map(subArr => [...subArr]);
    content = subjects.map(() => []);
    const container = document.querySelector('.right-panel > ol');
    container.innerHTML = '';
    subjects.forEach((subject, index) => {
        const subjectItem = document.createElement('li');
        subjectItem.className = 'subject-item';

        // 科目标签
        const label = document.createElement('label');
        label.className = 'subject-label';
        label.textContent = subject;
        label.htmlFor = "subject-" + index;

        // 任务列表
        const taskList = document.createElement('ol');
        taskList.className = 'tasks-list';

        const line = createLine(index);
        taskList.appendChild(line);

        // 组装元素
        subjectItem.append(label, taskList);
        container.appendChild(subjectItem);
        autoResize(line.querySelector('textarea'));
    });
});
api.undoClear(() => {
    if (contentTmp) {
        content = contentTmp.map(subArr => [...subArr]);
        contentTmp = null;

        // 清空现有DOM
        const container = document.querySelector('.right-panel > ol');
        container.innerHTML = '';

        // 重新创建科目和任务列表
        subjects.forEach((subject, index) => {
            const subjectItem = document.createElement('li');
            subjectItem.className = 'subject-item';

            // 科目标签
            const label = document.createElement('label');
            label.className = 'subject-label';
            label.textContent = subject;
            label.htmlFor = "subject-" + index;

            // 任务列表
            const taskList = document.createElement('ol');
            taskList.className = 'tasks-list';

            // 组装元素
            subjectItem.append(label, taskList);
            container.appendChild(subjectItem);

            // 重新填充任务项
            content[index].forEach((taskText, taskIndex) => {
                const node = createLineDOM(index, taskIndex);
                const textarea = node.querySelector('textarea');
                textarea.value = taskText;
                taskList.appendChild(node);
                autoResize(textarea);
            });
        });

    }
});


let zoomLevel = 1.0
const zoomStep = 0.05
const maxZoom = 2.0
const minZoom = 0.5

function updateZoom() {
    api.zoom(zoomLevel);
    document.getElementById('zoom-level').textContent =
        `${Math.round(zoomLevel * 100)}%`
}

document.getElementById('zoom-in').addEventListener('click', () => {
    if (zoomLevel < maxZoom) {
        zoomLevel += zoomStep
        updateZoom()
    }
})

document.getElementById('zoom-out').addEventListener('click', () => {
    if (zoomLevel > minZoom) {
        zoomLevel -= zoomStep
        updateZoom()
    }
})

api.message((message) => {
    let time = new Date();
    let msg = "[" + time.getHours() + ":" + (time.getMinutes() < 10 ? "0" : "") + time.getMinutes() + "]" + message;
    document.getElementById('message').textContent = msg;
    msgHistory.push(msg);
    if (msgHistory.length > 10) {
        msgHistory.shift();
    }
})

function save() {
    api.saveRes(content);
}

api.save(save);

window.addEventListener('load', () => {
    document.getElementById('container').classList.remove('hidden');
});

// 显示当前时间
var time = new Date();
document.getElementById('time').innerHTML = "今天是" + (time.getMonth() + 1) + "月" + time.getDate() + "日 ";

function openCaptionEdit() {
    const currentCaption = document.getElementById('caption').textContent;

    EditDialog.show(currentCaption, "晚自习作业清单", (newCaption) => {
        if (newCaption && newCaption.trim() !== '') {
            // 更新本地配置
            config.caption = newCaption.trim();
            // 更新界面
            document.getElementById('caption').textContent = newCaption.trim();
            // 通知主进程保存配置
            api.captionEdit(config.caption);
        }
    });
}

document.getElementById('caption').addEventListener('click', openCaptionEdit);

api.editCaption(() => {
    openCaptionEdit();
});


// 添加历史记录窗口功能
const historyWindow = document.getElementById('history-window');
const historyList = document.getElementById('history-list');

// 点击消息显示历史记录
document.getElementById('message').addEventListener('click', function (e) {
    e.stopPropagation();

    // 填充历史记录
    historyList.innerHTML = '';
    msgHistory.forEach(msg => {
        const li = document.createElement('li');
        li.textContent = msg;
        historyList.appendChild(li);
    });

    // 显示窗口
    historyWindow.classList.add('show');
});

// 点击其他地方关闭历史记录窗口
document.addEventListener('click', function (e) {
    if (historyWindow.classList.contains('show') &&
        !historyWindow.contains(e.target) &&
        e.target.id !== 'message') {
        historyWindow.classList.remove('show');
    }
});

// 防止点击历史窗口内部时关闭
historyWindow.addEventListener('click', function (e) {
    e.stopPropagation();
});

api.loadTemplates((templates) => {
    config.templates = templates;
});

// ==================== 新增：自定义确认对话框模块 ====================
const ConfirmDialog = (() => {
    let dialogElement = null;
    let callback = null;

    const createDialog = (message) => {
        const dialog = document.createElement('div');
        dialog.id = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>确认删除</h3>
                <p>${message}</p>
                <div class="dialog-buttons">
                    <button id="dialog-confirm-delete">确认</button>
                    <button id="dialog-cancel-delete">取消</button>
                </div>
            </div>
        `;
        return dialog;
    };

    return {
        show: (message, onConfirm) => {
            if (dialogElement) return;
            callback = onConfirm;
            dialogElement = createDialog(message);
            document.body.appendChild(dialogElement);
            setTimeout(() => dialogElement.classList.add('show'), 10);

            const handleConfirm = () => {
                if (callback) callback();
                ConfirmDialog.hide();
            };
            const handleCancel = () => ConfirmDialog.hide();
            const handleBackgroundClick = (e) => {
                if (e.target === dialogElement) ConfirmDialog.hide();
            };

            dialogElement.addEventListener('click', handleBackgroundClick);
            dialogElement.querySelector('#dialog-confirm-delete').addEventListener('click', handleConfirm);
            dialogElement.querySelector('#dialog-cancel-delete').addEventListener('click', handleCancel);
        },
        hide: () => {
            if (dialogElement) {
                dialogElement.classList.remove('show');
                setTimeout(() => {
                    dialogElement.remove();
                    dialogElement = null;
                    callback = null;
                }, 300);
            }
        }
    };
})();

function renderImageCard(imagePaths) {
    const imageCard = document.getElementById('image-card');
    if (!imageCard) return;

    imageCard.innerHTML = ''; // 清空

    const paths = imagePaths || [];

    // 创建工具栏
    const toolbar = document.createElement('div');
    toolbar.className = 'image-toolbar';

    // 添加图片按钮
    const addBtn = document.createElement('button');
    addBtn.textContent = '添加图片';
    addBtn.className = 'add-image-btn';
    addBtn.addEventListener('click', async () => {
        const path = await api.selectImage();
        if (path) {
            const newPaths = [...paths, path];
            config.imagePaths = newPaths;
            api.updateImagePaths(newPaths);
            renderImageCard(newPaths);
        }
    });

    // 删除所有图片按钮
    const deleteAllBtn = document.createElement('button');
    deleteAllBtn.textContent = '🗑️';
    deleteAllBtn.className = 'delete-all-btn';
    deleteAllBtn.title = '删除所有图片';
    deleteAllBtn.addEventListener('click', () => {
        ConfirmDialog.show('确定要删除所有图片吗？', () => {
            config.imagePaths = [];
            api.updateImagePaths([]);
            renderImageCard([]);
        });
    });

    // 高度显示
    const heightLabel = document.createElement('span');

    // 图片高度调整滑动条
    const heightSlider = document.createElement('input');
    heightSlider.type = 'range';
    heightSlider.min = 100;
    heightSlider.max = 1400;
    heightSlider.step = 50;
    heightSlider.value = config.imageMaxHeight || 400;
    heightSlider.title = `图片高度: ${heightSlider.value}px`;
    heightSlider.addEventListener('input', () => {
        heightSlider.title = `图片高度: ${heightSlider.value}px`;
        heightLabel.textContent = `图片高度: ${heightSlider.value}px`;
    });
    heightSlider.addEventListener('input', () => {
        config.imageMaxHeight = parseInt(heightSlider.value, 10);
        api.updateImageConfig({ imageMaxHeight: config.imageMaxHeight });
        renderImageCard(config.imagePaths || []);
    });

    // 高度显示
    heightLabel.textContent = `图片最大高度: ${heightSlider.value}px`;

    // 列数切换按钮组
    const columnGroup = document.createElement('div');
    columnGroup.className = 'layout-toggle-group';

    [1, 2, 3, 4].forEach((columns) => {
        const btn = document.createElement('button');
        btn.className = 'layout-toggle-btn';
        btn.textContent = '⋮'.repeat(columns);
        btn.title = `切换到 ${columns} 列布局`;
        if (config.imageColumns === columns) btn.classList.add('active');
        btn.addEventListener('click', () => {
            if (config.imageColumns !== columns) {
                config.imageColumns = columns;
                api.updateImageConfig({ imageColumns: config.imageColumns });
                renderImageCard(config.imagePaths || []);
            }
        });
        columnGroup.appendChild(btn);
    });

    const rightControls = document.createElement('div');
    rightControls.className = 'right-controls';
    rightControls.appendChild(heightLabel);
    rightControls.appendChild(heightSlider);
    rightControls.appendChild(deleteAllBtn);

    toolbar.appendChild(addBtn);
    toolbar.appendChild(rightControls);
    toolbar.appendChild(columnGroup);

    // 图片列表容器
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'image-items-container';
    itemsContainer.style.gridTemplateColumns = `repeat(${config.imageColumns || 3}, 1fr)`;

    paths.forEach((path, index) => {
        const container = document.createElement('div');
        container.className = 'image-item';
        container.style.maxHeight = `${config.imageMaxHeight || 400}px`;

        const img = document.createElement('img');
        img.src = path;
        img.alt = `图片无法显示: ${path}`;
        img.addEventListener('click', () => {
            ConfirmDialog.show('确定要删除这张图片吗？', () => {
                const newPaths = paths.filter((_, i) => i !== index);
                config.imagePaths = newPaths;
                api.updateImagePaths(newPaths);
                renderImageCard(newPaths);
            });
        });

        container.appendChild(img);
        itemsContainer.appendChild(container);
    });

    imageCard.appendChild(toolbar);
    imageCard.appendChild(itemsContainer);
}

api.onAppVersion((version) => {
    document.getElementById('version').textContent = `v${version}`;
});

// ==================== 天气功能 ====================

function initWeatherCard() {
    const leftPanel = document.querySelector('.left-panel');
    if (!leftPanel) return;

    // 检查是否已存在
    if (document.querySelector('.weather-card')) return;

    weatherCard = document.createElement('div');
    weatherCard.className = 'info-card weather-card';
    weatherCard.innerHTML = `
        <div class="weather-loading">加载天气中...</div>
    `;
    leftPanel.appendChild(weatherCard);
}

function handleWeatherData(data) {
    if (!weatherCard) {
        initWeatherCard();
        weatherCard = document.querySelector('.weather-card');
    }

    if (data.error) {
        if (hasReceivedWeatherData) { return; } // 防止错误提示覆盖原有的天气信息
        weatherCard.innerHTML = `
            <div class="weather-error">
                天气加载失败<br>
                <small>${data.error}</small>
                <button class="weather-refresh-btn" onclick="api.refreshWeather()">重试</button>
            </div>
        `;
        return;
    }

    weatherData = data;
    renderWeatherCard(data);
    hasReceivedWeatherData = true;
}

function getWeatherIcon(weatherText, hour) {
    if (!weatherText) return '☁️';

    // 判断是否为夜间（19点至5点）
    const isNight = hour !== undefined && (hour >= 19 || hour <= 5);

    // 晴天：夜间显示月亮，白天显示太阳
    if (weatherText.includes('晴')) {
        if (isNight) {
            return '🌙'; // 月亮
        }
        return '☀️';
    }
    if (weatherText.includes('多云')) return '⛅';
    if (weatherText.includes('阴')) return '☁️';
    if (weatherText.includes('雷')) return '⛈️';
    if (weatherText.includes('雨')) return '🌧️';
    if (weatherText.includes('雪')) return '❄️';
    if (weatherText.includes('雾') || weatherText.includes('霾')) return '🌫️';
    return '🌡️';
}

function renderWeatherCard(data) {
    if (!weatherCard) return;

    const { hourlyForecast, dailyForecast, updateTime, currentWeather, position } = data;

    // 获取配置
    const forecastHours = config.weatherForecastHours || 8;
    const forecastDays = config.weatherForecastDays || 3;
    const skipMidnight = config.weatherSkipMidnightHours !== false;

    // 处理小时预报 - 修复分隔线逻辑
    let filteredHours = [];
    let skippedCount = 0;

    if (hourlyForecast && hourlyForecast.length > 0) {
        // 按时间排序
        const sorted = [...hourlyForecast].sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

        // 获取当前时间
        const now = new Date();
        const currentHour = now.getHours();

        // 第一步：过滤出从当前时间开始的未来小时
        let futureHours = [];
        let foundCurrent = false;
        for (const item of sorted) {
            const hourStr = item.hour;
            if (hourStr && hourStr.length >= 10) {
                const itemHour = parseInt(hourStr.substring(8, 10));
                if (!foundCurrent) {
                    if (itemHour >= currentHour) {
                        foundCurrent = true;
                    } else {
                        continue;
                    }
                }
                futureHours.push({
                    ...item,
                    hourNum: itemHour,
                    fullHour: hourStr
                });
            }
        }

        // 第二步：按顺序处理，标记跳过的夜间时段，并记录需要插入分隔线的位置
        let tempHours = [];
        let lastWasSkipped = false;
        let insertDividerBeforeNext = false;
        
        for (let i = 0; i < futureHours.length && tempHours.length < forecastHours; i++) {
            const item = futureHours[i];
            const itemHour = item.hourNum;
            const isMidnight = (itemHour >= 23 || itemHour <= 5);
            
            if (skipMidnight && isMidnight) {
                skippedCount++;
                // 如果之前有未跳过的时段，标记需要在下一个未跳过的时段前插入分隔线
                if (tempHours.length > 0 && !lastWasSkipped) {
                    insertDividerBeforeNext = true;
                }
                lastWasSkipped = true;
                continue;
            }
            
            // 如果不是夜间时段
            if (insertDividerBeforeNext) {
                // 为这个时段标记需要前面插入分隔线
                tempHours.push({
                    ...item,
                    hourNum: itemHour,
                    fullHour: item.fullHour || item.hour,
                    showDividerBefore: true
                });
                insertDividerBeforeNext = false;
            } else {
                tempHours.push({
                    ...item,
                    hourNum: itemHour,
                    fullHour: item.fullHour || item.hour,
                    showDividerBefore: false
                });
            }
            lastWasSkipped = false;
        }
        
        filteredHours = tempHours;
    }

    // 处理天数预报
    let filteredDays = [];
    if (dailyForecast && dailyForecast.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const sortedDays = [...dailyForecast].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let foundToday = false;
        for (const day of sortedDays) {
            if (!foundToday) {
                if (day.date === today) {
                    foundToday = true;
                } else {
                    continue;
                }
            }
            filteredDays.push(day);
            if (filteredDays.length >= forecastDays) break;
        }
    }

    // 构建HTML
    const formatTime = (timeStr) => {
        if (!timeStr) return '未知';
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return timeStr.substring(11, 16);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const getWeekday = (dateStr) => {
        const date = new Date(dateStr);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[date.getDay()];
    };

    // 构建小时预报HTML
    let hourlyHtml = '';
    if (filteredHours.length > 0) {
        hourlyHtml = `
            <div class="weather-hourly-section">
                <div class="weather-section-title">⏰ 小时预报</div>
                <div class="weather-hourly-list">
                    ${filteredHours.map((item, idx) => {
            const hourStr = item.fullHour;
            let timeLabel = '';
            if (hourStr && hourStr.length >= 10) {
                const h = parseInt(hourStr.substring(8, 10));
                timeLabel = `${h.toString().padStart(2, '0')}:00`;
            }
            const temp = item.temperature || '--';
            const precipProb = item.precipitation_probability !== undefined ? item.precipitation_probability :
                (item.precipitation && item.precipitation !== '0.0' ? '--' : '0');
            const weather = item.weather || '';
            const itemHour = item.hourNum;
            
            // 根据标记决定是否显示分隔线
            const dividerHtml = item.showDividerBefore ? `<div class="hourly-divider"></div>` : '';
            
            return `
                            ${dividerHtml}
                            <div class="hourly-item">
                                <div class="hourly-time">${timeLabel}</div>
                                <div class="hourly-icon">${getWeatherIcon(weather, itemHour)}</div>
                                <div class="hourly-temp">${temp}°</div>
                                <div class="hourly-precip">${precipProb}%</div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    } else if (skippedCount > 0 && filteredHours.length === 0) {
        hourlyHtml = `<div class="weather-hourly-section"><div class="weather-section-title">⏰ 小时预报</div><div class="weather-empty">夜间时段已隐藏</div></div>`;
    } else {
        hourlyHtml = `<div class="weather-hourly-section"><div class="weather-section-title">⏰ 小时预报</div><div class="weather-empty">暂无数据</div></div>`;
    }

    // 构建天数预报HTML
    let dailyHtml = '';
    if (filteredDays.length > 0) {
        dailyHtml = `
            <div class="weather-daily-section">
                <div class="weather-section-title">📅 天气预报</div>
                <div class="weather-daily-list">
                    ${filteredDays.map((day, index) => {
            const dateStr = day.date;
            const weekday = index === 0 ? '今天' : getWeekday(dateStr);
            const weatherDay = day.weather_day || day.weather || '';
            const tempDay = day.temperature_day || '--';
            const tempNight = day.temperature_night || '--';
            const tempRange = `${tempNight}°~${tempDay}°`;
            return `
                            <div class="daily-item">
                                <div class="daily-weekday">${weekday}</div>
                                <div class="daily-icon">${getWeatherIcon(weatherDay, 12)}</div>
                                <div class="daily-temp">${tempRange}</div>
                                <div class="daily-weather">${weatherDay}</div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    } else {
        dailyHtml = `<div class="weather-daily-section"><div class="weather-section-title">📅 天气预报</div><div class="weather-empty">暂无数据</div></div>`;
    }

    // 底部栏HTML
    const updateTimeStr = updateTime ? formatTime(updateTime) : '未知';
    const locationName = position && position.city ? position.city : '';

    const now = new Date();
    const currentHour = now.getHours();
    const isNightNow = currentHour >= 20 || currentHour <= 5;

    // 构建整体HTML
    weatherCard.innerHTML = `
        <div class="weather-current" style="display: ${currentWeather ? 'block' : 'none'}">
            ${currentWeather ? `
                <div class="weather-location">${locationName}</div>
                <div class="weather-main">
                    <div class="weather-temp">${currentWeather.temperature || '--'}°</div>
                    <div class="weather-info">
                        <div class="weather-desc-item">
                            <span class="weather-icon ${isNightNow && currentWeather.weather && currentWeather.weather.includes('晴') ? 'night-clear-icon' : ''}">${getWeatherIcon(currentWeather.weather, currentHour)}</span>
                            <span>${currentWeather.weather || ''}</span>
                        </div>
                        <div class="weather-humidity-item">
                            <span>💧</span> ${currentWeather.humidity || '--'}%
                        </div>
                        <div class="weather-wind-item">
                            <span>💨</span> ${currentWeather.wind_direction || ''} ${currentWeather.wind_power || ''}
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
        ${hourlyHtml}
        ${dailyHtml}
        <div class="weather-footer">
            <div class="weather-update-info">
                <span class="weather-update-time">🕐 ${updateTimeStr}更新</span>
                <button class="weather-refresh-btn" id="weather-refresh-btn">🔄</button>
            </div>
            <div class="weather-more-btn" id="weather-more-btn">⋮</div>
        </div>
    `;

    // 绑定事件
    const refreshBtn = weatherCard.querySelector('#weather-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            api.refreshWeather();
        });
    }

    const moreBtn = weatherCard.querySelector('#weather-more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', () => {
            api.openWeatherBrowser(config.weatherOpenBrowserURL);
        });
    }
}