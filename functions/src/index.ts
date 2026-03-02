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

type ProgramSummary = {
  programId: string;
  internalCount: number;
  toolsCount: number;
  toolsTotal: number;
  contractorTotal: number;
  sowTotal: number;
  externalTotal: number;
  totalForecast: number;
  externalReliance: number;
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
 * Safely sums MS + NF values across all months for an item array.
 * @param {unknown} v - input array
 * @return {number} total amount
 */
function sumItems(v: unknown): number {
  const items = asArray(v) as Array<Record<string, unknown>>;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return items.reduce((total, item) => {
    const msByMonth = (item?.msByMonth ?? {}) as Record<string, unknown>;
    const nfByMonth = (item?.nfByMonth ?? {}) as Record<string, unknown>;

    const itemTotal = months.reduce((acc, month) => {
      return (
        acc +
        Number(msByMonth?.[month] ?? 0) +
        Number(nfByMonth?.[month] ?? 0)
      );
    }, 0);

    return total + itemTotal;
  }, 0);
}

/**
 * Sums an individual item's MS + NF values across all months.
 * @param {Record<string, unknown>} item - forecast item
 * @return {number} total amount
 */
function sumSingleItem(item: Record<string, unknown>): number {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const msByMonth = (item?.msByMonth ?? {}) as Record<string, unknown>;
  const nfByMonth = (item?.nfByMonth ?? {}) as Record<string, unknown>;

  return months.reduce((acc, month) => {
    return (
      acc +
      Number(msByMonth?.[month] ?? 0) +
      Number(nfByMonth?.[month] ?? 0)
    );
  }, 0);
}

/**
 * Builds a deterministic summary of a program from saved state.
 * @param {string} programId - connected | tre | csc
 * @param {Record<string, unknown> | null} state - saved state
 * @return {ProgramSummary} summary
 */
function summarizeProgramState(
  programId: string,
  state: Record<string, unknown> | null
): ProgramSummary {
  const internalItems = asArray(state?.internalLaborItems);
  const toolsItems = asArray(state?.tnsItems) as Array<Record<string, unknown>>;
  const contractors = asArray(state?.contractors);
  const sows = asArray(state?.sows);

  const toolsTotal = sumItems(toolsItems);
  const contractorTotal = sumItems(contractors);
  const sowTotal = sumItems(sows);
  const externalTotal = contractorTotal + sowTotal;
  const totalForecast = toolsTotal + externalTotal;

  return {
    programId,
    internalCount: countItems(internalItems),
    toolsCount: countItems(toolsItems),
    toolsTotal,
    contractorTotal,
    sowTotal,
    externalTotal,
    totalForecast,
    externalReliance: totalForecast > 0 ? externalTotal / totalForecast : 0,
  };
}

/**
 * Formats a number as USD currency without decimals.
 * @param {number} value - numeric value
 * @return {string} formatted currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

/**
 * Maps a risk score into a leadership-friendly label.
 * @param {number} reliance - external reliance ratio
 * @return {string} label
 */
function classifyRisk(reliance: number): string {
  if (reliance >= 0.75) return "At Risk";
  if (reliance >= 0.6) return "Watch";
  return "Healthy";
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
      "Terminology: MS means Maintenance.",
      "Terminology: NF means New Feature.",
      "If the user says MF, interpret it as NF (New Feature).",
      "Tracked spend means Tools & Services plus External costs only.",
      "Internal is represented as FTE capacity, not internal labor cost.",
      "When answering leadership-style questions, lead with the takeaway, then the supporting numbers.",
    ];

    if (state) {
      const tnsItemsArr = asArray(state.tnsItems);
      const contractorsArr = asArray(state.contractors);
      const sowsArr = asArray(state.sows);
      const internalLaborArr = asArray(state.internalLaborItems);
      const toolsTotal = sumItems(tnsItemsArr);
      const contractorTotal = sumItems(contractorsArr);
      const sowTotal = sumItems(sowsArr);
      const trackedSpendTotal = toolsTotal + contractorTotal + sowTotal;

      const countsLine =
        "Counts: " +
        `tnsItems=${countItems(tnsItemsArr)}, ` +
        `contractors=${countItems(contractorsArr)}, ` +
        `sows=${countItems(sowsArr)}, ` +
        "internalLaborItems=" +
        `${countItems(internalLaborArr)}`;

      const totalsLine =
        "Executive summary: " +
        `trackedSpend=${trackedSpendTotal}, ` +
        `toolsAndServices=${toolsTotal}, ` +
        `contractors=${contractorTotal}, ` +
        `sows=${sowTotal}, ` +
        `internalFteCount=${countItems(internalLaborArr)}`;

      promptLines.push("");
      promptLines.push("Firestore state loaded: YES");
      promptLines.push(`State keys: ${keys.join(", ")}`);
      promptLines.push(countsLine);
      promptLines.push(totalsLine);

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

export const portfolioInsights = onRequest(
  {
    cors: true,
    secrets: ["GEMINI_API_KEY"],
    region: "us-central1",
  },
  async (req, res) => {
    logger.info("portfolioInsights called", {method: req.method});

    if (req.method !== "POST") {
      res.status(405).json({error: "Use POST"});
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({error: "GEMINI_API_KEY secret is not available."});
      return;
    }

    const programIds = ["connected", "tre", "csc"];
    const loaded = await Promise.all(
      programIds.map(async (id) => [id, await loadProgramState(id)] as const)
    );

    const states = Object.fromEntries(loaded);
    const summaries = programIds.map((id) => summarizeProgramState(id, states[id] ?? null));

    const portfolioTotal = summaries.reduce((sum, item) => sum + item.totalForecast, 0);
    const toolsTotal = summaries.reduce((sum, item) => sum + item.toolsTotal, 0);
    const externalTotal = summaries.reduce((sum, item) => sum + item.externalTotal, 0);
    const internalCount = summaries.reduce((sum, item) => sum + item.internalCount, 0);

    const topProgram = summaries.reduce((best, item) => {
      return item.totalForecast > best.totalForecast ? item : best;
    }, summaries[0]);

    const highestExternalReliance = summaries.reduce((best, item) => {
      return item.externalReliance > best.externalReliance ? item : best;
    }, summaries[0]);

    let topTool = {name: "None", total: 0, programId: "n/a"};
    for (const id of programIds) {
      const tnsItems = asArray(states[id]?.tnsItems) as Array<Record<string, unknown>>;
      for (const item of tnsItems) {
        const total = sumSingleItem(item);
        if (total > topTool.total) {
          topTool = {
            name: String(item?.name ?? "Unnamed tool"),
            total,
            programId: id,
          };
        }
      }
    }

    const riskLevel = classifyRisk(highestExternalReliance.externalReliance);
    const topRiskDriver =
      highestExternalReliance.externalReliance >= 0.75
        ? "External reliance"
        : topTool.total > portfolioTotal * 0.12
          ? "Tool concentration"
          : "Portfolio mix";

    const deterministic = {
      portfolioTotal,
      toolsTotal,
      externalTotal,
      internalCount,
      topProgram: {
        programId: topProgram.programId,
        totalForecast: topProgram.totalForecast,
      },
      topTool,
      highestExternalReliance: {
        programId: highestExternalReliance.programId,
        ratio: highestExternalReliance.externalReliance,
      },
      riskLevel,
      topRiskDriver,
      generatedAt: new Date().toISOString(),
    };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = [
      "You are Forecast Companion Portfolio Analyst.",
      "Turn the deterministic metrics below into concise executive language.",
      "Do not change the numbers.",
      "Be specific, not generic.",
      "Return JSON only with these keys: headline, overview, deliveryView, recommendedFocus.",
      "headline = short one-line title.",
      "overview = one concise paragraph explaining overall portfolio posture.",
      "deliveryView = one concise paragraph explaining delivery or execution posture.",
      "recommendedFocus = one concise paragraph explaining what leaders should review next.",
      "Use plain business language.",
      "",
      `Portfolio total tracked spend: ${formatCurrency(portfolioTotal)}`,
      `Tools and Services tracked spend: ${formatCurrency(toolsTotal)}`,
      `External tracked spend: ${formatCurrency(externalTotal)}`,
      `Internal FTE count: ${internalCount}`,
      `Top cost program: ${topProgram.programId} at ${formatCurrency(topProgram.totalForecast)}`,
      `Top cost tool: ${topTool.name} in ${topTool.programId} at ${formatCurrency(topTool.total)}`,
      `Highest external reliance: ${highestExternalReliance.programId} at ${Math.round(highestExternalReliance.externalReliance * 100)}%`,
      `Portfolio risk level: ${riskLevel}`,
      `Top risk driver: ${topRiskDriver}`,
      "",
      "Write the insight as a calm, leadership-friendly update.",
    ].join("\n");

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      let parsed: {
        headline?: string;
        overview?: string;
        deliveryView?: string;
        recommendedFocus?: string;
      } = {};

      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {
          headline: `${riskLevel} portfolio signal`,
          overview: text,
          deliveryView: "",
          recommendedFocus: "",
        };
      }

      res.status(200).json({
        ok: true,
        deterministic,
        insight: {
          headline: parsed.headline || `${riskLevel} portfolio signal`,
          overview: parsed.overview || "",
          deliveryView: parsed.deliveryView || "",
          recommendedFocus: parsed.recommendedFocus || "",
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown Gemini error";

      logger.error("portfolioInsights error", {message});

      res.status(500).json({
        ok: false,
        error: "Gemini error",
        details: message,
        deterministic,
      });
    }
  }
);
