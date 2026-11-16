# Sanitized historical packets

Frozen item outcomes from PRs [643](https://github.com/axatbhardwaj/axstack/pull/643),
[644](https://github.com/axatbhardwaj/axstack/pull/644),
[645](https://github.com/axatbhardwaj/axstack/pull/645) and
[646](https://github.com/axatbhardwaj/axstack/pull/646), checked against their merged
GitHub bodies and the retained Sandcastle reviewer receipts / Sol audit.
The `source` fields are relative references within that historical evidence packet.
No original logs, private paths, hostnames or credentials are copied here.

W3-1 did not exist during those reviews. Tests adapt the frozen facts to synthetic
schema-v1 capture receipts, with a synthetic source root, digest and chronology.
These adapters test reconciliation, not historical execution authenticity.
#645's reported provider launch has no retained capture receipt; its in-flight
closure reused an earlier fixture that was already insufficient at review time.
#643's adherence closure does not close its separate rate-limit item.
Its rate-limit `open` status models the PR body's still-declared limitation;
the historical packet retained no separate closure disposition for it.
#644 and #646 retain their proved changed-behavior items. Their unrelated,
out-of-scope limitations are not converted into changed-behavior failures.
