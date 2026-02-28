import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.js"),
			name: "XAgent",
			fileName: (format) => {
				if (format === "umd") return "x-agent.umd.min.js";
				return "x-agent.min.js";
			},
			formats: ["es", "umd"],
		},
		outDir: "dist",
		minify: true,
		sourcemap: true,
		rollupOptions: {
			external: ["@mariozechner/pi-ai"],
			output: {
				globals: {
					"@mariozechner/pi-ai": "PiAI",
				},
			},
		},
	},
});
