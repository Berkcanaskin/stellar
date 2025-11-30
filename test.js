// Basit sanity test: fonksiyonlar ihrac ediliyor mu?
const lib = require('./index.js');
let ok = true;
if (typeof lib.getBalance !== 'function') { console.error('getBalance eksik'); ok = false; }
if (typeof lib.sendPayment !== 'function') { console.error('sendPayment eksik'); ok = false; }
if (typeof lib.getKeypair !== 'function') { console.error('getKeypair eksik'); ok = false; }
if (!ok) process.exit(2);
console.log('Sanity checks passed (exports ok)');
