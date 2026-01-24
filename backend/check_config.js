const { Configuration, Cashfree } = require('cashfree-pg');
console.log('Configuration keys:', Object.getOwnPropertyNames(Configuration));
console.log('Configuration prototype keys:', Object.getOwnPropertyNames(Configuration.prototype));
