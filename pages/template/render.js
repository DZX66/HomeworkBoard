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

// 选择科目
function selectSubject(subject) {
  currentSubject = subject;
  document.getElementById('currentSubject').textContent = subject;

  // 更新选中状态
  document.querySelectorAll('.subject-item').forEach(el => {
    el.classList.toggle('active', el.textContent === subject);
  });

  // 加载该科目的模板
  const subjectTemplates = templates[subject] || [];
  document.getElementById('templateArea').value = subjectTemplates.join('\n');
}

// 保存模板
document.getElementById('saveBtn').addEventListener('click', () => {
  if (!currentSubject) return;

  const content = document.getElementById('templateArea').value;
  templates[currentSubject] = content.split('\n').filter(line => line.trim());

  // 发送到主进程保存
  api.saveTemplates(templates);
});

// 取消按钮
document.getElementById('cancelBtn').addEventListener('click', () => {
  window.close();
});