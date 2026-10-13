# Whiteboard defense

Apply whiteboard defense to a whole system, PR, run or change, whether shipped,
in review or planned. Narrow questions stay proportional.
Triggers include "help me defend X", "whiteboard defense for PR N", and
"prep me for questions on X".
Extend §2.1's base for every explanation with the five elements below.
Use the §1.6 decision trail as evidence for decisions.
Spec-readback identity wins when defending a spec.
Show-your-work and blast-radius requests keep their rules unless the user also
asks to understand or defend the whole.

1. Cover how it works at a high level and where data flows.
2. Cover key decisions as "why X instead of Y".
3. Cover the main data structures or state and why they were chosen.
4. Cover what happens if a user, dependency, agent or attacker misbehaves or
   acts maliciously.
5. Cover where it fails and how that failure shows.

Traced means source, tests, observation or recorded design (spec, run-record
Decisions, ADR, PR), each with its §1.3 label.
Label design-only claims planned/proposed.
For shipped or in-review work, list design-only (4) or (5) as an open gap:
"implementation not traced".
List a missing alternative, reason, data-structure rationale, or untraced
misbehaviour or failure as open gaps. Never invent alternatives, reasons,
threats or failures.
Name each trust boundary on the flow traced in (1), with an evidence pointer
and the actors crossing it; an unclear boundary is an open gap.
Answer each actor the user names or list it open.
State in one line that other actors are out of scope.
Omissions of (2) and (3) require "does not apply", a one-line reason and
an evidence pointer. Never omit (1), (4) or (5); answer them or mark them open.
Never drop an element silently.
(5) does not trigger the blast-radius proof; that runs only on "what could this break".
Use function names and line-level detail only as evidence pointers.

Close with likely whiteboard questions beyond (1)-(5), each with an
evidence-backed labelled answer or marked open.
Give each open gap one line naming the missing evidence and saying to resolve
it before defending the work.
Every whiteboard-defense explanation is consequential for review, in chat too.
Follow [Delivery](delivery.md) for reviewer-outage and two-round holds.

If five elements and closing questions exceed 700 words, keep the top level,
every element and the open gaps as at least one line each.
Offer per-component explanations for closing questions that cannot fit and
count how many moved. Never drop questions silently.
If mandatory lines exceed 700 words, give the top-level explanation first and
split the rest into per-component explanations; never exceed the cap.
The delivered view keeps (1), one line each for (4) and (5), and the open-gap
count with the components holding them.
State how many elements and open gaps moved.

When the user or stated records (run record, spec, PR body or README) identify
a PoC, demo or experiment, use an optional checklist and proportional answer
under the ordinary review rule. Never infer that status.
An intent to ship overrides the PoC exemption.
An explicit checklist request requires full whiteboard defense.
