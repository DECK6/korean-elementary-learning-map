# Initial Release Verification — 2026-07-10

## Release identity

- Project: **한국 초등 학습지도 / Korean Elementary Learning Map**
- Local path: `/Volumes/data/Dev/korean-elementary-learning-map`
- Intended repository URL: https://github.com/DECK6/korean-elementary-learning-map
- Release/package version: `0.4.0`
- Dataset version: `kr-full-depth-v0.4`
- Git posture at verification: fresh local repository on `main`, no imported commits, no remotes

This project is based on `withmarbleapp/os-taxonomy` / **Marble Skill Taxonomy**, rebuilt as a Korea-first graph aligned to the Korean 2022 Revised National Curriculum. It is not an official MOE, National Education Commission, or NCIC publication and is not a translation-only fork.

## Source safety check

The extraction source was checked before copying:

- Path: `/Volumes/data/Dev/os-taxonomy`
- Branch: `kr-full-depth-v0.4-improved`
- HEAD: `6e3455c7bb90e4424cd4da61c7b8e9a65f7bd4fe`
- Working tree: clean

The source repository was copied from only; it was not modified, deleted, reset, or given a new remote.

## Extraction scope

Included:

- `LICENSE`, `LICENSE-CONTENT`
- all 18 files under `data/kr/`
- four `schema/kr-*.schema.json` files
- nine KR scripts plus all three `scripts/lib/kr-*.mjs` helpers
- all three KR test files
- all four KR documentation files
- new project metadata/docs and this verification report

Excluded:

- root general data files and all non-KR datasets
- non-KR schemas
- media
- upstream root README/CITATION/CHANGELOG/PROVENANCE and previous audits
- upstream general `scripts/validate.mjs`
- upstream Git history and remotes

## Verification results

| Command/check | Result |
| --- | --- |
| `npm install --package-lock-only` | PASS — lockfile regenerated for `korean-elementary-learning-map@0.4.0`; 0 vulnerabilities reported |
| `npm ci` | PASS — 5 packages installed; 6 audited; 0 vulnerabilities |
| `npm run build` | PASS — 11 curricula, 620 standards, 1,956 topics, 1,894 dependencies, 153 clusters |
| `node --test tests/*.test.mjs` | PASS — 37 tests, 37 passed, 0 failed/cancelled/skipped/todo |
| `npm test` | PASS — package test alias ran the same 37 tests; 37 passed |
| `npm run validate` | PASS — schemas, official inventories, source locators, graph policy/DAG, references and manifest checksums valid |
| `npm run check:content` | PASS — 1,956 final and 1,956 workstream topics; all ten reported defect metrics are 0 in both sets |
| `npm run check:links` | PASS — 13/13 unique HTTP(S) source URLs reachable for 17 source records |
| `npm audit` | PASS — 0 vulnerabilities |
| `git diff --cached --check` | PASS — no whitespace errors before initial commit |

## Rebrand/reference classification

Defect searches after the build found:

- obsolete Korean product label: **0**
- obsolete npm package label: **0**
- obsolete upstream-hosted schema-ID prefix: **0**
- stale general-data counts/paths (legacy counts and root-level non-KR data paths): **0**
- non-KR curriculum source identifiers: **0**

Remaining `Marble Skill Taxonomy` / `withmarbleapp/os-taxonomy` / `os-taxonomy` text is intentional and limited to:

- `README.md`, `NOTICE.md`, `PROVENANCE.md`, `CITATION.cff`: upstream attribution/provenance
- `CHANGELOG.md`: extraction history
- `docs/kr-localization-plan.md`: clearly marked upstream design history
- `audits/2026-07-10-initial-release-verification.md`: source-safety and verification history

No old-brand reference remains in `data/`, `schema/`, `scripts/`, `tests/`, `package.json`, or `package-lock.json`.

## Licensing and release blockers

- ODbL 1.0 and CC BY-SA 4.0 files and upstream attribution are preserved.
- The exact upstream README attribution notice is retained in `NOTICE.md`.
- Korean official PDF work-level KOGL/commercial-reuse evidence is unresolved and remains explicit **HOLD** in README, PROVENANCE, NOTICE, generated data, and the manifest.
- No software/build/test blocker was found.
- Rights HOLD is the only release-use blocker: do not treat Korean official-source-derived records as cleared for general redistribution or commercial use without work-specific review or permission.
