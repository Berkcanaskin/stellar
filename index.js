#!/usr/bin/env node
const StellarSdk = require('stellar-sdk');
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
const NETWORK = StellarSdk.Networks.TESTNET;

function usage() {
  console.log(`
Basit Stellar Testnet CLI

Kullanım:
  node index.js balance --secret <SECRET>
  node index.js pay --secret <SECRET> --to <DEST_PUBLIC_KEY> --amount <AMOUNT>

Ayrıca STELLAR_SECRET ortam değişkenini kullanabilirsiniz:
  STELLAR_SECRET=SB... node index.js balance
`);
}

function getKeypair(secret) {
  try {
    return StellarSdk.Keypair.fromSecret(secret);
  } catch (e) {
    throw new Error('Geçersiz secret key');
  }
}

async function getBalance(secret) {
  const kp = getKeypair(secret);
  const publicKey = kp.publicKey();
  const account = await server.loadAccount(publicKey);
  const balances = account.balances.map(b => ({asset: b.asset_type === 'native' ? 'XLM' : b.asset_code, balance: b.balance}));
  return {publicKey, balances};
}

async function sendPayment(secret, destination, amount) {
  if (!destination) throw new Error('destination required');
  if (!amount) throw new Error('amount required');
  const kp = getKeypair(secret);
  const sourcePublic = kp.publicKey();
  const account = await server.loadAccount(sourcePublic);

  const fee = await server.fetchBaseFee();

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: fee.toString(),
    networkPassphrase: NETWORK
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: destination,
      asset: StellarSdk.Asset.native(),
      amount: amount.toString()
    }))
    .setTimeout(30)
    .build();

  tx.sign(kp);
  const res = await server.submitTransaction(tx);
  return res;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
    process.exit(0);
  }

  const cmd = args[0];
  const opts = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--secret' && args[i+1]) { opts.secret = args[i+1]; i++; }
    else if (a === '--to' && args[i+1]) { opts.to = args[i+1]; i++; }
    else if (a === '--amount' && args[i+1]) { opts.amount = args[i+1]; i++; }
    else if (a === '--help') { usage(); process.exit(0); }
  }

  const secret = opts.secret || process.env.STELLAR_SECRET;
  try {
    if (cmd === 'balance') {
      if (!secret) { console.error('Secret yok. --secret kullanın veya STELLAR_SECRET ayarlayın.'); process.exit(1); }
      const info = await getBalance(secret);
      console.log('Public Key:', info.publicKey);
      console.log('Balances:');
      info.balances.forEach(b => console.log(`  ${b.asset}: ${b.balance}`));
      process.exit(0);
    } else if (cmd === 'pay') {
      if (!secret) { console.error('Secret yok. --secret kullanın veya STELLAR_SECRET ayarlayın.'); process.exit(1); }
      if (!opts.to || !opts.amount) { console.error('Eksik parametre. --to ve --amount gerekli.'); process.exit(1); }
      const res = await sendPayment(secret, opts.to, opts.amount);
      console.log('Transaction successful:');
      console.log('  hash:', res.hash);
      process.exit(0);
    } else {
      usage();
      process.exit(1);
    }
  } catch (err) {
    console.error('Hata:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getBalance, sendPayment, getKeypair };
