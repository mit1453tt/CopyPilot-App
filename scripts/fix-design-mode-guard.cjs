const fs = require("fs");
const files = [
  "C:/Users/TUNAHAN/CopyPilot-App/extensions/copy-pilot-ai/blocks/copy-pilot.liquid",
  "C:/Users/TUNAHAN/CopyPilot-App/extensions/copy-pilot-ai/blocks/copy-pilot-compact.liquid",
];
const badBlocks = [
  /\{\%\s*comment\s*\%\}\s*MERCHANT-ONLY:[\s\S]*?\{\%\s*endcomment\s*\%\}\s*/g,
  /\{\%\s*unless\s+request\.design_mode\s*\%\}\s*/g,
  /\{\%\s*comment\s*\%\}\s*Hidden on live storefront[\s\S]*?\{\%\s*endcomment\s*\%\}\s*/g,
  /\{\%\s*else\s*\%\}\s*/g,
  /\{\%\s*endunless\s*\%\}\s*/g,
  /\{\%\s*if\s+request\.design_mode\s*\%\}\s*/g,
  /\{\%\s*endif\s*\%\}\s*(?=\{\%\s*schema\s*\%\})/g,
];
const guard =
  "{% comment %} MERCHANT-ONLY: live storefront'ta musteriye GOSTERILMEZ. Theme Editor'da ve Admin'de kullanin. {% endcomment %}\n" +
  "{% if request.design_mode %}\n";
for (const f of files) {
  let c = fs.readFileSync(f, "utf8");
  for (const re of badBlocks) c = c.replace(re, "");
  const m = c.match(/^(\{\%\s*comment\s*\%\}[\s\S]*?\{\%\s*endcomment\s*\%\}\s*)/);
  if (m) c = m[1] + guard + c.slice(m[0].length);
  else c = guard + c;
  if (!/\{\%\s*endif\s*\%\}\s*\n\s*\{\%\s*schema\s*\%\}/.test(c)) {
    c = c.replace(/(\{\%\s*schema\s*\%\})/, "{% endif %}\n\n$1");
  }
  fs.writeFileSync(f, c);
  console.log(
    f.split("/").pop(),
    "if",
    (c.match(/\{\%\s*if request\.design_mode/g) || []).length,
    "endif",
    (c.match(/\{\%\s*endif\s*\%\}/g) || []).length
  );
}
