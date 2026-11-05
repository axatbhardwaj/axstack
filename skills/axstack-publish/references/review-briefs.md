# Article review and repair briefs

Use these templates for source-fidelity review and repair of Explain/Publish
articles. Fill the placeholders from the exact artifact and research record.
Keep the existing design, verification and delivery rules alongside this brief.

## Review brief template

```text
Article: <final.html path, byte count, SHA-256>
Research: <source record path, revision/hash, claim IDs and research labels>
Review: check each claim against its source and label, including headings and tables.
Return: <finding ID, severity, claim ID, research label, exact location,
         quoted text, source evidence, proposed correction; or no findings>
```

Carry this severity rubric and these wording rules in every review brief.

- High means making a reader believe something false, a privacy leak, or a broken page.
- Medium means a specific overstated label, misquote, or wrong number.
- Phrasing preferences are low severity, never above low.
- Headings must never be stronger than the body.
- Bound absence claims with “we found no…” to the searched sources and timeframe.
- Never place context or comparators as evidence for or against a hypothesis.

## Repair brief template

For every repair finding, require a claim ID, research label, and allowed
location (heading, body or table column).
Require a before→after line for every finding in the author receipt.

```text
Input: <exact artifact path, byte count, SHA-256; research record revision/hash>
Finding: <finding ID and accepted correction>
Claim ID: <research claim ID>
Research label: <label from the research record>
Allowed location: <heading | body | named table column; exact section/cell>
Repair: <bounded wording or move/delete instruction preserving the label>
Author receipt: <finding ID, claim ID, research label, location, before→after line>
Output: <new artifact path, byte count, SHA-256>
```

Repeat the finding block for each accepted finding. Carry the wording rules
above into repairs, and return changed bytes for the existing exact-byte checks.
