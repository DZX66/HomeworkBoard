
let currentDate = new Date();
let recordsCache = {};

function initCalendar() {
    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", 
                      "七月", "八月", "九月", "十月", "十一月", "十二月"];
    document.getElementById('current-month').textContent = 
        `${currentDate.getFullYear()}年 ${monthNames[currentDate.getMonth()]}`;

    // 获取月份数据
    window.api.requestHistory({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1
    });
}

function generateCalendar(daysWithRecords) {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';

    // 创建日期对象
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // 生成日期格子
    let date = 1;
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 7; j++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';

            if (i === 0 && j < firstDay.getDay()) {
                // 空白格子
                dayCell.textContent = '';
            } else if (date > lastDay.getDate()) {
                break;
            } else {
                // 有效日期
                dayCell.textContent = date;
                const dateKey = `${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}-${pad(date)}`;
                
                if (daysWithRecords.includes(dateKey)) {
                    dayCell.classList.add('has-record');
                }

                dayCell.addEventListener('click', () => {
                    showDetail(dateKey);
                });
                date++;
            }
            calendar.appendChild(dayCell);
        }
    }
}

function showDetail(date) {
    if (recordsCache[date]) {
        document.getElementById('detail-date').textContent = date;
        document.getElementById('detail-content').textContent = recordsCache[date];
    } else {
        window.api.requestDayDetail(date);
    }
}

function pad(n) {
    return n.toString().padStart(2, '0');
}

// IPC通信
window.api.onHistoryData(({ days, records }) => {
    recordsCache = records.reduce((acc, cur) => {
        acc[cur.date] = cur.content;
        return acc;
    }, {});
    generateCalendar(days);
});

window.api.onDayDetail(({ date, content }) => {
    recordsCache[date] = content;
    document.getElementById('detail-date').textContent = date;
    document.getElementById('detail-content').textContent = content;
});

// 月份切换
document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    initCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    initCalendar();
});

// 初始化
document.addEventListener('DOMContentLoaded', initCalendar);