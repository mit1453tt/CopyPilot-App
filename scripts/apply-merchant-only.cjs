const fs = require("fs");
const files = [
  "C:/Users/TUNAHAN/CopyPilot-App/extensions/copy-pilot-ai/blocks/copy-pilot.liquid",
  "C:/Users/TUNAHAN/CopyPilot-App/extensions/copy-pilot-ai/blocks/copy-pilot-compact.liquid",
];
const guard =
  "{% comment %} MERCHANT-ONLY: live storefront musteriye GOSTERILMEZ {% endcomment %}\n" +
  "{% if request.design_mode %}\n";
for (const p of files) {
  let c = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  c = c.replace(/\/apps\/size-wizard/g, "/apps/copy-pilot");
  if (!c.includes("request.design_mode")) {
    const m = c.match(/^(\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}\s*)/);
    c = m ? m[1] + guard + c.slice(m[0].length) : guard + c;
    c = c.replace(/(\{%\s*schema\s*%\})/, "{% endif %}\n\n$1");
  }
  // boot.js in schema
  c = c.replace(/"javascript":\s*"copy-pilot\.js"/, '"javascript": "copy-pilot-boot.js"');
  fs.writeFileSync(p, c);
  console.log(
    p.split("/").pop(),
    "design_mode=",
    c.includes("request.design_mode"),
    "billing_ok=",
    c.includes("1{% else %}0")
  );
}
