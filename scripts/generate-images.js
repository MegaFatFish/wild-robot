// Generates part images from image-prompts.json, using OpenAI or Gemini.
//   npm run images          -> every part that doesn't have an image yet
//   npm run images -- 3 7   -> only parts 3 and 7 (overwrites them)
// Needs OPEN_AI_API or GEMINI_API in .env and the style reference picture at reference.png.
// IMAGE_PROVIDER=openai|gemini picks one; otherwise OpenAI is used when its key is set.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const outDir = new URL("src/img/parts/", root);

process.loadEnvFile(new URL(".env", root));
const provider = process.env.IMAGE_PROVIDER ?? (process.env.OPEN_AI_API ? "openai" : "gemini");

const { style, ...prompts } = JSON.parse(readFileSync(new URL("image-prompts.json", root), "utf8"));
const reference = readFileSync(new URL("reference.png", root));

// Both return the image as a Buffer, or throw with the API's error message.
async function generateOpenAI(prompt) {
  const apiKey = process.env.OPEN_AI_API;
  if (!apiKey) throw new Error("OPEN_AI_API is missing from .env");

  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2");
  form.append("prompt", prompt);
  form.append("image", new Blob([reference], { type: "image/png" }), "reference.png");
  form.append("size", "1536x1024"); // 3:2, matches .picture in style.css

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? res.status);
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function generateGemini(prompt) {
  const apiKey = process.env.GEMINI_API;
  if (!apiKey) throw new Error("GEMINI_API is missing from .env");
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/png", data: reference.toString("base64") } },
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "3:2" }, // matches .picture in style.css
        },
      }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? res.status);

  const image = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!image) throw new Error(`no image returned (${json.candidates?.[0]?.finishReason ?? "unknown reason"})`);
  return Buffer.from(image.data, "base64");
}

const generate = provider === "gemini" ? generateGemini : generateOpenAI;

const requested = process.argv.slice(2).map(Number);
const parts = requested.length
  ? requested
  : Object.keys(prompts).map((key) => Number(key.split("-")[1]));

for (const part of parts) {
  const scene = prompts[`part-${part}`];
  if (!scene) {
    console.warn(`part ${part}: no prompt, skipping`);
    continue;
  }

  const name = `part-${String(part).padStart(2, "0")}.png`;
  const file = new URL(name, outDir);
  if (!requested.length && existsSync(file)) {
    console.log(`part ${part}: already exists, skipping`);
    continue;
  }

  console.log(`part ${part}: generating with ${provider}…`);
  try {
    const image = await generate(`Match the art style of the attached reference image.\n\n${style}\n\nScene: ${scene}`);
    writeFileSync(file, image);
    console.log(`part ${part}: saved src/img/parts/${name}`);
  } catch (err) {
    console.error(`part ${part}: ${err.message}`);
  }
}
