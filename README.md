# Futsal Subs

A phone-friendly web app for parents and coaches running kids' futsal. It works out who plays where and who sits out in each rotation, so every child gets fair time on court.

No sign-up, no server. Everything is saved on your own phone.

## What it does

**Squad.** Add your players, tick who's turned up today, and mark who's happy to go in goal (GK).

**Plan.** Makes a rotation grid like the classic paper sheet: positions down the side, rotations across the top, subs at the bottom. It keeps things fair:

- equal playing time, give or take one rotation when the numbers don't divide evenly
- nobody sits out two rotations in a row
- goalkeeping is shared out, and only kids marked GK go in goal
- kids try different positions instead of the same one every time

Tap one name, then another in the same rotation, to swap them. Tap a name to highlight that child in every rotation. **Shuffle** makes a fresh fair plan. **Copy** gives you a text version for the team WhatsApp. The playing-time table and checks update as you edit.

**Match.** A big countdown for the current rotation, a court view of who's where, and the next changes spelled out ("Erin on for Matilda, Right Wing"). It buzzes and vibrates when time's up, and keeps the screen awake while the clock runs.

Formats: futsal 5-a-side with goalie (default), 4-a-side with or without a goalie, 3-a-side, or any positions you type in.

## Running it

Open `index.html` in a browser, or serve the folder:

```sh
npm start        # http://localhost:8080
```

To put it on your phone, host the folder anywhere static (GitHub Pages works: Settings → Pages → deploy from this branch) and use **Add to Home Screen**. Once loaded over HTTPS it also works offline.

## Tests

```sh
npm test
```

The rotation logic lives in `rotation.js` and is covered by `test/rotation.test.js`.
