let currentSubject = null;
let templates = {};
let config = {};

// 初始化模板数据
api.initTemplates((data) => {
  config = data;
  templates = config.templates || {};
  renderSubjectList();

  // 默认选择第一个科目
  if (config.subjects.length > 0) {
    selectSubject(config.subjects[0]);
  }
});

// 渲染科目列表
function renderSubjectList() {
  const container = document.getElementById('subjectList');
  container.innerHTML = '';

  config.subjects.forEach(subject => {
    const div = document.createElement('div');
    div.className = 'subject-item';
    div.textContent = subject;
    div.addEventListener('click', () => selectSubject(subject));
    container.appendChild(div);
  });
}

// 创建一个模板条目（包含输入框和删除按钮）
function createTemplateEntry(value = '') {
  const div = document.createElement('div');
  div.className = 'template-entry';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'template-entry-input';
  input.value = value;
  input.placeholder = '输入模板内容';

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-entry-btn';
  delBtn.textContent = '删除';
  delBtn.addEventListener('click', () => {
    div.remove(); // 移除当前条目
  });

  div.appendChild(input);
  div.appendChild(delBtn);
  return div;
}

// 渲染当前科目的模板条目列表
function renderTemplateEntries(subject) {
  const container = document.getElementById('templateEntries');
  container.innerHTML = ''; // 清空现有条目

  const subjectTemplates = templates[subject] || [];
  subjectTemplates.forEach(value => {
    container.appendChild(createTemplateEntry(value));
  });
}

// 选择科目
function selectSubject(subject) {
  currentSubject = subject;
  document.getElementById('currentSubject').textContent = subject;

  // 更新选中状态
  document.querySelectorAll('.subject-item').forEach(el => {
    el.classList.toggle('active', el.textContent === subject);
  });

  // 渲染该科目的模板条目
  renderTemplateEntries(subject);
}

// 添加条目按钮
document.getElementById('addEntryBtn').addEventListener('click', () => {
  if (!currentSubject) return; // 没有选中科目时不操作
  const container = document.getElementById('templateEntries');
  container.appendChild(createTemplateEntry('')); // 新增空白条目
});

// 保存模板
document.getElementById('saveBtn').addEventListener('click', () => {
  if (!currentSubject) return;

  const container = document.getElementById('templateEntries');
  const inputs = container.querySelectorAll('.template-entry-input');
  // 过滤掉空字符串（trim后为空）
  const values = Array.from(inputs)
    .map(input => input.value.trim())
    .filter(v => v !== '');

  templates[currentSubject] = values;
  api.saveTemplates(templates);
});

// 取消按钮
document.getElementById('cancelBtn').addEventListener('click', () => {
  window.close();
});