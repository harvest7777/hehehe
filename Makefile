.PHONY: check-dependencies dev

check-dependencies:
	@command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required."; exit 1; }
	@command -v ollama >/dev/null 2>&1 || { echo "Error: Ollama is required."; exit 1; }
	@echo "Dependencies ready:\n-----\nNode.js $$(node --version)\n$$(ollama --version)"

dev: OLLAMA_TAGS_URL ?= http://127.0.0.1:11434/api/tags
dev: check-dependencies
	@set -e; \
	if curl -fsS --max-time 2 "$(OLLAMA_TAGS_URL)" >/dev/null 2>&1; then \
		echo "Using the existing Ollama server."; \
	else \
		echo "Starting Ollama server..."; \
		ollama serve >/tmp/browser-ollama.log 2>&1 & \
		ollama_pid=$$!; \
		trap 'kill $$ollama_pid 2>/dev/null || true' EXIT INT TERM; \
		until curl -fsS --max-time 2 "$(OLLAMA_TAGS_URL)" >/dev/null 2>&1; do \
			sleep 1; \
		done; \
	fi; \
	npm run dev:extension >/tmp/browser-vite.log 2>&1 & \
	vite_pid=$$!; \
	trap 'kill $$vite_pid 2>/dev/null || true; kill $${ollama_pid:-} 2>/dev/null || true' EXIT INT TERM; \
	echo; \
	echo "API server starting at http://localhost:3000"; \
	echo "Extension dev server starting at http://localhost:5173"; \
	echo "To test the extension:"; \
	echo "1. Open chrome://extensions"; \
	echo "2. Enable Developer mode"; \
	echo "3. Click Load unpacked and select the dist directory"; \
	echo; \
	npm start
