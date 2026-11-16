# Review-manager reap

Use installed [launcher](launcher.js) from trusted cwd `/`:
`bun --no-env-file <resolved-launcher> reap`.
For failing reap or absent Docker, record stdout/stderr, exit and limitation,
and continue the pass, including quiet passes. Cleanup uncertainty holds sandbox
execution; review code and CI.
