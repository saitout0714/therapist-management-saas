
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
const btn = $("button:contains(\"画像アップロード\")");
console.log("画像アップロード form:", btn.closest("form").length > 0 ? btn.closest("form").attr("action") : "no form");
const btn2 = $("button:contains(\"この内容で保存\")");
console.log("この内容で保存 form:", btn2.closest("form").length > 0 ? btn2.closest("form").attr("action") : "no form");

