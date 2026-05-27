const { execSync } = require("child_process");

try {
  execSync("npx electron-rebuild -f -m .", {
    stdio: "inherit",
    cwd: require("path").join(__dirname, ".."),
  });
} catch {
  console.warn("[postinstall] electron-rebuild skipped — native modules may not be rebuilt.");
  console.warn("[postinstall] Run `npm run rebuild` manually on a system with Visual Studio Build Tools if needed.");
}
