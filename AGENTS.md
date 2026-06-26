# AGENTS.md

## Generalization-First Principle

When a specific query fails, do not add a one-off patch as the primary fix.
Use the failing case only as a signal to strengthen a general rule that applies broadly across languages and regions.

## Mandatory Rules for Natural-Language Geo Search

1. Explicit user location wins.
If the query contains a location phrase (for example "in Wales", "a Roma", "dans la region"), that location must be resolved first and must have higher precedence than model-inferred geography.

2. Keep species and geography parsing independent.
When a location phrase exists, parse species from the plant segment and geography from the location segment. Do not let one overwrite the other.

3. Prefer geometry for sub-country regions.
If geocoding identifies a sub-country area (region/state/city), use geometry filtering instead of broad country code filtering.

4. Use country filters only for true country intent.
Apply country-level filtering only when the resolved location is explicitly country-level.

5. Multilingual by default.
Patterns, connectors, and heuristics must be language-agnostic or multilingual. Avoid logic limited to one or two languages.

6. Log explainability metadata.
Return and log resolver metadata (scope, area name, source strategy) so failures can be diagnosed and improved systematically.

7. Extend shared logic, not duplicate logic.
Coverage heuristics and resolver policies should live in shared modules and be reused by runtime and admin diagnostics.
