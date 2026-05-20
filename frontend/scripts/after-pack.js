const { readdirSync, unlinkSync, existsSync } = require("fs");
const { join } = require("path");

exports.default = async function (context) {
  const localesDir = join(context.appOutDir, "locales");
  if (!existsSync(localesDir)) return;

  const keep = new Set([
    "en-US.pak",  // always required
    "de.pak",
    "it.pak",
    "es.pak",
    "ja.pak",
  ]);

  const removed = [];
  for (const file of readdirSync(localesDir)) {
    if (!keep.has(file)) {
      unlinkSync(join(localesDir, file));
      removed.push(file);
    }
  }

  console.log(`[afterPack] Removed ${removed.length} unused locale files, kept: ${[...keep].join(", ")}`);
};
