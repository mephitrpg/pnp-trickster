const path = require("node:path");
const { build, transformSync } = require("esbuild");

async function importTypeScript(relativePath) {
  const result = await build({
    entryPoints: [path.join(__dirname, relativePath)],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm"
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
}

function compileTypeScript(source) {
  return transformSync(source, { loader: "ts", format: "esm" }).code;
}

module.exports = { importTypeScript, compileTypeScript };
