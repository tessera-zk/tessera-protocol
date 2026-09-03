# Tessera — Demo Click-Through

Exact clicks for the recorded demo. Pairs with DEMO.md. Testnet only.

## Pre-flight (before recording)

1. In a real terminal, from projects/tessera-protocol/frontend, run: npm run dev
2. Confirm it prints Local: http://localhost:3001
3. In Brave, turn off any VPN or proxy so localhost loads.
4. Freighter: confirm the treasury-holder account is imported and selected. Address ends OLYHTK. Get the key with: stellar keys show tessera-treasury
5. Freighter network: set to Testnet.
6. .env.local is already filled. It is the server fallback signer if you do not use the wallet.

## Scene 1 - Landing (0:00)

1. Open http://localhost:3001
2. Point at the live-proof panel on the right: commitments, treasury, ratio, tests count up.
3. Click Create attestation.

## Scene 2 - Attestation console, generate the proof (0:50)

1. On /attest, show the commitment set on the left. Say these are private witnesses.
2. On the right, show Attested treasury is prefilled.
3. Click Connect wallet in the top nav.
4. In the Freighter popup, choose the treasury-holder account, click Connect, then Approve.
5. Confirm the nav now shows the truncated treasury-holder address.
6. Confirm the button reads Generate proof and submit with wallet. If it reads server fallback, the connected wallet is not the treasury holder; switch account in Freighter.
7. Click Generate proof and submit with wallet.
8. Watch the step list: build tree, prove, encode, submit, receipt, Horizon.
9. In the Freighter popup, click Approve to sign the transaction.
10. When it finishes, click the transaction hash to open stellar.expert and show successful.

## Scene 3 - Refusals (2:10)

1. Back on /attest, click Forge negative commitment.
2. Click Generate proof and submit. Show the rejection banner. Say the proof cannot be built, nothing is submitted.
3. Optional: set treasury to Underfunded minus 1 using the Underfunded button, run, show rejection.

## Scene 4 - Non-omission and inclusion (3:00)

1. Click Safety in the nav.
2. Show the member enrollment evidence and the rejection path text.
3. Click Membership in the nav.
4. Enter a member commitment from the sample book, click the verify button, show returns true against the attested root.

## Scene 5 - Product surface (3:55)

1. Click Developers in the nav. Show Healthy, ratio, epoch, live reserve balance.
2. Open http://localhost:3001/api/solvency in a new tab. Show the JSON payload.

## Scene 6 - Close (4:30)

1. Return to the ledger or badge. Restate: commitments at most treasury at most a real controlled balance, no member commitment revealed.

## If the wallet popup does not appear

- Click the Freighter icon in the Brave toolbar once to unlock it, then retry Connect.
- If still stuck, the app falls back to the server signer from .env.local, which also produces a real transaction. Say you are using the server signer for the recording.