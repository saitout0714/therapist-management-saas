
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
console.log($("input[value=\"画像アップロード\"]").parent().html());
console.log($("input[value=\"この内容で保存\"]").parent().html());

