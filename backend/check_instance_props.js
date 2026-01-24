const { Cashfree } = require('cashfree-pg');
Cashfree.XClientId = 'test_id';
const instance = new Cashfree();
console.log('instance.XClientId:', instance.XClientId);
console.log('Cashfree.XClientId:', Cashfree.XClientId);
