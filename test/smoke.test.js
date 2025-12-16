const http = require('http');

const PORT = process.env.PORT || 3000;

function request(path, method = 'GET', body = null) {
  const data = body ? JSON.stringify(body) : null;

  const options = {
    hostname: 'localhost',
    port: PORT,
    path,
    method,
    headers: data
      ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      : {}
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let respData = '';
      res.on('data', chunk => (respData += chunk));
      res.on('end', () => {
        try {
          const json = respData ? JSON.parse(respData) : null;
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: respData });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Running simple smoke test...');
  try {
    const health = await request('/health');
    console.log('GET /health =>', health.status, health.body);

    const created = await request('/todos', 'POST', {
      title: 'Test task from smoke test',
      description: 'Ensure CRUD works',
      completed: false
    });
    console.log('POST /todos =>', created.status, created.body);

    if (!created.body || !created.body._id) {
      console.error('Failed to create todo, aborting.');
      process.exit(1);
    }

    const id = created.body._id;

    const fetched = await request(`/todos/${id}`);
    console.log('GET /todos/:id =>', fetched.status, fetched.body);

    const updated = await request(`/todos/${id}`, 'PUT', {
      title: 'Updated test task',
      description: 'Updated description',
      completed: true
    });
    console.log('PUT /todos/:id =>', updated.status, updated.body);

    const all = await request('/todos');
    console.log('GET /todos =>', all.status, Array.isArray(all.body) ? all.body.length : all.body);

    const deleted = await request(`/todos/${id}`, 'DELETE');
    console.log('DELETE /todos/:id =>', deleted.status);

    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed', err);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}


