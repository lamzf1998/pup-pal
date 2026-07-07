# 🐕 Pup-Pal

A Tamagotchi-style virtual dog you keep alive by working through a **daily care
to-do list**. Every care task you tick off tops up one of your pup's stats;
neglect the list and those stats drain over real time, dragging the pup's mood
from *happy* down to *sick*.

The dog is drawn as a mood-reactive SVG sprite that changes expression (and
animation) based on how well you've been looking after it.

## Concept

- **Four stats**, each 0–100: `fullness`, `happiness`, `energy`, `hygiene`.
- Stats **decay in real time** whenever you're away — the server tracks the
  pet's `lastTick` timestamp and subtracts the elapsed decay on every read.
- Each **care task** belongs to a category that restores a specific stat:

  | Category      | Restores    | Boost |
  |---------------|-------------|-------|
  | 🍖 Feed       | fullness    | +30   |
  | 🦮 Walk       | energy      | +25   |
  | 🎾 Play       | happiness   | +25   |
  | 🛁 Groom      | hygiene     | +35   |
  | 😴 Rest       | energy      | +40   |
  | 💊 Vet / Health | happiness | +15   |

- The checklist is a **daily** list: completing a task marks it done *for today*
  and applies the boost; a new calendar day clears the checkmarks so you care
  for the pup again. Un-ticking a task the same day claws the boost back.
- The pup's **mood** (and sprite face) is derived from its stats, and the UI
  also shows a rolled-up **health** percentage (the average of all four stats).

### Decay rates

Each stat drains by a fixed number of points per real hour of neglect:

| Stat      | Drain / hour |
|-----------|--------------|
| fullness  | 4            |
| energy    | 3.5          |
| happiness | 3            |
| hygiene   | 2            |

### Mood thresholds

Mood is computed from the average of the four stats (`avg`), with one special
case for a tired pup:

| Mood      | Condition                     |
|-----------|-------------------------------|
| 😴 sleepy | `energy` ≤ 15 (checked first) |
| 😄 happy  | `avg` ≥ 75                    |
| 🙂 content| `avg` ≥ 45                    |
| 😔 sad    | `avg` ≥ 20                    |
| 🤒 sick   | below 20                      |

## Run it

```bash
cd pup-pal
npm install
npm start        # or: npm run dev  (auto-restart on changes)
```

Then open http://localhost:3001.

The port can be overridden with the `PORT` environment variable
(e.g. `PORT=4000 npm start`). Requires **Node.js 18+** (for `crypto.randomUUID`
and `--watch`).

Data is persisted to flat JSON files under `data/` (`pet.json`, `tasks.json`),
created and seeded automatically on first run. Both files are git-ignored, so
deleting the `data/` folder resets your pup to a fresh Shiba named *Biscuit*.

## CRUD API

Care tasks are a full CRUD resource. All request/response bodies are JSON.

| Method   | Route                    | Purpose                                  |
|----------|--------------------------|------------------------------------------|
| `GET`    | `/api/tasks`             | List today's checklist (with done flags) |
| `POST`   | `/api/tasks`             | Create a care task                       |
| `PUT`    | `/api/tasks/:id`         | Update a task's title / category         |
| `POST`   | `/api/tasks/:id/toggle`  | Toggle done-for-today; adjusts pet stats |
| `DELETE` | `/api/tasks/:id`         | Delete a task                            |
| `GET`    | `/api/pet`               | Current pet state (decay applied)        |
| `PUT`    | `/api/pet`               | Rename / re-breed the pup                |
| `GET`    | `/api/meta`              | Care-category catalogue for the UI       |

A task must have a non-empty `title` (≤ 80 chars) and a `category` from the
table above; invalid input returns `400` with an `errors` array.

Example — add a task:

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Evening walk","category":"walk"}'
```

## Project structure

```
pup-pal/
├── server.js          # Express app: care logic, decay, and the JSON store
├── package.json
├── public/            # Static front end (served by Express, no build step)
│   ├── index.html
│   ├── style.css
│   └── app.js         # Renders the SVG pup + drives the checklist UI
└── data/              # Auto-created flat-file store (git-ignored)
    ├── pet.json
    └── tasks.json
```

## Stack

Node + Express + a flat-JSON store on the back end, vanilla HTML/CSS/JS on the
front end — matching the other starter apps in this repo (no build step). The
pup sprite is inline SVG whose face group swaps by mood, and the open tab
re-polls the pet once a minute so you can watch its stats slowly drain.
