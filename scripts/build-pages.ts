const sourceDir = "public";
const outputDir = "docs";
const assetSourceDir = `${sourceDir}/assets`;
const assetOutputDir = `${outputDir}/assets`;

await ensureDir(outputDir);
await ensureDir(assetOutputDir);

await copyFile(`${sourceDir}/index.html`, `${outputDir}/index.html`);
await copyFile(`${sourceDir}/benchmark.html`, `${outputDir}/benchmark.html`);
await copyFile(`${sourceDir}/integration.html`, `${outputDir}/integration.html`);
await copyFile(`${sourceDir}/styles.css`, `${outputDir}/styles.css`);
await copyDirectory(assetSourceDir, assetOutputDir);
await Bun.write(`${outputDir}/.nojekyll`, "");

console.log("GitHub Pages site generated in ./docs");

async function ensureDir(path: string) {
  await Bun.$`mkdir -p ${path}`.quiet();
}

async function copyFile(from: string, to: string) {
  await Bun.write(to, Bun.file(from));
}

async function copyDirectory(from: string, to: string) {
  const entries = await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: from, absolute: false }));

  for (const entry of entries) {
    const sourcePath = `${from}/${entry}`;
    const targetPath = `${to}/${entry}`;
    const sourceFile = Bun.file(sourcePath);

    if (await sourceFile.exists()) {
      const parentPath = targetPath.slice(0, Math.max(targetPath.lastIndexOf("/"), 0));

      if (parentPath) {
        await ensureDir(parentPath);
      }

      await Bun.write(targetPath, sourceFile);
    }
  }
}
