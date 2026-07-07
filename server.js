'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const PET_FILE = path.join(DATA_DIR, 'pet.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Care stats & their care categories
// ---------------------------------------------------------------------------
// Each stat sits on a 0..100 scale, drains over real time, and is topped up
// when the owner completes a care task in the matching category.
const STATS = ['fullness', 'happiness', 'energy', 'hygiene'];

// How many points a stat drains per real hour of neglect.
const DECAY_PER_HOUR = {
  fullness: 20,
  happiness: 15,
  energy: 18,
  hygiene: 12,
};

// Care categories map a task to the stat it restores and how much.
const CATEGORIES = {
  feed: { label: 'Feed', stat: 'fullness', boost: 30, icon: '🍖' },
  walk: { label: 'Walk', stat: 'energy', boost: 25, icon: '🦮' },
  play: { label: 'Play', stat: 'happiness', boost: 25, icon: '🎾' },
  groom: { label: 'Groom', stat: 'hygiene', boost: 35, icon: '🛁' },
  rest: { label: 'Rest', stat: 'energy', boost: 40, icon: '😴' },
  vet: { label: 'Vet / Health', stat: 'happiness', boost: 15, icon: '💊' },
};

// ---------------------------------------------------------------------------
// Tiny JSON-file data store
// ---------------------------------------------------------------------------
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PET_FILE)) {
    fs.writeFileSync(PET_FILE, JSON.stringify(seedPet(), null, 2));
  }
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(seedTasks(), null, 2));
  }
}

function readJson(file) {
  ensureStore();
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function seedPet() {
  return {
    name: 'Biscuit',
    breed: 'Shiba',
    born: new Date().toISOString(),
    stats: { fullness: 80, happiness: 80, energy: 80, hygiene: 80 },
    lastTick: new Date().toISOString(),
  };
}

function seedTasks() {
  const now = new Date().toISOString();
  const base = [
    { title: 'Morning kibble', category: 'feed' },
    { title: 'Round-the-block walk', category: 'walk' },
    { title: 'Fetch in the yard', category: 'play' },
    { title: 'Brush & bath', category: 'groom' },
    { title: 'Afternoon nap', category: 'rest' },
  ];
  return base.map((t) => ({
    id: crypto.randomUUID(),
    title: t.title,
    category: t.category,
    doneDate: null, // ISO date-string (YYYY-MM-DD) of the day it was last completed
    createdAt: now,
    updatedAt: now,
  }));
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

// Apply real-time stat decay since the pet's last tick, persist, and return it.
function tickPet() {
  const pet = readJson(PET_FILE);
  const last = new Date(pet.lastTick).getTime();
  const now = Date.now();
  const hours = Math.max(0, (now - last) / 3_600_000);

  if (hours > 0) {
    for (const stat of STATS) {
      const current = pet.stats[stat] ?? 80;
      pet.stats[stat] = clamp(current - DECAY_PER_HOUR[stat] * hours);
    }
    pet.lastTick = new Date(now).toISOString();
    writeJson(PET_FILE, pet);
  }
  return pet;
}

function moodFor(stats) {
  const avg = STATS.reduce((sum, s) => sum + stats[s], 0) / STATS.length;
  if (stats.energy <= 15) return 'sleepy';
  if (avg >= 75) return 'happy';
  if (avg >= 45) return 'content';
  if (avg >= 20) return 'sad';
  return 'sick';
}

function decoratePet(pet) {
  const avg = Math.round(
    STATS.reduce((sum, s) => sum + pet.stats[s], 0) / STATS.length
  );
  return { ...pet, health: avg, mood: moodFor(pet.stats) };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateTask(body) {
  const errors = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) errors.push('title is required');
  if (title.length > 80) errors.push('title must be 80 characters or fewer');

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!CATEGORIES[category]) {
    errors.push(`category must be one of: ${Object.keys(CATEGORIES).join(', ')}`);
  }
  return { errors, clean: { title, category } };
}

// ---------------------------------------------------------------------------
// Pet API
// ---------------------------------------------------------------------------

// Current pet state (with decay applied) plus the care-category catalogue.
app.get('/api/pet', (_req, res) => {
  res.json(decoratePet(tickPet()));
});

// Rename / re-breed the pup.
app.put('/api/pet', (req, res) => {
  const pet = tickPet();
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const breed = typeof req.body?.breed === 'string' ? req.body.breed.trim() : '';
  if (name) pet.name = name.slice(0, 40);
  if (breed) pet.breed = breed.slice(0, 40);
  pet.updatedAt = new Date().toISOString();
  writeJson(PET_FILE, pet);
  res.json(decoratePet(pet));
});

app.get('/api/meta', (_req, res) => {
  res.json({ categories: CATEGORIES, stats: STATS });
});

// ---------------------------------------------------------------------------
// Care-task CRUD
// ---------------------------------------------------------------------------

// List today's checklist, each flagged done/not-done for the current day.
app.get('/api/tasks', (_req, res) => {
  const today = todayKey();
  const tasks = readJson(TASKS_FILE)
    .map((t) => ({
      ...t,
      done: t.doneDate === today,
      ...CATEGORIES[t.category],
    }))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title));
  res.json(tasks);
});

// Create
app.post('/api/tasks', (req, res) => {
  const { errors, clean } = validateTask(req.body || {});
  if (errors.length) return res.status(400).json({ errors });

  const tasks = readJson(TASKS_FILE);
  const now = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    ...clean,
    doneDate: null,
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  writeJson(TASKS_FILE, tasks);
  res.status(201).json({ ...task, done: false, ...CATEGORIES[task.category] });
});

// Update title / category
app.put('/api/tasks/:id', (req, res) => {
  const tasks = readJson(TASKS_FILE);
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const { errors, clean } = validateTask(req.body || {});
  if (errors.length) return res.status(400).json({ errors });

  tasks[idx] = { ...tasks[idx], ...clean, updatedAt: new Date().toISOString() };
  writeJson(TASKS_FILE, tasks);
  const t = tasks[idx];
  res.json({ ...t, done: t.doneDate === todayKey(), ...CATEGORIES[t.category] });
});

// Toggle done for today — completing a task feeds the pet's matching stat.
app.post('/api/tasks/:id/toggle', (req, res) => {
  const tasks = readJson(TASKS_FILE);
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const today = todayKey();
  const wasDone = task.doneDate === today;
  const cat = CATEGORIES[task.category];

  const pet = tickPet();
  if (wasDone) {
    task.doneDate = null; // undo: claw back the boost
    pet.stats[cat.stat] = clamp(pet.stats[cat.stat] - cat.boost);
  } else {
    task.doneDate = today;
    pet.stats[cat.stat] = clamp(pet.stats[cat.stat] + cat.boost);
  }
  task.updatedAt = new Date().toISOString();
  writeJson(TASKS_FILE, tasks);
  writeJson(PET_FILE, pet);

  res.json({
    task: { ...task, done: !wasDone, ...cat },
    pet: decoratePet(pet),
  });
});

// Delete — dropping a care activity leaves that need unmet, so dock the stat.
app.delete('/api/tasks/:id', (req, res) => {
  const tasks = readJson(TASKS_FILE);
  const idx = tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  const [removed] = tasks.splice(idx, 1);
  writeJson(TASKS_FILE, tasks);

  const cat = CATEGORIES[removed.category];
  const pet = tickPet();
  pet.stats[cat.stat] = clamp(pet.stats[cat.stat] - cat.boost);
  writeJson(PET_FILE, pet);

  res.json({ removed, pet: decoratePet(pet) });
});

app.listen(PORT, () => {
  console.log(`Pup-Pal running at http://localhost:${PORT}`);
});
