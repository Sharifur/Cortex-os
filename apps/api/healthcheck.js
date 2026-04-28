var http = require('http');
http.get('http://localhost:3000/health', function(res) {
  process.exit(res.statusCode === 200 ? 0 : 1);
}).on('error', function() {
  process.exit(1);
});
