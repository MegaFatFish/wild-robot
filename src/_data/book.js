// Reads ../../parts.json and shapes it for the templates.
// The chapter text is dropped on purpose: the book is under copyright
// and the pages only need the glossary and questions.
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const imageDir = new URL("src/img/parts/", root);
const IMAGE_EXTS = ["webp", "jpg", "jpeg", "png"];
const IMAGE_WIDTHS = [800, 1200];
const FULL_WIDTH = 1536; // the generated images are 1536×1024
const SMALL_WORDS = new Set(["a", "an", "and", "the", "of", "in", "on", "to", "for", "at", "by", "or"]);
const KEEP_UPPERCASE = new Set(["reco", "recos"]);

// "THE ROBOT’S GARDEN" -> "The Robot’s Garden"
function titleCase(text) {
  return text
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (KEEP_UPPERCASE.has(word)) return word.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// Glossary entries can be plain strings now, or { word, meaning } later.
function toWord(entry) {
  return typeof entry === "string" ? { word: entry } : entry;
}

// Each part has three images: src/img/parts/part-03-1.jpg, part-03-2.jpg, part-03-3.jpg
// (or .webp/.png), shown in that order down the page. Missing ones are skipped.
// Smaller copies named part-03-1-800.jpg / part-03-1-1200.jpg are offered to phones via srcset.
function findImages(partNumber, alts = []) {
  return [1, 2, 3].flatMap((n) => {
    const name = `part-${String(partNumber).padStart(2, "0")}-${n}`;
    const ext = IMAGE_EXTS.find((e) => existsSync(new URL(`${name}.${e}`, imageDir)));
    return ext ? [{ ...imageSources(name, ext), alt: alts[n - 1] ?? "" }] : [];
  });
}

function imageSources(name, ext) {
  const sizes = IMAGE_WIDTHS.filter((w) => existsSync(new URL(`${name}-${w}.${ext}`, imageDir)));
  return {
    src: `/img/parts/${name}.${ext}`,
    srcset: sizes.length
      ? [...sizes.map((w) => `/img/parts/${name}-${w}.${ext} ${w}w`), `/img/parts/${name}.${ext} ${FULL_WIDTH}w`].join(", ")
      : null,
  };
}

export default function () {
  const { parts } = JSON.parse(readFileSync(new URL("parts-size-4.json", root), "utf8"));

  return {
    parts: parts.map((part) => {
      const chapters = part.chapters.map((ch) => ({
        chapter: ch.chapter,
        title: titleCase(ch.title),
        glossary: (ch.glossary ?? []).map(toWord),
        questions: ch.questions ?? [],
      }));
      const first = chapters[0].chapter;
      const last = chapters[chapters.length - 1].chapter;

      return {
        part: part.part,
        chapters,
        chapterRange: first === last ? `Chapter ${first}` : `Chapters ${first}–${last}`,
        chapterNames: chapters.map((ch) => ch.title),
        glossary: part.glossary.map(toWord),
        questions: part.questions,
        thinkingQuestion: part.thinkingQuestion ?? null,
        extraQuestion: part.extraQuestion ?? null,
        images: findImages(part.part, part.imageAlts),
      };
    }),
  };
}
