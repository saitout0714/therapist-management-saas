
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
const aTags = $("a.btn-danger");
aTags.each((i, a) => {
  console.log("Found:", $(a).text());
});

