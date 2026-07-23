const axios = require('axios');

async function test() {
  try {
    // 1. Register a test user
    const email = `test_${Date.now()}@test.com`;
    console.log('Registering user:', email);
    const regRes = await axios.post('http://localhost:3000/auth/register', {
      name: 'Test User',
      email,
      password: 'password123'
    });
    const token = regRes.data.token;
    console.log('Token obtained.');

    // 2. Fetch /trips
    console.log('Fetching GET /trips...');
    const tripsRes = await axios.get('http://localhost:3000/trips', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status:', tripsRes.status);
    console.log('Body:', tripsRes.data);
  } catch (err) {
    if (err.response) {
      console.log('Error Status:', err.response.status);
      console.log('Error Body:', err.response.data);
    } else {
      console.error(err);
    }
  }
}
test();
