var http = require('http');
var port = process.env.PORT || '3000';
var req = http.get('http://127.0.0.1:' + port + '/health', function(res) {
  console.log('healthcheck: port=' + port + ' status=' + res.statusCode);
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', function(e) {
  console.error('healthcheck: port=' + port + ' error=' + e.code + ' ' + e.message);
  process.exit(1);
});
req.setTimeout(4000, function() {
  console.error('healthcheck: port=' + port + ' timeout');
  req.destroy();
  process.exit(1);
});
