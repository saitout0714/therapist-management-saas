
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
const confirmBtn = $("input[value=\" 確認 \"]");
console.log("Has 確認 button:", confirmBtn.length > 0);
const otherBtns = $("input[type=\"submit\"], button[type=\"submit\"]");
otherBtns.each((i, btn) => {
  console.log("Submit button:", $(btn).attr("value") || $(btn).text());
});

