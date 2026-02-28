import { build } from "bun";
import { mkdirSync } from "fs";

// Ensure dist directory exists
try {
	mkdirSync("dist", { recursive: true });
} catch (e) {}

console.log("Building X-Agent with Bun...\n");

// Build ESM bundle
const esmResult = await build({
	entrypoints: ["src/index.js"],
	outdir: "dist",
	naming: "x-agent.min.js",
	minify: true,
	sourcemap: true,
	target: "browser",
	external: ["@mariozechner/pi-ai"],
	format: "esm",
});

console.log(`✓ ESM bundle: ${esmResult.outputs[0].path}`);

// Build UMD bundle
const umdResult = await build({
	entrypoints: ["src/index.js"],
	outdir: "dist",
	naming: "x-agent.umd.min.js",
	minify: true,
	sourcemap: true,
	target: "browser",
	external: ["@mariozechner/pi-ai"],
	format: "iife",
	globalName: "XAgent",
});

console.log(`✓ UMD bundle: ${umdResult.outputs[0].path}\n`);

// Print file sizes
const { statSync } = await import("fs");
const { gzip } = await import("zlib");
const { promisify } = await import("util");
const gzipAsync = promisify(gzip);

for (const file of ["x-agent.min.js", "x-agent.umd.min.js"]) {
	const content = await Bun.file(`dist/${file}`).arrayBuffer();
	const gzipped = await gzipAsync(Buffer.from(content));
	const size = statSync(`dist/${file}`).size;
	const gzippedSize = gzipped.length;
	console.log(`${file}: ${(size / 1024).toFixed(2)} kB (gzip: ${(gzippedSize / 1024).toFixed(2)} kB)`);
}

console.log("\n✓ Build complete!");
