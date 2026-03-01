import { build } from "bun";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
let envContent = {};
try {
	const envText = readFileSync(join(__dirname, '.env'), 'utf-8');
	envText.split('\n').forEach(line => {
		const [key, ...valueParts] = line.split('=');
		if (key && valueParts.length > 0) {
			envContent[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
		}
	});
	console.log('Loaded .env file\n');
} catch (e) {
	console.log('No .env file found, using empty config\n');
}

// Update config.js with env values
const configPath = join(__dirname, 'config.js');
const configContent = `/**
 * App Configuration
 * Auto-generated from .env file
 */

export const OPENROUTER_API_KEY = '${envContent.OPENROUTER_API_KEY || ''}';

export const CONFIG = {
  defaultModel: 'mistralai/mistral-small-3.1-24b-instruct:free',
  siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
  siteName: 'X-Agent Test',
};
`;
writeFileSync(configPath, configContent);
console.log('Generated config.js from .env\n');

// Ensure dist directory exists
try {
	mkdirSync("dist", { recursive: true });
} catch (e) {}

console.log("Building X-Agent with Bun...\n");

// Build ESM bundle (for Node.js usage, externalizes pi-ai)
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

// Build UMD bundle (for Node.js usage, externalizes pi-ai)
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

// Build OpenRouter ESM bundle (browser-compatible, no external deps)
const orEsmResult = await build({
	entrypoints: ["src/openrouter/index.js"],
	outdir: "dist",
	naming: "x-agent-openrouter.min.js",
	minify: true,
	sourcemap: true,
	target: "browser",
	format: "esm",
});

console.log(`✓ OpenRouter ESM bundle: ${orEsmResult.outputs[0].path}`);

// Build OpenRouter UMD bundle (browser-compatible, no external deps)
const orUmdResult = await build({
	entrypoints: ["src/openrouter/index.js"],
	outdir: "dist",
	naming: "x-agent-openrouter.umd.min.js",
	minify: true,
	sourcemap: true,
	target: "browser",
	format: "iife",
	globalName: "XAgentOpenRouter",
});

console.log(`✓ OpenRouter UMD bundle: ${orUmdResult.outputs[0].path}\n`);

// Print file sizes
const { statSync } = await import("fs");
const { gzip } = await import("zlib");
const { promisify } = await import("util");
const gzipAsync = promisify(gzip);

for (const file of ["x-agent.min.js", "x-agent.umd.min.js", "x-agent-openrouter.min.js", "x-agent-openrouter.umd.min.js"]) {
	const content = await Bun.file(`dist/${file}`).arrayBuffer();
	const gzipped = await gzipAsync(Buffer.from(content));
	const size = statSync(`dist/${file}`).size;
	const gzippedSize = gzipped.length;
	console.log(`${file}: ${(size / 1024).toFixed(2)} kB (gzip: ${(gzippedSize / 1024).toFixed(2)} kB)`);
}

console.log("\n✓ Build complete!");
