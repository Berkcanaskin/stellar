Neighborhood Fund — Story

Neighborhood Fund is a small-demo project to show how Stellar can empower local communities with micro-donations.

Scenario:
- A neighborhood wants to raise small amounts of XLM to fix a playground, buy supplies for a community garden, or support a local teacher.
- Any resident can create a campaign (title + goal in XLM). The app creates a Stellar testnet account for the campaign and shows a public key.
- Donors send micro-donations (XLM) to the campaign public key. The UI shows a progress bar and recent transactions (transaction hashes).

Why this story?
- It demonstrates account creation, funding (friendbot for Testnet), balance checks, and payments — covering key Stellar primitives taught in the course.
- UX is simple, makes a clear real-world use case, and is easy to demo for the evaluation criteria (deployment, README, UX, technical quality).

Scope for extension:
- Persist campaigns to a database.
- Add receipts, multisig or escrow for larger campaigns.
- Integrate sharing (QR/link) for social reach.
