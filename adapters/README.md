# Adapters

`json/` is a small non-MCP request adapter used for conformance evaluation. It parses bounded JSON and delegates to application operations. `apps/cli` is the local operator adapter.

No MCP server, HTTP hosting, UI, administrative writes, authentication, or protocol version is selected here. Add future adapters only after the relevant architecture/threat-model decisions, using the same contracts and conformance fixtures.
