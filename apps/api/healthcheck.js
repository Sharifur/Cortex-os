var http = require('http');
http.get('http://127.0.0.1:3000/health', function(res) {
  process.exit(res.statusCode === 200 ? 0 : 1);
}).on('error', function() {
  process.exit(1);
});
