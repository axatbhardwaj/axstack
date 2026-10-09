# Ordinary PR chains

## Routing

Record ordinary-chain or legacy-native-stack identity and direct dependencies
in the run record.
New work defaults to ordinary PRs/chains. Unknown or mixed identity holds
affected operations. Use `gh stack` only for legacy-native-stack operations,
probe `gh stack --help` first. Preserve publication, linear-history, full-stack
merge, pinning and no-retarget rules under
[watch §5](../../axstack-watch/SKILL.md#5-state-readiness-precisely).
No automatic live unstacking. Singleton eligibility stays unchanged.

Children start from the reviewed parent. For ordinary chains, merge the parent
or base into the owned child preserving existing commits. Immediately
invalidate affected child readiness. Refresh next ready children and direct
dependencies as needed, batching ancestor changes. Re-run affected checks and
remeasure shape against the new base; size growth alone is not an automatic hold.
Legacy children retain reviewed-parent rebasing and revalidation.

## Integration

Only ready chain roots merge into integration targets. Never merge a child into
an open parent branch. A ready parent can merge before child publication or
readiness for independently deliverable approved scope. Apply watch §5, including
personal/work eligibility and user-only categories. The latest integration tip
must enter child history before
its merge, even when original parent commits are ancestors.

After confirmed parent merge, verify the reviewed head equals actual head and
is reachable from the integration result. Mismatch: serious-risk hold.
For direct children, reread old head and base, change only base, and read back
unchanged head and new base. Use `gh pr edit <child> --base <integration>` only
after confirming old base is the parent's branch and recorded head still matches.
Retarget direct children only; apply the same proof to forge auto-retargeting.
An unknown retarget outcome requires lookup before retry. Closed without merge,
rewritten parents, external squash or rebase, and missing ancestry hold dependents.

Bind evidence to PR, head, base branch identity and base SHA. Base-only retargeting
or base update requires fresh applicable review, diligence, shape, CI and
approval evaluation. Check new-base workflow coverage even at unchanged heads;
never silently reuse
old-base receipts. Carryover compares stable patch-id at both recorded head/base
identities and requires a forge-counted human approval under watch §5. Never
automatically request human rereview.

## Retirement

Branch retirement checks published and unpublished dependencies, active authors
and complete open-PR inventory. Unknown consumers hold deletion, never safe
independent parent integration. Resolve/read back all consumers before deletion.
Keep auto-delete off and omit
merge-time deletion for present/uncertain consumers.
