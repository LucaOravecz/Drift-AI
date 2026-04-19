# Meeting Prep Evals

This folder holds golden meeting-prep cases for the RIA-focused prep pipeline.

Each case should include:
- household context
- meeting input
- source documents or chunk fixtures
- expected must-mention facts
- expected prohibited errors
- expected citations
- grader rubric

Target:
- `100` cases minimum before treating the pipeline as production-ready

Current state:
- Harness scaffolded
- Dataset incomplete

Failure conditions:
- material claim without support
- citation that does not support the claim
- missing required section
- misstated compliance issue
