// Reads ../../parts.json and shapes it for the templates.
// The chapter text is dropped on purpose: the book is under copyright
// and the pages only need the glossary and questions.
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const imageDir = new URL("src/img/parts/", root);
const IMAGE_EXTS = ["webp", "jpg", "jpeg", "png"];
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

// Drop src/img/parts/part-03.jpg (or .webp/.png) in and it shows up on part 3.
function findImage(partNumber) {
  const name = `part-${String(partNumber).padStart(2, "0")}`;
  const ext = IMAGE_EXTS.find((e) => existsSync(new URL(`${name}.${e}`, imageDir)));
  return ext ? `/img/parts/${name}.${ext}` : null;
}

export default function () {
  const { parts } = JSON.parse(readFileSync(new URL("parts.json", root), "utf8"));

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
        image: part.image ?? findImage(part.part),
        imageAlt: part.imageAlt ?? "",
      };
    }),
  };
}
