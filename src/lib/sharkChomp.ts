// Shark Chomp — the little game borrowers play while they wait for their call (moodeng.app/chomp).
// Pure rules only (no DOM), so they're unit-testable; the page (src/app/chomp/page.tsx) draws and
// drives them.
//
// A grid lagoon: rocks never move, seaweed blocks the way until it's chomped. Moodeng swims tile by
// tile and CHOMPS: every shark right next to her (diagonals too), plus everything in a straight line
// the way she faces up to `reach` tiles — sharks are eaten, the first seaweed is eaten and stops the
// bite, a rock stops it. Eaten seaweed can leave
// a 🍉 (longer bite) or a ❤️. A shark that swims into her costs a heart. Eat every shark → next wave,
// with more and faster sharks.

export const COLS = 11;
export const ROWS = 13;

export type Tile = 'water' | 'rock' | 'weed' | 'melon' | 'heart';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Pos = { x: number; y: number };
export type Shark = Pos & { id: number; dir: Dir };

export type ChompState = {
   grid: Tile[][]; // grid[y][x]
   hippo: Pos;
   facing: Dir;
   sharks: Shark[];
   hearts: number;
   reach: number;
   score: number;
   wave: number;
   over: boolean;
   // Wall-clock ms; the page passes `now` into every call.
   invulnerableUntil: number;
   lastChompAt: number;
   chompTiles: Pos[]; // last bite's tiles, for the flash
};

export const MAX_HEARTS = 5;
export const MAX_REACH = 4;
export const START_REACH = 2;
export const CHOMP_COOLDOWN_MS = 320;
export const HIT_GRACE_MS = 1500;
export const POINTS_SHARK = 100;
export const POINTS_WEED = 10;
export const POINTS_WAVE = 250;

export const DIRS: Record<Dir, Pos> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const DIR_LIST: Dir[] = ['up', 'down', 'left', 'right'];

export type Rng = () => number;

const isRockAt = (x: number, y: number) => x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0);

// Sharks get a bit quicker every wave, never too fast to dodge on a phone.
export const sharkStepMs = (wave: number) => Math.max(260, 640 - (wave - 1) * 45);
export const sharkCount = (wave: number) => Math.min(9, 2 + wave);

const inBounds = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS;
const walkable = (t: Tile) => t === 'water' || t === 'melon' || t === 'heart';
const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const add = (p: Pos, d: Dir): Pos => ({ x: p.x + DIRS[d].x, y: p.y + DIRS[d].y });

// A fresh lagoon. The hippo starts top-left with her corner kept clear; sharks start far from her.
export const newWave = (wave: number, rng: Rng, carry?: Pick<ChompState, 'hearts' | 'reach' | 'score'>): ChompState => {
   const grid: Tile[][] = [];
   for (let y = 0; y < ROWS; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < COLS; x++) {
         if (isRockAt(x, y)) row.push('rock');
         else if (x + y <= 3) row.push('water'); // her safe corner
         else row.push(rng() < 0.42 ? 'weed' : 'water');
      }
      grid.push(row);
   }
   const open: Pos[] = [];
   for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (grid[y][x] === 'water' && x + y >= 9) open.push({ x, y });
   const sharks: Shark[] = [];
   const want = sharkCount(wave);
   for (let i = 0; i < want && open.length > 0; i++) {
      const at = open.splice(Math.floor(rng() * open.length), 1)[0];
      sharks.push({ ...at, id: i + 1, dir: DIR_LIST[Math.floor(rng() * 4)] });
   }
   // A shark boxed in by seaweed on all sides would never come out: clear one side for it.
   for (const s of sharks) {
      if (DIR_LIST.some((d) => walkable(grid[add(s, d).y][add(s, d).x]))) continue;
      const d = DIR_LIST.find((dd) => grid[add(s, dd).y][add(s, dd).x] === 'weed');
      if (d) grid[add(s, d).y][add(s, d).x] = 'water';
   }
   return {
      grid,
      hippo: { x: 1, y: 1 },
      facing: 'right',
      sharks,
      hearts: carry?.hearts ?? 3,
      reach: carry?.reach ?? START_REACH,
      score: carry?.score ?? 0,
      wave,
      over: false,
      invulnerableUntil: 0,
      lastChompAt: 0,
      chompTiles: []
   };
};

const hurt = (s: ChompState, now: number): ChompState => {
   if (now < s.invulnerableUntil || s.over) return s;
   const hearts = s.hearts - 1;
   return { ...s, hearts, over: hearts <= 0, invulnerableUntil: now + HIT_GRACE_MS };
};

const touchesShark = (s: ChompState) => s.sharks.some((k) => same(k, s.hippo));

// Pick up whatever is on her tile.
const pickUp = (s: ChompState): ChompState => {
   const t = s.grid[s.hippo.y][s.hippo.x];
   if (t !== 'melon' && t !== 'heart') return s;
   const grid = s.grid.map((r) => r.slice());
   grid[s.hippo.y][s.hippo.x] = 'water';
   return t === 'melon'
      ? { ...s, grid, reach: Math.min(MAX_REACH, s.reach + 1), score: s.score + 50 }
      : { ...s, grid, hearts: Math.min(MAX_HEARTS, s.hearts + 1), score: s.score + 50 };
};

// One step. Always turns her to face `dir`, even when the way is blocked (so she can aim a chomp).
export const moveHippo = (s: ChompState, dir: Dir, now: number): ChompState => {
   if (s.over) return s;
   const to = add(s.hippo, dir);
   if (!inBounds(to) || !walkable(s.grid[to.y][to.x])) return { ...s, facing: dir };
   let next: ChompState = pickUp({ ...s, hippo: to, facing: dir });
   if (touchesShark(next)) next = hurt(next, now);
   return next;
};

// The bite: she DASHES forward up to `reach` tiles, eating everything on the way, and ends up where
// the bite lands (George 2026-11-25: "it goes forward and eats"). Sharks on the path are eaten;
// seaweed is eaten and ends the dash on its tile (it may leave a 🍉 / ❤️, which she grabs); a rock
// stops her in front of it. Forgiving too: any shark right next to where she started or where she
// lands (diagonals included) is eaten — sharks keep moving, and an exact line-up on a phone is too
// fiddly. Returns the same state if she's still on cooldown.
export const chomp = (s: ChompState, now: number, rng: Rng): ChompState => {
   if (s.over || now - s.lastChompAt < CHOMP_COOLDOWN_MS) return s;
   const grid = s.grid.map((r) => r.slice());
   let sharks = s.sharks;
   let score = s.score;
   const tiles: Pos[] = [];
   const path: Pos[] = [];
   let land = s.hippo;
   let p = s.hippo;
   for (let i = 0; i < s.reach; i++) {
      p = add(p, s.facing);
      if (!inBounds(p) || grid[p.y][p.x] === 'rock') break;
      tiles.push(p);
      path.push(p);
      land = p;
      const here = p;
      const eaten = sharks.filter((k) => same(k, here));
      if (eaten.length) {
         sharks = sharks.filter((k) => !same(k, here));
         score += POINTS_SHARK * eaten.length;
      }
      if (grid[p.y][p.x] === 'weed') {
         const roll = rng();
         grid[p.y][p.x] = roll < 0.12 ? 'melon' : roll < 0.18 ? 'heart' : 'water';
         score += POINTS_WEED;
         break;
      }
   }
   const nextTo = (a: Pos, k: Pos) => Math.abs(k.x - a.x) <= 1 && Math.abs(k.y - a.y) <= 1;
   const near = sharks.filter((k) => nextTo(s.hippo, k) || nextTo(land, k));
   if (near.length) {
      sharks = sharks.filter((k) => !near.includes(k));
      score += POINTS_SHARK * near.length;
      for (const k of near) if (!tiles.some((t) => same(t, k))) tiles.push({ x: k.x, y: k.y });
   }
   // Grab any 🍉 / ❤️ she dashed over (including one the seaweed just dropped).
   let next: ChompState = { ...s, grid, sharks, score, lastChompAt: now, chompTiles: tiles };
   for (const t of path) next = pickUp({ ...next, hippo: t });
   next = { ...next, hippo: land };
   if (sharks.length === 0) next = newWave(s.wave + 1, rng, { hearts: next.hearts, reach: next.reach, score: next.score + POINTS_WAVE });
   return next;
};

// Every shark swims one tile. Mostly keeps going; turns at walls; now and then turns toward Moodeng
// when she's in its row or column.
export const stepSharks = (s: ChompState, now: number, rng: Rng): ChompState => {
   if (s.over) return s;
   const taken = new Set(s.sharks.map((k) => `${k.x},${k.y}`));
   const sharks = s.sharks.map((k) => {
      const open = DIR_LIST.filter((d) => {
         const p = add(k, d);
         return inBounds(p) && walkable(s.grid[p.y][p.x]) && !taken.has(`${p.x},${p.y}`);
      });
      if (open.length === 0) return k;
      let dir: Dir = k.dir;
      const toward: Dir | null =
         k.x === s.hippo.x ? (s.hippo.y < k.y ? 'up' : 'down') : k.y === s.hippo.y ? (s.hippo.x < k.x ? 'left' : 'right') : null;
      if (toward && open.includes(toward) && rng() < 0.45) dir = toward;
      else if (!open.includes(dir) || rng() < 0.2) dir = open[Math.floor(rng() * open.length)];
      const p = add(k, dir);
      taken.delete(`${k.x},${k.y}`);
      taken.add(`${p.x},${p.y}`);
      return { ...k, ...p, dir };
   });
   let next: ChompState = { ...s, sharks };
   if (touchesShark(next)) next = hurt(next, now);
   return next;
};

// "Call in 12 min" / "Call starting now" for the bar above the lagoon. null = no call time known.
export const callCountdownLabel = (startsAtIso: string | null, now: number): string | null => {
   if (!startsAtIso) return null;
   const at = Date.parse(startsAtIso);
   if (Number.isNaN(at)) return null;
   const min = Math.ceil((at - now) / 60000);
   if (min <= 0) return 'Your call is starting now!';
   return `Your call starts in ${min} min`;
};
