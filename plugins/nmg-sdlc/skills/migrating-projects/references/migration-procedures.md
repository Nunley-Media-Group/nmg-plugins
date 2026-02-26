# Migration Procedures Reference

Detailed reference material for the migrating-projects skill.

---

## Relevance Heuristic Table

Use this table to determine whether a missing template section is relevant to the project. For each missing heading, check if it matches a keyword (case-insensitive substring match against the heading text). If it matches, run `Glob` with the associated patterns **one at a time, stopping at the first match** — if any pattern returns results, the section is relevant (include it) and skip remaining patterns. If **none** return results, the section is irrelevant — exclude it.

| Heading Keyword | Codebase Evidence (Glob Patterns) |
|----------------|----------------------------------|
| `Database` | `**/migrations/**`, `**/schema.*`, `**/*database*`, `**/*prisma*`, `**/*knexfile*`, `**/sequelize*`, `**/typeorm*`, `**/drizzle*`, `**/*.sql`, `**/models/**` |
| `API / Interface Standards` | `**/routes/**`, `**/controllers/**`, `**/api/**`, `**/endpoints/**`, `**/*router*`, `**/swagger*`, `**/openapi*` |
| `Design Tokens` or `UI Standards` | `**/components/**`, `**/*.css`, `**/*.scss`, `**/*.styled.*`, `**/theme*`, `**/tokens*`, `**/*.tsx`, `**/*.vue`, `**/*.svelte` |

**Conservative default:** If a missing heading does not match any keyword in this table, include it in the proposal. The table is a filter for known-irrelevant sections, not a whitelist.

---

## Exclusion File Schema

The `.claude/migration-exclusions.json` file stores section headings the user has previously declined:

```json
{
  "excludedSections": {
    "tech.md": ["Database Standards", "API / Interface Standards"],
    "structure.md": ["Design Tokens / UI Standards (if applicable)"]
  }
}
```

- Keys are steering doc filenames (not full paths)
- Values are arrays of exact heading text (without the `## ` prefix)
- Only sections explicitly declined by the user are stored
- Stale entries (for headings removed from templates) are harmless

---

## Step 10: Apply Changes

If the user approves:

### Markdown files (steering docs and specs)

For each file with missing sections:

1. Read the file
2. For each missing section (in template order):
   - Find the predecessor section's heading in the file
   - Locate the end of the predecessor section (the line before the next `## ` heading, or end of file)
   - Use `Edit` to insert the missing section content (including `---` separator and `## ` heading) after the predecessor section
3. After all insertions, re-read the file to verify the new headings are present

**Insertion format:** Insert a blank line, then `---`, then a blank line, then the full section content from the template (heading + body). Match the separator style used in the rest of the file.

### Related Spec corrections

For each defect spec with an approved Related Spec correction (from Step 4a findings):

1. Read the defect spec's `requirements.md`
2. Use `Edit` to replace the `**Related Spec**:` line with the corrected value (the resolved feature spec path, or `N/A`)

### JSON config

For the `sdlc-config.json`:

1. Read the current file
2. For each missing root-level key, add it with the template default value
3. For each missing step entry, add it with the template default values
4. For each existing step with missing sub-keys, add the missing sub-keys
5. Write the updated JSON (preserve existing values, only add missing keys)
6. Use `Edit` to add the missing keys — do not overwrite the entire file

### Config value drift updates

For each user-selected drifted value from Step 9 Part C (interactive mode only; this section is skipped entirely in auto-mode):

1. Read the current `sdlc-config.json`
2. For each selected drifted value, locate the key in the JSON and use `Edit` to replace the old value with the template default value
3. Preserve JSON formatting — use 2-space indentation per project JSON standards
4. After each individual value update, re-read the file to verify the update was applied correctly
5. If a value cannot be found in the file (e.g., the key path changed), skip it and note the failure in the output summary

**Example edit for a step sub-key drift:**
```
Old: "maxTurns": 15
New: "maxTurns": 30
```

**Example edit for a root-level drift:**
```
Old: "maxRetriesPerStep": 2
New: "maxRetriesPerStep": 3
```

### Persist declined sections

After applying approved changes, persist any newly declined steering doc sections:

1. Read `.claude/migration-exclusions.json` from the project root (or start with `{ "excludedSections": {} }` if it doesn't exist)
2. For each steering doc section that was **proposed but not selected** by the user in Step 9 Part A, add the heading text to the `excludedSections` array for that file
3. Write the updated JSON to `.claude/migration-exclusions.json` using `Write`

**Important:** Only add newly declined sections. Do not remove existing entries — they represent prior user decisions.

### Output summary

After applying changes, output a summary:

```
## Migration Complete

### Changes Applied
- **product.md** — Added sections: "Product Principles"
- **sdlc-config.json** — Added keys: "cleanup", "steps.merge"

### Declined (will be skipped in future runs)
- **product.md** — "Brand Voice" (saved to .claude/migration-exclusions.json)

### Skipped (already up to date)
- tech.md, structure.md, 42-add-auth/design.md

### Filtered by relevance (no codebase evidence)
- **tech.md** — "Database Standards", "API / Interface Standards"

### Recommendations
- Review added sections and customize placeholder content
- Run /installing-openclaw-skill to update the OpenClaw skill
- To re-propose a declined section, remove it from .claude/migration-exclusions.json
```
