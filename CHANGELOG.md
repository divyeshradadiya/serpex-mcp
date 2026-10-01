# Changelog

## 1.2.0 — 2026-10-01

- New `serpex_extract` tool: extract up to 10 known URLs as markdown or HTML (`POST /api/crawl`).
- `serpex_search` output: adds `status`, `credits_used` and the no-results `message`; drops the `engines` / per-result `engine` fields (always `"auto"`, no information for the model).
- Timeouts: 60 s search, 100 s with `include_content`, 100 s extract (was 30 s for everything, shorter than the server's own budget for content searches).
- Every request sends `User-Agent: serpex-mcp/<version>`.

## 1.1.2 — 2026-09-22

- docs: positioning — Serpex is a real-time web search API; tool description, README and integration guide updated. `engine` deprecated (ignored by the API since 2026-06); this server never sent it and still doesn't. Tool name, inputs and output fields unchanged.
- `npm test` is now an offline smoke test (`initialize` + `tools/list`), no API key or network needed.
- package description, keywords and repository URL updated; PUBLISHING.md matches the tag-triggered workflow.
