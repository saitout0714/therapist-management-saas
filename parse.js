
const fs = require("fs");
const html = fs.readFileSync("er_photo_page.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);

// Find photo rows
const rows = $("table tbody tr");
rows.each((i, row) => {
  console.log("Row", i + 1);
  const inputs = $(row).find("input");
  inputs.each((j, input) => {
    console.log("  Input:", $(input).attr("type"), $(input).attr("name"), $(input).attr("value"));
  });
  const buttons = $(row).find("button, a.btn");
  buttons.each((j, btn) => {
    console.log("  Button:", $(btn).text().trim(), $(btn).attr("href"), $(btn).attr("class"));
  });
});

