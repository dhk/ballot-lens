# Contributing

Read [requirements](docs/requirements.md) and [roadmap](docs/roadmap.md) before proposing changes. Keep work in milestone-sized pull requests.

Each pull request should identify requirements IDs, scope, migrations (or none), validation and fixtures, limitations, and required human review. Report checks actually run; do not describe planned gates as passing.

Keep evidence independent of organization weights and personal circumstances. Calculations must be deterministic; unknown inputs remain unknown. Preserve provenance and immutable released revisions. Do not log raw profiles, preferences, weights, or answers.

Use clearly labeled synthetic data for initial contracts and tests. Real pilot measures, editorial rubric, organization inclusion, rule approval, public releases, and interface selection require human decisions. Record conflicts between the specifications for resolution rather than silently changing scope.

Use Node 24, install with `npm ci`, and run `npm run check` before submitting. Tests and builds need no network after dependencies are installed. Regenerate contract schemas with `npm run schemas`; never edit generated schemas alone. The original planning documents are excluded from formatting to preserve their supplied text. Propose architecture decisions before changing the baseline; do not add a license or assign source redistribution rights without an owner decision.
