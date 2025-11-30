#!/usr/bin/env node
const { spawn } = require('child_process');
// Use global fetch available in Node 18+ (no extra dependency)
const fetch = global.fetch;
const StellarSdk = require('stellar-sdk');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER_CMD = 'node';
const SERVER_ARGS = ['server.js'];

function waitForServer(url, timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function ping() {
      fetch(url).then(r => resolve()).catch(() => {
        if (Date.now() - start > timeout) return reject(new Error('timeout waiting for server'));
        setTimeout(ping, 200);
      });
    })();
  });
}

(async function demo(){
  console.log('Starting server...');
  const server = spawn(SERVER_CMD, SERVER_ARGS, { cwd: ROOT, stdio: ['ignore','inherit','inherit'] });

  try {
    await waitForServer('http://localhost:3000', 8000);
    console.log('Server ready. Creating sender account...');

    // create sender keypair and fund via friendbot
    const sender = StellarSdk.Keypair.random();
    await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(sender.publicKey())}`);
    console.log('Sender created:');
    console.log('  public:', sender.publicKey());
    console.log('  secret:', sender.secret());

    // create campaign via API
    console.log('Creating campaign via API...');
    const campRes = await fetch('http://localhost:3000/api/campaigns', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ title: 'Demo Park', goal: 2 })
    });
    const campJson = await campRes.json();
    console.log('Campaign created:', campJson.campaign);

    // list campaigns
    const listRes = await fetch('http://localhost:3000/api/campaigns');
    const listJson = await listRes.json();
    console.log('Campaign list:', JSON.stringify(listJson, null, 2));

    // pick first campaign public key
    const campaign = listJson.campaigns[0];
    const to = campaign.publicKey;

    // send 0.5 XLM from sender to campaign
    console.log('Sending 0.5 XLM from sender to campaign...');
    const payRes = await fetch('http://localhost:3000/api/pay', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ secret: sender.secret(), to, amount: '0.5' })
    });
    const payJson = await payRes.json();
    console.log('Payment result:', payJson);

    // fetch balances
    const balSender = await fetch('http://localhost:3000/api/balance', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ secret: sender.secret() }) });
    const balSenderJson = await balSender.json();
    console.log('Sender balance:', balSenderJson);

    const balCamp = await fetch('http://localhost:3000/api/balance', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ secret: campaign.secret || '' }) });
    // campaign.secret is not returned by API; read campaigns file directly
    const fs = require('fs');
    const camps = JSON.parse(fs.readFileSync(path.join(ROOT,'campaigns.json'),'utf8'));
    const campSecret = camps[0].secret;
    const balCamp2 = await fetch('http://localhost:3000/api/balance', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ secret: campSecret }) });
    const balCampJson = await balCamp2.json();
    console.log('Campaign balance:', balCampJson);

    console.log('\nE2E demo finished.');
  } catch (err) {
    console.error('Demo failed:', err);
  } finally {
    console.log('Stopping server...');
    server.kill();
  }
})();
