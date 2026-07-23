
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);

const links = $("a[href*=\"toggle_public\"]");
links.each((i, link) => {
  console.log("Toggle Public Link:", $(link).attr("href"), $(link).text().trim());
});

