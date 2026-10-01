// Generates part images from image-prompts.json (three per part), using OpenAI or Gemini.
//   npm run images            -> every image that doesn't exist yet
//   npm run images -- 3 7     -> all three images of parts 3 and 7 (overwrites them)
//   npm run images -- 3-2     -> only the second image of part 3 (overwrites it)
// Needs OPEN_AI_API or GEMINI_API in .env and the style reference picture at reference.png.
// The PNG from the API is kept in image-originals/, and macOS's sips turns it into
// src/img/parts/part-03-2.jpg plus -1200 and -800 copies for the srcset.
// IMAGE_PROVIDER=openai|gemini picks one; otherwise OpenAI is used when its key is set.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const outDir = new URL("src/img/parts/", root);
const originalsDir = new URL("image-originals/", root);
const EXISTING_EXTS = ["jpg", "jpeg", "png", "webp"];

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

// "3" -> every image of part 3, "3-2" -> just the second one
const requested = process.argv.slice(2).map((arg) => arg.split("-").map(Number));
const parts = requested.length
  ? requested
  : Object.keys(prompts).map((key) => [Number(key.split("-")[1])]);

for (const [part, only] of parts) {
  const scenes = prompts[`part-${part}`];
  if (!scenes) {
    console.warn(`part ${part}: no prompts, skipping`);
    continue;
  }

  for (const [i, scene] of scenes.entries()) {
    const n = i + 1;
    if (only && only !== n) continue;

    const base = `part-${String(part).padStart(2, "0")}-${n}`;
    const label = `part ${part} image ${n}`;
    if (!requested.length && EXISTING_EXTS.some((e) => existsSync(new URL(`${base}.${e}`, outDir)))) {
      console.log(`${label}: already exists, skipping`);
      continue;
    }

    console.log(`${label}: generating with ${provider}…`);
    try {
      const image = await generate(`Match the art style of the attached reference image.\n\n${style}\n\nScene: ${scene}`);
      mkdirSync(originalsDir, { recursive: true });
      const original = new URL(`${base}.png`, originalsDir).pathname;
      writeFileSync(original, image);
      for (const [width, suffix] of [[null, ""], [1200, "-1200"], [800, "-800"]]) {
        const resize = width ? ["--resampleWidth", String(width)] : [];
        const out = new URL(`${base}${suffix}.jpg`, outDir).pathname;
        execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", ...resize, original, "--out", out], { stdio: "ignore" });
      }
      console.log(`${label}: saved src/img/parts/${base}.jpg (+ -1200, -800)`);
    } catch (err) {
      console.error(`${label}: ${err.message}`);
    }
  }
}
