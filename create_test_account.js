#!/usr/bin/env node
const StellarSdk = require('stellar-sdk');
const https = require('https');

function createAndFund() {
  const kp = StellarSdk.Keypair.random();
  const publicKey = kp.publicKey();
  const secret = kp.secret();
  console.log('Yeni Testnet hesap oluşturuluyor...');
  console.log('Public Key:', publicKey);
  console.log('Secret (gizli, saklayın):', secret);

  const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;
  https.get(friendbotUrl, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('Hesap testnet friendbot ile başarıyla finanse edildi.');
        try {
          const parsed = JSON.parse(data);
          console.log('Friendbot response transaction hash:', parsed.hash);
        } catch (e) {
          console.log('Friendbot yanıtı alındı.');
        }
        console.log('\nKullanmak için örnek:');
        console.log(`  export STELLAR_SECRET=${secret}`);
        console.log('  node index.js balance');
      } else {
        console.error('Friendbot başarısız oldu. HTTP kod:', res.statusCode);
        console.error(data);
      }
    });
  }).on('error', (err) => {
    console.error('Friendbot isteği sırasında hata:', err.message);
  });
}

if (require.main === module) createAndFund();

module.exports = { createAndFund };
