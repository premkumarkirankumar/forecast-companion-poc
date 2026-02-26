import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleGenerativeAI} from "@google/generative-ai";

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

    // ListModels mode: lets us see which model IDs your key supports.
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

    // TEMP model name until we confirm via listModels.
    // After you run listModels, we will set this to an available model.
    const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

    const promptLines = [
      "You are Forecast Companion Analyst.",
      `Program: ${programId}`,
      "Rules: Do not invent numbers.",
      "If data is not provided, say what you need.",
      "",
      `User question: ${question}`,
    ];
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
