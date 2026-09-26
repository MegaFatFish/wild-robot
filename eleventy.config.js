export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/img");

  // parts.json lives in the project root, outside src/
  eleventyConfig.addWatchTarget("./parts.json");

  return {
    dir: {
      input: "src",
      output: "_site",
    },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
