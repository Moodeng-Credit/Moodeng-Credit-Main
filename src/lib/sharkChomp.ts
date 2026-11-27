// Shark Chomp — the little game borrowers play while they wait for their call (moodeng.app/chomp).
// Pure rules only (no DOM), so they're unit-testable; the page (src/app/chomp/page.tsx) draws and
// drives them.
//
// A grid lagoon: rocks never move, seaweed blocks the way until it's chomped. Moodeng swims tile by
// tile and CHOMPS: every shark right next to her (diagonals too), plus everything in a straight line
// the way she faces up to `reach` tiles — sharks are eaten, the first seaweed is eaten and stops the
// bite, a rock stops it. Eaten seaweed can leave a Filipino snack that powers her up (FOODS below).
// A shark that swims into her costs a heart. Eat every shark → a door opens in the lagoon; she swims
// in to Moodeng's House (the page): the next level's lesson about borrowing safely with Moodeng
// (LEVELS below), a shop to spend 🍞 pandesal points on a power-up, and every other level a prize
// wheel (WHEEL). Then the next level, with more and faster sharks.

export const COLS = 11;
export const ROWS = 13;

export type Food = 'pandesal' | 'mango' | 'halohalo' | 'turon';
export type Tile = 'water' | 'rock' | 'weed' | Food;

// Snacks hidden in the seaweed. `chance` is per chomped seaweed (the rest is plain water).
export const FOODS: Record<Food, { name: string; power: string; chance: number }> = {
   pandesal: { name: 'Pandesal', power: 'Swim faster', chance: 0.06 },
   mango: { name: 'Mango', power: 'Longer bite', chance: 0.06 },
   halohalo: { name: 'Halo-halo', power: 'Shield: eat any shark you touch', chance: 0.04 },
   turon: { name: 'Turon', power: '+1 heart', chance: 0.04 }
};
export const FOOD_LIST = Object.keys(FOODS) as Food[];
export const isFood = (t: Tile): t is Food => t in FOODS;
export const POWER_MS = 6000;
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
   fastUntil: number; // pandesal
   shieldUntil: number; // halo-halo
   coins: number; // 🍞 pandesal points: +1 a shark, +3 a level, wheel prizes; spent in the shop
   portal: Pos | null; // the door that opens when every shark is eaten
   inHouse: boolean; // she swam through it
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
export const COINS_SHARK = 1;
export const COINS_LEVEL = 3;

export const DIRS: Record<Dir, Pos> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const DIR_LIST: Dir[] = ['up', 'down', 'left', 'right'];

export type Rng = () => number;

const isRockAt = (x: number, y: number) => x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0);

// Sharks get a bit quicker every wave, never too fast to dodge on a phone.
export const sharkStepMs = (wave: number) => Math.max(260, 640 - (wave - 1) * 45);
export const sharkCount = (wave: number) => Math.min(9, 2 + wave);

const inBounds = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS;
const walkable = (t: Tile) => t === 'water' || isFood(t);

// What a chomped piece of seaweed leaves behind.
const dropFrom = (roll: number): Tile => {
   let acc = 0;
   for (const f of FOOD_LIST) {
      acc += FOODS[f].chance;
      if (roll < acc) return f;
   }
   return 'water';
};
const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const add = (p: Pos, d: Dir): Pos => ({ x: p.x + DIRS[d].x, y: p.y + DIRS[d].y });

// A fresh lagoon. The hippo starts top-left with her corner kept clear; sharks start far from her.
export const newWave = (wave: number, rng: Rng, carry?: Pick<ChompState, 'hearts' | 'reach' | 'score' | 'coins'>): ChompState => {
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
      fastUntil: 0,
      shieldUntil: 0,
      coins: carry?.coins ?? 0,
      portal: null,
      inHouse: false,
      lastChompAt: 0,
      chompTiles: []
   };
};

const hurt = (s: ChompState, now: number): ChompState => {
   if (now < s.invulnerableUntil || now < s.shieldUntil || s.over) return s;
   const hearts = s.hearts - 1;
   return { ...s, hearts, over: hearts <= 0, invulnerableUntil: now + HIT_GRACE_MS };
};

const touchesShark = (s: ChompState) => s.sharks.some((k) => same(k, s.hippo));

// A shark meets her: with the halo-halo shield on she eats it, otherwise it costs a heart.
const sharkContact = (s: ChompState, now: number, rng: Rng): ChompState => {
   if (!touchesShark(s)) return s;
   if (now < s.shieldUntil) {
      const sharks = s.sharks.filter((k) => !same(k, s.hippo));
      const eaten = s.sharks.length - sharks.length;
      const next = { ...s, sharks, score: s.score + POINTS_SHARK * eaten, coins: s.coins + COINS_SHARK * eaten };
      return sharks.length === 0 ? openPortal(next, rng) : next;
   }
   return hurt(s, now);
};

// Eat the snack on her tile.
const pickUp = (s: ChompState, now: number): ChompState => {
   const t = s.grid[s.hippo.y][s.hippo.x];
   if (!isFood(t)) return s;
   const grid = s.grid.map((r) => r.slice());
   grid[s.hippo.y][s.hippo.x] = 'water';
   const base = { ...s, grid, score: s.score + 50 };
   switch (t) {
      case 'mango':
         return { ...base, reach: Math.min(MAX_REACH, s.reach + 1) };
      case 'turon':
         return { ...base, hearts: Math.min(MAX_HEARTS, s.hearts + 1) };
      case 'pandesal':
         return { ...base, fastUntil: now + POWER_MS };
      case 'halohalo':
         return { ...base, shieldUntil: now + POWER_MS };
   }
};

// Every shark eaten: the door opens on a tile away from her (seaweed there is cleared).
const openPortal = (s: ChompState, rng: Rng): ChompState => {
   const spots: Pos[] = [];
   for (let y = 1; y < ROWS - 1; y++)
      for (let x = 1; x < COLS - 1; x++) if (!isRockAt(x, y) && Math.abs(x - s.hippo.x) + Math.abs(y - s.hippo.y) >= 5) spots.push({ x, y });
   const portal = spots.length ? spots[Math.floor(rng() * spots.length)] : { x: COLS - 2, y: ROWS - 2 };
   const grid = s.grid.map((r) => r.slice());
   grid[portal.y][portal.x] = 'water';
   return { ...s, grid, portal, score: s.score + POINTS_WAVE, coins: s.coins + COINS_LEVEL };
};

// Out of the house: the next level, keeping hearts, bite, score and points.
export const nextLevel = (s: ChompState, rng: Rng): ChompState =>
   newWave(s.wave + 1, rng, { hearts: s.hearts, reach: s.reach, score: s.score, coins: s.coins });

// A snack's power without finding it (the shop, the wheel): same effect as eating it.
export const applySnack = (s: ChompState, food: Food, now: number): ChompState => {
   const grid = s.grid.map((r) => r.slice());
   const saved = grid[s.hippo.y][s.hippo.x];
   grid[s.hippo.y][s.hippo.x] = food;
   const fed = pickUp({ ...s, grid }, now);
   const back = fed.grid.map((r) => r.slice());
   back[s.hippo.y][s.hippo.x] = saved;
   return { ...fed, grid: back, score: s.score };
};

// Moodeng's House shop: a power-up for the next level, paid in 🍞 pandesal points.
export const SHOP: Record<Food, number> = { pandesal: 2, turon: 3, mango: 4, halohalo: 5 };
export const buy = (s: ChompState, food: Food, now: number): ChompState | null =>
   s.coins < SHOP[food] ? null : { ...applySnack(s, food, now), coins: s.coins - SHOP[food] };

// One step. Always turns her to face `dir`, even when the way is blocked (so she can aim a chomp).
export const moveHippo = (s: ChompState, dir: Dir, now: number, rng: Rng = Math.random): ChompState => {
   if (s.over || s.inHouse) return s;
   const to = add(s.hippo, dir);
   if (!inBounds(to) || !walkable(s.grid[to.y][to.x])) return { ...s, facing: dir };
   const moved = pickUp({ ...s, hippo: to, facing: dir }, now);
   if (moved.portal && same(moved.portal, to)) return { ...moved, inHouse: true };
   return sharkContact(moved, now, rng);
};

// Touch controls (George 2026-11-28: "move my finger around and when I tap it chomps"). Spots are in
// tiles (fractions OK, tile centres are whole numbers).
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Which way to swim toward the finger: the longer way first, the other way when that's blocked. A
// seaweed in the way: face it (a tap then chomps through). A rock straight ahead with nothing to the
// side to try: step around it. null = she's already under the finger.
export const stepToward = (s: ChompState, target: { x: number; y: number }): Dir | null => {
   const dx = target.x - s.hippo.x;
   const dy = target.y - s.hippo.y;
   const h: Dir | null = Math.abs(dx) >= 0.5 ? (dx > 0 ? 'right' : 'left') : null;
   const v: Dir | null = Math.abs(dy) >= 0.5 ? (dy > 0 ? 'down' : 'up') : null;
   const order = (Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h]).filter((d): d is Dir => d !== null);
   if (!order.length) return null;
   const tileAt = (d: Dir): Tile => {
      const p = add(s.hippo, d);
      return inBounds(p) ? s.grid[p.y][p.x] : 'rock';
   };
   const open = order.find((d) => walkable(tileAt(d)));
   if (open) return open;
   const weed = order.find((d) => tileAt(d) === 'weed');
   if (weed) return weed;
   if (order.length === 1) {
      const side = DIR_LIST.find((d) => d !== order[0] && d !== OPPOSITE[order[0]] && walkable(tileAt(d)));
      if (side) return side;
   }
   return order[0];
};

// Which way a tap aims the bite: toward the tapped spot. null = tapped on her (bite the way she faces).
export const aimAt = (s: ChompState, target: { x: number; y: number }): Dir | null => {
   const dx = target.x - s.hippo.x;
   const dy = target.y - s.hippo.y;
   if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
   return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
};

// The bite: she DASHES forward up to `reach` tiles, eating everything on the way, and ends up where
// the bite lands (George 2026-11-25: "it goes forward and eats"). Sharks on the path are eaten;
// seaweed is eaten and ends the dash on its tile (it may leave a snack, which she grabs); a rock
// stops her in front of it. Forgiving too: any shark right next to where she started or where she
// lands (diagonals included) is eaten — sharks keep moving, and an exact line-up on a phone is too
// fiddly. Returns the same state if she's still on cooldown.
export const chomp = (s: ChompState, now: number, rng: Rng): ChompState => {
   if (s.over || s.inHouse || now - s.lastChompAt < CHOMP_COOLDOWN_MS) return s;
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
         grid[p.y][p.x] = dropFrom(roll);
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
   // Grab any snack she dashed over (including one the seaweed just dropped).
   let next: ChompState = { ...s, grid, sharks, score, lastChompAt: now, chompTiles: tiles };
   for (const t of path) next = pickUp({ ...next, hippo: t }, now);
   next = { ...next, hippo: land, coins: next.coins + COINS_SHARK * (s.sharks.length - sharks.length) };
   if (s.sharks.length > 0 && sharks.length === 0) return openPortal(next, rng);
   if (next.portal && same(next.portal, land)) return { ...next, inHouse: true };
   return sharkContact(next, now, rng);
};

// Every shark swims one tile. Mostly keeps going; turns at walls; now and then turns toward Moodeng
// when she's in its row or column.
export const stepSharks = (s: ChompState, now: number, rng: Rng): ChompState => {
   if (s.over || s.inHouse || s.sharks.length === 0) return s;
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
   return sharkContact({ ...s, sharks }, now, rng);
};

// The call, as the game shows it (George 2026-11-25: a countdown is pointless when the call isn't soon):
//   later  more than an hour away   → "📅 Your call: Wed 7:00 PM" (just so they know when)
//   soon   within the hour          → "⏰ Your call starts in 12 min" + Join
//   now    start → 20 min after     → the "Join the call or keep playing" popup
//   none   no time, bad time, or more than 20 min after the start → no call UI at all
export const CALL_SOON_MIN = 60;
export const CALL_LATE_MIN = 20;
export type CallStatus = { kind: 'none' | 'later' | 'soon' | 'now'; label: string | null };
export const callStatus = (startsAtIso: string | null, now: number, timeZone?: string): CallStatus => {
   const at = startsAtIso ? Date.parse(startsAtIso) : NaN;
   if (Number.isNaN(at)) return { kind: 'none', label: null };
   const min = Math.ceil((at - now) / 60000);
   if (min < -CALL_LATE_MIN) return { kind: 'none', label: null };
   if (min <= 0) return { kind: 'now', label: '🎥 Your call is on now' };
   if (min <= CALL_SOON_MIN) return { kind: 'soon', label: `⏰ Your call starts in ${min} min` };
   const when = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }).format(new Date(at));
   return { kind: 'later', label: `📅 Your call: ${when}` };
};

// One level = one Moodeng rule. Moo-Guard (the house guardian) explains it in Moodeng's House
// after each level (George 2026-11-25: "each level is 1 rule"). Short, plain 8th-grade English for
// Filipino first-time borrowers; every line must be true of how Moodeng works today. After the last
// rule they repeat.
export type Lesson = { title: string; text: string; tip?: string };
export const LEVELS: Lesson[] = [
   {
      title: 'Show up to your call',
      text: 'Every new borrower meets us on a short video call. Bring your real ID and turn your camera on. It keeps scammers out.',
      tip: 'Snacks hide in the seaweed. Chomp it!'
   },
   {
      title: 'One account, your real name',
      text: 'Borrow only for yourself, with your own name, ID and Facebook. Two accounts or borrowing for someone else gets you rejected.',
      tip: 'Pandesal makes you swim faster.'
   },
   {
      title: 'Start small, grow',
      text: 'Your first loan is small. Pay it back on time and your limit grows, step by step.',
      tip: 'Mango gives you a longer bite.'
   },
   {
      title: 'Know what you owe',
      text: 'One fixed fee and one due date, shown before you borrow. No hidden charges, no surprises.',
      tip: 'Halo-halo gives you a shield.'
   },
   {
      title: 'Pay on time',
      text: 'Paying on time earns rewards and a bigger limit. Late payments are recorded and can close your account.',
      tip: 'Turon gives you an extra heart.'
   },
   {
      title: 'Bring friends, not loan sharks',
      text: 'Invite friends to Moodeng instead of a loan shark. When they repay on time, you get rewarded.',
      tip: 'The sharks get faster now. Good luck!'
   }
];
export const lessonFor = (wave: number): Lesson & { level: number } => ({ ...LEVELS[(wave - 1) % LEVELS.length], level: wave });

// The prize wheel in Moodeng's House (every other level). Game prizes only, with honest odds:
// `weight` is the real chance and each slice is drawn that big. (Real food vouchers would need a
// server draw and sign-in, like Moo-Spin, and are not offered here.)
export type WheelPrize = { label: string; coins?: number; snack?: Food; weight: number; color: string };
export const WHEEL: WheelPrize[] = [
   { label: '+3 🍞', coins: 3, weight: 30, color: '#ffe08a' },
   { label: 'Turon', snack: 'turon', weight: 15, color: '#ffc4d6' },
   { label: '+5 🍞', coins: 5, weight: 22, color: '#ffd166' },
   { label: 'Halo-halo', snack: 'halohalo', weight: 10, color: '#d7c6ff' },
   { label: '+10 🍞', coins: 10, weight: 13, color: '#ffb703' },
   { label: 'Mango', snack: 'mango', weight: 10, color: '#fff1a8' }
];
export const WHEEL_TOTAL = WHEEL.reduce((n, p) => n + p.weight, 0);
export const spinWheel = (rng: Rng): number => {
   let r = rng() * WHEEL_TOTAL;
   for (let i = 0; i < WHEEL.length; i++) {
      r -= WHEEL[i].weight;
      if (r < 0) return i;
   }
   return WHEEL.length - 1;
};
export const wheelDueAfter = (wave: number) => wave % 2 === 0;
