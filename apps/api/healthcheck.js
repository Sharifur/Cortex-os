const http = require('http');

const port = parseInt(process.env.PORT ?? '3000');

http.get(`http://127.0.0.1:${port}/health`, (res) => {
  if (res.statusCode >= 200 && res.statusCode < 400) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}).on('error', () => {
  process.exit(1);
});
