# `.agents` maintenance rules

- Repository-wide rules are in [`../AGENTS.md`](../AGENTS.md); commands and verification scope are in [`../docs/ai-development.md`](../docs/ai-development.md).
- Skill folder names and frontmatter `name` must use the same kebab-case value.
- `SKILL.md` requires `name` and a concise, trigger-oriented `description`. Supported optional metadata may be retained. Keep the body focused on the workflow and its completion conditions.
- Preserve existing `agents/openai.yaml` UI metadata. It is optional for new skills; when present, keep `display_name`, a 25–64 character `short_description`, and the `$skill-name` default prompt consistent with the skill.
- Do not duplicate detailed architecture documentation in skills. Link to the authoritative repository document and describe only the task-specific workflow.
- When a workflow or scaffolder changes, update affected skills. Run `npm run check:ai-foundation` for names, descriptions, local references, commands, and optional UI metadata. Check the intended trigger and adjacent requests that should not activate the skill; full application tests are needed only when code or tooling behavior changes.
