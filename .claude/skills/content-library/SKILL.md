---
name: content-library
description: Build or extend the TailgatePro safety talk library by running the safety-collector, safety-structurer and safety-auditor agents in order. Use when the user asks to create, add to, or refresh the safety talk / toolbox talk content library.
---

# Constructing and Gathering Content Library

When user asks to create or add to the safety talk library, you will work with 3 agents to get the work done.
| agent | src | task |
| safety-collector | .claude/agents/talks/safety-collector.md | harvest raw safet talks |
| safety-structurer | .claude/agents/talks/safety-structurer.md | convert raw files into standardized JSON |
| safety-auditor | .claude/agents/talks/safety-auditor.md | audit the processed files |

## How to Run This Workflow in Claude Code

1. **Step 1:** Run `@safety-collector` to harvest raw safety talks into `data/raw/`.
2. **Step 2:** Run `@safety-structurer` to convert raw files into standardized JSON in `data/processed/`.
3. **Step 3:** Run `@safety-auditor` to audit the processed files and append compliance flags or approval status.
