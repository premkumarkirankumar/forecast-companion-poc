import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleGenerativeAI} from "@google/generative-ai";
import * as admin from "firebase-admin";

type AssistantBody = {
  programId?: string;
  question?: string;
  stream?: boolean;
  mode?: "listModels";
};

type ModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

type ProgramDoc = {
  state?: Record<string, unknown>;
};

/**
 * Ensures Firebase Admin SDK is initialized exactly once.
 * @return {void}
 */
function ensureAdmin(): void {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
}

/**
 * Safely converts unknown to a finite number (defaults to 0).
 * @param {unknown} v - input value
 * @return {number} finite number or 0
 */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Ensures a value is an array; otherwise returns an empty array.
 * @param {unknown} v - input value
 * @return {unknown[]} array value or []
 */
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Counts items if value is an array.
 * @param {unknown} v - input value
 * @return {number} item count
 */
function countItems(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/**
 * Sums yearTarget fields for an array of items.
 * @param {unknown[]} items - list of items
 * @return {number} sum of yearTarget
 */
function sumYearTargets(items: unknown[]): number {
  let total = 0;
  for (const it of items) {
    if (it && typeof it === "object") {
      const obj = it as Record<string, unknown>;
      total += num(obj.yearTarget);
    }
  }
  return total;
}

/**
 * Builds a compact state summary for grounding the AI prompt.
 * This is additive-only context and does not affect existing API shape.
 * @param {Record<string, unknown> | null} state - program state from Firestore
 * @return {string[]} summary lines
 */
function buildStateSummary(state: Record<string, unknown> | null): string[] {
  if (!state) return [];

  const internalLaborItems = asArray(state.internalLaborItems);
  const contractors = asArray(state.contractors);
  const sows = asArray(state.sows);
  const tnsItems = asArray(state.tnsItems);

  const lines: string[] = [];

  lines.push("Data context (from Firestore programs/{programId}.state):");
  lines.push(`- Internal labor items: ${countItems(internalLaborItems)}`);
  lines.push(`- External contractors: ${countItems(contractors)}`);
  lines.push(`- External SOWs: ${countItems(sows)}`);
  lines.push(`- Tools & Services items: ${countItems(tnsItems)}`);

  const tnsTarget = sumYearTargets(tnsItems);
  if (tnsTarget > 0) {
    lines.push(`- Tools & Services yearTarget (sum): ${tnsTarget}`);
  }

  return lines;
}

/**
 * Loads program state from Firestore doc: programs/{programId}.
 * If not found or if any error occurs, returns null (non-breaking).
 * @param {string} programId - connected | tre | csc | default
 * @return {Promise<Record<string, unknown> | null>} program state
 */
async function loadProgramState(
  programId: string
): Promise<Record<string, unknown> | null> {
  try {
    ensureAdmin();

    const snap = await admin.firestore().doc(`programs/${programId}`).get();
    if (!snap.exists) return null;

    const data = snap.data() as ProgramDoc | undefined;
    const state = (data?.state ?? null) as Record<string, unknown> | null;
    return state;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn("Failed to load Firestore program state", {programId, message});
    return null;
  }
}

export const assistant = onRequest(
  {
    cors: true,
    secrets: ["GEMINI_API_KEY"],
    region: "us-central1",
  },
  async (req, res) => {
    logger.info("assistant called", {method: req.method});

    if (req.method !== "POST") {
      res.status(405).json({error: "Use POST"});
      return;
    }

    const body = (req.body || {}) as AssistantBody;
    const programId = body.programId ?? "default";
    const question = (body.question ?? "").trim();
    const stream = body.stream === true;
    const mode = body.mode;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({error: "GEMINI_API_KEY secret is not available."});
      return;
    }

    if (mode === "listModels") {
      try {
        const url =
          "https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey;

        const r = await fetch(url);
        const j = (await r.json()) as ModelsResponse;

        res.status(200).json({
          ok: true,
          models: j.models ?? [],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({
          ok: false,
          error: "ListModels failed",
          details: message,
        });
      }
      return;
    }

    if (!question) {
      res.status(400).json({error: "Missing 'question' in request body."});
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

    const state = await loadProgramState(programId);
    const stateSummary = buildStateSummary(state);

    const promptLines: string[] = [
      "You are Forecast Companion Analyst.",
      `Program: ${programId}`,
      "Rules: Do not invent numbers.",
      "If data is not provided, say what you need.",
    ];

    if (stateSummary.length > 0) {
      promptLines.push("");
      promptLines.push(...stateSummary);
    }

    promptLines.push("");
    promptLines.push(`User question: ${question}`);

    const prompt = promptLines.join("\n");

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      try {
        const result = await model.generateContentStream(prompt);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            const payload = JSON.stringify({delta: text});
            res.write(`data: ${payload}\n\n`);
          }
        }

        res.write(`data: ${JSON.stringify({done: true})}\n\n`);
        res.end();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown Gemini error";

        logger.error("Gemini streaming error", {message});

        const payload = JSON.stringify({
          error: "Gemini error",
          details: message,
        });

        res.write(`data: ${payload}\n\n`);
        res.end();
      }
      return;
    }

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      res.status(200).json({
        ok: true,
        programId,
        answerText: text,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown Gemini error";

      logger.error("Gemini error", {message});

      res.status(500).json({
        ok: false,
        error: "Gemini error",
        details: message,
      });
    }
  }
);
