# 🐕 Pup-Pal

A Tamagotchi-style virtual dog you keep alive by working through a **daily care
to-do list**. Every care task you tick off tops up one of your pup's stats;
neglect the list and those stats drain over real time, dragging the pup's mood
from *happy* down to *sick*.

The dog is drawn as a mood-reactive SVG sprite that changes expression (and
animation) based on how well you've been looking after it.

## Concept

- **Four stats**, each 0–100: `fullness`, `happiness`, `energy`, `hygiene`.
- Stats **decay in real time** (a few points per hour) whenever you're away.
- Each **care task** belongs to a category that restores a specific stat:

  | Category | Restores    | Boost |
  |----------|-------------|-------|
  | 🍖 Feed  | fullness    | +30   |
  | 🦮 Walk  | energy      | +25   |
  | 🎾 Play  | happiness   | +25   |
  | 🛁 Groom | hygiene     | +35   |
  | 😴 Rest  | energy      | +40   |
  | 💊 Vet   | happiness   | +15   |

- The checklist is a **daily** list: completing a task marks it done *for today*
  and applies the boost; a new calendar day clears the checkmarks so you care
  for the pup again.
- The pup's **mood** (and sprite face) is derived from its average stats:
  `happy → content → sad → sick`, plus a `sleepy` state when energy is very low.

## Run it

```bash
cd pup-pal
npm install
npm start        # or: npm run dev  (auto-restart on changes)
```

Then open http://localhost:3001.

Data is persisted to flat JSON files under `data/` (`pet.json`, `tasks.json`),
created and seeded automatically on first run.

## CRUD API

Care tasks are a full CRUD resource:

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

## Stack

Node + Express + a flat-JSON store on the back end, vanilla HTML/CSS/JS on the
front end — matching the other starter apps in this repo (no build step).
