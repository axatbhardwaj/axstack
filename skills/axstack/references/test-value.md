# Test value

Use this reference when authoring or reviewing tests and investigating audit
candidates. Judge assertions and the production boundary, not test names.
There is no deletion quota or quality score; zero candidates is valid.

## Authoring gate

For every new or changed test, answer:

1. Which observable behavior or independent contract does it protect?
2. Which plausible regression would make it fail?
3. Why would existing coverage miss that regression? Prefer extending the
   primary boundary test; another layer needs a distinct risk.
4. Does it require an export, flag, wrapper, or hook used only by tests?
   If so, exercise the real production boundary instead.

Also ask: if every imported function returned `undefined`, would it still pass?
Investigate a yes. Missing answers or an unproven independent contract fail
the gate: do not add the test. A test that breaks under a behavior-preserving
refactor needs a boundary assertion unless it guards an independent contract.

For a bug fix, demonstrate the regression test failing on pre-fix code for
the intended reason, then passing with the fix. Protect the bug once at its
owner boundary; repeated scenarios at other layers need a separate risk.

## Investigate junk patterns

- Probes without assertions; self-comparison; expected values computed by the
  subject being tested.
- Assertions only about mocks or absence; a mock implementing the behavior
  being asserted; fixtures checking their own supplied results.
- Repeating constants, config, declared capability flags, or type guarantees
  without independently exercising the promised contract.
- Exact source, import, or string greps of non-contract text; copied fixtures,
  inventories, manifests, or export lists.
- Private predicates or call shapes already covered at a boundary; duplicate
  invocations of one contract; tests preserving test-only exports or wrappers.
- Negative controls passing because an unrelated guard blocked the path;
  names promising behavior the assertions never exercise.

The `undefined` check and these patterns are investigative heuristics, never
automatic deletion verdicts. Read the complete test, production owner and its
callers, overlapping coverage, CI routing, and relevant history before marking.

## Retention bar

Retain independent public API, protocol, config, security, migration, storage,
platform, package, release, architecture, or prompt-byte contracts. Keep
observable ordering, credible regression protection, and source inspection
when it is the cheapest independent guard and survives unrelated rewording or
identifier changes. Static or slow alone never justifies deletion.

A retained test failing on the baseline is a possible product bug: reproduce
and report it rather than deleting it. Retain uncertain candidates.

## Marks and evidence

- **R — retain:** name the independent contract and regression caught.
- **F — fix assertion:** keep the contract; report the weak assertion for repair.
- **C — consolidate:** identify the remaining owner test (keeper) first.
- **D — delete:** identify remaining proof, or prove the assertion vacuous or
  its contract obsolete.

For each C/D, record the exact test name and location, what failure it can
detect, the named keeper or evidence of vacuity/obsolescence, and the validation
command. Missing evidence leaves the candidate retained and report-only.

## F proof

An authorized F repair preserves its contract: the repaired check passes on the
base, goes red when its instruction or code is removed or inverted by a
targeted disposable mutation restored byte for byte, and survives equivalent
rewording for semantic prose. Never weaken or loosen an assertion.

## Deletion proof

Pin base and candidate revisions. Run the suite green before and after the
edit. Map every removed assertion's contract to a remaining keeper or evidence
that it is vacuous or obsolete; passing suites alone do not prove preservation.

For each C and each keeper-backed D, make a targeted disposable mutation of
the production owner for each distinct contract. Show the named keeper going
red for that regression, then restore the source byte for byte. Do not infer
keeper strength from its name or coverage alone.

A vacuous D cites the vacuity (no assertion, self-comparison, or an expected
value derived from the subject). An obsolete D cites the removed production
path, spec, or history proving the contract is gone. Without that proof,
report the candidate and retain it. Release-only tests hidden from authoring
agents are outside weekly audit scope. Where the runner reports coverage,
use it as a per-file guard; it never authorizes deletion by itself.

## Sources and license

Adapted and condensed from OpenClaw's
[test-audit](https://github.com/openclaw/openclaw/blob/1f351187bd0d/.agents/skills/test-audit/SKILL.md)
and [campaign](https://github.com/openclaw/openclaw/blob/1f351187bd0d/.agents/skills/test-audit/CAMPAIGN.md).
MIT License — Copyright (c) 2026 OpenClaw Foundation.
Paraphrased ideas: [pstack](https://github.com/cursor/plugins/blob/fae2c6ed9582/pstack/skills/principle-test-behavior-not-implementation/SKILL.md)
(license unverified): test whether assertions depend on subject behavior;
[Matt Pocock](https://github.com/mattpocock/skills/blob/d81f3a183412/skills/engineering/tdd/tests.md)
(MIT): use public boundaries and independently chosen expected results.

OpenClaw MIT notice:
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
