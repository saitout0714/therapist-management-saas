
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
const btn = $("button:contains(\"画像アップロード\")");
console.log(btn.closest("form").attr("name"), btn.closest("form").attr("action"));
const btn2 = $("button:contains(\"この内容で保存\")");
console.log(btn2.closest("form").attr("name"), btn2.closest("form").attr("action"));

