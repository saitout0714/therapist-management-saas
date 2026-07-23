
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
const btns = $("input[type=\"submit\"], button[type=\"submit\"]");
btns.each((i, btn) => {
  console.log("Tag:", btn.tagName, "Outer:", $(btn).prop("outerHTML"));
});

