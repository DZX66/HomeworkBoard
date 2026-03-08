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
    // 新增：初始化图片卡片
    let imagePaths = config.imagePaths;
    renderImageCard(imagePaths || []);
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
    textarea.addEventListener('input', (e) => {
        content[index][node.i] = textarea.value;
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

    // 高度显示
    const heightLabel = document.createElement('span');

    // 图片高度调整滑动条
    const heightSlider = document.createElement('input');
    heightSlider.type = 'range';
    heightSlider.min = 100;
    heightSlider.max = 1000;
    heightSlider.step = 50;
    heightSlider.value = config.imageMaxHeight || 400;
    heightSlider.title = `图片高度: ${heightSlider.value}px`;
    heightSlider.addEventListener('input', () => {
        heightSlider.title = `图片高度: ${heightSlider.value}px`;
        heightLabel.textContent = `图片高度: ${heightSlider.value}px`;
    });
    heightSlider.addEventListener('change', () => {
        config.imageMaxHeight = parseInt(heightSlider.value, 10);
        api.updateImageConfig({ imageMaxHeight: config.imageMaxHeight });
        renderImageCard(config.imagePaths || []);
    });

    // 高度显示
    heightLabel.textContent = `图片高度: ${heightSlider.value}px`;

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

    toolbar.appendChild(addBtn);
    toolbar.appendChild(heightSlider);
    toolbar.appendChild(heightLabel);
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
        img.alt = `图片${index + 1}`;
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