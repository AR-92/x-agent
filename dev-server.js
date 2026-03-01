#!/usr/bin/env bun
/**
 * Dev Server for X-Agent
 * 
 * - Serves static files
 * - Loads .env at runtime (no rebuild needed)
 * - Injects API key into HTML on-the-fly
 */

import { serve } from "bun";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();

// Load .env file
let OPENROUTER_API_KEY = '';
try {
	const envPath = join(ROOT, '.env');
	if (existsSync(envPath)) {
		const envText = readFileSync(envPath, 'utf-8');
		for (const line of envText.split('\n')) {
			const [key, ...valueParts] = line.split('=');
			if (key?.trim() === 'OPENROUTER_API_KEY') {
				OPENROUTER_API_KEY = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
				console.log('✓ Loaded OPENROUTER_API_KEY from .env');
				break;
			}
		}
	}
} catch (e) {
	console.log('⚠ No .env file found - API key field will be empty');
}

console.log(`\n🚀 X-Agent Dev Server`);
console.log(`📍 http://localhost:${PORT}`);
console.log(`📁 Root: ${ROOT}\n`);

serve({
	port: PORT,
	
	fetch(req) {
		const url = new URL(req.url);
		let path = url.pathname;
		
		// Serve index.html and inject API key
		if (path === '/' || path === '/index.html') {
			let html = readFileSync(join(ROOT, 'index.html'), 'utf-8');
			
			// Inject API key into the page
			if (OPENROUTER_API_KEY) {
				const injectScript = `
  <script>
    // Dev server injected API key
    window.OPENROUTER_API_KEY = '${OPENROUTER_API_KEY}';
  </script>`;
				
				// Inject before the closing head tag
				html = html.replace('</head>', injectScript + '\n</head>');
			}
			
			return new Response(html, {
				headers: { 'Content-Type': 'text/html' }
			});
		}
		
		// Serve static files
		try {
			const filePath = join(ROOT, path);
			const file = Bun.file(filePath);
			
			// Security: ensure file is within ROOT
			const realPath = await file.path;
			if (!realPath.startsWith(ROOT)) {
				return new Response('Forbidden', { status: 403 });
			}
			
			return new Response(file);
		} catch (e) {
			return new Response('Not Found', { status: 404 });
		}
	},
});
