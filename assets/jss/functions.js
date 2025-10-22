
const $ = id => document.getElementById(id);

// ---------- POMODORO ----------
let mode = 'work'; // 'work' | 'short' | 'long'
let timers = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
let remaining = timers.work;
let running = false;
let pomInterval = null;
let cycles = 0; 
const pomTime = $('pomTime'), pomMode = $('pomMode'), pomProgress = $('pomProgress'), cycleCount = $('cycleCount');

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return m + ':' + sec;
}

function updatePomUI() {
    pomTime.textContent = formatTime(remaining);
    pomMode.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    const total = timers[mode];
    pomProgress.value = 100 - Math.round((remaining / total) * 100);
    document.title = `${formatTime(remaining)} — ${mode.charAt(0).toUpperCase() + mode.slice(1)} • StudyApp`;
    cycleCount.textContent = cycles;
}

function loadDurations() {
    timers.work = Math.max(1, parseInt($('workMin').value, 10) || 25) * 60;
    timers.short = Math.max(1, parseInt($('shortMin').value, 10) || 5) * 60;
    timers.long = Math.max(1, parseInt($('longMin').value, 10) || 15) * 60;
}

$('workMin').addEventListener('change', () => { loadDurations(); if (mode === 'work') { remaining = timers.work; updatePomUI(); } });
$('shortMin').addEventListener('change', () => { loadDurations(); if (mode === 'short') { remaining = timers.short; updatePomUI(); } });
$('longMin').addEventListener('change', () => { loadDurations(); if (mode === 'long') { remaining = timers.long; updatePomUI(); } });

function playSfx() {
    try {
        const s = $('tickSfx');
        s.volume = parseFloat($('sfx').value);
        s.currentTime = 0;
        s.play().catch(() => { });
    } catch (e) { }
}

function notify(title, body) {
    if (Notification && Notification.permission === 'granted') {
        try { new Notification(title, { body, silent: false }); } catch (e) { }
    } else {
        alert(title + (body ? '\n\n' + body : ''));
    }
}

function tickPom() {
    if (remaining > 0) {
        remaining--;
        updatePomUI();
    } else {
        // session ended
        playSfx();
        if (mode === 'work') cycles++;
        const auto = $('autoSwitch').checked;
        if (auto) {
            if (mode === 'work') {
                if (cycles % 4 === 0) mode = 'long'; else mode = 'short';
            } else {
                mode = 'work';
            }
        } else {
            running = false;
            $('startPause').textContent = 'Start';
        }
        loadDurations();
        remaining = timers[mode];
        updatePomUI();
        notify('Pomodoro', `Time for ${mode === 'work' ? 'work' : mode + ' break'}.`);
    }
}

$('startPause').addEventListener('click', () => {
    if (!running) {
        // start
        loadDurations();
        running = true;
        $('startPause').textContent = 'Pause';
        if (!pomInterval) pomInterval = setInterval(tickPom, 1000);
    } else {
        running = false;
        $('startPause').textContent = 'Start';
        if (pomInterval) { clearInterval(pomInterval); pomInterval = null; }
    }
});

$('skip').addEventListener('click', () => {
    // jump to next
    if (mode === 'work') { cycles++; }
    if (mode === 'work') {
        mode = (cycles % 4 === 0) ? 'long' : 'short';
    } else {
        mode = 'work';
    }
    loadDurations();
    remaining = timers[mode];
    updatePomUI();
    notify('Pomodoro', 'Skipped to next session.');
});

$('reset').addEventListener('click', () => {
    running = false;
    if (pomInterval) { clearInterval(pomInterval); pomInterval = null; }
    mode = 'work';
    loadDurations();
    remaining = timers.work;
    cycles = 0;
    $('startPause').textContent = 'Start';
    updatePomUI();
});

// initialize
loadDurations();
remaining = timers.work;
updatePomUI();

// ---------- TODO (localStorage) ----------
const todoInput = $('todoInput'), addTodo = $('addTodo'), todoList = $('todoList'), clearDone = $('clearDone');
const STORAGE_KEY = 'studyapp.todos';

function saveTodos(todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}
function loadTodos() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) { return []; }
}
function renderTodos() {
    const todos = loadTodos();
    todoList.innerHTML = '';
    if (todos.length === 0) {
        const el = document.createElement('div'); el.style.color = 'var(--muted)'; el.style.fontSize = '14px'; el.textContent = 'No tasks yet';
        todoList.appendChild(el); return;
    }
    todos.forEach((t, i) => {
        const item = document.createElement('div'); item.className = 'todo-item';
        const left = document.createElement('div'); left.className = 'todo-left';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = t.done;
        cb.addEventListener('change', () => { t.done = cb.checked; saveTodos(todos); renderTodos(); });
        const txt = document.createElement('div'); txt.className = 'todo-text'; txt.textContent = t.text;
        if (t.done) txt.classList.add('completed');
        left.appendChild(cb); left.appendChild(txt);
        const right = document.createElement('div');
        const del = document.createElement('button'); del.className = 'trash'; del.title = 'Delete'; del.innerHTML = '✕';
        del.addEventListener('click', () => { todos.splice(i, 1); saveTodos(todos); renderTodos(); });
        right.appendChild(del);
        item.appendChild(left); item.appendChild(right);
        todoList.appendChild(item);
    });
}

addTodo.addEventListener('click', () => { const v = todoInput.value.trim(); if (!v) return; const todos = loadTodos(); todos.unshift({ text: v, done: false, created: Date.now() }); saveTodos(todos); todoInput.value = ''; renderTodos(); });
todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo.click(); });
clearDone.addEventListener('click', () => { const todos = loadTodos().filter(t => !t.done); saveTodos(todos); renderTodos(); });

// initial render
renderTodos();

// ---------- WATER REMINDER ----------
let waterInterval = null;
let waterRunning = false;
let waterDuration = parseInt($('waterMin').value || 45, 10) * 60;
let waterElapsed = 0;

const waterBar = $('waterBar'), waterElapsedLabel = $('waterElapsed'), waterRemainingLabel = $('waterRemaining'), waterNext = $('waterNext');

function updateWaterUI() {
    const pct = Math.min(100, Math.round((waterElapsed / waterDuration) * 100));
    waterBar.style.width = pct + '%';
    waterElapsedLabel.textContent = Math.floor(waterElapsed / 60) + 'm';
    const rem = Math.max(0, waterDuration - waterElapsed);
    waterRemainingLabel.textContent = Math.ceil(rem / 60) + 'm';
    const nextIn = Math.max(0, waterDuration - waterElapsed);
    waterNext.textContent = (nextIn > 0 ? Math.ceil(nextIn / 60) + 'm' : 'Soon');
}

function tickWater() {
    waterElapsed++;
    updateWaterUI();
    if (waterElapsed >= waterDuration) {
        // fire reminder
        playSfx();
        notify('Hydration Reminder', 'Time to drink some water 💧');
        // reset
        waterElapsed = 0;
        updateWaterUI();
    }
}

$('startWater').addEventListener('click', async () => {
    if (Notification && Notification.permission !== 'granted') {
        try {
            await Notification.requestPermission();
        } catch (e) { }
    }
    waterDuration = Math.max(5, parseInt($('waterMin').value, 10) || 45) * 60;
    if (waterRunning) return;
    waterRunning = true;
    waterInterval = setInterval(tickWater, 1000);
    updateWaterUI();
});

$('stopWater').addEventListener('click', () => {
    waterRunning = false;
    if (waterInterval) { clearInterval(waterInterval); waterInterval = null; }
    waterElapsed = 0;
    updateWaterUI();
});

$('drank').addEventListener('click', () => {
    waterElapsed = 0;
    updateWaterUI();
});

// keep UI in sync even if user changes interval
$('waterMin').addEventListener('change', () => { waterDuration = Math.max(5, parseInt($('waterMin').value, 10) || 45) * 60; updateWaterUI(); });

// request permission on load (gentle)
if ("Notification" in window && Notification.permission === "default") {
    // do not spam — ask only once after a short delay
    setTimeout(() => { try { Notification.requestPermission().catch(() => { }); } catch (e) { } }, 4000);
}

// cleanup on unload
window.addEventListener('beforeunload', () => { if (pomInterval) clearInterval(pomInterval); if (waterInterval) clearInterval(waterInterval); });

// accessibility: announce remaining time every minute (optional quiet)
// done — initial UI updated
updateWaterUI();
updatePomUI();