import { GoogleGenAI } from "@google/genai";

let cachedClient = null;

/**
 * Gets or initializes the Google GenAI client
 */
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    const error = new Error(
      "Gemini API key is not configured. Please add GEMINI_API_KEY to your backend .env file (get a free key at aistudio.google.com)."
    );
    error.status = 503;
    error.code = "API_KEY_MISSING";
    throw error;
  }
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
};

/**
 * Formats standardized messages into Gemini contents format
 */
const formatContents = (messages = []) => {
  const contents = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: String(msg.content || "") }],
      });
    } else if (msg.role === "assistant" || msg.role === "model") {
      if (msg.rawContent) {
        // Use the exact Content object returned by Gemini (preserves thought signatures, parts, and IDs)
        contents.push(msg.rawContent);
      } else {
        const parts = [];
        if (msg.content) {
          parts.push({ text: String(msg.content) });
        }
        if (Array.isArray(msg.functionCalls)) {
          for (const call of msg.functionCalls) {
            const part = {
              functionCall: {
                name: call.name,
                args: call.args || {},
              },
            };
            if (call.id) part.functionCall.id = call.id;
            if (call.thoughtSignature) part.thoughtSignature = call.thoughtSignature;
            parts.push(part);
          }
        }
        contents.push({
          role: "model",
          parts: parts.length > 0 ? parts : [{ text: "" }],
        });
      }
    } else if (msg.role === "tool_response" || msg.role === "tool" || msg.role === "function") {
      const responses = Array.isArray(msg.toolResponses)
        ? msg.toolResponses
        : [{ name: msg.name, output: msg.content }];

      const parts = responses.map((r) => ({
        functionResponse: {
          name: r.name,
          response: {
            output: typeof r.output === "object" && r.output !== null ? r.output : { result: r.output },
          },
        },
      }));

      // In Gemini API, all functionResponses for the preceding model turn must reside in a single user turn
      const lastContent = contents[contents.length - 1];
      if (lastContent && lastContent.role === "user") {
        lastContent.parts.push(...parts);
      } else {
        contents.push({
          role: "user",
          parts,
        });
      }
    }
  }

  return contents;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getModelHierarchy = () => {
  const primary = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const fallbacksRaw = process.env.GEMINI_FALLBACK_MODELS?.trim() || "gemini-1.5-flash,gemini-2.0-flash";
  const fallbacks = fallbacksRaw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const seen = new Set();
  const models = [];
  for (const m of [primary, ...fallbacks]) {
    if (!seen.has(m)) {
      seen.add(m);
      models.push(m);
    }
  }
  return models;
};

/**
 * Single provider interface for generating assistant completions
 * Can be swapped for Groq or other providers in the future.
 */
export const generate = async ({ systemPrompt, messages = [], tools = [] }) => {
  const ai = getClient();
  const modelsToTry = getModelHierarchy();
  const contents = formatContents(messages);

  const config = {};
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }
  if (Array.isArray(tools) && tools.length > 0) {
    config.tools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
  }

  let lastError = null;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const currentModel = modelsToTry[mIdx];
    const isLastModel = mIdx === modelsToTry.length - 1;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config,
        });

        const candidate = response.candidates?.[0];
        const candidateParts = candidate?.content?.parts || [];

        // Safely extract text parts without triggering the SDK's warning on functionCall responses
        const textParts = candidateParts
          .filter((p) => typeof p.text === "string" && !p.thought)
          .map((p) => p.text);
        const text = textParts.join("") || "";

        // Extract function calls with their metadata (id, thoughtSignature) preserved
        const functionCalls = [];
        for (const part of candidateParts) {
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {},
              id: part.functionCall.id,
              thoughtSignature: part.thoughtSignature || part.functionCall.thoughtSignature,
            });
          }
        }

        return {
          text,
          functionCalls,
          rawContent: candidate?.content,
          modelUsed: currentModel,
        };
      } catch (error) {
        lastError = error;
        const errStatus = error.status || error.statusCode || 500;
        const errMessage = String(error.message || "");
        console.error(
          `[LLM Service Error] Model '${currentModel}' (attempt ${attempt}/2):`,
          errMessage || error
        );

        // Immediate fail on invalid API key
        if (
          errStatus === 400 &&
          (errMessage.includes("API key not valid") || errMessage.includes("API_KEY_INVALID"))
        ) {
          const friendlyError = new Error(
            "Invalid Gemini API key. Please check your GEMINI_API_KEY in backend/.env."
          );
          friendlyError.status = 401;
          friendlyError.code = "INVALID_KEY";
          throw friendlyError;
        }

        const isTransient =
          errStatus === 429 ||
          errStatus === 503 ||
          errStatus === 404 ||
          errMessage.includes("429") ||
          errMessage.includes("503") ||
          errMessage.includes("404") ||
          errMessage.toLowerCase().includes("quota") ||
          errMessage.toLowerCase().includes("resource_exhausted") ||
          errMessage.toLowerCase().includes("not found");

        if (isTransient && attempt === 1) {
          // Wait briefly and retry once on this model
          await delay(600);
          continue;
        }

        // If retry also failed or not transient, advance to next fallback model
        if (!isLastModel) {
          console.warn(
            `[LLM Warning] Model '${currentModel}' failed. Trying fallback model '${modelsToTry[mIdx + 1]}' ...`
          );
        }
        break;
      }
    }
  }

  // If every model has failed, classify and throw specific friendly error
  const finalStatus = lastError?.status || lastError?.statusCode || 500;
  const finalMessage = String(lastError?.message || "");

  if (
    finalStatus === 429 ||
    finalMessage.includes("429") ||
    finalMessage.toLowerCase().includes("quota") ||
    finalMessage.toLowerCase().includes("resource_exhausted")
  ) {
    const err = new Error(
      "Gemini API quota exceeded or busy across all configured models. Please wait a moment."
    );
    err.status = 429;
    err.code = "QUOTA_EXCEEDED";
    throw err;
  }

  if (finalStatus === 404 || finalMessage.includes("404") || finalMessage.toLowerCase().includes("not found")) {
    const err = new Error(
      "Gemini AI models not found or unavailable for your API key. Check GEMINI_MODEL in backend/.env."
    );
    err.status = 404;
    err.code = "MODEL_NOT_FOUND";
    throw err;
  }

  if (lastError?.name === "AbortError" || finalMessage.toLowerCase().includes("timeout")) {
    const err = new Error("The AI assistant service timed out. Please try your question again.");
    err.status = 504;
    err.code = "TIMEOUT";
    throw err;
  }

  const genericErr = new Error(
    "The AI assistant is temporarily unavailable. All configured models failed."
  );
  genericErr.status = finalStatus >= 400 && finalStatus < 600 ? finalStatus : 500;
  genericErr.code = "SERVICE_UNAVAILABLE";
  throw genericErr;
};
