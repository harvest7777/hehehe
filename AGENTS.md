# AI Coding Rules

## Scope and authorization

- Never implement, modify, delete, refactor, or reorganize anything without explicit developer authorization.
- Ask questions whenever requirements are incomplete or ambiguous.
- Keep the developer in control of direction and decisions.
- Use the narrowest reasonable scope for every change.
- Preserve existing behavior unless a change is explicitly requested.
- Do not rename or reorganize existing code unless explicitly requested.
- Apply these rules to source code, scripts, configuration, infrastructure, and documentation.

## Simplicity and readability

- Always prefer the simplest viable approach.
- Keep the codebase minimal. Avoid unnecessary abstractions, files, dependencies, and generated output.
- Prefer explicit, readable, skimmable code over clever, compressed, or overly generic code.
- Use clear, descriptive names for variables, functions, types, files, and other identifiers.
- Keep functions short and single-purpose. Avoid mega-functions.
- Do not create many helper functions without discussing the tradeoff with the developer.
- Follow the naming conventions of the language and existing project.
- Keep diffs as small as possible. Do not change unrelated whitespace or formatting.

## Comments and documentation

- Never add comments unless the developer explicitly requests them.
- This includes documentation comments, TODO markers, explanatory comments, and comments in configuration or infrastructure files.

## Dependencies

- Avoid dependencies when the standard library or existing project code is sufficient.
- Small, well-maintained dependencies are acceptable when they provide clear value.
- The developer must approve every added dependency.
- Clearly call out every dependency added during implementation.

## Tests and validation

- Never write tests unless explicitly instructed.
- When tests are requested, use only the test type specified by the developer.
- Never modify tests merely to make them pass.
- If a failure is caused by the AI’s implementation, fix only the implementation that caused it.
- If a test appears incorrect or unrelated to the requested change, tell the developer and do not change it blindly.
- Run relevant existing tests after implementation and investigate failures as iterative feedback.
- Follow any additional validation requirements specified by the developer.

## Technical judgment

- When multiple implementations are reasonable, recommend the simplest one and briefly list viable alternatives.
- If a requested approach conflicts with the architecture, project conventions, or sound engineering practice, explain the conflict and propose an alternative before proceeding.
- Challenge unclear, risky, overcomplicated, or technically unsound requests directly. Do not blindly implement them.
- Pause and request confirmation before changes involving meaningful security, privacy, or data-loss risks.

## Unrelated issues

- Do not fix unrelated bugs or perform unrelated cleanup.
- Report them clearly under the exact heading:

  `UNRELATED OTHER BUGS FOUND:`

## Handoffs

- Keep completion messages concise.
- Report only the important changes, dependency additions, validation performed, and unresolved issues.
- Do not produce unnecessary essays about the generated code.

## Git commits

- Keep commit messages short and concise.
- Use a single-line message with a concise change description, such as `(feat) added agents.md file`.
- Do not include a commit-message body or description.
- Do not include co-author attribution.
