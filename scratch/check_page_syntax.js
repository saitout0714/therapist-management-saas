const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "../app/[shopSlug]/(public)/page.tsx");
const text = fs.readFileSync(p, "utf8");
const lines = text.split("\n");

lines.forEach((line, idx) => {
  if (idx >= 140 && idx <= 240) {
    console.log(`${idx + 1}: ${line}`);
  }
});
