const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../app/[shopSlug]/(public)/page.tsx");
const content = fs.readFileSync(filePath, "utf8");
console.log(content);
