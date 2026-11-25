import type { VoucherBrand } from '@/lib/friendReferrals';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Moo-Spin, the prize wheel (moodeng.app/spin and /spin/CODE). Every rule — who may spin, the odds,
 * the weekly pot, claims — lives in the database (migration 20261122120000_spin_wheel); these helpers
 * only call its functions. The server draws the prize; the wheel just animates to it.
 */

export type SpinPrize = 'grab100' | 'food50' | 'locked50' | 'extra' | 'none';
export type SpinPrizeStatus = 'claimable' | 'locked' | 'claimed' | 'expired' | 'nothing' | 'test';
export type SpinBlockReason = 'off' | 'not_approved' | 'blocked' | 'not_ph' | 'overdue';

export interface SpinCampaign {
   code: string;
   title: string;
   body: string | null;
   videoUrl: string | null;
   question: string | null;
   options: string[];
   done: boolean;
}

export interface SpinWin {
   id: string;
   prize: SpinPrize;
   amountPhp: number;
   createdAt: string;
   expiresAt: string | null;
   status: SpinPrizeStatus;
}

export interface SpinState {
   blocked: SpinBlockReason | null;
   test: boolean;
   segment: 'new' | 'comeback' | 'regular';
   ready: number;
   nextAt: string | null;
   welcomeReady: boolean;
   /** An unused Shark Chomp spin (moodeng.app/chomp, level 3): saved until they may spin. */
   gameSpin: boolean;
   potLeft: { grab100: number; food50: number; locked50: number };
   campaign: SpinCampaign | null;
   campaignMissing: boolean;
   prizes: SpinWin[];
}

export interface SpinResult {
   spinId: string;
   prize: SpinPrize;
   amountPhp: number | null;
   expiresAt: string | null;
   nextAt: string | null;
   test: boolean;
}

const num = (value: unknown) => {
   const n = Number(value);
   return Number.isFinite(n) ? n : 0;
};
const str = (value: unknown) => (typeof value === 'string' ? value : null);
const PRIZES: SpinPrize[] = ['grab100', 'food50', 'locked50', 'extra', 'none'];
const asPrize = (value: unknown): SpinPrize => (PRIZES.includes(value as SpinPrize) ? (value as SpinPrize) : 'none');

export function parseSpinState(raw: unknown): SpinState {
   const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
   const pot = (value.potLeft ?? {}) as Record<string, unknown>;
   const campaign = value.campaign && typeof value.campaign === 'object' ? (value.campaign as Record<string, unknown>) : null;
   const segment = value.segment === 'comeback' || value.segment === 'regular' ? value.segment : 'new';
   return {
      blocked: (str(value.blocked) as SpinBlockReason | null) ?? null,
      test: value.test === true,
      segment,
      ready: num(value.ready),
      nextAt: str(value.nextAt),
      welcomeReady: value.welcomeReady === true,
      gameSpin: value.gameSpin === true,
      potLeft: { grab100: num(pot.grab100), food50: num(pot.food50), locked50: num(pot.locked50) },
      campaign: campaign
         ? {
              code: String(campaign.code ?? ''),
              title: String(campaign.title ?? ''),
              body: str(campaign.body),
              videoUrl: str(campaign.videoUrl),
              question: str(campaign.question),
              options: Array.isArray(campaign.options) ? campaign.options.map((item) => String(item)) : [],
              done: campaign.done === true
           }
         : null,
      campaignMissing: value.campaignMissing === true,
      prizes: (Array.isArray(value.prizes) ? (value.prizes as Record<string, unknown>[]) : []).map((item) => ({
         id: String(item.id ?? ''),
         prize: asPrize(item.prize),
         amountPhp: num(item.amountPhp),
         createdAt: String(item.createdAt ?? ''),
         expiresAt: str(item.expiresAt),
         status: (str(item.status) as SpinPrizeStatus | null) ?? 'expired'
      }))
   };
}

export async function getSpinState(campaign?: string | null): Promise<SpinState> {
   const { data, error } = await getSupabaseBrowserClient().rpc('get_spin_state', { p_campaign: campaign || null });
   if (error) throw error;
   return parseSpinState(data);
}

// Shark Chomp → Moo-Spin: clearing level 3 earns one spin, ever (earn_game_spin, 20261125230000).
export type GameSpinResult = { saved: boolean; had: boolean; canSpin: boolean; reason: 'not_ph' | 'blocked' | 'no_call' | null };

export async function earnGameSpin(): Promise<GameSpinResult> {
   const { data, error } = await getSupabaseBrowserClient().rpc('earn_game_spin');
   if (error) throw error;
   const value = (data ?? {}) as Record<string, unknown>;
   const reason = value.reason === 'not_ph' || value.reason === 'blocked' || value.reason === 'no_call' ? value.reason : null;
   return { saved: value.saved === true, had: value.had === true, canSpin: value.canSpin === true, reason };
}

export const GAME_SPIN_TEXT: Record<'saved' | 'had' | 'not_ph' | 'blocked' | 'no_call', string> = {
   saved: 'Your Shark Chomp spin is saved! 🎟️',
   had: 'You already earned your Shark Chomp spin. 🎟️',
   not_ph: 'Moo-Spin prizes are for the Philippines for now.',
   blocked: 'Moo-Spin is not open for this account.',
   no_call: 'Book your video call first, then play again to earn your spin.'
};

export type AnswerResult = { ok: true } | { ok: false; error: 'wrong_answer' | 'campaign_over' | SpinBlockReason };

export async function answerSpinCampaign(code: string, answer: number | null): Promise<AnswerResult> {
   const { data, error } = await getSupabaseBrowserClient().rpc('answer_spin_campaign', { p_code: code, p_answer: answer });
   if (error) throw error;
   const value = (data ?? {}) as Record<string, unknown>;
   return value.ok === true ? { ok: true } : { ok: false, error: String(value.error ?? 'campaign_over') as 'campaign_over' };
}

export class SpinError extends Error {}

export async function spinWheel(): Promise<SpinResult> {
   const { data, error } = await getSupabaseBrowserClient().rpc('spin_wheel');
   if (error) throw error;
   const value = (data ?? {}) as Record<string, unknown>;
   if (typeof value.error === 'string') throw new SpinError(value.error);
   return {
      spinId: String(value.spinId ?? ''),
      prize: asPrize(value.prize),
      amountPhp: value.amountPhp === null || value.amountPhp === undefined ? null : num(value.amountPhp),
      expiresAt: str(value.expiresAt),
      nextAt: str(value.nextAt),
      test: value.test === true
   };
}

export async function claimSpinPrize(input: {
   spinId: string;
   fullName: string;
   mobile: string;
   email?: string;
   brand?: VoucherBrand;
}): Promise<string> {
   const { data, error } = await getSupabaseBrowserClient().rpc('claim_spin_prize', {
      p_spin_id: input.spinId,
      p_full_name: input.fullName,
      p_mobile: input.mobile,
      p_email: input.email || null,
      p_brand: input.brand ?? 'food'
   });
   if (error) throw error;
   return String(data);
}

// ── the wheel's faces ────────────────────────────────────────────────────────────────────────────────
/** Eight slices, clockwise from 12 o'clock. Each prize has at least one; the wheel lands on one of them. */
export const WHEEL_SLICES: Array<{ prize: SpinPrize; label: string; sub: string; fill: string; ink: string }> = [
   { prize: 'grab100', label: '₱100', sub: 'GrabMart', fill: '#ffd84d', ink: '#5a3a12' },
   { prize: 'none', label: 'Try', sub: 'again', fill: '#efe9ff', ink: '#6b55f7' },
   { prize: 'food50', label: '₱50', sub: 'Food', fill: '#7b67f9', ink: '#ffffff' },
   { prize: 'extra', label: 'Spin', sub: 'again', fill: '#ffe9a8', ink: '#5a3a12' },
   { prize: 'locked50', label: '₱50', sub: 'Next loan', fill: '#3c8248', ink: '#ffffff' },
   { prize: 'none', label: 'Try', sub: 'again', fill: '#efe9ff', ink: '#6b55f7' },
   { prize: 'food50', label: '₱50', sub: 'Food', fill: '#7b67f9', ink: '#ffffff' },
   { prize: 'extra', label: 'Spin', sub: 'again', fill: '#ffe9a8', ink: '#5a3a12' }
];

export const SLICE_DEG = 360 / WHEEL_SLICES.length;

/**
 * How far to turn (degrees, always forward) so the pointer at 12 o'clock lands inside a slice that
 * shows this prize. `current` is the wheel's rotation now; `roll` in [0, 1) picks the slice and the
 * spot inside it (kept off the edges so it never looks like a near miss).
 */
export function targetRotation(prize: SpinPrize, current: number, roll: number, turns = 5): number {
   const slots = WHEEL_SLICES.map((slice, index) => (slice.prize === prize ? index : -1)).filter((index) => index >= 0);
   const pick = slots[Math.min(slots.length - 1, Math.floor(roll * slots.length))] ?? 1;
   const within = 0.25 + ((roll * slots.length) % 1) * 0.5;
   // Slice i spans [i*SLICE_DEG, (i+1)*SLICE_DEG) clockwise; rotating the wheel by -x brings angle x to the top.
   const sliceAngle = (pick + within) * SLICE_DEG;
   const restNow = ((current % 360) + 360) % 360;
   const want = (360 - sliceAngle) % 360;
   const delta = (want - restNow + 360) % 360;
   return current + turns * 360 + delta;
}

/** Which slice sits under the pointer at a given rotation (for tests and the "sold out" check). */
export function sliceAt(rotation: number): number {
   const angle = (((-rotation % 360) + 360) % 360) / SLICE_DEG;
   return Math.floor(angle) % WHEEL_SLICES.length;
}

export const PRIZE_HEADLINE: Record<SpinPrize, string> = {
   grab100: 'You won ₱100!',
   food50: 'You won ₱50 food!',
   locked50: 'You won ₱50 food!',
   extra: 'Free spin tomorrow!',
   none: 'So close!'
};

export const BLOCKED_TEXT: Record<SpinBlockReason, string> = {
   off: 'Moo-Spin is resting. Come back soon!',
   not_approved: 'Moo-Spin opens once your account is approved.',
   blocked: 'Moo-Spin is not open for this account.',
   not_ph: 'Moo-Spin prizes are for the Philippines for now.',
   overdue: 'Repay your loan first, then spin.'
};

/** A made-up state for the dev-only /spin-preview route (no account, nothing saved). */
export const SPIN_PREVIEW_STATE: SpinState = {
   blocked: null,
   test: false,
   segment: 'new',
   ready: 2,
   nextAt: null,
   welcomeReady: true,
   gameSpin: false,
   potLeft: { grab100: 0, food50: 6, locked50: 30 },
   campaign: {
      code: 'PAYDAY',
      title: 'Payday tip: pay yourself first',
      body: 'Before you spend, put ₱100 aside. Small, every payday.',
      videoUrl: null,
      question: 'What do you do first on payday?',
      options: ['Spend it all', 'Put ₱100 aside', 'Borrow more'],
      done: false
   },
   campaignMissing: false,
   prizes: [
      {
         id: 'p1',
         prize: 'food50',
         amountPhp: 50,
         createdAt: '2026-11-20T10:00:00Z',
         expiresAt: '2026-12-04T10:00:00Z',
         status: 'claimable'
      },
      { id: 'p2', prize: 'locked50', amountPhp: 50, createdAt: '2026-11-18T10:00:00Z', expiresAt: '2027-02-01T10:00:00Z', status: 'locked' }
   ]
};
