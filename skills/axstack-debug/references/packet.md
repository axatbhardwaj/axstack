# Debug shapes

Read before phase 7 and before any fan-out. Every artifact below is redacted.

## Evidence packet

One snapshot file under the run record, hashed, referenced by path from every
brief. Fields:

- user symptom verbatim
- base and candidate SHA plus dirty-patch or artifact hashes
- cwd, runtime, dependency and config prerequisites
- redacted fixture, setup and reset steps
- the loop command, its exact assertion, and its original output
- minimised repro and what remains load-bearing
- state and recent-change findings
- every prior attempt with diff summary, hypothesis, and why it was judged
  failed
- hypotheses already refuted
- allowed reads, commands, scratch location, and excluded systems
- probe budget

## Investigator brief

One per hypothesis, added to the shared packet:

- hypothesis ID and statement
- prediction it makes
- discriminating probe
- falsification criterion
- stop criterion ("confirmed means", "inconclusive means", budget)

An investigator may report one credible alternative hypothesis without
cross-reading another investigator's output.

## Investigator receipt

```text
Investigator: <role ID + provider/model/effort receipt> worktree <path> rev <sha> dirty <hash | clean>
Hypothesis: <ID>
Loop before probe: <red output excerpt>
Probe: <diff or script pointer> -> <command> -> <output pointer>
Verdict: confirmed | refuted | inconclusive | blocked
Evidence: <pointers>
Alternative: <one hypothesis or none>
Limitations: <what could not be checked and why>
```

## Diagnosis record

```text
Bug: <user symptom, verbatim, redacted>
Revision: <candidate SHA> base <SHA> dirty <patch hash | clean>
Loop: <one command> -> <red output excerpt>  Hermetic: <yes | shared: ...>
Minimised repro: <what remains load-bearing>
State/recent change: <findings or none>
Hypotheses: <ranked; each confirmed/refuted/inconclusive/blocked/untested + evidence>
Root cause: <origin of the bad value> | UNKNOWN + what was tried
Seam: <regression test location> | NONE (finding)
Pattern sweep: <other sites or none>
Rung reached: <L0 | L1 | L2>  Fixes tried: <n: change, why judged failed>
Adviser receipts: <ids or n/a>  Investigator receipts: <ids or n/a>
Cleanup: <tagged prefixes removed | listed for implementer>
Repair class: <bounded -> small-change intent | substantial -> spec route | unresolved -> investigation continues>
Lesson: <one line or none>
```

## Repair classes

- `bounded` — a confirmed root cause with a named seam and a repair the
  record predicts will turn the loop green; supplies the small-change intent
  for `axstack-implement`.
- `substantial` — the repair crosses a material design, security, or
  infrastructure boundary; takes the approved-spec and ticket route.
- `unresolved` — root cause UNKNOWN or no decisive evidence; investigation
  continues at the recorded rung.

A NONE seam is an explicit TDD gap requiring a scoped decision, not permission
to fix without a meaningful red. The implementer verifies the repair against
both the original loop and the minimised repro.
