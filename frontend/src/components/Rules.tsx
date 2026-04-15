export function Rules() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Rules &amp; Acceptable Use</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        CellSwap is a frontend to a public, immutable blockchain. We do not control what is stored on chain, but we do control what this site renders and who can mint through this interface.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>How moderation works here</h2>
        <ul style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
          <li>Cells minted on the CKB blockchain are permanent. Nothing here, or anywhere, can delete them.</li>
          <li>This site can refuse to render specific cells, hide listings from specific creators, and refuse to let specific wallets mint.</li>
          <li>Bans are applied at the wallet args level. To bypass them a user must create a new key — a deliberate friction.</li>
          <li>The cell remains on chain. Other frontends, indexers, and tools may still surface it. We are explicit that our enforcement is local to this site.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Content not permitted on this interface</h2>
        <ul style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
          <li>Child sexual abuse material (CSAM). Reported and removed without exception, no review window.</li>
          <li>Credible threats of violence against identified people or groups.</li>
          <li>Doxxing — publication of private personal information without consent (real names, addresses, phone numbers, government IDs).</li>
          <li>Non-consensual intimate imagery.</li>
          <li>Content that infringes copyright where a valid takedown request is received.</li>
          <li>Content unlawful under Australian law where the operator is resident.</li>
          <li>Spam, scam pages, phishing, malware, drive-by exploits.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Reporting</h2>
        <p style={{ lineHeight: 1.6 }}>
          Every listed item has a Report button. Reports include the cell outpoint, the reason category, and an optional message. Reports are reviewed manually. A confirmed violation results in: (1) the cell is hidden from this site, (2) the creator wallet is added to the mint and render blocklist.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Why immutability and rules coexist</h2>
        <p style={{ lineHeight: 1.6 }}>
          The chain offers permanence. The site offers selection. Both are choices, not contradictions. Permanence is valuable for content people want to outlive any single host. Selection is necessary for any host to remain operable and lawful. Holding both at once is the explicit position of this site.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Appeals</h2>
        <p style={{ lineHeight: 1.6 }}>
          If your wallet was blocked and you believe it was in error, contact the operator with the wallet args and a short explanation. The blocklist lives in the public source repository — anyone can audit who has been blocked and why.
        </p>
      </section>
    </div>
  );
}
