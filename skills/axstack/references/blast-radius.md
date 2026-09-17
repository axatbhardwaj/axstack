# Blast radius

Find what a change breaks somewhere else before it ships, beyond the diff, and
prove the one fact it is safe because of by running real code instead of
writing it up. Loaded by `axstack-review` under angle 3 before any verdict and
by `axstack-explain` for a direct "what could this break" question.

Listing the callers is not the job; a symbol search does that in a second. The
job is the breakage the search does not show.

## Evidence ladder

A writeup that sounds right is worthless: it reads as convincing whether or not
it is true. For each fact the change's safety depends on, get it as far down
this ladder as is cheap and say where it stopped:

1. **Said so.** Worthless on its own.
2. **Pointed at the line.** A real `file:line`, or the library's own source at
   the pinned version.
3. **Walked the failure.** The bad case was traced step by step and does not
   reach.
4. **Ran it.** A script or test that calls the real code and fails loud if the
   claim is wrong.
5. **Reproduced it in the running app.**

A safety fact below step 4 is written as **unproven**, never as settled. Step 4
is usually one small script that imports what the app ships and calls the exact
function in question. "Not found" is an answer for the inspected scope only.

## Steps

1. **Read the change.** The diff, the symbols it adds, changes, and deletes,
   and what it now does differently, including the part the diff does not
   spell out. Pull the PR body and commit messages for the stated intent.
2. **Find the one fact it is safe because of.** Most changes that look risky
   are safe because of a single fact, such as "this call only drops
   already-dead cache entries". Spend the time here, not on a long list of
   maybes. If that fact holds, most risky cases clear at once.
3. **Look where the search stops.** Library source at the pinned version and
   any local patch; when things run (microtasks, unmount and teardown,
   reactive frameworks); what a symbol search misses: the JSON an API returns,
   a database column, a wire or on-chain format, another language reading the
   same bytes, a feature flag, code three hops downstream.
4. **Be honest about each risk.** Give it a real chance of happening and a
   real cost if it does. Keep the confirmed risks; list the checked and cleared
   ones separately. Cite a real `file:line`; never invent a caller or an API.
5. **Prove the one fact.** Write the script or test, run it against the real
   code, and paste what happened. If it cannot be proven cheaply, mark it
   unproven; do not overstate.

## What to hand back

- **What it does.** What changed, including the part that is not obvious.
- **The one fact it is safe because of.** State it, the ladder step reached,
  and the proof; or `unproven`.
- **Risks.** Only the real ones, each with how it breaks, the `file:line`, how
  likely and how bad, and how to check.
- **Cleared.** What was checked and why it is fine.
- **Before merge.** The cheapest test or repro that catches the real bug,
  including the script written for step 5.

Strip anything private before the writeup leaves the run. In review, an
unproven safety fact for a consequential change is a finding with its
consequence stated, not a footnote.
