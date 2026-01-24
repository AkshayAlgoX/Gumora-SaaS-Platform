const http = require('http');

function post(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let resData = '';
      res.on('data', (chunk) => resData += chunk);
      res.on('end', () => {
        try {
          resolve({
            data: JSON.parse(resData),
            headers: res.headers,
            status: res.statusCode
          });
        } catch (e) {
          resolve({
            data: resData,
            headers: res.headers,
            status: res.statusCode
          });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let resData = '';
      res.on('data', (chunk) => resData += chunk);
      res.on('end', () => {
        try {
          resolve({
            data: JSON.parse(resData),
            status: res.statusCode
          });
        } catch (e) {
          resolve({
            data: resData,
            status: res.statusCode
          });
        }
      });
    }).on('error', (e) => reject(e));
  });
}

async function test() {
  const email = `test_${Date.now()}@test.com`;
  console.log(`Registering ${email}...`);
  try {
    const regResp = await post('http://localhost:5001/api/auth/register', {
      name: 'Test User',
      email: email,
      password: 'password123'
    });
    console.log('Register response:', regResp.data);

    console.log('Logging in...');
    const loginResp = await post('http://localhost:5001/api/auth/login', {
      email: email,
      password: 'password123'
    });
    console.log('Login response:', loginResp.data);
    
    const cookie = loginResp.headers['set-cookie'];
    console.log('Cookie:', cookie);

    // Get a product slug
    const prodResp = await get('http://localhost:5001/api/products');
    const product = prodResp.data.products.find(p => p.slug === 'digital-assets');
    
    if (!product) {
        console.error('Product digital-assets not found');
        return;
    }

    console.log(`Creating session for product ${product._id}...`);
    const sessionResp = await post('http://localhost:5001/api/checkout/create-session', {
      productId: product._id
    }, {
      Cookie: cookie[0]
    });
    console.log('Session response:', sessionResp.data);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
