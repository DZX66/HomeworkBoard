// 获取DOM元素
const titleInput = document.getElementById('title');
const captionInput = document.getElementById('caption');
const zoomInput = document.getElementById('zoom');
const autoSaveGapInput = document.getElementById('auto-save-gap');
const weatherEnableCheckbox = document.getElementById('weather-enable');
const weatherUrlInput = document.getElementById('weather-url');
const weatherRefreshGapInput = document.getElementById('weather-refresh-gap');
const weatherForecastDaysInput = document.getElementById('weather-forecast-days');
const weatherForecastHoursInput = document.getElementById('weather-forecast-hours');
const weatherSkipMidnightCheckbox = document.getElementById('weather-skip-midnight');
const weatherOpenBrowserUrlInput = document.getElementById('weather-open-browser-url');
const imageEnableCheckbox = document.getElementById('image-enable');
// 这些元素在 HTML 中被注释掉了，需要先检查是否存在
const imageColumnsInput = document.getElementById('image-columns');
const imageMaxHeightInput = document.getElementById('image-max-height');
const checkVersionCheckbox = document.getElementById('check-version');
const alwaysFillCheckbox = document.getElementById('always-fill');
const debugModeCheckbox = document.getElementById('debug-mode');

const subjectsList = document.getElementById('subjects-list');
const newSubjectInput = document.getElementById('new-subject');
const addSubjectBtn = document.getElementById('add-subject-btn');

const saveTimesList = document.getElementById('save-times-list');
const newSaveHour = document.getElementById('new-save-hour');
const newSaveMinute = document.getElementById('new-save-minute');
const addSaveTimeBtn = document.getElementById('add-save-time-btn');

// 这些元素在 HTML 中被注释掉了，需要先检查是否存在
const imagesList = document.getElementById('images-list');
const addImageBtn = document.getElementById('add-image-btn');
const clearImagesBtn = document.getElementById('clear-images-btn');

const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

// 存储当前配置
let currentConfig = null;
let subjects = [];
let saveTimes = [];
let imagePaths = [];

// 依赖项控制函数
function setupDependencies() {
    const weatherDependents = document.querySelectorAll('.weather-dependent');
    const imageDependents = document.querySelectorAll('.image-dependent');
    
    function updateWeatherDependents() {
        const enabled = weatherEnableCheckbox && weatherEnableCheckbox.checked;
        weatherDependents.forEach(el => {
            if (enabled) {
                el.classList.remove('disabled');
            } else {
                el.classList.add('disabled');
            }
        });
    }
    
    function updateImageDependents() {
        const enabled = imageEnableCheckbox && imageEnableCheckbox.checked;
        imageDependents.forEach(el => {
            if (enabled) {
                el.classList.remove('disabled');
            } else {
                el.classList.add('disabled');
            }
        });
    }
    
    if (weatherEnableCheckbox) {
        weatherEnableCheckbox.addEventListener('change', updateWeatherDependents);
    }
    if (imageEnableCheckbox) {
        imageEnableCheckbox.addEventListener('change', updateImageDependents);
    }
    
    updateWeatherDependents();
    updateImageDependents();
}

// 渲染学科列表
function renderSubjects() {
    if (!subjectsList) return;
    
    subjectsList.innerHTML = '';
    subjects.forEach((subject, index) => {
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.draggable = true;
        item.dataset.index = index;
        
        item.innerHTML = `
            <span class="subject-name">${escapeHtml(subject)}</span>
            <div class="subject-actions">
                <button class="edit-subject" data-index="${index}" title="编辑">✏️</button>
                <button class="delete-subject" data-index="${index}" title="删除">🗑️</button>
            </div>
        `;
        
        // 拖拽排序
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        
        subjectsList.appendChild(item);
    });
    
    // 绑定编辑和删除事件
    document.querySelectorAll('.edit-subject').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            const newName = prompt('请输入学科名称', subjects[index]);
            if (newName && newName.trim()) {
                subjects[index] = newName.trim();
                renderSubjects();
            }
        });
    });
    
    document.querySelectorAll('.delete-subject').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('确定要删除该学科吗？')) {
                subjects.splice(parseInt(btn.dataset.index), 1);
                renderSubjects();
            }
        });
    });
}

// 拖拽排序变量
let dragStartIndex = null;

function handleDragStart(e) {
    dragStartIndex = parseInt(e.target.closest('.subject-item').dataset.index);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    const targetItem = e.target.closest('.subject-item');
    if (!targetItem) return;
    const dragEndIndex = parseInt(targetItem.dataset.index);
    if (dragStartIndex === dragEndIndex) return;
    
    const [removed] = subjects.splice(dragStartIndex, 1);
    subjects.splice(dragEndIndex, 0, removed);
    renderSubjects();
}

// 渲染保存时间点
function renderSaveTimes() {
    if (!saveTimesList) return;
    
    saveTimesList.innerHTML = '';
    saveTimes.sort((a, b) => a - b).forEach(time => {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const tag = document.createElement('div');
        tag.className = 'save-time-tag';
        tag.innerHTML = `
            ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}
            <button class="remove-time" data-time="${time}">×</button>
        `;
        saveTimesList.appendChild(tag);
    });
    
    document.querySelectorAll('.remove-time').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const time = parseInt(btn.dataset.time);
            saveTimes = saveTimes.filter(t => t !== time);
            renderSaveTimes();
        });
    });
}

// 添加保存时间点
function addSaveTime() {
    if (!newSaveHour || !newSaveMinute) return;
    
    const hour = parseInt(newSaveHour.value);
    const minute = parseInt(newSaveMinute.value);
    
    if (isNaN(hour) || isNaN(minute)) {
        alert('请输入有效的小时和分钟');
        return;
    }
    
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        alert('小时范围0-23，分钟范围0-59');
        return;
    }
    
    const timeValue = hour * 60 + minute;
    if (!saveTimes.includes(timeValue)) {
        saveTimes.push(timeValue);
        renderSaveTimes();
    }
    
    newSaveHour.value = '';
    newSaveMinute.value = '';
}

// 渲染图片列表（仅在元素存在时执行）
function renderImages() {
    if (!imagesList) return;
    
    imagesList.innerHTML = '';
    imagePaths.forEach((path, index) => {
        const item = document.createElement('div');
        item.className = 'image-item';
        
        // 获取文件名
        const fileName = path.split(/[/\\]/).pop();
        
        item.innerHTML = `
            <img src="${escapeHtml(path)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'80\'%3E%3Crect width=\'100\' height=\'80\' fill=\'%23ddd\'/%3E%3Ctext x=\'50\' y=\'45\' text-anchor=\'middle\' fill=\'%23999\'%3E加载失败%3C/text%3E%3C/svg%3E'">
            <div class="image-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName.substring(0, 20))}</div>
            <button class="remove-image" data-index="${index}">×</button>
        `;
        imagesList.appendChild(item);
    });
    
    document.querySelectorAll('.remove-image').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const index = parseInt(btn.dataset.index);
            imagePaths.splice(index, 1);
            renderImages();
            // 更新配置中的图片路径
            if (window.api && window.api.updateImagePaths) {
                window.api.updateImagePaths(imagePaths);
            }
        });
    });
}

// 添加图片
async function addImage() {
    if (!window.api || !window.api.selectImage) {
        console.error('API not available');
        return;
    }
    
    const imagePath = await window.api.selectImage();
    if (imagePath) {
        imagePaths.push(imagePath);
        renderImages();
        // 更新配置中的图片路径
        if (window.api && window.api.updateImagePaths) {
            window.api.updateImagePaths(imagePaths);
        }
    }
}

// 清空所有图片
function clearImages() {
    if (confirm('确定要清空所有图片吗？')) {
        imagePaths = [];
        renderImages();
        if (window.api && window.api.updateImagePaths) {
            window.api.updateImagePaths(imagePaths);
        }
    }
}

// 转义HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 加载配置
function loadConfig(config) {
    currentConfig = config;
    
    if (titleInput) titleInput.value = config.title || 'HomeworkBoard';
    if (captionInput) captionInput.value = config.caption || '晚自习作业清单';
    if (zoomInput) zoomInput.value = config.zoom || 1;
    if (autoSaveGapInput) autoSaveGapInput.value = config.autoSaveGap || 10;
    
    subjects = config.subjects ? [...config.subjects] : ["语文", "数学", "英语"];
    renderSubjects();
    
    saveTimes = config.saveTime ? [...config.saveTime] : [1220, 1300];
    renderSaveTimes();
    
    if (weatherEnableCheckbox) weatherEnableCheckbox.checked = config.weatherEnable !== false;
    if (weatherUrlInput) weatherUrlInput.value = config.weatherDataURL || '';
    if (weatherRefreshGapInput) weatherRefreshGapInput.value = config.weatherAutoRefreshGap || 5;
    if (weatherForecastDaysInput) weatherForecastDaysInput.value = config.weatherForecastDays || 3;
    if (weatherForecastHoursInput) weatherForecastHoursInput.value = config.weatherForecastHours || 5;
    if (weatherSkipMidnightCheckbox) weatherSkipMidnightCheckbox.checked = config.weatherSkipMidnightHours !== false;
    if (weatherOpenBrowserUrlInput) weatherOpenBrowserUrlInput.value = config.weatherOpenBrowserURL || '';
    
    if (imageEnableCheckbox) imageEnableCheckbox.checked = config.imageEnable !== false;
    if (imageColumnsInput) imageColumnsInput.value = config.imageColumns || 3;
    if (imageMaxHeightInput) imageMaxHeightInput.value = config.imageMaxHeight || 400;
    imagePaths = config.imagePaths ? [...config.imagePaths] : [];
    renderImages();
    
    if (checkVersionCheckbox) checkVersionCheckbox.checked = config.checkVersion !== false;
    if (alwaysFillCheckbox) alwaysFillCheckbox.checked = config.alwaysFill === true;
    if (debugModeCheckbox) debugModeCheckbox.checked = config.debug === true;
    
    setupDependencies();
}

// 收集配置
function collectConfig() {
    return {
        title: (titleInput ? titleInput.value.trim() : 'HomeworkBoard') || 'HomeworkBoard',
        caption: (captionInput ? captionInput.value.trim() : '晚自习作业清单') || '晚自习作业清单',
        zoom: parseFloat(zoomInput ? zoomInput.value : 1) || 1,
        autoSaveGap: parseInt(autoSaveGapInput ? autoSaveGapInput.value : 10) || 10,
        subjects: subjects,
        saveTime: saveTimes,
        weatherEnable: weatherEnableCheckbox ? weatherEnableCheckbox.checked : false,
        weatherDataURL: weatherUrlInput ? weatherUrlInput.value.trim() : '',
        weatherAutoRefreshGap: parseInt(weatherRefreshGapInput ? weatherRefreshGapInput.value : 5) || 5,
        weatherForecastDays: parseInt(weatherForecastDaysInput ? weatherForecastDaysInput.value : 3) || 3,
        weatherForecastHours: parseInt(weatherForecastHoursInput ? weatherForecastHoursInput.value : 5) || 5,
        weatherSkipMidnightHours: weatherSkipMidnightCheckbox ? weatherSkipMidnightCheckbox.checked : false,
        weatherOpenBrowserURL: weatherOpenBrowserUrlInput ? weatherOpenBrowserUrlInput.value.trim() : '',
        imageEnable: imageEnableCheckbox ? imageEnableCheckbox.checked : false,
        imageColumns: parseInt(imageColumnsInput ? imageColumnsInput.value : 3) || 3,
        imageMaxHeight: parseInt(imageMaxHeightInput ? imageMaxHeightInput.value : 400) || 400,
        imagePaths: imagePaths,
        checkVersion: checkVersionCheckbox ? checkVersionCheckbox.checked : false,
        alwaysFill: alwaysFillCheckbox ? alwaysFillCheckbox.checked : false,
        debug: debugModeCheckbox ? debugModeCheckbox.checked : false
    };
}

// 保存配置并重启
function saveAndRestart() {
    const newConfig = collectConfig();
    
    // 保存配置到主进程
    if (window.api && window.api.saveConfigAndRestart) {
        window.api.saveConfigAndRestart(newConfig);
    } else {
        console.error('API not available');
        alert('无法保存配置，请重试');
    }
}

// 取消并关闭
function cancel() {
    if (window.api && window.api.closeConfigWindow) {
        window.api.closeConfigWindow();
    } else {
        window.close();
    }
}

// 事件绑定 - 添加空值检查
if (addSubjectBtn) {
    addSubjectBtn.addEventListener('click', () => {
        const newSubject = newSubjectInput ? newSubjectInput.value.trim() : '';
        if (newSubject) {
            subjects.push(newSubject);
            renderSubjects();
            if (newSubjectInput) newSubjectInput.value = '';
        }
    });
}

if (addSaveTimeBtn) {
    addSaveTimeBtn.addEventListener('click', addSaveTime);
}

if (addImageBtn) {
    addImageBtn.addEventListener('click', addImage);
}

if (clearImagesBtn) {
    clearImagesBtn.addEventListener('click', clearImages);
}

if (saveBtn) {
    saveBtn.addEventListener('click', saveAndRestart);
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', cancel);
}

// 接收配置数据
if (window.api && window.api.onConfigData) {
    window.api.onConfigData((config) => {
        loadConfig(config);
    });
} else if (window.api && window.api.config) {
    window.api.config(loadConfig);
}

// 键盘支持 - 添加空值检查
if (newSubjectInput) {
    newSubjectInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && addSubjectBtn) {
            addSubjectBtn.click();
        }
    });
}

if (newSaveHour) {
    newSaveHour.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSaveTime();
        }
    });
}

if (newSaveMinute) {
    newSaveMinute.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSaveTime();
        }
    });
}