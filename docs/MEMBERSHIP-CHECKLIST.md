# Membership checklist — issuer + member (issue #12)

## Issuer, every epoch

- [ ] `registered_key_count()` read; equals proof key count (else #10).
- [ ] Key order matches registration order exactly (position-by-position pin).
- [ ] `epoch` exceeds `signed_epoch()` (else #14 replay reject).
- [ ] New joins included; approved leaves removed only via explicit removal tx
      (no silent drop — the pin would reject it anyway).
- [ ] Old roots + key lists archived (historical inclusion still checkable).

## Member, one-time + per epoch

- [ ] Self-registered via `register_customer_key` under own auth (tx kept).
- [ ] `is_registered_key(ax, ay)` returns true.
- [ ] Per epoch: confirm latest attestation's public keys contain your key
      (board shows the pinned set; omission = #10 reject, visible on-chain).
