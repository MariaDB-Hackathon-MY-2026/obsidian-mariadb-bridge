# Reference Materials

This directory contains reference specifications and sample data structures for the Obsidian-MariaDB Bridge.

## Sample Vault Structure
- `Notes/`
  - `Project Alpha.md` (Rich metadata sample)
  - `Neural Networks.md` (Vector embedding target)
- `Daily/`
  - `2026-04-29.md` (Time-series data)

## API Reference
- `GET /api/search`: Query the vector store.
- `GET /api/stats`: Fetch indexing progress.
- `GET /api/note/:name`: Retrieve full markdown content.
