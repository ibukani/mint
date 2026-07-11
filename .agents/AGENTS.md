# `.agents` maintenance rules

- Repository-wide rules are in [`../AGENTS.md`](../AGENTS.md) and [`../docs/ai-development.md`](../docs/ai-development.md).
- Skill folder names and frontmatter `name` must use the same kebab-case value.
- `SKILL.md` frontmatter contains only `name` and a trigger-oriented `description`; keep the body concise and imperative.
- Every skill includes `agents/openai.yaml` with `display_name`, 25–64 character `short_description`, and a `$skill-name` default prompt.
- Do not duplicate detailed architecture documentation in skills. Link to the authoritative repository document and describe only the task-specific workflow.
- When a workflow or scaffolder changes, update affected skills and run `npm run check:ai-foundation` plus the skill validator.
