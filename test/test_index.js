const { expect } = require('chai');
const { getKeypair, getBalance, sendPayment } = require('../index.js');

describe('index.js basics', () => {
  it('exports functions', () => {
    expect(getKeypair).to.be.a('function');
    expect(getBalance).to.be.a('function');
    expect(sendPayment).to.be.a('function');
  });

  it('getKeypair throws on invalid secret', () => {
    expect(() => getKeypair('not-a-secret')).to.throw();
  });

  it('getKeypair returns object for valid-looking secret', () => {
    // generate a real keypair using stellar-sdk to pass a valid secret
    const StellarSdk = require('stellar-sdk');
    const kp = StellarSdk.Keypair.random();
    const secret = kp.secret();
    const res = getKeypair(secret);
    expect(res).to.have.property('publicKey');
    expect(res).to.have.property('rawSecretKey');
  });
});
