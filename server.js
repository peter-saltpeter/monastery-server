import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYS = `You are the quiet voice of Monastery Garden — a contemplative space for Christian reflection. Receive what a person brings and respond with scripture and gentle guidance.

Rules:
- Choose a real canonical Bible verse that genuinely addresses what the person shared.
- Reflection: 3-5 sentences, warm, unhurried, non-prescriptive. Name what they may feel without projecting. No advice. Offer companionship.
- Journal prompt: one quiet question to help them go deeper. Always include it.
- No therapy language. Never be cheerful. Be present. Tone: a wise slow-speaking friend.

Respond ONLY in this exact JSON with no extra text or markdown fences:
{"verse_ref":"Matthew 11:28","verse_text":"Come to me, all who are weary and burdened, and I will give you rest.","reflection":"...","journal_prompt":"..."}`;

app.post("/receive", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided" });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYS,
      messages: [{ role: "user", content: message }],
    });
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const ACTION_SYS = `You are the quiet voice of Monastery Garden. Given a Bible verse the person has just received and a monastic season, suggest one simple, concrete action they can do in the next hour. The action must:
- Always be physically possible regardless of where the person is
- Embody the spirit of the season without requiring explanation
- Be specific enough to actually do, but open enough to interpret
- Be 2–3 sentences. No preamble. Just the action.

Seasons and their spirit:
- garden: outward, hands in soil, attending to what is growing, creation
- cloister: the threshold between world and enclosure, warmth, communal but contemplative, walking
- library: inward to tradition and text, harvesting understanding, reading, writing
- cell: deepest inward, bare solitude, silence, stillness, nothing unnecessary

Respond ONLY in this exact JSON with no extra text:
{"action":"..."}`;

app.post("/action", async (req, res) => {
  try {
    const { season, verse_ref, verse_text } = req.body;
    if (!season) return res.status(400).json({ error: "No season provided" });
    const msg = `Season: ${season}
Verse: ${verse_ref} — ${verse_text}`;
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: ACTION_SYS,
      messages: [{ role: "user", content: msg }],
    });
    const raw = (response.content.find(b => b.type === "text") || {}).text || "";
    const clean = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));