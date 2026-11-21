// Discord Interactions endpoint (Supabase Edge Function).
//
// Was deployed from outside this repo until Nov 2026 (version 65 copied in unchanged, plus the
// proof-of-income buttons). Deploy with --no-verify-jwt: Discord signs its requests instead.
//
// Replaces the always-on gateway bot. Discord HTTP-POSTs interaction events
// (button clicks, modal submits) here. We verify Discord's Ed25519 signature,
// then:
//   • "Reply" button click  -> open a modal (text box)
//   • modal submit          -> save the agent's reply to widget_messages
//                              (the website widget polls and shows it)
//
// No bot token needed here: interaction responses use Discord's own callback,
// and Supabase injects SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY automatically.
import nacl from "npm:tweetnacl@1.0.3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleIncomeDocDiscordClick } from "../_shared/incomeDocCards.ts";

// This is the application's PUBLIC key (safe to embed — it is not a secret).
const PUBLIC_KEY = "8689924a663ff1128d36e9f5d05e36de9d885cc8a27761fde3d13d03589fd1fd";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function hex2bin(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });

// --- Nudge the visitor once when they've left and a reply is waiting --------
// The widget updates widget_conversations.last_seen_at while its chat is open
// (see web/api/poll.js). If a reply lands while the visitor is away, we email
// them ONE "you've been replied to" nudge for the whole batch of unread agent
// messages — not one email per reply. This is the "we'll follow up by email"
// promise the widget already makes. Reuses the team's Resend setup; both env
// vars are read at runtime so a missing key is a safe no-op, not a crash.
//
// Why "unread batch" instead of a time throttle: a throttle still emails once
// per window even if the agent sends five quick replies, and it can't tell
// "she came back and read everything" from "she's still away" — so a reply an
// hour later might get silently swallowed by an old throttle window. Instead:
// a nudge fires only when there's at least one agent message newer than
// last_seen_at (unread) AND we haven't already nudged for that same unread
// batch (last_emailed_at is older than the oldest unread message). The moment
// she polls again, last_seen_at advances past the whole batch, clearing it —
// so the very next agent reply starts a fresh batch and nudges again. This
// naturally yields exactly one email per "stepped away" episode.
//
// NOTE: the away-reply nudge itself now lives in the separate
// nudge-away-replies cron sweep (a debounced digest that groups a burst of
// replies into ONE email and also catches a reply that lands just after the
// visitor leaves). This function no longer sends it inline — it only keeps the
// resolve-time transcript (emailTranscript) below.
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Moodeng Support <support@moodengcredit.com>";
// Visitor-facing agent name. The widget + reply/transcript emails present one
// friendly agent ("Moodeng"); the Discord thread still shows the real staffer so
// the team knows who replied internally. Override with AGENT_DISPLAY_NAME.
const AGENT_DISPLAY_NAME = Deno.env.get("AGENT_DISPLAY_NAME") || "Moodeng";

// Canned replies — the agent picks one from the "Quick reply…" dropdown on a
// ticket and it's sent to the visitor verbatim (as Moodeng).
const CANNED: { key: string; label: string; text: string }[] = [
  { key: "greet", label: "Greeting", text: "Hi! Thanks for reaching out to Moodeng Support — looking into this now, one moment 🙏" },
  { key: "details", label: "Ask for details", text: "Could you share a screenshot and the wallet address or tracking ID involved? That helps me sort it fast." },
  { key: "pending", label: "Payment pending", text: "On-chain payments can take a few minutes to confirm. If it's been over 15 min, send me the transaction hash and I'll check it." },
  { key: "repay", label: "Repayment help", text: "To repay, open your loan in the dashboard and tap Repay. If it's failing, tell me the exact error and I'll help." },
  { key: "kyc", label: "KYC / verification", text: "For verification, make sure your ID photo is clear and matches your selfie. I can re-trigger your verification — want me to?" },
  { key: "wallet", label: "Wallet connection", text: "Try disconnecting and reconnecting your wallet, and confirm you're on the right network. Still stuck? Send a screenshot." },
  { key: "limit", label: "Borrowing limit", text: "Your limit grows as you repay on time. Let me check your current limit — one sec." },
  { key: "escalate", label: "Escalating", text: "This needs a closer look — I'm escalating to the team and we'll get back to you shortly." },
  { key: "hours", label: "After-hours", text: "Our team is offline right now (online 10 AM–midnight, Bangkok time). I've noted your message and we'll reply as soon as we're back." },
  { key: "close", label: "Closing", text: "Glad that's sorted! I'll close this out — reply anytime and it'll reopen 💚" },
];

// Buttons + the "Quick reply…" dropdown carried on every ticket message.
function ticketComponents(cid: string) {
  return [
    { type: 1, components: [
      { type: 2, style: 1, label: "Reply", custom_id: `reply:${cid}` },
      { type: 2, style: 3, label: "✅ Resolve", custom_id: `resolve:${cid}` },
    ] },
    { type: 1, components: [
      { type: 3, custom_id: `canned:${cid}`, placeholder: "Quick reply…", options: CANNED.map((c) => ({ label: c.label, value: c.key })) },
    ] },
  ];
}

const escapeHtml = (s: string) =>
  s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

// On resolve, email the visitor a copy of the whole conversation (if we have an
// address). Best-effort: a missing Resend key or empty thread is a safe no-op.
async function emailTranscript(cid: string): Promise<void> {
  try {
    if (!RESEND_KEY) return;
    const { data: convo } = await supabase
      .from("widget_conversations")
      .select("visitor_email, visitor_name")
      .eq("id", cid)
      .maybeSingle();
    if (!convo?.visitor_email) return;
    const { data: msgs } = await supabase
      .from("widget_messages")
      .select("sender, body, created_at")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: true });
    const lines = (msgs || []).filter((m) => m.sender === "visitor" || m.sender === "agent");
    if (lines.length === 0) return;
    const first = convo.visitor_name ? String(convo.visitor_name).split(" ")[0] : "there";
    const rows = lines
      .map((m) => {
        const who = m.sender === "agent" ? AGENT_DISPLAY_NAME : "You";
        const color = m.sender === "agent" ? "#16a34a" : "#111";
        return `<p style="margin:8px 0"><strong style="color:${color}">${escapeHtml(who)}:</strong> ${escapeHtml(String(m.body || ""))}</p>`;
      })
      .join("");
    const html =
      `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#111;line-height:1.5">` +
      `<p>Hi ${escapeHtml(first)},</p>` +
      `<p>Here's a summary of your conversation with Moodeng Support:</p>` +
      `<div style="margin:14px 0;padding:12px 16px;background:#f4f4f6;border-left:3px solid #16a34a;border-radius:6px">${rows}</div>` +
      `<p style="color:#8a8a8a;font-size:13px">Reply to this email or reopen the chat on the site any time.</p>` +
      `</div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: convo.visitor_email, subject: "Summary of your Moodeng Support chat", html }),
    });
    if (!r.ok) console.error("[transcript-email] resend failed:", r.status, await r.text());
  } catch (e) {
    console.error("[transcript-email] error:", (e as Error).message);
  }
}

// --- Realtime: push agent replies / resolve events to the visitor instantly ---
// The widget subscribes to a per-conversation broadcast channel `chat:<id>` and
// renders these the moment they arrive. Its 15s poll is the fallback, so this is
// best-effort: a failed broadcast never breaks delivery.
async function broadcastToChat(convId: string, event: string, payload: unknown): Promise<void> {
  try {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: `chat:${convId}`, event, payload, private: false }] }),
    });
  } catch (_e) { /* best-effort; the widget's poll is the fallback */ }
}

// Schedule a background task without blocking Discord's 3s interaction budget.
function background(task: Promise<unknown>): void {
  const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime?.waitUntil;
  if (typeof waitUntil === "function") waitUntil(task);
  else task.catch(() => {});
}

// Ask the widget API to rebuild the live #support-tickets board after a reply or
// resolve. Best-effort: a missing secret or a failed call never breaks the reply.
async function kickBoard(): Promise<void> {
  const base = Deno.env.get("WEB_BASE_URL") || "https://web-iota-sage-38.vercel.app";
  const secret = Deno.env.get("BOARD_SECRET");
  if (!secret) return;
  try {
    await fetch(`${base}/api/board?key=${encodeURIComponent(secret)}`, { method: "POST" });
  } catch (e) {
    console.error("[board] refresh failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  const sig = req.headers.get("X-Signature-Ed25519");
  const ts = req.headers.get("X-Signature-Timestamp");
  const raw = await req.text();

  // Verify the request really came from Discord.
  if (!sig || !ts) return new Response("missing signature", { status: 401 });
  const valid = nacl.sign.detached.verify(
    new TextEncoder().encode(ts + raw),
    hex2bin(sig),
    hex2bin(PUBLIC_KEY),
  );
  if (!valid) return new Response("invalid signature", { status: 401 });

  const body = JSON.parse(raw);

  // 1 = PING  -> Discord's endpoint validation handshake
  if (body.type === 1) return json({ type: 1 });

  // 3 = MESSAGE_COMPONENT (button click)
  if (body.type === 3) {
    const custom = String(body.data?.custom_id || "");

    // Proof of income: 👀 Check / ✅ Approve / ❌ Reject on a "Needs your decision" card
    // ("incdoc:…", posted by kyc-cross-check — see _shared/incomeDocCards.ts).
    if (custom.startsWith("incdoc:")) {
      const reply = await handleIncomeDocDiscordClick(supabase, body);
      return json(reply ?? { type: 4, data: { content: "Unknown button.", flags: 64 } });
    }

    // "Quick reply…" dropdown -> send the chosen canned reply to the visitor.
    if (custom.startsWith("canned:")) {
      const cid = custom.split(":")[1] || "";
      const key = String(body.data?.values?.[0] || "");
      const canned = CANNED.find((c) => c.key === key);
      const agent = body.member?.nick || body.member?.user?.username || body.user?.username || "Agent";
      if (!cid || !canned) return json({ type: 4, data: { content: "Unknown quick reply." } });
      let visitorLabel = "visitor";
      const { data: who } = await supabase
        .from("widget_conversations").select("visitor_name, visitor_email").eq("id", cid).maybeSingle();
      visitorLabel = (who && (who.visitor_name || who.visitor_email)) || "visitor";
      await supabase.from("widget_messages").insert({
        conversation_id: cid, sender: "agent", body: canned.text, agent_name: AGENT_DISPLAY_NAME,
      });
      await supabase.from("widget_conversations").update({ agent_typing_until: null }).eq("id", cid);
      // Away-reply email is owned by the nudge-away-replies cron sweep (debounced
      // digest), not sent inline here — so a burst of replies becomes one email.
      background(kickBoard()); // canned reply moves the ticket to "In progress"
      return json({ type: 4, data: { content: `**${agent} → ${visitorLabel}:** ${canned.text}`, components: ticketComponents(cid) } });
    }

    // Founding-referrer credit confirm/decline: "refcredit-ok:<id>" / "refcredit-no:<id>"
    if (custom.startsWith("refcredit-")) {
      const [tag, creditId] = custom.split(":");
      const approve = tag === "refcredit-ok";
      const agent = body.member?.nick || body.member?.user?.username || "founder";
      let summary = "";
      if (creditId) {
        const { data: row } = await supabase
          .from("referrer_credits")
          .update({ status: approve ? "earned" : "declined", confirmed_by: agent, confirmed_at: new Date().toISOString() })
          .eq("id", creditId).eq("status", "pending")
          .select("ambassador_user_id, credits, credit_type").maybeSingle();
        if (row && approve) {
          const { data: agg } = await supabase
            .from("referrer_credits").select("credits")
            .eq("ambassador_user_id", row.ambassador_user_id).eq("status", "earned");
          const total = (agg || []).reduce((s, r) => s + Number(r.credits), 0);
          const next = total >= 30 ? "0.25% (full grant)" : total >= 15 ? "0.125%" : total >= 5 ? "0.05%" : `${(total * 0.01).toFixed(2)}% (prorated)`;
          summary = `✅ **+${row.credits} credit** confirmed by ${agent}. Ambassador total: **${total} credits** → ${next}.`;
        } else {
          summary = approve ? `✅ Confirmed by ${agent}.` : `🚫 Declined by ${agent}.`;
        }
      }
      return json({ type: 7, data: { content: summary || "Handled.", components: [] } });
    }

    // Resolve button -> mark the conversation resolved. The widget sees the new
    // status on its next poll and asks the visitor for a 👍/👎 rating.
    if (custom.startsWith("resolve:")) {
      const rid = custom.split(":")[1] || "";
      const agent = body.member?.nick || body.member?.user?.username || body.user?.username || "Agent";
      if (rid) {
        await supabase.from("widget_conversations")
          .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: agent, agent_typing_until: null })
          .eq("id", rid);
        // Email the visitor a transcript (best-effort, off the response path).
        const task = emailTranscript(rid);
        const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
          .EdgeRuntime?.waitUntil;
        if (typeof waitUntil === "function") waitUntil(task);
        else await task;
      }
      background(kickBoard()); // resolve moves the ticket into "Resolved"
      return json({ type: 4, data: { content: `✅ **Resolved** by ${agent}. The visitor was asked to rate the chat.` } });
    }

    // Otherwise: the support Reply button -> open the reply modal.
    const cid = custom.split(":")[1] || "";
    // Agent opened the reply box → show "Moodeng is typing…" to the visitor.
    // A short TTL means it self-clears if the agent abandons the modal.
    if (cid) {
      await supabase.from("widget_conversations")
        .update({ agent_typing_until: new Date(Date.now() + 60_000).toISOString() })
        .eq("id", cid);
    }
    return json({
      type: 9, // MODAL
      data: {
        custom_id: `replymodal:${cid}`,
        title: "Reply to visitor",
        components: [{
          type: 1, // action row
          components: [{
            type: 4, // text input
            custom_id: "body",
            label: "Your reply",
            style: 2, // paragraph
            required: true,
            max_length: 2000,
          }],
        }],
      },
    });
  }

  // 5 = MODAL_SUBMIT -> persist the agent's reply
  if (body.type === 5) {
    const cid = String(body.data?.custom_id || "").split(":")[1] || "";
    const text = (body.data?.components?.[0]?.components?.[0]?.value || "").trim();
    const agent = body.member?.nick || body.member?.user?.username || body.user?.username || "Agent";

    // Descriptive label for the confirmation ("→ Jane Doe" / "→ jane@x.com")
    // instead of a bare "visitor". Uses the name/email captured for the chat.
    let visitorLabel = "visitor";
    if (cid) {
      const { data: who } = await supabase
        .from("widget_conversations").select("visitor_name, visitor_email").eq("id", cid).maybeSingle();
      visitorLabel = (who && (who.visitor_name || who.visitor_email)) || "visitor";
    }

    if (cid && text) {
      await supabase.from("widget_messages").insert({
        conversation_id: cid,
        sender: "agent",
        body: text,
        agent_name: AGENT_DISPLAY_NAME,
      });
      // Reply sent → stop the typing indicator.
      await supabase.from("widget_conversations").update({ agent_typing_until: null }).eq("id", cid);
      // If the visitor has left, the away-reply email is sent by the
      // nudge-away-replies cron sweep (a debounced digest that groups a burst of
      // replies into one email), not inline here.
      background(kickBoard()); // first agent reply moves the ticket to "In progress"
    }

    // Post the reply visibly in the thread, and carry a fresh "Reply again"
    // button so the agent can keep the conversation going without waiting for
    // the visitor to message again.
    return json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: `**${agent} → ${visitorLabel}:** ${text}`,
        components: cid ? ticketComponents(cid) : [],
      },
    });
  }

  return json({ type: 1 });
});
