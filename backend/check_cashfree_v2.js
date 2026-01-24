const cf = require('cashfree-pg');
console.log('Keys of require("cashfree-pg"):', Object.keys(cf));
console.log('Type of Cashfree:', typeof cf.Cashfree);
if (typeof cf.Cashfree === 'function') {
    console.log('Cashfree static keys:', Object.keys(cf.Cashfree));
    console.log('Cashfree prototype keys:', Object.keys(cf.Cashfree.prototype));
}
// Try to see if there is a global instance
try {
    console.log('Trying to call PGCreateOrder on Cashfree...');
    console.log('Cashfree.PGCreateOrder type:', typeof cf.Cashfree.PGCreateOrder);
} catch (e) {
    console.log('Error accessing PGCreateOrder:', e.message);
}
