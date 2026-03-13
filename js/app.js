// === БАЗОВОЕ СОСТОЯНИЕ И ХРАНЕНИЕ ===

const STORAGE_KEY = "gymtrack_full_v1";

let state = {
  workouts: [],              // список тренировок
  templates: [],             // шаблоны тренировок
  achievements: [],          // полученные бейджи
  settings: {
    restDurationSec: 60,
    betweenExercisesSec: 120,
    theme: "dark",
  },
  ui: {
    selectedWorkoutId: null,
    selectedExerciseRuntime: {},   // runtime-данные по упражнениям (firstSetTs и т.п.)
    timer: {
      type: null,                  // 'rest' | 'between'
      isRunning: false,
      endTs: null,
      intervalId: null,
    },
    statsRange: {
      type: "all",
      from: null,
      to: null,
    },
    calendar: {
      year: new Date().getFullYear(),
      month: new Date().getMonth(), // 0-11
      selectedDate: null,           // 'YYYY-MM-DD'
    },
  },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    state.workouts = Array.isArray(parsed.workouts) ? parsed.workouts : [];
    state.templates = Array.isArray(parsed.templates) ? parsed.templates : [];
    state.achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements
      : [];
    state.settings = {
      ...state.settings,
      ...(parsed.settings || {}),
    };
  } catch (e) {
    console.error("Ошибка загрузки состояния", e);
  }
}

function saveState() {
  try {
    const toSave = {
      workouts: state.workouts,
      templates: state.templates,
      achievements: state.achievements,
      settings: state.settings,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("Ошибка сохранения состояния", e);
  }
}

function nowTs() {
  return Date.now();
}

function formatDate(dStr) {
  if (!dStr) return "-";
  const [y, m, d] = dStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

function formatMinutesFromSeconds(sec) {
  if (!sec) return "0";
  const minutes = Math.round(sec / 60);
  return String(minutes);
}

function isoFromDate(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

function parseISO(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// === DOM-ЭЛЕМЕНТЫ ===

const views = {
  workoutsView: document.getElementById("workoutsView"),
  statsView: document.getElementById("statsView"),
  calendarView: document.getElementById("calendarView"),
  achievementsView: document.getElementById("achievementsView"),
  settingsView: document.getElementById("settingsView"),
};

const navTabs = document.querySelectorAll(".nav-tab");

// Workouts
const workoutListEl = document.getElementById("workoutList");
const newWorkoutBtn = document.getElementById("newWorkoutBtn");
const newWorkoutFromTemplateBtn = document.getElementById(
  "newWorkoutFromTemplateBtn"
);
const workoutDetailTitle = document.getElementById("workoutDetailTitle");
const workoutMetaEl = document.getElementById("workoutMeta");
const newExerciseBtn = document.getElementById("newExerciseBtn");
const exerciseListEl = document.getElementById("exerciseList");
const startWorkoutBtn = document.getElementById("startWorkoutBtn");
const finishWorkoutBtn = document.getElementById("finishWorkoutBtn");
const deleteWorkoutBtn = document.getElementById("deleteWorkoutBtn");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const restDurationLabel = document.getElementById("restDurationLabel");
const betweenDurationLabel = document.getElementById("betweenDurationLabel");

// Статистика
const statTotalWorkouts = document.getElementById("statTotalWorkouts");
const statTotalTime = document.getElementById("statTotalTime");
const statAvgDuration = document.getElementById("statAvgDuration");
const statTotalTonnage = document.getElementById("statTotalTonnage");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const statsRangeSelect = document.getElementById("statsRangeSelect");
const statsCustomRange = document.getElementById("statsCustomRange");
const statsFromDate = document.getElementById("statsFromDate");
const statsToDate = document.getElementById("statsToDate");
const statsApplyRangeBtn = document.getElementById("statsApplyRangeBtn");
const exerciseSelectForWeightChart = document.getElementById(
  "exerciseSelectForWeightChart"
);
const weightChartCanvas = document.getElementById("weightChart");
const tonnageChartCanvas = document.getElementById("tonnageChart");
const timePerExerciseChartCanvas = document.getElementById(
  "timePerExerciseChart"
);

// Календарь
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarPrevBtn = document.getElementById("calendarPrevBtn");
const calendarNextBtn = document.getElementById("calendarNextBtn");
const calendarDayDetails = document.getElementById("calendarDayDetails");

// Достижения
const achievementsListEl = document.getElementById("achievementsList");

// Настройки
const settingsForm = document.getElementById("settingsForm");
const restDurationInput = document.getElementById("restDurationInput");
const betweenDurationInput = document.getElementById("betweenDurationInput");
const themeToggleBtn = document.getElementById("themeToggleBtn");

// Presets
document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = Number(btn.dataset.restPreset);
    restDurationInput.value = v;
  });
});

// Модалки
const workoutModal = document.getElementById("workoutModal");
const workoutModalTitle = document.getElementById("workoutModalTitle");
const workoutForm = document.getElementById("workoutForm");
const workoutNameInput = document.getElementById("workoutNameInput");
const workoutDateInput = document.getElementById("workoutDateInput");
const closeWorkoutModalBtn = document.getElementById("closeWorkoutModalBtn");

const exerciseModal = document.getElementById("exerciseModal");
const exerciseModalTitle = document.getElementById("exerciseModalTitle");
const exerciseForm = document.getElementById("exerciseForm");
const exerciseNameInput = document.getElementById("exerciseNameInput");
const exerciseSetsInput = document.getElementById("exerciseSetsInput");
const exerciseRepsInput = document.getElementById("exerciseRepsInput");
const exerciseWeightInput = document.getElementById("exerciseWeightInput");
const exerciseImageInput = document.getElementById("exerciseImageInput");
const closeExerciseModalBtn = document.getElementById("closeExerciseModalBtn");

const templateModal = document.getElementById("templateModal");
const templateListEl = document.getElementById("templateList");
const closeTemplateModalBtn = document.getElementById("closeTemplateModalBtn");

const timerModal = document.getElementById("timerModal");
const timerTitle = document.getElementById("timerTitle");
const timerDisplay = document.getElementById("timerDisplay");
const timerStopBtn = document.getElementById("timerStopBtn");

const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmOkBtn = document.getElementById("confirmOkBtn");

const achievementModal = document.getElementById("achievementModal");
const achievementModalBody = document.getElementById("achievementModalBody");
const achievementModalCloseBtn = document.getElementById(
  "achievementModalCloseBtn"
);

let pendingConfirmAction = null;
let editingWorkoutId = null;
let editingExerciseId = null;

// Charts (ленивая инициализация)
let weightChart = null;
let tonnageChart = null;
let timePerExerciseChart = null;

// === НАВИГАЦИЯ ===

navTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    const viewId = btn.dataset.view;
    setActiveView(viewId);
  });
});

function setActiveView(viewId) {
  Object.entries(views).forEach(([id, el]) => {
    el.classList.toggle("view--active", id === viewId);
  });
  navTabs.forEach((btn) => {
    btn.classList.toggle(
      "nav-tab--active",
      btn.dataset.view === viewId
    );
  });

  // лениво обновляем шарты и календари
  if (viewId === "statsView") {
    renderStats();
    renderCharts();
  }
  if (viewId === "calendarView") {
    renderCalendar();
  }
  if (viewId === "achievementsView") {
    renderAchievements();
  }
}

// === ТЕМА ===

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.settings.theme);
  // Радио-кнопки в настройках
  const radios = settingsForm.elements["theme"];
  Array.from(radios).forEach((r) => {
    r.checked = r.value === state.settings.theme;
  });
}

themeToggleBtn.addEventListener("click", () => {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
});

// === ТРЕНИРОВКИ И УПРАЖНЕНИЯ ===

function createEmptyWorkout(name, dateStr) {
  const ts = nowTs();
  return {
    id: ts,
    name,
    date: dateStr,
    isPlanned: true,
    status: "planned", // planned | active | completed
    totalTimeSec: 0,
    startTs: null,
    endTs: null,
    exercises: [],
  };
}

function getSelectedWorkout() {
  return state.workouts.find((w) => w.id === state.ui.selectedWorkoutId) || null;
}

function renderWorkouts() {
  workoutListEl.innerHTML = "";
  const workouts = [...state.workouts].sort((a, b) => b.id - a.id);
  if (!workouts.length) {
    const li = document.createElement("li");
    li.textContent = "Пока нет тренировок. Создайте первую!";
    li.style.fontSize = "13px";
    li.style.color = "var(--muted-color)";
    workoutListEl.appendChild(li);
    return;
  }

  workouts.forEach((w) => {
    const li = document.createElement("li");
    li.className = "workout-item";
    if (w.id === state.ui.selectedWorkoutId) {
      li.classList.add("workout-item--active");
    }

    const mainDiv = document.createElement("div");
    mainDiv.className = "workout-item-main";

    const nameSpan = document.createElement("span");
    nameSpan.className = "workout-name";
    nameSpan.textContent = w.name;

    const metaDiv = document.createElement("div");
    metaDiv.className = "workout-meta-line";
    const dateSpan = document.createElement("span");
    dateSpan.textContent = formatDate(w.date);

    const statusPill = document.createElement("span");
    statusPill.className = "status-pill";
    if (w.status === "planned") {
      statusPill.classList.add("status-pill--planned");
      statusPill.textContent = "Запланирована";
    } else if (w.status === "active") {
      statusPill.classList.add("status-pill--active");
      statusPill.textContent = "Активна";
    } else {
      statusPill.classList.add("status-pill--completed");
      statusPill.textContent = "Выполнена";
    }

    metaDiv.appendChild(dateSpan);
    metaDiv.appendChild(statusPill);

    mainDiv.appendChild(nameSpan);
    mainDiv.appendChild(metaDiv);

    const rightDiv = document.createElement("div");
    rightDiv.className = "workout-meta-line";
    rightDiv.style.justifyContent = "flex-end";
    rightDiv.textContent =
      w.totalTimeSec > 0
        ? `${formatMinutesFromSeconds(w.totalTimeSec)} мин`
        : "-";

    li.appendChild(mainDiv);
    li.appendChild(rightDiv);

    li.addEventListener("click", () => {
      state.ui.selectedWorkoutId = w.id;
      renderAll();
    });

    workoutListEl.appendChild(li);
  });
}

function renderWorkoutDetail() {
  const w = getSelectedWorkout();
  if (!w) {
    workoutDetailTitle.textContent = "Детали тренировки";
    workoutMetaEl.textContent = "Выберите тренировку или создайте новую.";
    newExerciseBtn.disabled = true;
    startWorkoutBtn.disabled = true;
    finishWorkoutBtn.disabled = true;
    deleteWorkoutBtn.disabled = true;
    saveTemplateBtn.disabled = true;
    exerciseListEl.innerHTML = "";
    restDurationLabel.textContent = state.settings.restDurationSec;
    betweenDurationLabel.textContent = state.settings.betweenExercisesSec;
    return;
  }

  workoutDetailTitle.textContent = w.name;
  const lines = [];
  lines.push(`Дата: ${formatDate(w.date)}`);
  lines.push(
    `Статус: ${
      w.status === "planned"
        ? "Запланирована"
        : w.status === "active"
        ? "Активна"
        : "Выполнена"
    }`
  );
  if (w.totalTimeSec) {
    lines.push(`Время: ${formatMinutesFromSeconds(w.totalTimeSec)} мин`);
  }
  workoutMetaEl.textContent = lines.join(" • ");

  newExerciseBtn.disabled = false;
  deleteWorkoutBtn.disabled = false;
  saveTemplateBtn.disabled = false;

  if (w.status === "planned") {
    startWorkoutBtn.disabled = false;
    finishWorkoutBtn.disabled = true;
  } else if (w.status === "active") {
    startWorkoutBtn.disabled = true;
    finishWorkoutBtn.disabled = false;
  } else {
    startWorkoutBtn.disabled = true;
    finishWorkoutBtn.disabled = true;
  }

  restDurationLabel.textContent = state.settings.restDurationSec;
  betweenDurationLabel.textContent = state.settings.betweenExercisesSec;

  // Список упражнений
  exerciseListEl.innerHTML = "";
  if (!w.exercises.length) {
    const li = document.createElement("li");
    li.textContent = "Добавьте упражнения к тренировке.";
    li.style.fontSize = "13px";
    li.style.color = "var(--muted-color)";
    exerciseListEl.appendChild(li);
  } else {
    w.exercises.forEach((ex) => {
      const li = document.createElement("li");
      li.className = "exercise-item";

      const main = document.createElement("div");
      main.className = "exercise-main";

      const nameSpan = document.createElement("span");
      nameSpan.className = "exercise-name";
      nameSpan.textContent = ex.name;

      const meta = document.createElement("div");
      meta.className = "exercise-meta";
      meta.textContent = `${ex.sets}×${ex.reps} • ${ex.weight} кг`;

      const progress = document.createElement("div");
      progress.className = "exercise-progress";
      const done = ex.completedSets || 0;
      progress.textContent = `Подходы: ${done}/${ex.sets}`;

      main.appendChild(nameSpan);
      main.appendChild(meta);
      main.appendChild(progress);

      const actions = document.createElement("div");
      actions.className = "exercise-actions";

      if (w.status === "active") {
        const completeSetBtn = document.createElement("button");
        completeSetBtn.className = "secondary-button";
        completeSetBtn.textContent = "Выполнил подход";
        completeSetBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleCompleteSet(w.id, ex.id);
        });
        actions.appendChild(completeSetBtn);
      } else if (ex.completedSets >= ex.sets) {
        const finLabel = document.createElement("div");
        finLabel.className = "exercise-complete-label";
        finLabel.textContent = "Упражнение завершено";
        actions.appendChild(finLabel);
      }

      const editBtn = document.createElement("button");
      editBtn.className = "secondary-button";
      editBtn.textContent = "Редактировать";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openExerciseModal(w.id, ex.id);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "secondary-button danger";
      deleteBtn.textContent = "Удалить";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showConfirm(
          "Удалить упражнение",
          `Удалить упражнение "${ex.name}"?`,
          () => {
            const ww = getSelectedWorkout();
            if (!ww) return;
            ww.exercises = ww.exercises.filter((x) => x.id !== ex.id);
            saveState();
            renderAll();
          }
        );
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(main);
      li.appendChild(actions);
      exerciseListEl.appendChild(li);
    });
  }
}

// === МОДАЛ ОКНО ТРЕНИРОВКИ ===

function openWorkoutModal(workoutId = null) {
  editingWorkoutId = workoutId;
  if (workoutId) {
    const w = state.workouts.find((x) => x.id === workoutId);
    if (!w) return;
    workoutModalTitle.textContent = "Редактирование тренировки";
    workoutNameInput.value = w.name;
    workoutDateInput.value = w.date;
  } else {
    workoutModalTitle.textContent = "Новая тренировка";
    workoutNameInput.value = "";
    workoutDateInput.value = isoFromDate(new Date());
  }
  workoutModal.classList.remove("hidden");
}

function closeWorkoutModal() {
  workoutModal.classList.add("hidden");
  editingWorkoutId = null;
}

newWorkoutBtn.addEventListener("click", () => openWorkoutModal());
closeWorkoutModalBtn.addEventListener("click", () => closeWorkoutModal());

workoutForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = workoutNameInput.value.trim();
  const date = workoutDateInput.value;
  if (!name || !date) return;

  if (editingWorkoutId) {
    const w = state.workouts.find((x) => x.id === editingWorkoutId);
    if (!w) return;
    w.name = name;
    w.date = date;
  } else {
    const w = createEmptyWorkout(name, date);
    state.workouts.push(w);
    state.ui.selectedWorkoutId = w.id;
  }
  saveState();
  closeWorkoutModal();
  recomputeAchievements();
  renderAll();
});

// === МОДАЛ ОКНО УПРАЖНЕНИЯ ===

function openExerciseModal(workoutId, exerciseId = null) {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  editingWorkoutId = workoutId;
  editingExerciseId = exerciseId;

  if (exerciseId) {
    const ex = w.exercises.find((x) => x.id === exerciseId);
    if (!ex) return;
    exerciseModalTitle.textContent = "Редактирование упражнения";
    exerciseNameInput.value = ex.name;
    exerciseSetsInput.value = ex.sets;
    exerciseRepsInput.value = ex.reps;
    exerciseWeightInput.value = ex.weight;
    exerciseImageInput.value = ex.imageUrl || "";
  } else {
    exerciseModalTitle.textContent = "Новое упражнение";
    exerciseNameInput.value = "";
    exerciseSetsInput.value = 3;
    exerciseRepsInput.value = 10;
    exerciseWeightInput.value = 0;
    exerciseImageInput.value = "";
  }

  exerciseModal.classList.remove("hidden");
}

function closeExerciseModal() {
  exerciseModal.classList.add("hidden");
  editingWorkoutId = null;
  editingExerciseId = null;
}

newExerciseBtn.addEventListener("click", () => {
  const w = getSelectedWorkout();
  if (!w) return;
  openExerciseModal(w.id);
});

closeExerciseModalBtn.addEventListener("click", () => closeExerciseModal());

exerciseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const w = state.workouts.find((x) => x.id === editingWorkoutId);
  if (!w) return;

  const name = exerciseNameInput.value.trim();
  const sets = Number(exerciseSetsInput.value) || 0;
  const reps = Number(exerciseRepsInput.value) || 0;
  const weight = Number(exerciseWeightInput.value) || 0;
  const imageUrl = exerciseImageInput.value.trim() || undefined;

  if (!name || sets <= 0 || reps <= 0 || weight < 0) return;

  if (editingExerciseId) {
    const ex = w.exercises.find((x) => x.id === editingExerciseId);
    if (!ex) return;
    ex.name = name;
    ex.sets = sets;
    ex.reps = reps;
    ex.weight = weight;
    ex.imageUrl = imageUrl;
  } else {
    const id = nowTs();
    w.exercises.push({
      id,
      name,
      sets,
      reps,
      weight,
      imageUrl,
      completedSets: 0,
      elapsedTimeSec: 0,
    });
  }

  saveState();
  closeExerciseModal();
  recomputeAchievements();
  renderAll();
});

// === СТАТУС ТРЕНИРОВКИ И ХРОНОМЕТРАЖ ТРЕНИРОВКИ ===

startWorkoutBtn.addEventListener("click", () => {
  const w = getSelectedWorkout();
  if (!w) return;
  if (w.status !== "planned") return;

  // Сброс прогресса подходов
  w.exercises.forEach((ex) => {
    ex.completedSets = 0;
    ex.elapsedTimeSec = 0;
  });

  // Старт "сегодня"
  const todayIso = isoFromDate(new Date());
  w.date = todayIso;
  w.status = "active";
  w.startTs = nowTs();
  w.endTs = null;
  w.totalTimeSec = 0;

  saveState();
  recomputeAchievements();
  renderAll();
});

finishWorkoutBtn.addEventListener("click", () => {
  const w = getSelectedWorkout();
  if (!w) return;
  if (w.status !== "active") return;
  w.status = "completed";
  w.endTs = nowTs();
  if (w.startTs && w.endTs) {
    w.totalTimeSec = Math.round((w.endTs - w.startTs) / 1000);
  }
  saveState();
  recomputeAchievements();
  renderAll();
});

deleteWorkoutBtn.addEventListener("click", () => {
  const w = getSelectedWorkout();
  if (!w) return;
  showConfirm("Удалить тренировку", `Удалить тренировку "${w.name}"?`, () => {
    state.workouts = state.workouts.filter((x) => x.id !== w.id);
    if (state.ui.selectedWorkoutId === w.id) {
      state.ui.selectedWorkoutId = null;
    }
    saveState();
    recomputeAchievements();
    renderAll();
  });
});

// === ОБРАБОТКА ПОДХОДОВ И ХРОНОМЕТРАЖ УПРАЖНЕНИЙ ===

function handleCompleteSet(workoutId, exerciseId) {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w || w.status !== "active") return;
  const ex = w.exercises.find((x) => x.id === exerciseId);
  if (!ex) return;

  const now = nowTs();

  // Хроно: время от первого до последнего подхода
  if (!state.ui.selectedExerciseRuntime[exerciseId]) {
    state.ui.selectedExerciseRuntime[exerciseId] = {
      firstSetTs: now,
    };
  }
  const rt = state.ui.selectedExerciseRuntime[exerciseId];

  ex.completedSets = (ex.completedSets || 0) + 1;

  if (ex.completedSets >= ex.sets) {
    // Последний подход у упражнения
    const elapsed =
      (now - (rt.firstSetTs || now)) / 1000;
    ex.elapsedTimeSec += elapsed;
    delete state.ui.selectedExerciseRuntime[exerciseId];

    // Таймер между упражнениями
    if (state.settings.betweenExercisesSec > 0) {
      startTimer(
        state.settings.betweenExercisesSec,
        "between"
      );
    }
  } else {
    // Не последний — таймер отдыха между подходами
    if (state.settings.restDurationSec > 0) {
      startTimer(
        state.settings.restDurationSec,
        "rest"
      );
    }
  }

  saveState();
  recomputeAchievements();
  renderAll();
}

// === ТАЙМЕРЫ И ЗВУК ===

let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playBeep(frequency = 880, durationMs = 150) {
  try {
    const ctx = ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(
      0.001,
      ctx.currentTime + durationMs / 1000
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
  } catch (e) {
    // на некоторых устройствах может не работать, но это ОК
  }
}

function playEndSignal() {
  // длинный двухтональный сигнал: 660 и 440 Гц
  try {
    const ctx = ensureAudioCtx();
    function tone(freq, startOffset) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + startOffset;
      const duration = 0.35;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.5, start + 0.03);
      gain.gain.linearRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    }
    tone(660, 0);
    tone(440, 0.4);
  } catch (e) {}
}

function openTimerModal(title) {
  timerTitle.textContent = title;
  timerModal.classList.remove("hidden");
}

function closeTimerModal() {
  timerModal.classList.add("hidden");
}

function stopTimer() {
  if (state.ui.timer.intervalId != null) {
    clearInterval(state.ui.timer.intervalId);
  }
  state.ui.timer.isRunning = false;
  state.ui.timer.endTs = null;
  state.ui.timer.intervalId = null;
  state.ui.timer.type = null;
  timerDisplay.textContent = formatTimer(0);
  closeTimerModal();
}

function updateTimerDisplay() {
  if (!state.ui.timer.isRunning || !state.ui.timer.endTs) {
    timerDisplay.textContent = formatTimer(0);
    return;
  }
  const remainingMs = state.ui.timer.endTs - nowTs();
  const remainingSec = remainingMs / 1000;
  if (remainingSec <= 0) {
    timerDisplay.textContent = formatTimer(0);
    playEndSignal();
    stopTimer();
    return;
  }

  const s = Math.floor(remainingSec);
  // короткие сигналы на 5,4,3,2,1
  if ([1, 2, 3, 4, 5].includes(s)) {
    playBeep(880, 120);
  }

  timerDisplay.textContent = formatTimer(remainingSec);
}

function startTimer(durationSec, type) {
  stopTimer(); // сброс предыдущего
  state.ui.timer.isRunning = true;
  state.ui.timer.type = type;
  state.ui.timer.endTs = nowTs() + durationSec * 1000;
  updateTimerDisplay();
  state.ui.timer.intervalId = setInterval(updateTimerDisplay, 200);
  const title =
    type === "rest"
      ? "Отдых между подходами"
      : "Отдых между упражнениями";
  openTimerModal(title);
}

timerStopBtn.addEventListener("click", () => stopTimer());

// === СТАТИСТИКА И ГРАФИКИ ===

function workoutsInRange() {
  const { type, from, to } = state.ui.statsRange;
  if (type === "all") return state.workouts;
  let fromD = null;
  let toD = null;
  if (type === "week") {
    const now = new Date();
    toD = now;
    fromD = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (type === "month") {
    const now = new Date();
    toD = now;
    fromD = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (type === "custom" && from && to) {
    fromD = parseISO(from);
    toD = parseISO(to);
  } else {
    return state.workouts;
  }

  return state.workouts.filter((w) => {
    if (!w.date) return false;
    const d = parseISO(w.date);
    return d >= fromD && d <= toD;
  });
}

function computeTonnageForWorkout(w) {
  return (w.exercises || []).reduce((sum, ex) => {
    return sum + ex.weight * ex.reps * ex.sets;
  }, 0);
}

function recomputeStats() {
  const workouts = workoutsInRange();
  const totalWorkouts = workouts.length;
  const completed = workouts.filter((w) => w.status === "completed");
  const totalTimeSec = completed.reduce(
    (sum, w) => sum + (w.totalTimeSec || 0),
    0
  );
  const avg = completed.length ? totalTimeSec / completed.length : 0;

  const totalTonnage = workouts.reduce(
    (sum, w) => sum + computeTonnageForWorkout(w),
    0
  );

  statTotalWorkouts.textContent = String(totalWorkouts);
  statTotalTime.textContent = formatMinutesFromSeconds(totalTimeSec);
  statAvgDuration.textContent = formatMinutesFromSeconds(avg);
  statTotalTonnage.textContent = String(Math.round(totalTonnage));
}

function buildWeightChartData() {
  const exerciseName = exerciseSelectForWeightChart.value;
  if (!exerciseName) return { labels: [], data: [] };

  const wks = workoutsInRange()
    .filter((w) =>
      (w.exercises || []).some((ex) => ex.name === exerciseName)
    )
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const labels = [];
  const data = [];
  wks.forEach((w) => {
    const exList = w.exercises.filter((ex) => ex.name === exerciseName);
    if (!exList.length) return;
    const maxWeight = Math.max(...exList.map((ex) => ex.weight || 0));
    labels.push(formatDate(w.date));
    data.push(maxWeight);
  });

  return { labels, data };
}

function buildTonnageByWeekData() {
  const wks = workoutsInRange();
  const byWeek = new Map(); // key: 'YYYY-WW', value: tonnage

  wks.forEach((w) => {
    if (!w.date) return;
    const d = parseISO(w.date);
    const year = d.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const week = Math.ceil(
      ((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7
    );
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const t = computeTonnageForWorkout(w);
    byWeek.set(key, (byWeek.get(key) || 0) + t);
  });

  const labels = Array.from(byWeek.keys()).sort();
  const data = labels.map((k) => Math.round(byWeek.get(k)));

  return { labels, data };
}

function buildTimePerExerciseData() {
  const wks = workoutsInRange();
  const byExercise = new Map();
  wks.forEach((w) => {
    (w.exercises || []).forEach((ex) => {
      const key = ex.name;
      const val = byExercise.get(key) || 0;
      byExercise.set(key, val + (ex.elapsedTimeSec || 0));
    });
  });
  const labels = Array.from(byExercise.keys());
  const data = labels.map((name) =>
    Math.round((byExercise.get(name) || 0) / 60)
  );
  return { labels, data };
}

function renderStats() {
  recomputeStats();
  // список упражнений для выпадающего списка
  const exNames = new Set();
  state.workouts.forEach((w) => {
    (w.exercises || []).forEach((ex) => {
      if (ex.name) exNames.add(ex.name);
    });
  });
  const current = exerciseSelectForWeightChart.value;

  exerciseSelectForWeightChart.innerHTML =
    '<option value="">Выберите упражнение</option>';
  Array.from(exNames)
    .sort()
    .forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === current) opt.selected = true;
      exerciseSelectForWeightChart.appendChild(opt);
    });
}

function renderCharts() {
  // Вес
  const weightData = buildWeightChartData();
  if (!weightChart && weightChartCanvas) {
    weightChart = new Chart(weightChartCanvas, {
      type: "line",
      data: {
        labels: weightData.labels,
        datasets: [
          {
            label: "Вес (кг)",
            data: weightData.data,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.3)",
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#9ca3af" } },
          y: { ticks: { color: "#9ca3af" } },
        },
      },
    });
  } else if (weightChart) {
    weightChart.data.labels = weightData.labels;
    weightChart.data.datasets[0].data = weightData.data;
    weightChart.update();
  }

  // Тоннаж по неделям
  const tonnageData = buildTonnageByWeekData();
  if (!tonnageChart && tonnageChartCanvas) {
    tonnageChart = new Chart(tonnageChartCanvas, {
      type: "bar",
      data: {
        labels: tonnageData.labels,
        datasets: [
          {
            label: "Тоннаж (кг)",
            data: tonnageData.data,
            backgroundColor: "rgba(56,189,248,0.6)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#9ca3af" } },
          y: { ticks: { color: "#9ca3af" } },
        },
      },
    });
  } else if (tonnageChart) {
    tonnageChart.data.labels = tonnageData.labels;
    tonnageChart.data.datasets[0].data = tonnageData.data;
    tonnageChart.update();
  }

  // Время по упражнениям
  const timeData = buildTimePerExerciseData();
  if (!timePerExerciseChart && timePerExerciseChartCanvas) {
    timePerExerciseChart = new Chart(timePerExerciseChartCanvas, {
      type: "bar",
      data: {
        labels: timeData.labels,
        datasets: [
          {
            label: "Время (мин)",
            data: timeData.data,
            backgroundColor: "rgba(129,140,248,0.65)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#9ca3af" } },
          y: { ticks: { color: "#9ca3af" } },
        },
      },
    });
  } else if (timePerExerciseChart) {
    timePerExerciseChart.data.labels = timeData.labels;
    timePerExerciseChart.data.datasets[0].data = timeData.data;
    timePerExerciseChart.update();
  }
}

// Фильтры статистики

statsRangeSelect.addEventListener("change", () => {
  const val = statsRangeSelect.value;
  state.ui.statsRange.type = val;
  if (val === "custom") {
    statsCustomRange.classList.remove("hidden");
  } else {
    statsCustomRange.classList.add("hidden");
  }
  renderStats();
  renderCharts();
});

statsApplyRangeBtn.addEventListener("click", () => {
  const from = statsFromDate.value || null;
  const to = statsToDate.value || null;
  state.ui.statsRange.from = from;
  state.ui.statsRange.to = to;
  renderStats();
  renderCharts();
});

exerciseSelectForWeightChart.addEventListener("change", () => {
  renderCharts();
});

// === ЭКСПОРТ / ИМПОРТ ===

exportBtn.addEventListener("click", () => {
  const data = {
    workouts: state.workouts,
    templates: state.templates,
    achievements: state.achievements,
    settings: state.settings,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = isoFromDate(new Date());
  a.href = url;
  a.download = `gymtrack-export-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed || typeof parsed !== "object") throw new Error("bad json");
      const {
        workouts = [],
        templates = [],
        achievements = [],
        settings = {},
      } = parsed;
      showConfirm(
        "Импорт данных",
        "Заменить текущие данные импортированными?",
        () => {
          state.workouts = Array.isArray(workouts) ? workouts : [];
          state.templates = Array.isArray(templates) ? templates : [];
          state.achievements = Array.isArray(achievements)
            ? achievements
            : [];
          state.settings = {
            ...state.settings,
            ...settings,
          };
          saveState();
          applyTheme();
          recomputeAchievements();
          renderAll();
        }
      );
    } catch (err) {
      alert("Ошибка импорта JSON");
      console.error(err);
    }
  };
  reader.readAsText(file);
});

// === МОДАЛ ПОДТВЕРЖДЕНИЯ ===

function showConfirm(title, message, onOk) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  pendingConfirmAction = onOk;
  confirmModal.classList.remove("hidden");
}

function closeConfirm() {
  confirmModal.classList.add("hidden");
  pendingConfirmAction = null;
}

confirmCancelBtn.addEventListener("click", () => closeConfirm());
confirmOkBtn.addEventListener("click", () => {
  if (typeof pendingConfirmAction === "function") {
    pendingConfirmAction();
  }
  closeConfirm();
});

// === КАЛЕНДАРЬ ===

calendarPrevBtn.addEventListener("click", () => {
  const { year, month } = state.ui.calendar;
  const d = new Date(year, month - 1, 1);
  state.ui.calendar.year = d.getFullYear();
  state.ui.calendar.month = d.getMonth();
  renderCalendar();
});

calendarNextBtn.addEventListener("click", () => {
  const { year, month } = state.ui.calendar;
  const d = new Date(year, month + 1, 1);
  state.ui.calendar.year = d.getFullYear();
  state.ui.calendar.month = d.getMonth();
  renderCalendar();
});

function renderCalendar() {
  const { year, month, selectedDate } = state.ui.calendar;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

  calendarGrid.innerHTML = "";
  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  weekDays.forEach((d) => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell calendar-cell--header";
    cell.textContent = d;
    calendarGrid.appendChild(cell);
  });

  const firstWeekday = (firstDay.getDay() + 6) % 7; // 0 - Пн
  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell";
    calendarGrid.appendChild(empty);
  }

  const workoutDates = new Set(
    state.workouts.map((w) => w.date).filter(Boolean)
  );

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell calendar-cell--day";
    const d = new Date(year, month, day);
    const iso = isoFromDate(d);

    cell.textContent = String(day);

    if (workoutDates.has(iso)) {
      cell.classList.add("calendar-cell--with-workout");
    }
    if (selectedDate === iso) {
      cell.classList.add("calendar-cell--selected");
    }

    cell.addEventListener("click", () => {
      state.ui.calendar.selectedDate = iso;
      renderCalendar();
      renderCalendarDayDetails();
    });

    calendarGrid.appendChild(cell);
  }

  renderCalendarDayDetails();
}

function renderCalendarDayDetails() {
  const iso = state.ui.calendar.selectedDate;
  if (!iso) {
    calendarDayDetails.textContent = "Выберите день с тренировками.";
    return;
  }
  const workouts = state.workouts.filter((w) => w.date === iso);
  if (!workouts.length) {
    calendarDayDetails.textContent = "В этот день тренировок не было.";
    return;
  }
  const container = document.createElement("div");
  workouts.forEach((w) => {
    const block = document.createElement("div");
    block.style.marginBottom = "8px";
    const title = document.createElement("div");
    title.style.fontWeight = "500";
    title.textContent = w.name;
    const meta = document.createElement("div");
    meta.style.fontSize = "12px";
    meta.style.color = "var(--muted-color)";
    meta.textContent = `Статус: ${
      w.status === "planned"
        ? "Запланирована"
        : w.status === "active"
        ? "Активна"
        : "Выполнена"
    }`;

    const ul = document.createElement("ul");
    ul.style.fontSize = "12px";
    ul.style.margin = "4px 0 0 0";
    ul.style.paddingLeft = "16px";

    (w.exercises || []).forEach((ex) => {
      const li = document.createElement("li");
      li.textContent = `${ex.name}: ${ex.sets}×${ex.reps} • ${ex.weight} кг (выполнено ${ex.completedSets || 0})`;
      ul.appendChild(li);
    });

    block.appendChild(title);
    block.appendChild(meta);
    block.appendChild(ul);
    container.appendChild(block);
  });

  calendarDayDetails.innerHTML = "";
  calendarDayDetails.appendChild(container);
}

// === ДОСТИЖЕНИЯ ===

// Правила (id, условие, редкость)
const ACHIEVEMENT_RULES = [
  // количество тренировок
  {
    id: "workouts_2",
    title: "Первые шаги",
    rarity: "common",
    check: (wks) => wks.length >= 2,
  },
  {
    id: "workouts_5",
    title: "В ритме",
    rarity: "common",
    check: (wks) => wks.length >= 5,
  },
  {
    id: "workouts_10",
    title: "Десятка",
    rarity: "rare",
    check: (wks) => wks.length >= 10,
  },
  {
    id: "workouts_25",
    title: "Железный воин",
    rarity: "epic",
    check: (wks) => wks.length >= 25,
  },
  {
    id: "workouts_50",
    title: "Легенда зала",
    rarity: "legendary",
    check: (wks) => wks.length >= 50,
  },

  // тоннаж
  {
    id: "tonnage_1000",
    title: "1 тонна железа",
    rarity: "common",
    check: (wks) =>
      wks.reduce((s, w) => s + computeTonnageForWorkout(w), 0) >= 1000,
  },
  {
    id: "tonnage_5000",
    title: "5 тонн железа",
    rarity: "rare",
    check: (wks) =>
      wks.reduce((s, w) => s + computeTonnageForWorkout(w), 0) >= 5000,
  },
  {
    id: "tonnage_10000",
    title: "10 тонн железа",
    rarity: "epic",
    check: (wks) =>
      wks.reduce((s, w) => s + computeTonnageForWorkout(w), 0) >= 10000,
  },

  // серии тренировок
  {
    id: "streak_3",
    title: "Серия 3 дня",
    rarity: "common",
    check: (wks) => computeBestStreak(wks) >= 3,
  },
  {
    id: "streak_7",
    title: "Серия 7 дней",
    rarity: "rare",
    check: (wks) => computeBestStreak(wks) >= 7,
  },
  {
    id: "streak_30",
    title: "Серия 30 дней",
    rarity: "epic",
    check: (wks) => computeBestStreak(wks) >= 30,
  },

  // рекордный вес
  {
    id: "weight_50",
    title: "Рекорд 50 кг",
    rarity: "common",
    check: (wks) => computeMaxWeight(wks) >= 50,
  },
  {
    id: "weight_100",
    title: "Рекорд 100 кг",
    rarity: "rare",
    check: (wks) => computeMaxWeight(wks) >= 100,
  },
  {
    id: "weight_150",
    title: "Рекорд 150 кг",
    rarity: "epic",
    check: (wks) => computeMaxWeight(wks) >= 150,
  },
];

function computeBestStreak(workouts) {
  const dates = Array.from(
    new Set(
      workouts
        .filter((w) => w.status === "completed" && w.date)
        .map((w) => w.date)
    )
  ).sort();
  if (!dates.length) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = parseISO(dates[i - 1]);
    const cur = parseISO(dates[i]);
    const diffDays = (cur - prev) / 86400000;
    if (diffDays === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function computeMaxWeight(workouts) {
  let maxW = 0;
  workouts.forEach((w) => {
    (w.exercises || []).forEach((ex) => {
      if (ex.weight > maxW) maxW = ex.weight;
    });
  });
  return maxW;
}

function rarityClass(rarity) {
  if (rarity === "rare") return "badge-rarity badge-rarity--rare";
  if (rarity === "epic") return "badge-rarity badge-rarity--epic";
  if (rarity === "legendary")
    return "badge-rarity badge-rarity--legendary";
  return "badge-rarity badge-rarity--common";
}

function recomputeAchievements() {
  const wks = state.workouts;
  const existingIds = new Set(state.achievements.map((a) => a.id));
  const newlyEarned = [];

  ACHIEVEMENT_RULES.forEach((rule) => {
    if (existingIds.has(rule.id)) return;
    if (rule.check(wks)) {
      const ach = {
        id: rule.id,
        title: rule.title,
        rarity: rule.rarity,
        earnedAt: nowTs(),
      };
      state.achievements.push(ach);
      newlyEarned.push(ach);
    }
  });

  if (newlyEarned.length) {
    saveState();
    showAchievementModal(newlyEarned);
  }
}

function showAchievementModal(achievements) {
  achievementModalBody.innerHTML = "";
  achievements.forEach((a) => {
    const div = document.createElement("div");
    div.className = "achievement-badge";
    const icon = document.createElement("span");
    icon.innerHTML = '<i class="fa-solid fa-trophy"></i>';
    const title = document.createElement("span");
    title.textContent = a.title;
    const rarity = document.createElement("span");
    rarity.className = rarityClass(a.rarity);
    rarity.textContent =
      a.rarity === "common"
        ? "Обычный"
        : a.rarity === "rare"
        ? "Редкий"
        : a.rarity === "epic"
        ? "Эпический"
        : "Легендарный";
    div.appendChild(icon);
    div.appendChild(title);
    div.appendChild(rarity);
    achievementModalBody.appendChild(div);
  });
  achievementModal.classList.remove("hidden");
}

achievementModalCloseBtn.addEventListener("click", () => {
  achievementModal.classList.add("hidden");
});

function renderAchievements() {
  achievementsListEl.innerHTML = "";
  if (!state.achievements.length) {
    const p = document.createElement("p");
    p.textContent = "Пока нет бейджей. Тренируйтесь, чтобы их заработать!";
    p.className = "hint";
    achievementsListEl.appendChild(p);
    return;
  }
  const sorted = [...state.achievements].sort(
    (a, b) => a.earnedAt - b.earnedAt
  );
  sorted.forEach((a) => {
    const div = document.createElement("div");
    div.className = "achievement-badge";
    const icon = document.createElement("span");
    icon.innerHTML = '<i class="fa-solid fa-trophy"></i>';
    const title = document.createElement("span");
    title.textContent = a.title;
    const rarity = document.createElement("span");
    rarity.className = rarityClass(a.rarity);
    rarity.textContent =
      a.rarity === "common"
        ? "Обычный"
        : a.rarity === "rare"
        ? "Редкий"
        : a.rarity === "epic"
        ? "Эпический"
        : "Легендарный";

    div.appendChild(icon);
    div.appendChild(title);
    div.appendChild(rarity);
    achievementsListEl.appendChild(div);
  });
}

// === ШАБЛОНЫ ТРЕНИРОВОК ===

saveTemplateBtn.addEventListener("click", () => {
  const w = getSelectedWorkout();
  if (!w) return;
  if (!w.exercises || !w.exercises.length) {
    alert("Нельзя создать шаблон без упражнений.");
    return;
  }
  const template = {
    id: nowTs(),
    name: w.name,
    exercises: w.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      imageUrl: ex.imageUrl || null,
    })),
  };
  state.templates.push(template);
  saveState();
  alert("Шаблон сохранён.");
});

// модал с шаблонами

function openTemplateModal() {
  templateListEl.innerHTML = "";
  if (!state.templates.length) {
    const p = document.createElement("p");
    p.textContent = "Пока нет сохранённых шаблонов.";
    p.className = "hint";
    templateListEl.appendChild(p);
  } else {
    state.templates
      .slice()
      .sort((a, b) => b.id - a.id)
      .forEach((t) => {
        const div = document.createElement("div");
        div.className = "template-item";
        const main = document.createElement("div");
        main.className = "template-item-main";
        const name = document.createElement("div");
        name.textContent = t.name;
        const meta = document.createElement("div");
        meta.style.fontSize = "12px";
        meta.style.color = "var(--muted-color)";
        meta.textContent = `${t.exercises.length} упражнений`;

        main.appendChild(name);
        main.appendChild(meta);

        const btn = document.createElement("button");
        btn.className = "primary-button";
        btn.textContent = "Создать";
        btn.addEventListener("click", () => {
          createWorkoutFromTemplate(t);
          closeTemplateModal();
        });

        div.appendChild(main);
        div.appendChild(btn);
        templateListEl.appendChild(div);
      });
  }

  templateModal.classList.remove("hidden");
}

function closeTemplateModal() {
  templateModal.classList.add("hidden");
}

newWorkoutFromTemplateBtn.addEventListener("click", () => {
  openTemplateModal();
});

closeTemplateModalBtn.addEventListener("click", () => closeTemplateModal());

function createWorkoutFromTemplate(template) {
  const todayIso = isoFromDate(new Date());
  const w = createEmptyWorkout(template.name, todayIso);
  w.exercises = template.exercises.map((ex) => ({
    id: nowTs() + Math.random(),
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    weight: ex.weight,
    imageUrl: ex.imageUrl || undefined,
    completedSets: 0,
    elapsedTimeSec: 0,
  }));
  state.workouts.push(w);
  state.ui.selectedWorkoutId = w.id;
  saveState();
  recomputeAchievements();
  renderAll();
}

// === НАСТРОЙКИ ===

settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const rest = Number(restDurationInput.value);
  if (!Number.isNaN(rest) && rest >= 5 && rest <= 600) {
    state.settings.restDurationSec = rest;
  }
  const between = Number(betweenDurationInput.value);
  if (!Number.isNaN(between) && between >= 5 && between <= 600) {
    state.settings.betweenExercisesSec = between;
  }

  const themeVal = settingsForm.elements["theme"].value || "dark";
  state.settings.theme = themeVal;
  applyTheme();
  saveState();
  renderWorkoutDetail();
});

// === ИНИЦИАЛИЗАЦИЯ ===

function renderAll() {
  renderWorkouts();
  renderWorkoutDetail();
  renderStats();
  renderCharts();
  renderCalendar();
  renderAchievements();
}

function initSettingsForm() {
  restDurationInput.value = state.settings.restDurationSec;
  betweenDurationInput.value = state.settings.betweenExercisesSec;
}

function initModalsBackdropClose() {
  [workoutModal, exerciseModal, timerModal, confirmModal, templateModal, achievementModal].forEach(
    (modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal.querySelector(".modal-backdrop")) {
          if (modal === workoutModal) closeWorkoutModal();
          if (modal === exerciseModal) closeExerciseModal();
          if (modal === timerModal) stopTimer();
          if (modal === confirmModal) closeConfirm();
          if (modal === templateModal) closeTemplateModal();
          if (modal === achievementModal) {
            achievementModal.classList.add("hidden");
          }
        }
      });
    }
  );
}

function init() {
  loadState();
  applyTheme();
  initSettingsForm();

  // Стартовые значения для календаря
  const now = new Date();
  state.ui.calendar.year = now.getFullYear();
  state.ui.calendar.month = now.getMonth();

  renderAll();
  initModalsBackdropClose();
}

init();
