/* =========================================================
   STUDYMATE - script.js
   Sections:
   1. Storage helpers & default state
   2. DOM references
   3. Utility helpers
   4. Navigation
   5. Toasts & Notifications
   6. Dashboard render
   7. Tasks module
   8. Subjects module
   9. Schedule module
   10. Timer module
   11. Progress module
   12. Settings module
   13. Modals & confirm dialog
   14. Init
   ========================================================= */

/* ---------------------------------------------------------
   1. STORAGE HELPERS & DEFAULT STATE
--------------------------------------------------------- */
const STORAGE_KEYS = {
  tasks: "studymate_tasks",
  subjects: "studymate_subjects",
  schedule: "studymate_schedule",
  settings: "studymate_settings",
  timer: "studymate_timer",
  studylog: "studymate_studylog",
  notifications: "studymate_notifications"
};

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// In-memory state, loaded from localStorage on startup
let tasks = loadData(STORAGE_KEYS.tasks, []);
let subjects = loadData(STORAGE_KEYS.subjects, []);
let schedule = loadData(STORAGE_KEYS.schedule, []);
let settings = loadData(STORAGE_KEYS.settings, {
  darkMode: false,
  weeklyGoal: 20,
  notifications: true
});
let timerSettings = loadData(STORAGE_KEYS.timer, {
  studyMinutes: 25,
  breakMinutes: 5
});
let studyLog = loadData(STORAGE_KEYS.studylog, {}); // { "YYYY-MM-DD": minutes }
let notifications = loadData(STORAGE_KEYS.notifications, []);

// Profile / avatar state
const PROFILE_KEY = "studymate_profile";
let profile = loadData(PROFILE_KEY, {
  name: "Student",
  avatarSeed: "Student1",
  customImage: null // base64 string if user uploaded their own photo
});

/* ---------------------------------------------------------
   2. DOM REFERENCES
--------------------------------------------------------- */
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.querySelectorAll(".nav-link");
const pages = document.querySelectorAll(".page");

const themeToggle = document.getElementById("themeToggle");
const notifBtn = document.getElementById("notifBtn");
const notifPanel = document.getElementById("notifPanel");
const notifList = document.getElementById("notifList");
const notifDot = document.getElementById("notifDot");
const clearNotifsBtn = document.getElementById("clearNotifs");

/* ---------------------------------------------------------
   3. UTILITY HELPERS
--------------------------------------------------------- */
function todayStr() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function formatDateReadable(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function priorityBadgeClass(priority) {
  if (priority === "High") return "badge-high";
  if (priority === "Low") return "badge-low";
  return "badge-medium";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ---------------------------------------------------------
   4. NAVIGATION
--------------------------------------------------------- */
function goToPage(pageName) {
  pages.forEach(p => p.classList.remove("active"));
  navLinks.forEach(l => l.classList.remove("active"));

  const targetPage = document.getElementById("page-" + pageName);
  const targetLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
  if (targetPage) targetPage.classList.add("active");
  if (targetLink) targetLink.classList.add("active");

  // Close mobile sidebar after navigating
  sidebar.classList.remove("open");
  overlay.classList.remove("show");

  // Refresh relevant sections when navigated to
  if (pageName === "dashboard") renderDashboard();
  if (pageName === "schedule") renderSchedule();
  if (pageName === "subjects") renderSubjects();
  if (pageName === "tasks") renderTasks();
  if (pageName === "progress") renderProgress();
}

navLinks.forEach(link => {
  link.addEventListener("click", () => goToPage(link.dataset.page));
});

menuToggle.addEventListener("click", () => {
  sidebar.classList.add("open");
  overlay.classList.add("show");
});
overlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
});

document.querySelectorAll("[data-quick]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.quick === "task") openTaskModal();
    if (btn.dataset.quick === "session") openSessionModal();
  });
});

/* ---------------------------------------------------------
   5. TOASTS & NOTIFICATIONS
--------------------------------------------------------- */
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function addNotification(message) {
  if (!settings.notifications) return;
  notifications.unshift({ id: uid(), message, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  notifications = notifications.slice(0, 20);
  saveData(STORAGE_KEYS.notifications, notifications);
  renderNotifications();
}

function renderNotifications() {
  notifList.innerHTML = "";
  if (notifications.length === 0) {
    notifList.innerHTML = '<li class="empty-notif">No notifications yet.</li>';
    notifDot.style.display = "none";
    return;
  }
  notifDot.style.display = "block";
  notifications.forEach(n => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(n.message)}</strong><br><span style="color:var(--text-muted);font-size:11px;">${n.time}</span>`;
    notifList.appendChild(li);
  });
}

notifBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  notifPanel.classList.toggle("open");
  notifDot.style.display = "none";
});
document.addEventListener("click", (e) => {
  if (!notifPanel.contains(e.target) && e.target !== notifBtn) {
    notifPanel.classList.remove("open");
  }
});
clearNotifsBtn.addEventListener("click", () => {
  notifications = [];
  saveData(STORAGE_KEYS.notifications, notifications);
  renderNotifications();
});

/* ---------------------------------------------------------
   6. DASHBOARD
--------------------------------------------------------- */
function getHour() {
  return new Date().getHours();
}

function greetingMessage() {
  const h = getHour();
  if (h < 12) return "Good Morning, Student 👋";
  if (h < 17) return "Good Afternoon, Student 👋";
  return "Good Evening, Student 👋";
}

function computeStreak() {
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = cursor.toISOString().split("T")[0];
    if (studyLog[key] && studyLog[key] > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function renderDashboard() {
  document.getElementById("greetingText").textContent = greetingMessage();
  document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const todayMinutes = studyLog[todayStr()] || 0;
  document.getElementById("statStudyHours").textContent = (todayMinutes / 60).toFixed(1) + "h";

  const tasksCompleted = tasks.filter(t => t.completed).length;
  document.getElementById("statTasksDone").textContent = tasksCompleted;

  document.getElementById("statSubjects").textContent = subjects.length;

  const weeklyPct = computeWeeklyGoalPercent();
  document.getElementById("statProgress").textContent = weeklyPct + "%";

  const streak = computeStreak();
  document.getElementById("streakCount").textContent = streak;
  document.getElementById("sidebarStreak").textContent = streak + " day streak";

  // Today's tasks
  const todayTasksList = document.getElementById("todayTasksList");
  const todaysTasks = tasks.filter(t => t.dueDate === todayStr());
  if (todaysTasks.length === 0) {
    todayTasksList.innerHTML = `<div class="empty-state"><div class="empty-icon-badge"><i class="fa-solid fa-mug-hot"></i></div><p>No tasks due today. Enjoy your day!</p></div>`;
  } else {
    todayTasksList.innerHTML = todaysTasks.slice(0, 5).map(t => taskItemHtml(t)).join("");
    attachTaskItemEvents(todayTasksList);
  }

  // Upcoming sessions (from today onward)
  const upcomingList = document.getElementById("upcomingSessionsList");
  const upcoming = schedule
    .filter(s => s.date >= todayStr())
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 5);
  if (upcoming.length === 0) {
    upcomingList.innerHTML = `<div class="empty-state"><div class="empty-icon-badge"><i class="fa-solid fa-calendar-xmark"></i></div><p>No upcoming sessions. Plan one now!</p></div>`;
  } else {
    upcomingList.innerHTML = upcoming.map(s => {
      const subj = subjects.find(sub => sub.id === s.subjectId);
      return `<div class="mini-item">
        <span class="subject-dot" style="background:${subj ? subj.color : '#6c5ce7'}"></span>
        <div class="mini-item-body">
          <h4>${escapeHtml(subj ? subj.name : "General")} ${s.topic ? "- " + escapeHtml(s.topic) : ""}</h4>
          <p>${formatDateReadable(s.date)} • ${s.startTime} - ${s.endTime}</p>
        </div>
        <span class="badge ${priorityBadgeClass(s.priority)}">${s.priority}</span>
      </div>`;
    }).join("");
  }
}

function computeWeeklyGoalPercent() {
  const totalMinutes = getLast7DaysMinutes().reduce((a, b) => a + b.minutes, 0);
  const goalMinutes = (settings.weeklyGoal || 1) * 60;
  return Math.min(100, Math.round((totalMinutes / goalMinutes) * 100));
}

function getLast7DaysMinutes() {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    result.push({ date: key, minutes: studyLog[key] || 0 });
  }
  return result;
}

/* ---------------------------------------------------------
   TASK ITEM HTML (shared by dashboard + tasks page)
--------------------------------------------------------- */
function taskItemHtml(t) {
  const subj = subjects.find(s => s.id === t.subjectId);
  return `<div class="mini-item" data-id="${t.id}">
    <div class="check ${t.completed ? "done" : ""}" data-action="toggle"><i class="fa-solid fa-check"></i></div>
    <div class="mini-item-body">
      <h4 class="${t.completed ? "strike" : ""}">${escapeHtml(t.title)}</h4>
      <p>${subj ? escapeHtml(subj.name) : "General"} • Due ${formatDateReadable(t.dueDate)}</p>
    </div>
    <span class="badge ${priorityBadgeClass(t.priority)}">${t.priority}</span>
    <div class="mini-actions">
      <button data-action="edit"><i class="fa-solid fa-pen"></i></button>
      <button data-action="delete" class="del-btn"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

function attachTaskItemEvents(container) {
  container.querySelectorAll(".mini-item").forEach(item => {
    const id = item.dataset.id;
    const checkBtn = item.querySelector('[data-action="toggle"]');
    const editBtn = item.querySelector('[data-action="edit"]');
    const delBtn = item.querySelector('[data-action="delete"]');
    if (checkBtn) checkBtn.addEventListener("click", () => toggleTaskCompleted(id));
    if (editBtn) editBtn.addEventListener("click", () => openTaskModal(id));
    if (delBtn) delBtn.addEventListener("click", () => confirmAction(
      "Delete this task? This cannot be undone.",
      () => deleteTask(id)
    ));
  });
}

/* ---------------------------------------------------------
   7. TASKS MODULE
--------------------------------------------------------- */
let currentTaskFilter = "all";

function renderTasks() {
  const list = document.getElementById("tasksList");
  let filtered = tasks;
  if (currentTaskFilter === "pending") filtered = tasks.filter(t => !t.completed);
  if (currentTaskFilter === "completed") filtered = tasks.filter(t => t.completed);

  filtered = [...filtered].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon-badge"><i class="fa-solid fa-clipboard-list"></i></div><p>No tasks here yet. Add your first task!</p></div>`;
  } else {
    list.innerHTML = filtered.map(t => taskItemHtml(t)).join("");
    attachTaskItemEvents(list);
  }

  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById("taskCompletionText").textContent = pct + "% complete";
  document.getElementById("taskCompletionBar").style.width = pct + "%";
}

function toggleTaskCompleted(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  saveData(STORAGE_KEYS.tasks, tasks);
  if (t.completed) addNotification(`Task completed: "${t.title}"`);
  renderTasks();
  renderDashboard();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveData(STORAGE_KEYS.tasks, tasks);
  showToast("Task deleted", "success");
  renderTasks();
  renderDashboard();
}

document.querySelectorAll(".filter-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTaskFilter = tab.dataset.filter;
    renderTasks();
  });
});

document.getElementById("addTaskBtn").addEventListener("click", () => openTaskModal());

function openTaskModal(id) {
  const modal = document.getElementById("taskModal");
  const form = document.getElementById("taskForm");
  form.reset();
  document.getElementById("taskFormError").textContent = "";
  populateSubjectSelect(document.getElementById("taskSubject"));

  if (id) {
    const t = tasks.find(x => x.id === id);
    document.getElementById("taskModalTitle").textContent = "Edit Task";
    document.getElementById("taskId").value = t.id;
    document.getElementById("taskTitle").value = t.title;
    document.getElementById("taskSubject").value = t.subjectId || "";
    document.getElementById("taskDueDate").value = t.dueDate;
    document.getElementById("taskPriority").value = t.priority;
  } else {
    document.getElementById("taskModalTitle").textContent = "Add Task";
    document.getElementById("taskId").value = "";
    document.getElementById("taskDueDate").value = todayStr();
  }
  modal.classList.add("open");
}

document.getElementById("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  const subjectId = document.getElementById("taskSubject").value;
  const dueDate = document.getElementById("taskDueDate").value;
  const priority = document.getElementById("taskPriority").value;
  const id = document.getElementById("taskId").value;
  const errorEl = document.getElementById("taskFormError");

  if (!title) { errorEl.textContent = "Task title is required."; return; }
  if (!dueDate) { errorEl.textContent = "Please select a valid due date."; return; }

  if (id) {
    const t = tasks.find(x => x.id === id);
    Object.assign(t, { title, subjectId, dueDate, priority });
    showToast("Task updated", "success");
  } else {
    tasks.push({ id: uid(), title, subjectId, dueDate, priority, completed: false });
    addNotification(`New task added: "${title}"`);
    showToast("Task added", "success");
  }
  saveData(STORAGE_KEYS.tasks, tasks);
  closeModal("taskModal");
  renderTasks();
  renderDashboard();
});

/* ---------------------------------------------------------
   8. SUBJECTS MODULE
--------------------------------------------------------- */
function renderSubjects() {
  const grid = document.getElementById("subjectsGrid");
  if (subjects.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon-badge"><i class="fa-solid fa-book"></i></div><p>No subjects yet. Add your first subject to get started!</p></div>`;
    return;
  }
  grid.innerHTML = subjects.map(s => {
    const pct = s.totalHours > 0 ? Math.min(100, Math.round((s.studiedHours / s.totalHours) * 100)) : 0;
    return `<div class="subject-card" style="--sub-color:${s.color}" data-id="${s.id}">
      <div class="subject-card-top">
        <h4>${escapeHtml(s.name)}</h4>
        <span class="subject-dot" style="background:${s.color}"></span>
      </div>
      <p class="teacher"><i class="fa-solid fa-chalkboard-user"></i> ${escapeHtml(s.teacher || "No teacher assigned")}</p>
      <div class="progress-label"><span>Progress</span><span>${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%; background:${s.color}"></div></div>
      <div class="hours-row"><span>${s.studiedHours}h studied</span><span>${s.totalHours}h target</span></div>
      <div class="card-actions">
        <button data-action="edit"><i class="fa-solid fa-pen"></i> Edit</button>
        <button data-action="delete"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".subject-card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => openSubjectModal(id));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => confirmAction(
      "Delete this subject? Related sessions will remain but lose their subject link.",
      () => deleteSubject(id)
    ));
  });
}

function deleteSubject(id) {
  subjects = subjects.filter(s => s.id !== id);
  saveData(STORAGE_KEYS.subjects, subjects);
  showToast("Subject deleted", "success");
  renderSubjects();
  renderDashboard();
  populateAllSubjectSelects();
}

document.getElementById("addSubjectBtn").addEventListener("click", () => openSubjectModal());

function openSubjectModal(id) {
  const modal = document.getElementById("subjectModal");
  const form = document.getElementById("subjectForm");
  form.reset();
  document.getElementById("subjectFormError").textContent = "";

  if (id) {
    const s = subjects.find(x => x.id === id);
    document.getElementById("subjectModalTitle").textContent = "Edit Subject";
    document.getElementById("subjectId").value = s.id;
    document.getElementById("subjectName").value = s.name;
    document.getElementById("subjectTeacher").value = s.teacher || "";
    document.getElementById("subjectColor").value = s.color;
    document.getElementById("subjectTotalHours").value = s.totalHours;
    document.getElementById("subjectStudiedHours").value = s.studiedHours;
  } else {
    document.getElementById("subjectModalTitle").textContent = "Add Subject";
    document.getElementById("subjectId").value = "";
    document.getElementById("subjectColor").value = "#6c5ce7";
  }
  modal.classList.add("open");
}

document.getElementById("subjectForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("subjectName").value.trim();
  const teacher = document.getElementById("subjectTeacher").value.trim();
  const color = document.getElementById("subjectColor").value;
  const totalHours = parseFloat(document.getElementById("subjectTotalHours").value);
  const studiedHours = parseFloat(document.getElementById("subjectStudiedHours").value);
  const id = document.getElementById("subjectId").value;
  const errorEl = document.getElementById("subjectFormError");

  if (!name) { errorEl.textContent = "Subject name is required."; return; }
  if (isNaN(totalHours) || totalHours <= 0) { errorEl.textContent = "Total study hours must be a positive number."; return; }
  if (isNaN(studiedHours) || studiedHours < 0) { errorEl.textContent = "Studied hours cannot be negative."; return; }

  if (id) {
    const s = subjects.find(x => x.id === id);
    Object.assign(s, { name, teacher, color, totalHours, studiedHours });
    showToast("Subject updated", "success");
  } else {
    subjects.push({ id: uid(), name, teacher, color, totalHours, studiedHours });
    showToast("Subject added", "success");
  }
  saveData(STORAGE_KEYS.subjects, subjects);
  closeModal("subjectModal");
  renderSubjects();
  renderDashboard();
  populateAllSubjectSelects();
});

function populateSubjectSelect(selectEl) {
  const currentValue = selectEl.value;
  const firstOption = selectEl.querySelector("option");
  selectEl.innerHTML = "";
  selectEl.appendChild(firstOption);
  subjects.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    selectEl.appendChild(opt);
  });
  selectEl.value = currentValue;
}

function populateAllSubjectSelects() {
  populateSubjectSelect(document.getElementById("taskSubject"));
  populateSubjectSelect(document.getElementById("sessionSubject"));
}

/* ---------------------------------------------------------
   9. SCHEDULE MODULE
--------------------------------------------------------- */
function renderSchedule() {
  const container = document.getElementById("scheduleList");
  if (schedule.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon-badge"><i class="fa-solid fa-calendar-days"></i></div><p>No study sessions planned yet. Add your first session!</p></div>`;
    return;
  }
  const sorted = [...schedule].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  let html = `<table class="sessions-table"><thead><tr>
    <th>Subject</th><th>Date</th><th>Time</th><th>Topic</th><th>Priority</th><th>Actions</th>
  </tr></thead><tbody>`;
  sorted.forEach(s => {
    const subj = subjects.find(sub => sub.id === s.subjectId);
    html += `<tr data-id="${s.id}">
      <td><span class="subject-dot" style="background:${subj ? subj.color : '#999'}"></span>${escapeHtml(subj ? subj.name : "Unknown")}</td>
      <td>${formatDateReadable(s.date)}</td>
      <td>${s.startTime} - ${s.endTime}</td>
      <td>${escapeHtml(s.topic || "-")}</td>
      <td><span class="badge ${priorityBadgeClass(s.priority)}">${s.priority}</span></td>
      <td>
        <div class="mini-actions">
          <button data-action="edit"><i class="fa-solid fa-pen"></i></button>
          <button data-action="delete" class="del-btn"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  });
  html += "</tbody></table>";
  container.innerHTML = html;

  container.querySelectorAll("tr[data-id]").forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-action="edit"]').addEventListener("click", () => openSessionModal(id));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => confirmAction(
      "Delete this study session?",
      () => deleteSession(id)
    ));
  });
}

function deleteSession(id) {
  schedule = schedule.filter(s => s.id !== id);
  saveData(STORAGE_KEYS.schedule, schedule);
  showToast("Session deleted", "success");
  renderSchedule();
  renderDashboard();
}

document.getElementById("addSessionBtn").addEventListener("click", () => openSessionModal());

function openSessionModal(id) {
  const modal = document.getElementById("sessionModal");
  const form = document.getElementById("sessionForm");
  form.reset();
  document.getElementById("sessionFormError").textContent = "";
  populateSubjectSelect(document.getElementById("sessionSubject"));

  if (id) {
    const s = schedule.find(x => x.id === id);
    document.getElementById("sessionModalTitle").textContent = "Edit Study Session";
    document.getElementById("sessionId").value = s.id;
    document.getElementById("sessionSubject").value = s.subjectId;
    document.getElementById("sessionDate").value = s.date;
    document.getElementById("sessionStart").value = s.startTime;
    document.getElementById("sessionEnd").value = s.endTime;
    document.getElementById("sessionTopic").value = s.topic || "";
    document.getElementById("sessionPriority").value = s.priority;
  } else {
    document.getElementById("sessionModalTitle").textContent = "Add Study Session";
    document.getElementById("sessionId").value = "";
    document.getElementById("sessionDate").value = todayStr();
  }
  modal.classList.add("open");
}

document.getElementById("sessionForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const subjectId = document.getElementById("sessionSubject").value;
  const date = document.getElementById("sessionDate").value;
  const startTime = document.getElementById("sessionStart").value;
  const endTime = document.getElementById("sessionEnd").value;
  const topic = document.getElementById("sessionTopic").value.trim();
  const priority = document.getElementById("sessionPriority").value;
  const id = document.getElementById("sessionId").value;
  const errorEl = document.getElementById("sessionFormError");

  if (!subjectId) { errorEl.textContent = "Please select a subject."; return; }
  if (!date) { errorEl.textContent = "Please select a valid date."; return; }
  if (!startTime || !endTime) { errorEl.textContent = "Please select both start and end time."; return; }
  if (startTime >= endTime) { errorEl.textContent = "End time must be after start time."; return; }

  if (id) {
    const s = schedule.find(x => x.id === id);
    Object.assign(s, { subjectId, date, startTime, endTime, topic, priority });
    showToast("Session updated", "success");
  } else {
    schedule.push({ id: uid(), subjectId, date, startTime, endTime, topic, priority });
    addNotification("New study session scheduled");
    showToast("Session added", "success");
  }
  saveData(STORAGE_KEYS.schedule, schedule);
  closeModal("sessionModal");
  renderSchedule();
  renderDashboard();
});

/* ---------------------------------------------------------
   10. STUDY TIMER MODULE (Pomodoro)
--------------------------------------------------------- */
const RING_CIRCUMFERENCE = 2 * Math.PI * 100; // r=100
let timerMode = "study"; // "study" or "break"
let secondsLeft = timerSettings.studyMinutes * 60;
let totalSeconds = timerSettings.studyMinutes * 60;
let timerInterval = null;
let isRunning = false;
let sessionsCompletedToday = loadData("studymate_sessions_today", { date: todayStr(), count: 0 });

if (sessionsCompletedToday.date !== todayStr()) {
  sessionsCompletedToday = { date: todayStr(), count: 0 };
  saveData("studymate_sessions_today", sessionsCompletedToday);
}

const timerDisplay = document.getElementById("timerDisplay");
const timerRing = document.getElementById("timerRing");
const timerModeLabel = document.getElementById("timerModeLabel");
timerRing.style.strokeDasharray = RING_CIRCUMFERENCE;

function updateTimerDisplay() {
  const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const s = (secondsLeft % 60).toString().padStart(2, "0");
  timerDisplay.textContent = `${m}:${s}`;
  const progress = 1 - secondsLeft / totalSeconds;
  timerRing.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  timerModeLabel.textContent = timerMode === "study" ? "Study Session" : "Break Time";
}

function renderTimerStats() {
  document.getElementById("sessionsCompleted").textContent = sessionsCompletedToday.count;
  const todayMinutes = studyLog[todayStr()] || 0;
  document.getElementById("timerTotalMinutes").textContent = todayMinutes + "m";
}

document.getElementById("timerStartBtn").addEventListener("click", () => {
  if (isRunning) return;
  isRunning = true;
  timerInterval = setInterval(tickTimer, 1000);
});

document.getElementById("timerPauseBtn").addEventListener("click", () => {
  isRunning = false;
  clearInterval(timerInterval);
});

document.getElementById("timerResetBtn").addEventListener("click", () => {
  isRunning = false;
  clearInterval(timerInterval);
  timerMode = "study";
  totalSeconds = timerSettings.studyMinutes * 60;
  secondsLeft = totalSeconds;
  updateTimerDisplay();
});

function tickTimer() {
  secondsLeft--;
  if (secondsLeft <= 0) {
    handleTimerComplete();
    return;
  }
  updateTimerDisplay();
}

function handleTimerComplete() {
  clearInterval(timerInterval);
  isRunning = false;

  if (timerMode === "study") {
    // Log study minutes for today
    const minutesStudied = timerSettings.studyMinutes;
    studyLog[todayStr()] = (studyLog[todayStr()] || 0) + minutesStudied;
    saveData(STORAGE_KEYS.studylog, studyLog);

    sessionsCompletedToday.count++;
    saveData("studymate_sessions_today", sessionsCompletedToday);

    addNotification(`Great job! You completed a ${minutesStudied}-minute study session.`);
    showToast("Study session complete! Time for a break.", "success");

    timerMode = "break";
    totalSeconds = timerSettings.breakMinutes * 60;
  } else {
    addNotification("Break finished. Ready for another study session?");
    showToast("Break over! Ready to study again?", "success");
    timerMode = "study";
    totalSeconds = timerSettings.studyMinutes * 60;
  }
  secondsLeft = totalSeconds;
  updateTimerDisplay();
  renderTimerStats();
  renderDashboard();
  renderProgress();
}

document.getElementById("saveTimerSettingsBtn").addEventListener("click", () => {
  const studyVal = parseInt(document.getElementById("studyDurationInput").value, 10);
  const breakVal = parseInt(document.getElementById("breakDurationInput").value, 10);

  if (isNaN(studyVal) || studyVal <= 0 || isNaN(breakVal) || breakVal <= 0) {
    showToast("Please enter valid durations (positive numbers).", "error");
    return;
  }

  timerSettings = { studyMinutes: studyVal, breakMinutes: breakVal };
  saveData(STORAGE_KEYS.timer, timerSettings);

  // Reset current timer to reflect new settings
  isRunning = false;
  clearInterval(timerInterval);
  timerMode = "study";
  totalSeconds = timerSettings.studyMinutes * 60;
  secondsLeft = totalSeconds;
  updateTimerDisplay();

  showToast("Timer settings saved", "success");
});

/* ---------------------------------------------------------
   11. PROGRESS MODULE
--------------------------------------------------------- */
function renderProgress() {
  // Weekly bar chart
  const chart = document.getElementById("weeklyChart");
  const days = getLast7DaysMinutes();
  const maxMinutes = Math.max(60, ...days.map(d => d.minutes));
  chart.innerHTML = days.map(d => {
    const heightPct = Math.round((d.minutes / maxMinutes) * 100);
    const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
    return `<div class="bar-col">
      <span class="bar-value">${(d.minutes / 60).toFixed(1)}h</span>
      <div class="bar" style="height:${Math.max(heightPct, 3)}%"></div>
      <span>${label}</span>
    </div>`;
  }).join("");

  // Weekly goal ring
  const pct = computeWeeklyGoalPercent();
  const goalRing = document.getElementById("goalRing");
  goalRing.style.setProperty("--pct", pct);
  document.getElementById("goalPercentText").textContent = pct + "%";
  const totalHoursThisWeek = (days.reduce((a, b) => a + b.minutes, 0) / 60).toFixed(1);
  document.getElementById("goalDetailText").textContent = `${totalHoursThisWeek} / ${settings.weeklyGoal} hours this week`;

  // Subject progress list
  const subjList = document.getElementById("progressSubjectsList");
  if (subjects.length === 0) {
    subjList.innerHTML = `<div class="empty-state"><div class="empty-icon-badge"><i class="fa-solid fa-book"></i></div><p>Add subjects to see progress here.</p></div>`;
  } else {
    subjList.innerHTML = subjects.map(s => {
      const pct2 = s.totalHours > 0 ? Math.min(100, Math.round((s.studiedHours / s.totalHours) * 100)) : 0;
      return `<div class="mini-item">
        <span class="subject-dot" style="background:${s.color}"></span>
        <div class="mini-item-body">
          <h4>${escapeHtml(s.name)}</h4>
          <div class="progress-bar" style="margin-top:6px;"><div class="progress-fill" style="width:${pct2}%; background:${s.color}"></div></div>
        </div>
        <span class="badge badge-medium">${pct2}%</span>
      </div>`;
    }).join("");
  }

  document.getElementById("progressStreakCount").textContent = computeStreak();
}

/* ---------------------------------------------------------
   12. SETTINGS MODULE
--------------------------------------------------------- */
const darkModeSwitch = document.getElementById("darkModeSwitch");
const notifSwitch = document.getElementById("notifSwitch");
const weeklyGoalInput = document.getElementById("weeklyGoalInput");

function applyTheme() {
  document.documentElement.setAttribute("data-theme", settings.darkMode ? "dark" : "light");
  themeToggle.innerHTML = settings.darkMode
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
  darkModeSwitch.checked = settings.darkMode;
}

function loadSettingsUI() {
  applyTheme();
  notifSwitch.checked = settings.notifications;
  weeklyGoalInput.value = settings.weeklyGoal;
  document.getElementById("studyDurationInput").value = timerSettings.studyMinutes;
  document.getElementById("breakDurationInput").value = timerSettings.breakMinutes;
}

themeToggle.addEventListener("click", () => {
  settings.darkMode = !settings.darkMode;
  saveData(STORAGE_KEYS.settings, settings);
  applyTheme();
});

darkModeSwitch.addEventListener("change", () => {
  settings.darkMode = darkModeSwitch.checked;
  saveData(STORAGE_KEYS.settings, settings);
  applyTheme();
});

notifSwitch.addEventListener("change", () => {
  settings.notifications = notifSwitch.checked;
  saveData(STORAGE_KEYS.settings, settings);
  showToast(settings.notifications ? "Notifications enabled" : "Notifications disabled", "success");
});

weeklyGoalInput.addEventListener("change", () => {
  const val = parseInt(weeklyGoalInput.value, 10);
  if (isNaN(val) || val <= 0) {
    showToast("Please enter a valid weekly goal.", "error");
    weeklyGoalInput.value = settings.weeklyGoal;
    return;
  }
  settings.weeklyGoal = val;
  saveData(STORAGE_KEYS.settings, settings);
  showToast("Weekly goal updated", "success");
  renderDashboard();
  renderProgress();
});

document.getElementById("clearDataBtn").addEventListener("click", () => {
  confirmAction(
    "This will delete all tasks, subjects, sessions and study history. Continue?",
    () => {
      tasks = []; subjects = []; schedule = []; studyLog = {}; notifications = [];
      sessionsCompletedToday = { date: todayStr(), count: 0 };
      saveData(STORAGE_KEYS.tasks, tasks);
      saveData(STORAGE_KEYS.subjects, subjects);
      saveData(STORAGE_KEYS.schedule, schedule);
      saveData(STORAGE_KEYS.studylog, studyLog);
      saveData(STORAGE_KEYS.notifications, notifications);
      saveData("studymate_sessions_today", sessionsCompletedToday);
      showToast("All data cleared", "success");
      refreshEverything();
    }
  );
});

document.getElementById("resetAppBtn").addEventListener("click", () => {
  confirmAction(
    "This will reset StudyMate completely, including settings and timer preferences. Continue?",
    () => {
      localStorage.clear();
      location.reload();
    }
  );
});

/* ---------------------------------------------------------
   13. MODALS & CONFIRM DIALOG
--------------------------------------------------------- */
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

document.querySelectorAll(".close-modal").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.classList.remove("open");
  });
});

let pendingConfirmAction = null;
function confirmAction(message, onConfirm) {
  document.getElementById("confirmMessage").textContent = message;
  pendingConfirmAction = onConfirm;
  document.getElementById("confirmModal").classList.add("open");
}
document.getElementById("confirmActionBtn").addEventListener("click", () => {
  if (pendingConfirmAction) pendingConfirmAction();
  pendingConfirmAction = null;
  closeModal("confirmModal");
});

/* ---------------------------------------------------------
   GLOBAL SEARCH (simple filter across tasks/subjects/sessions)
--------------------------------------------------------- */
document.getElementById("globalSearch").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return;
  // Basic behavior: if user is searching, jump to Tasks and filter title matches
  const matchedTask = tasks.find(t => t.title.toLowerCase().includes(q));
  const matchedSubject = subjects.find(s => s.name.toLowerCase().includes(q));
  if (matchedTask) {
    goToPage("tasks");
  } else if (matchedSubject) {
    goToPage("subjects");
  }
});

/* ---------------------------------------------------------
   13b. AVATAR / PROFILE MODULE
   Uses the free DiceBear avatar API to generate fun,
   copyright-free cartoon avatars from a text "seed".
   Users can also upload their own photo (stored as base64
   locally — never uploaded anywhere).
--------------------------------------------------------- */
const profileBtn = document.getElementById("profileBtn");
const avatarModal = document.getElementById("avatarModal");
const avatarGrid = document.getElementById("avatarGrid");
const profileNameInput = document.getElementById("profileNameInput");
const avatarUploadInput = document.getElementById("avatarUpload");
const avatarFormError = document.getElementById("avatarFormError");

let avatarSeeds = [];
let selectedSeed = profile.avatarSeed;
let pendingCustomImage = null;

function avatarUrlForSeed(seed) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;
}

function currentAvatarSrc() {
  if (profile.customImage) return profile.customImage;
  return avatarUrlForSeed(profile.avatarSeed);
}

function renderProfileHeader() {
  document.getElementById("profileAvatarImg").src = currentAvatarSrc();
  document.getElementById("profileNameDisplay").textContent = profile.name || "Student";
}

function generateRandomSeeds(count) {
  const seeds = [];
  for (let i = 0; i < count; i++) {
    seeds.push(Math.random().toString(36).slice(2, 10));
  }
  return seeds;
}

function renderAvatarGrid() {
  avatarGrid.innerHTML = "";
  avatarSeeds.forEach(seed => {
    const div = document.createElement("div");
    div.className = "avatar-option" + (seed === selectedSeed && !pendingCustomImage ? " selected" : "");
    div.innerHTML = `<img src="${avatarUrlForSeed(seed)}" alt="avatar option" loading="lazy" />`;
    div.addEventListener("click", () => {
      selectedSeed = seed;
      pendingCustomImage = null;
      avatarUploadInput.value = "";
      renderAvatarGrid();
    });
    avatarGrid.appendChild(div);
  });
}

function openAvatarModal() {
  profileNameInput.value = profile.name || "";
  selectedSeed = profile.avatarSeed;
  pendingCustomImage = null;
  avatarFormError.textContent = "";
  avatarUploadInput.value = "";
  // Always include the current avatar seed plus a fresh batch of random options
  avatarSeeds = [profile.avatarSeed, ...generateRandomSeeds(9)];
  renderAvatarGrid();
  avatarModal.classList.add("open");
}

profileBtn.addEventListener("click", openAvatarModal);

document.getElementById("randomizeAvatarBtn").addEventListener("click", () => {
  avatarSeeds = generateRandomSeeds(10);
  renderAvatarGrid();
});

avatarUploadInput.addEventListener("change", () => {
  const file = avatarUploadInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    avatarFormError.textContent = "Please select a valid image file.";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    avatarFormError.textContent = "Image is too large. Please choose one under 2MB.";
    return;
  }
  avatarFormError.textContent = "";
  const reader = new FileReader();
  reader.onload = () => {
    pendingCustomImage = reader.result;
    // Deselect grid options visually since a custom photo takes priority
    document.querySelectorAll(".avatar-option").forEach(el => el.classList.remove("selected"));
  };
  reader.readAsDataURL(file);
});

document.getElementById("saveAvatarBtn").addEventListener("click", () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    avatarFormError.textContent = "Please enter a display name.";
    return;
  }
  profile.name = name;
  if (pendingCustomImage) {
    profile.customImage = pendingCustomImage;
  } else {
    profile.customImage = null;
    profile.avatarSeed = selectedSeed;
  }
  saveData(PROFILE_KEY, profile);
  renderProfileHeader();
  closeModal("avatarModal");
  showToast("Avatar updated", "success");
});

/* ---------------------------------------------------------
   14. INIT
--------------------------------------------------------- */
function refreshEverything() {
  populateAllSubjectSelects();
  renderDashboard();
  renderSchedule();
  renderSubjects();
  renderTasks();
  renderProgress();
  renderNotifications();
  renderTimerStats();
}

function init() {
  loadSettingsUI();
  updateTimerDisplay();
  renderProfileHeader();
  refreshEverything();
  goToPage("dashboard");
}

init();
