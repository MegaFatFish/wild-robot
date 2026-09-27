export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/img");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");

  // parts-size-4.json lives in the project root, outside src/
  eleventyConfig.addWatchTarget("./parts-size-4.json");

  return {
    dir: {
      input: "src",
      output: "_site",
    },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
