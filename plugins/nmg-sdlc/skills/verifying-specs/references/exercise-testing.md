# Exercise Testing for Plugin Changes

Detailed procedures for Steps 5b–5e of the verification workflow. These steps only apply when plugin changes (SKILL.md or agent files) are detected in the diff.

---

## 5b: Scaffold Disposable Test Project

Create a minimal test project for exercising the changed skill:

1. **Create temp directory** using `Bash`:
   ```bash
   node -e "const p = require('path').join(require('os').tmpdir(), 'nmg-sdlc-test-' + Date.now()); require('fs').mkdirSync(p, {recursive:true}); console.log(p)"
   ```
   Record the output path — this is `{test-project-path}`.

2. **Write scaffold files** using the `Write` tool:

   - `{test-project-path}/.claude/steering/product.md` — `"Test Project. One persona: Developer."`
   - `{test-project-path}/.claude/steering/tech.md` — `"Stack: Node.js. Test: manual verification."`
   - `{test-project-path}/.claude/steering/structure.md` — `"Flat layout: src/ + tests/"`
   - `{test-project-path}/src/index.js` — `console.log("hello")`
   - `{test-project-path}/README.md` — `"Test project for nmg-sdlc exercise verification"`
   - `{test-project-path}/.gitignore` — `node_modules/`
   - `{test-project-path}/package.json` — `{ "name": "test-project", "version": "1.0.0" }`

3. **Initialize git** using `Bash`:
   ```bash
   git init {test-project-path} && git -C {test-project-path} add -A && git -C {test-project-path} commit -m "initial"
   ```

## 5c: Exercise Changed Skill

Determine which skill(s) changed from the diff in 5a. Exercise the **first changed skill** (one skill per exercise run).

Identify whether the changed skill is **GitHub-integrated** (i.e., it creates GitHub resources — `creating-issues`, `creating-prs`, `starting-issues`). If so, append the dry-run instructions after the skill invocation in the exercise prompt.

**Dry-run instructions** (for GitHub-integrated skills only — append AFTER the skill invocation):
> IMPORTANT: This is a dry-run exercise. Do NOT execute any `gh` commands that create, modify, or delete GitHub resources. Instead, output the exact command and arguments you WOULD run, along with the content (title, body, labels) you WOULD use. Proceed through the full workflow, generating all artifacts as text output.

**Step 5c-i: Resolve Agent SDK Path**

ESM bare-specifier resolution (`import "pkg"`) only searches the `node_modules` hierarchy from the script's location and does NOT respect `NODE_PATH`. Resolve the SDK's absolute path via CJS `require.resolve()` first, then use a `file://` URL dynamic import in the exercise script. This works regardless of where the SDK is installed.

**Phase 1** — Try `require.resolve()` using `Bash`:
```bash
node -e "try { console.log(require.resolve('@anthropic-ai/claude-agent-sdk')); } catch { process.exit(1); }"
```
If exit code 0, store the output as `{sdk-entry-point}`. Proceed to Step 5c-iii.

**Phase 2** — If Phase 1 fails, try the fallback search using `Bash`:
```bash
node -e "const fs=require('fs'),path=require('path'),os=require('os'),home=os.homedir(),candidates=[path.join(home,'.npm','_npx'),path.join(home,'AppData','Local','npm-cache','_npx')];for(const base of candidates){if(!fs.existsSync(base))continue;for(const e of fs.readdirSync(base)){const pkg=path.join(base,e,'node_modules','@anthropic-ai','claude-agent-sdk','package.json');if(fs.existsSync(pkg)){const m=JSON.parse(fs.readFileSync(pkg,'utf8')).main||'dist/index.js';console.log(path.resolve(path.dirname(pkg),m));process.exit(0);}}}process.exit(1);"
```
If exit code 0, store the output as `{sdk-entry-point}`. Proceed to Step 5c-iii.

**Phase 3** — If both phases fail, `{sdk-entry-point}` is unresolved. Fall through to `claude -p` fallback.

No symlinks are created. All path construction uses Node.js built-in `path` module.

**Step 5c-ii: Choose Exercise Method**

- `{sdk-entry-point}` resolved → **Primary method** (Step 5c-iii below)
- `{sdk-entry-point}` unresolved, `claude` CLI available → **Fallback method** (`claude -p`, below)
- Neither → **Skip** (graceful degradation)

**Primary method: Agent SDK with `canUseTool`**

When `{sdk-entry-point}` was successfully resolved in Step 5c-i, write the following Node.js script to `{test-project-path}/exercise.mjs` using the `Write` tool, then run it via `Bash`. Substitute `{skill-name}`, `{plugin-path}`, `{test-project-path}`, `{output-file}`, `{sdk-entry-point}`, and `{exercise-prompt}` with actual values:

```javascript
// exercise.mjs — written to {test-project-path}/exercise.mjs
import { pathToFileURL } from "node:url";  // for cross-platform file URL conversion
import fs from "node:fs";

// Dynamic import using resolved absolute path (bypasses ESM bare-specifier limitation)
const { query } = await import(pathToFileURL("{sdk-entry-point}").href);

const messages = [];
for await (const message of query({
  prompt: "{exercise-prompt}",
  options: {
    plugins: [{ type: "local", path: "{plugin-path}" }],
    cwd: "{test-project-path}",
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 30,
    env: { ...process.env, CLAUDECODE: "" },  // Allow nested session
    canUseTool: async (toolName, input) => {
      if (toolName === "AskUserQuestion") {
        // Auto-select first option for deterministic testing
        const answers = {};
        for (const q of input.questions) {
          answers[q.question] = q.options[0].label;
        }
        return { behavior: "allow", updatedInput: { ...input, answers } };
      }
      return { behavior: "allow", updatedInput: input };
    },
  },
})) {
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if ("text" in block) messages.push(block.text);
    }
  } else if (message.type === "result") {
    messages.push(`Result: ${message.subtype}`);
    if ("result" in message) messages.push(message.result);
  }
}
fs.writeFileSync("{output-file}", messages.join("\n"));
console.log("Exercise complete. Output written to {output-file}");
```

Run the exercise script via `Bash` with a 5-minute timeout (set the `timeout` parameter to `300000`):
```bash
node {test-project-path}/exercise.mjs 2>&1
```

The `{exercise-prompt}` is:
- **Non-GitHub-integrated skills**: `"/{skill-name} [appropriate args based on the skill's argument-hint]"`
- **GitHub-integrated skills (dry-run)**: `"/{skill-name} [args]\n\nIMPORTANT: {dry-run-instructions}"` — skill invocation first, dry-run instructions appended after
The `{plugin-path}` is the absolute path to `plugins/nmg-sdlc` in the current repository.
The `{output-file}` is `{test-project-path}/exercise-output.txt`.

If `{sdk-entry-point}` is **unresolved** (both resolution phases failed), use the fallback method.

**Fallback method: `claude -p`**

Check if the `claude` CLI is available using `Bash`:
```bash
which claude
```

If available, run via `Bash` with a 5-minute timeout (set the `timeout` parameter to `300000`):
```bash
claude -p "{exercise-prompt}" \
  --plugin-dir {plugin-path} \
  --disallowedTools AskUserQuestion \
  --project-dir {test-project-path} \
  --append-system-prompt "Make reasonable default choices. Do not ask questions." \
  --max-turns 30 \
  > {output-file} 2>&1
```

Note: The `claude -p` fallback only tests the non-interactive path. Record this limitation for the report.

**If neither Agent SDK nor `claude` CLI is available**: Skip exercise testing entirely and proceed to 5e (cleanup is a no-op since no project was scaffolded). Record the reason for the report's Exercise Test Results section (graceful degradation).

**Timeout**: Set the Bash tool's `timeout` parameter to `300000` (5 minutes). If a timeout occurs, capture whatever output was produced before the timeout and report it as a graceful degradation in the Exercise Test Results section.

**Exercise errors**: If the exercise subprocess exits with a non-zero status, capture the error output. Report it as a finding and continue with evaluation of whatever output was captured.

## 5d: Evaluate Exercise Output

Read the captured output file (`{output-file}`) and the test project filesystem:

1. **Load acceptance criteria** from `requirements.md`
2. **For each AC**, search the captured output and test project filesystem for evidence:
   - **File-creating skills**: Check if expected files were created in the test project (use `Glob`)
   - **GitHub-integrated skills** (dry-run): Check if the generated `gh` commands and content match what the AC expects
   - **General**: Look for output messages that indicate the AC's expected behavior occurred
3. **Assign verdict** for each AC:
   - **Pass** — clear evidence the criterion was satisfied
   - **Fail** — contradictory evidence or expected output missing
   - **Partial** — some evidence but incomplete
4. **Record evidence** — the specific output line, file path, or observation supporting the verdict

Exercise findings (any Fail or Partial verdicts) are treated as findings for Step 6 (Fix Findings), just like any other verification finding.

## 5e: Cleanup

Delete the test project directory using `Bash`, regardless of whether the exercise succeeded or failed:

```bash
rm -rf {test-project-path}
```

This must run even if earlier sub-steps encountered errors. After cleanup, proceed to Step 6.
