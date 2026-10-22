# Experimental host API patch

- Baseline: official Pi v1.3.0 `71023aec1546d6d677a65669c5665c0927ce0dd0`.
- Experimental commit: `a5eef4497a8fed4c86d2c7250fe2ce59681e31cf`.
- Patch: `experiment.patch` (binary-capable Git diff, no dependencies or generated model data).
- SHA-256: `ed42f0d22ae14a9c1eb5539e6c9ccdef73fc51c1da017079846df445716aba8c`.
- Apply only to a separate checkout at the exact baseline; never patch the installed host.
- Evidence and limits: `docs/research/pi-thinking-provenance-investigation.md` in the port repository.

This preserves the reviewed local experiment beyond temporary checkout retention. It is not an official upstream release, production integration approval, or submission authorization. Ticket 01 remains blocked.
