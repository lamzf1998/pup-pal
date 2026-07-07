'use strict';

const api = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error((await r.json()).error || 'Request failed');
    return r.json();
  },
  async send(url, method, body) {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data.errors || [data.error]).join(', ') || 'Request failed');
    return data;
  },
};

let META = { categories: {}, stats: [] };

// ---------------------------------------------------------------- Dog sprite
// A single front-facing Shiba drawn in SVG; the face group swaps by mood.
function dogSvg(mood) {
  const faces = {
    happy: `
      <path d="M58 82 q7 -8 14 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>
      <path d="M78 82 q7 -8 14 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>
      <path d="M62 96 q13 16 26 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>
      <path d="M70 100 q5 10 10 0 z" fill="#e77" />`,
    content: `
      <circle cx="65" cy="84" r="4" fill="#3a2e26"/>
      <circle cx="85" cy="84" r="4" fill="#3a2e26"/>
      <path d="M64 97 q11 8 22 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>`,
    sad: `
      <circle cx="65" cy="86" r="4" fill="#3a2e26"/>
      <circle cx="85" cy="86" r="4" fill="#3a2e26"/>
      <path d="M60 80 q6 -4 10 -1" fill="none" stroke="#3a2e26" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M80 79 q4 -3 10 1" fill="none" stroke="#3a2e26" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M64 100 q11 -8 22 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>`,
    sick: `
      <path d="M60 82 l8 6 M68 82 l-8 6" stroke="#3a2e26" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M82 82 l8 6 M90 82 l-8 6" stroke="#3a2e26" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M64 100 q11 -6 22 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>`,
    sleepy: `
      <path d="M60 85 q5 4 10 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>
      <path d="M80 85 q5 4 10 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>
      <path d="M66 98 q9 5 16 0" fill="none" stroke="#3a2e26" stroke-width="3" stroke-linecap="round"/>
      <text x="100" y="60" font-size="16" fill="#8a7a6d">z</text>
      <text x="110" y="48" font-size="22" fill="#8a7a6d">Z</text>`,
  };

  return `
  <svg viewBox="0 0 150 150" width="150" height="150" xmlns="http://www.w3.org/2000/svg">
    <!-- tail -->
    <path d="M112 118 q22 -6 14 -30 q-3 16 -18 20 z" fill="#d98a3d"/>
    <!-- body -->
    <ellipse cx="75" cy="120" rx="34" ry="24" fill="#e0952f"/>
    <ellipse cx="75" cy="126" rx="22" ry="14" fill="#f6e6cf"/>
    <!-- ears -->
    <path d="M46 60 l6 -34 l20 20 z" fill="#d98a3d"/>
    <path d="M104 60 l-6 -34 l-20 20 z" fill="#d98a3d"/>
    <path d="M52 52 l3 -18 l11 11 z" fill="#f6e6cf"/>
    <path d="M98 52 l-3 -18 l-11 11 z" fill="#f6e6cf"/>
    <!-- head -->
    <circle cx="75" cy="78" r="34" fill="#e0952f"/>
    <!-- cheek/muzzle mask -->
    <path d="M55 82 q20 26 40 0 q0 22 -20 24 q-20 -2 -20 -24 z" fill="#f6e6cf"/>
    <!-- nose -->
    <ellipse cx="75" cy="90" rx="5" ry="3.5" fill="#3a2e26"/>
    <!-- face (mood) -->
    ${faces[mood] || faces.content}
  </svg>`;
}

// ------------------------------------------------------------------- Render
function statColor(v) {
  if (v >= 60) return 'var(--good)';
  if (v >= 30) return 'var(--mid)';
  return 'var(--bad)';
}

function renderPet(pet) {
  document.getElementById('sprite').dataset.mood = pet.mood;
  document.getElementById('sprite').innerHTML = dogSvg(pet.mood);
  document.getElementById('pet-name').textContent = pet.name;
  document.getElementById('pet-breed').textContent = pet.breed;
  document.getElementById('pet-mood').textContent = `${pet.mood} · ${pet.health}% health`;

  const wrap = document.getElementById('stats');
  wrap.innerHTML = META.stats
    .map((s) => {
      const v = Math.round(pet.stats[s]);
      return `
      <div class="stat">
        <span class="label">${s}</span>
        <div class="bar"><span style="width:${v}%;background:${statColor(v)}"></span></div>
        <span class="val">${v}</span>
      </div>`;
    })
    .join('');
}

function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  const empty = document.getElementById('empty');
  empty.classList.toggle('hidden', tasks.length > 0);

  const done = tasks.filter((t) => t.done).length;
  document.getElementById('progress').textContent = `${done} / ${tasks.length}`;

  list.innerHTML = tasks
    .map(
      (t) => `
    <li class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
      <button class="check" data-act="toggle" title="Mark done">✓</button>
      <span class="icon">${t.icon || '🐾'}</span>
      <div class="task-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="cat">${t.label} · +${t.boost} ${t.stat}</div>
      </div>
      <div class="actions">
        <button data-act="edit">Edit</button>
        <button data-act="delete">Delete</button>
      </div>
    </li>`
    )
    .join('');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

// -------------------------------------------------------------------- Loaders
async function refreshTasks() {
  renderTasks(await api.get('/api/tasks'));
}

async function refreshPet() {
  renderPet(await api.get('/api/pet'));
}

// ---------------------------------------------------------------------- Form
const form = document.getElementById('task-form');
const idField = document.getElementById('task-id');
const titleField = document.getElementById('task-title');
const catField = document.getElementById('task-category');
const submitBtn = document.getElementById('task-submit');
const cancelBtn = document.getElementById('task-cancel');

function resetForm() {
  idField.value = '';
  titleField.value = '';
  catField.selectedIndex = 0;
  submitBtn.textContent = 'Add';
  cancelBtn.classList.add('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { title: titleField.value.trim(), category: catField.value };
  try {
    if (idField.value) {
      await api.send(`/api/tasks/${idField.value}`, 'PUT', body);
      toast('Task updated');
    } else {
      await api.send('/api/tasks', 'POST', body);
      toast('Task added');
    }
    resetForm();
    await refreshTasks();
  } catch (err) {
    toast(err.message);
  }
});

cancelBtn.addEventListener('click', resetForm);

// Event delegation for the task list
document.getElementById('task-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const li = e.target.closest('.task');
  const id = li.dataset.id;
  const act = btn.dataset.act;

  try {
    if (act === 'toggle') {
      const { pet } = await api.send(`/api/tasks/${id}/toggle`, 'POST');
      renderPet(pet);
      await refreshTasks();
    } else if (act === 'delete') {
      await api.send(`/api/tasks/${id}`, 'DELETE');
      toast('Task removed');
      await refreshTasks();
    } else if (act === 'edit') {
      const title = li.querySelector('.task-title').textContent;
      const label = li.querySelector('.cat').textContent.split(' · ')[0];
      idField.value = id;
      titleField.value = title;
      const opt = [...catField.options].find((o) => o.dataset.label === label);
      if (opt) opt.selected = true;
      submitBtn.textContent = 'Save';
      cancelBtn.classList.remove('hidden');
      titleField.focus();
    }
  } catch (err) {
    toast(err.message);
  }
});

// Rename pet on blur of the editable name
const nameEl = document.getElementById('pet-name');
nameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    nameEl.blur();
  }
});
nameEl.addEventListener('blur', async () => {
  const name = nameEl.textContent.trim();
  if (!name) return refreshPet();
  try {
    renderPet(await api.send('/api/pet', 'PUT', { name }));
    toast('Renamed!');
  } catch (err) {
    toast(err.message);
  }
});

// ----------------------------------------------------------------------- Init
async function init() {
  META = await api.get('/api/meta');
  catField.innerHTML = Object.entries(META.categories)
    .map(
      ([key, c]) =>
        `<option value="${key}" data-label="${c.label}">${c.icon} ${c.label}</option>`
    )
    .join('');
  await Promise.all([refreshPet(), refreshTasks()]);
  // Gently re-tick the pet so stats visibly drain while the tab is open.
  setInterval(refreshPet, 60_000);
}

init().catch((err) => toast(err.message));
