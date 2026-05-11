# openclaw-gui

Desktop setup wizard for local OpenClaw onboarding.

## Run locally

```bash
npm install
npm run tauri:dev
```

The wizard wraps non-interactive OpenClaw setup commands, streams redacted logs,
runs `openclaw doctor` and `openclaw gateway status`, then opens the local
Control UI at `http://127.0.0.1:18789/`.

## Tests

```bash
npm test
```

## MVP roadmap

- Add Gemini.
- Add Ollama.
- Add custom OpenAI-compatible endpoint.
- Add Vercel AI Gateway.
- Add Cloudflare AI Gateway.
- Add channel setup screens.
- Add repair tools: re-run doctor, restart Gateway, change provider, change
  Gateway port, open logs, uninstall daemon, update OpenClaw.
