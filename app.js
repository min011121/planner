const STORAGE_KEY = "couple-year-planner-v1";
const PLANNER_ID = "couple-main";
const API_URL = `/api/planners/${PLANNER_ID}`;

const PEOPLE = {
  together: "함께",
  me: "민재",
  partner: "정현",
};

const CATEGORIES = {
  todo: "할일",
  study: "공부",
  certificate: "자격증",
};

const monthNames = Array.from({ length: 12 }, (_, index) => `${index + 1}월`);
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const state = {
  selectedYear: currentYear,
  selectedMonth: currentMonth,
  data: createDefaultData(),
  isOnline: false,
  saveTimer: null,
};

const elements = {
  selectedYearTitle: document.querySelector("#selectedYearTitle"),
  selectedMonthTitle: document.querySelector("#selectedMonthTitle"),
  summaryTitle: document.querySelector("#summaryTitle"),
  calendarTitle: document.querySelector("#calendarTitle"),
  yearForm: document.querySelector("#yearForm"),
  yearInput: document.querySelector("#yearInput"),
  yearTitleInput: document.querySelector("#yearTitleInput"),
  yearStrip: document.querySelector("#yearStrip"),
  monthSelect: document.querySelector("#monthSelect"),
  monthTitleInput: document.querySelector("#monthTitleInput"),
  taskForm: document.querySelector("#taskForm"),
  taskInput: document.querySelector("#taskInput"),
  personSelect: document.querySelector("#personSelect"),
  categorySelect: document.querySelector("#categorySelect"),
  startDateInput: document.querySelector("#startDateInput"),
  endDateInput: document.querySelector("#endDateInput"),
  progressPill: document.querySelector("#progressPill"),
  summaryList: document.querySelector("#summaryList"),
  calendarBoard: document.querySelector("#calendarBoard"),
  syncStatus: document.querySelector("#syncStatus"),
  taskTableBody: document.querySelector("#taskTableBody"),
  themeToggle: document.querySelector("#themeToggle"),
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  passwordInput: document.querySelector("#passwordInput"),
  authError: document.querySelector("#authError"),
};

function createDefaultData() {
  return {
    years: {
      [currentYear]: createYear(),
    },
    theme: "day",
  };
}

function createYear() {
  return {
    title: "",
    months: Object.fromEntries(
      monthNames.map((_, index) => [
        index + 1,
        {
          title: "",
          together: [],
          me: [],
          partner: [],
        },
      ]),
    ),
  };
}

function readLocalData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return createDefaultData();
  }

  try {
    return normalizeData(JSON.parse(saved));
  } catch {
    return createDefaultData();
  }
}

async function loadData() {
  state.data = readLocalData();
  render();

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error("데이터를 불러오지 못했습니다.");
    }

    const remoteData = await response.json();
    state.data = normalizeData(remoteData);
    state.isOnline = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    setSyncStatus("MySQL과 연결됨");
  } catch {
    state.isOnline = false;
    setSyncStatus("서버 연결 전까지 이 기기에 임시 저장됨");
  }

  ensureYear(state.selectedYear);
  render();
}

async function initializeApp() {
  try {
    const response = await fetch("/api/session");
    const session = await response.json();

    if (session.passwordRequired && !session.authenticated) {
      elements.authScreen.hidden = false;
      elements.passwordInput.focus();
      return;
    }
  } catch {
    elements.authScreen.hidden = false;
    elements.authError.textContent = "서버 연결을 확인해주세요.";
    return;
  }

  elements.authScreen.hidden = true;
  loadData();
}

function normalizeData(data) {
  const normalized = data && typeof data === "object" ? data : createDefaultData();
  normalized.years = normalized.years && typeof normalized.years === "object" ? normalized.years : {};
  normalized.theme = normalized.theme === "night" ? "night" : "day";

  if (!Object.keys(normalized.years).length) {
    normalized.years[currentYear] = createYear();
  }

  Object.keys(normalized.years).forEach((year) => {
    const baseYear = createYear();
    normalized.years[year].title = normalized.years[year].title || "";
    normalized.years[year].months = {
      ...baseYear.months,
      ...(normalized.years[year].months || {}),
    };

    Object.keys(normalized.years[year].months).forEach((month) => {
      const monthData = normalized.years[year].months[month];
      normalized.years[year].months[month] = {
        title: monthData.title || "",
        together: normalizeTasks(monthData.together),
        me: normalizeTasks(monthData.me),
        partner: normalizeTasks(monthData.partner),
      };
    });
  });

  return normalized;
}

function normalizeTasks(tasks = []) {
  return tasks.map((task) => ({
    ...task,
    category: task.category || "todo",
    startDate: task.startDate || "",
    endDate: task.endDate || task.startDate || "",
    updatedAt: task.updatedAt || task.createdAt || "",
  }));
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  clearTimeout(state.saveTimer);

  state.saveTimer = setTimeout(async () => {
    try {
      const response = await fetch(API_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(state.data),
      });

      if (!response.ok) {
        throw new Error("저장 실패");
      }

      state.isOnline = true;
      setSyncStatus("MySQL에 저장됨");
    } catch {
      state.isOnline = false;
      setSyncStatus("서버 연결 실패, 이 기기에 임시 저장됨");
    }
  }, 250);
}

function setSyncStatus(message) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.online = String(state.isOnline);
}

function ensureYear(year) {
  if (!state.data.years[year]) {
    state.data.years[year] = createYear();
  }
}

function getMonthData(year = state.selectedYear, month = state.selectedMonth) {
  ensureYear(year);
  return state.data.years[year].months[month];
}

function getYearData(year = state.selectedYear) {
  ensureYear(year);
  return state.data.years[year];
}

function getAllTasks(monthData) {
  return Object.keys(PEOPLE).flatMap((person) => monthData[person] || []);
}

function getCompletion(tasks) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  return { done, total, ratio: total ? Math.round((done / total) * 100) : 0 };
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthStartDate() {
  return formatDate(state.selectedYear, state.selectedMonth, 1);
}

function getMonthEndDate() {
  const lastDay = new Date(state.selectedYear, state.selectedMonth, 0).getDate();
  return formatDate(state.selectedYear, state.selectedMonth, lastDay);
}

function formatDateLabel(startDate, endDate) {
  if (!startDate && !endDate) {
    return "기간 없음";
  }

  if (startDate === endDate || !endDate) {
    return startDate;
  }

  return `${startDate} ~ ${endDate}`;
}

function formatEditedLabel(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isTaskOnDate(task, date) {
  if (!task.startDate && !task.endDate) {
    return false;
  }

  const start = task.startDate || task.endDate;
  const end = task.endDate || task.startDate;
  return start <= date && date <= end;
}

function isTaskInSelectedMonth(task) {
  if (!task.startDate && !task.endDate) {
    return true;
  }

  const start = task.startDate || task.endDate;
  const end = task.endDate || task.startDate;
  return start <= getMonthEndDate() && end >= getMonthStartDate();
}

function render() {
  document.documentElement.dataset.theme = state.data.theme === "night" ? "night" : "day";
  const yearTitle = getYearData().title;
  const monthTitle = getMonthData().title;
  elements.selectedYearTitle.textContent = yearTitle || `${state.selectedYear}년 프로젝트`;
  elements.selectedMonthTitle.textContent = monthTitle || `${state.selectedMonth}월 계획`;
  elements.summaryTitle.textContent = `${state.selectedMonth}월 한눈에 보기`;
  elements.calendarTitle.textContent = `${state.selectedYear}년 ${state.selectedMonth}월 달력`;
  elements.yearTitleInput.value = yearTitle;
  elements.monthTitleInput.value = monthTitle;

  renderYears();
  renderMonthSelect();
  syncDateInputs();
  renderTasks();
  renderSummary();
  renderCalendar();
}

function renderYears() {
  const years = Object.keys(state.data.years)
    .map(Number)
    .sort((a, b) => a - b);

  elements.yearStrip.replaceChildren(
    ...years.map((year) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `year-button${year === state.selectedYear ? " active" : ""}`;
      button.textContent = `${year}년`;
      button.addEventListener("click", () => {
        state.selectedYear = year;
        render();
      });
      return button;
    }),
  );
}

function renderMonthSelect() {
  if (elements.monthSelect.options.length !== 12) {
    const options = monthNames.map((monthName, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = monthName;
      return option;
    });
    elements.monthSelect.replaceChildren(...options);
  }

  elements.monthSelect.value = String(state.selectedMonth);
}

function syncDateInputs() {
  const start = getMonthStartDate();
  const end = getMonthEndDate();

  [elements.startDateInput, elements.endDateInput].forEach((input) => {
    input.min = start;
    input.max = end;
  });

  if (!elements.startDateInput.value || elements.startDateInput.value < start || elements.startDateInput.value > end) {
    elements.startDateInput.value = start;
  }

  if (!elements.endDateInput.value || elements.endDateInput.value < start || elements.endDateInput.value > end) {
    elements.endDateInput.value = elements.startDateInput.value;
  }
}

function renderTasks() {
  const monthData = getMonthData();
  const visibleTasks = getAllTasks(monthData).filter(isTaskInSelectedMonth);
  const completion = getCompletion(visibleTasks);
  elements.progressPill.textContent = `${completion.done} / ${completion.total} 완료`;

  const rows = Object.entries(PEOPLE).flatMap(([person, name]) => {
    const tasks = monthData[person].filter(isTaskInSelectedMonth);
    const sectionRow = createPersonSectionRow(name, tasks.length);
    const taskRows = tasks.length
      ? tasks.map((task) => createTaskRow(person, task))
      : [createEmptyPersonRow(name)];
    return [sectionRow, ...taskRows];
  });

  elements.taskTableBody.replaceChildren(...rows);
}

function createPersonSectionRow(name, count) {
  const row = document.createElement("tr");
  row.className = "person-section-row";
  row.innerHTML = `<td colspan="6">${name}<span>${count}개</span></td>`;
  return row;
}

function createEmptyPersonRow(name) {
  const row = document.createElement("tr");
  row.className = "empty-row";
  row.innerHTML = `<td colspan="6">${name} 계획이 아직 없어요</td>`;
  return row;
}

function createTaskRow(person, task) {
  const row = document.createElement("tr");
  row.className = task.done ? "is-done" : "is-active";
  row.dataset.category = task.category;

  const statusCell = document.createElement("td");
  const statusLabel = document.createElement("label");
  statusLabel.className = "status-pill";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  const statusText = document.createElement("span");
  statusText.textContent = task.done ? "완료" : "진행 중";
  statusLabel.append(checkbox, statusText);
  statusCell.append(statusLabel);

  const activityCell = document.createElement("td");
  activityCell.className = "activity-cell";
  activityCell.innerHTML = `
    <strong>${task.text}</strong>
  `;

  const categoryCell = document.createElement("td");
  const category = document.createElement("span");
  category.className = "category-chip";
  category.textContent = CATEGORIES[task.category] || "할일";
  categoryCell.append(category);

  const editedCell = document.createElement("td");
  editedCell.textContent = formatEditedLabel(task.updatedAt || task.createdAt);

  const dateCell = document.createElement("td");
  dateCell.textContent = formatDateLabel(task.startDate, task.endDate);

  const actionCell = document.createElement("td");
  const removeButton = document.createElement("button");
  removeButton.className = "row-delete";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "삭제");
  removeButton.textContent = "×";
  actionCell.append(removeButton);

  checkbox.addEventListener("change", () => {
    task.done = checkbox.checked;
    task.updatedAt = new Date().toISOString();
    saveData();
    render();
  });

  removeButton.addEventListener("click", () => {
    const tasks = getMonthData()[person];
    const index = tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) {
      tasks.splice(index, 1);
      saveData();
      render();
    }
  });

  row.append(statusCell, activityCell, categoryCell, editedCell, dateCell, actionCell);
  return row;
}

function renderSummary() {
  const monthData = getMonthData();
  const visibleTasks = getAllTasks(monthData).filter(isTaskInSelectedMonth);
  elements.summaryList.replaceChildren(createSummaryRow(`${state.selectedMonth}월 전체`, getCompletion(visibleTasks)));
}

function createSummaryRow(label, completion) {
  const row = document.createElement("div");
  row.className = "summary-row";
  row.innerHTML = `
    <div class="summary-head">
      <span>${label}</span>
      <span>${completion.done}/${completion.total} · ${completion.ratio}%</span>
    </div>
    <div class="summary-bar" aria-hidden="true">
      <div class="summary-fill" style="width: ${completion.ratio}%"></div>
    </div>
  `;
  return row;
}

function renderCalendar() {
  const monthData = getMonthData();
  const tasks = Object.entries(PEOPLE).flatMap(([person]) => {
    return monthData[person].map((task) => ({ ...task, person }));
  });
  const firstDay = new Date(state.selectedYear, state.selectedMonth - 1, 1).getDay();
  const lastDay = new Date(state.selectedYear, state.selectedMonth, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-cell is-empty";
    cells.push(emptyCell);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const date = formatDate(state.selectedYear, state.selectedMonth, day);
    const cellTasks = tasks.filter((task) => isTaskOnDate(task, date));
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.innerHTML = `<strong>${day}</strong>`;

    const list = document.createElement("div");
    list.className = "calendar-items";

    cellTasks.slice(0, 4).forEach((task) => {
      const start = task.startDate || task.endDate;
      const end = task.endDate || task.startDate;
      const dayOfWeek = new Date(state.selectedYear, state.selectedMonth - 1, day).getDay();
      const isStart = date === start || day === 1 || dayOfWeek === 0;
      const isEnd = date === end || day === lastDay || dayOfWeek === 6;
      const item = document.createElement("span");
      item.className = "calendar-item";
      item.dataset.category = task.category;
      item.classList.toggle("is-start", isStart);
      item.classList.toggle("is-middle", !isStart && !isEnd);
      item.classList.toggle("is-end", isEnd);
      const calendarLabel = `${task.text} - ${PEOPLE[task.person]}`;
      item.textContent = isStart ? calendarLabel : "";
      item.title = calendarLabel;
      list.append(item);
    });

    if (cellTasks.length > 4) {
      const more = document.createElement("span");
      more.className = "calendar-more";
      more.textContent = `+${cellTasks.length - 4}개`;
      list.append(more);
    }

    cell.append(list);
    cells.push(cell);
  }

  elements.calendarBoard.replaceChildren(...cells);
}

elements.yearForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const year = Number(elements.yearInput.value.trim());

  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    elements.yearInput.focus();
    return;
  }

  ensureYear(year);
  state.selectedYear = year;
  elements.yearInput.value = "";
  saveData();
  render();
});

elements.yearTitleInput.addEventListener("change", () => {
  getYearData().title = elements.yearTitleInput.value.trim();
  saveData();
  render();
});

elements.monthSelect.addEventListener("change", () => {
  state.selectedMonth = Number(elements.monthSelect.value);
  elements.startDateInput.value = "";
  elements.endDateInput.value = "";
  render();
});

elements.monthTitleInput.addEventListener("change", () => {
  getMonthData().title = elements.monthTitleInput.value.trim();
  saveData();
  render();
});

elements.startDateInput.addEventListener("change", () => {
  if (!elements.endDateInput.value || elements.endDateInput.value < elements.startDateInput.value) {
    elements.endDateInput.value = elements.startDateInput.value;
  }
});

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = elements.taskInput.value.trim();
  const person = elements.personSelect.value;
  const category = elements.categorySelect.value;
  let startDate = elements.startDateInput.value;
  let endDate = elements.endDateInput.value;

  if (!text) {
    elements.taskInput.focus();
    return;
  }

  if (startDate && endDate && endDate < startDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  getMonthData()[person].push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    text,
    category,
    startDate,
    endDate: endDate || startDate,
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  elements.taskInput.value = "";
  saveData();
  render();
});

elements.themeToggle.addEventListener("click", () => {
  state.data.theme = state.data.theme === "night" ? "day" : "night";
  saveData();
  render();
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.authError.textContent = "";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: elements.passwordInput.value }),
    });

    if (!response.ok) {
      elements.authError.textContent = "비밀번호가 맞지 않습니다.";
      elements.passwordInput.select();
      return;
    }

    elements.passwordInput.value = "";
    elements.authScreen.hidden = true;
    loadData();
  } catch {
    elements.authError.textContent = "서버 연결을 확인해주세요.";
  }
});

initializeApp();
