import fetch from 'node-fetch';
async function test() {
  const res = await fetch('http://localhost:3000/api/admin/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer undefined'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password',
      name: 'Test User',
      role: 'User'
    })
  });
  const text = await res.text();
  console.log(res.status, text);
}
test();
