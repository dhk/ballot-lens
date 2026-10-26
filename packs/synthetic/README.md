# SYNTHETIC demonstration pack

This is fictional data for offline engineering tests. It is not an SF election, actual measure, endorsement, fiscal estimate, or editorial review. The 2099 dates and synthetic reviewer events are test fixtures only.

`pack.json` contains two fictional measures: one has a simulated approved finding and an excluded draft; the other is pending. Source text is embedded and also preserved in `snapshots/<sha256>.txt`. The hash is over exact UTF-8 bytes. Source locators use UTF-16 offsets in the exact snapshot text.

`request.json` retrieves a measure brief. `requests.json` supplies every declared operation, including later operations that must return `UNAVAILABLE_ANALYSIS` in M0. Never copy fixture content into a real election pack or public coverage report.

`responses.json` contains committed expected outputs for the requests in matching order. Conformance checks compare each adapter against these constants rather than comparing adapters that call the same implementation. Inspect intentional changes before updating expectations. Original snapshot text has Git text conversion disabled in `.gitattributes` so checkout preserves the hashed bytes.
