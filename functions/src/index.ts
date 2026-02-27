import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleGenerativeAI} from "@google/generative-ai";
import * as admin from "firebase-admin";

type AssistantBody = {
  programId?: string;
  question?: string;
  stream?: boolean;
  mode?: "listModels" | "debugState" | "debugEnv";
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
 * Safely loads program state from Firestore doc: programs/{programId}.
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
        const baseUrl =
          "https://generativelanguage.googleapis.com/v1beta/models?key=";
        const url = baseUrl + apiKey;

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

    if (mode === "debugEnv") {
      res.status(200).json({
        ok: true,
        runtime: {
          gcloudProject: process.env.GCLOUD_PROJECT,
          googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
          functionsEmulator: process.env.FUNCTIONS_EMULATOR,
        },
      });
      return;
    }

    if (mode === "debugState") {
      try {
        ensureAdmin();

        const refPath = `programs/${programId}`;
        const snap = await admin.firestore().doc(refPath).get();

        const data = snap.exists ? (snap.data() as ProgramDoc) : undefined;
        const state = (data?.state ?? null) as Record<string, unknown> | null;

        const keys = state ? Object.keys(state) : [];

        const tnsItemsArr = asArray(state?.tnsItems);
        const contractorsArr = asArray(state?.contractors);
        const sowsArr = asArray(state?.sows);
        const internalLaborArr = asArray(state?.internalLaborItems);

        res.status(200).json({
          ok: true,
          programId,
          refPath,
          exists: snap.exists,
          hasState: Boolean(state),
          stateKeys: keys,
          counts: {
            tnsItems: tnsItemsArr.length,
            contractors: contractorsArr.length,
            sows: sowsArr.length,
            internalLaborItems: internalLaborArr.length,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(200).json({
          ok: true,
          programId,
          exists: false,
          debugError: message,
        });
      }
      return;
    }

    if (!question) {
      res.status(400).json({error: "Missing 'question' in request body."});
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const state = await loadProgramState(programId);
    const keys = state ? Object.keys(state) : [];

    const promptLines: string[] = [
      "You are Forecast Companion Analyst.",
      `Program: ${programId}`,
      "Rules: Do not invent numbers.",
      "If data is not provided, say what you need.",
      "Formatting: Respond in plain text paragraphs only.",
      "No Markdown, no bullets, no asterisks.",
      "If listing items is needed, use sentences separated by new lines.",
      "Do not use leading '*', '-', or numbering.",
      "Formatting rules:",
      "1. Respond in clean business paragraphs.",
      "2. Do NOT use Markdown.",
      "3. Do NOT use *, -, or numbered lists.",
      "4. Use short executive-style explanations.",
      "Tone: Professional, concise, executive summary style.",
    ];

    if (state) {
      const countsLine =
        "Counts: " +
        `tnsItems=${countItems(asArray(state.tnsItems))}, ` +
        `contractors=${countItems(asArray(state.contractors))}, ` +
        `sows=${countItems(asArray(state.sows))}, ` +
        "internalLaborItems=" +
        `${countItems(asArray(state.internalLaborItems))}`;

      promptLines.push("");
      promptLines.push("Firestore state loaded: YES");
      promptLines.push(`State keys: ${keys.join(", ")}`);
      promptLines.push(countsLine);

      const stateJson = JSON.stringify(state);
      promptLines.push("");
      promptLines.push("STATE_JSON:");
      promptLines.push(stateJson);
    } else {
      promptLines.push("");
      promptLines.push("Firestore state loaded: NO");
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
