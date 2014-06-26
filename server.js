var child_process = require('child_process');
var crypto = require('crypto');
var express = require('express');
var fs = require('fs');
var querystring = require('querystring');

// Override so we don't decode spaces, and mess up the base64 encoding
querystring.unescape = function(s, decodeSpaces) {
  return s;
};

// Pad to follow the processing export format
function pad(num) {
  var s = "000" + num;
  return s.substr(s.length-4);
}

function getHash() {
  var md5 = crypto.createHash('md5');
  md5.update((Math.random() + Date.now()).toString());
  var id = md5.digest('hex');
  return id;
}

// FIXME synchronous hack from http://strongloop.com/strongblog/whats-new-in-node-js-v0-12-execsync-a-synchronous-api-for-child-processes/
function execSync(command) {
  // Run the command in a subshell
  var ohash = getHash();
  var dhash = getHash();
  child_process.exec(command + ' 2>&1 1>/tmp/'+ ohash + ' && echo done! > /tmp/' + dhash);

  // Block the event loop until the command has executed.
  while (!fs.existsSync('/tmp/' + dhash)) {
  // Do nothing
  }

  // Read the output
  var output = fs.readFileSync('/tmp/' + ohash);

  // Delete temporary files.
  fs.unlinkSync('/tmp/' + ohash);
  fs.unlinkSync('/tmp/' + dhash);

  return output;
}

var app = express();

app.use(function(req, res, next) {
  if (req.method != "POST") {
    next();
  } else {
    req.body = {};
    var data = "";
    req.on('data', function(chunk){ data += chunk });
    req.on('end', function() {
      if (data.trim()) {
        req.body = querystring.parse(data);
      }
      next();
    })
  }
});

app.post('/export', function(req, res) {
  var sid = getHash();
  if (fs.existsSync(sid)) {
    res.send(400);
  } else {
    fs.mkdirSync(sid);
    res.send(201, sid);
 }
});

app.post('/export/:id', function(req, res) {
  var id =  req.params.id;
  var data = req.body['data'];
	var frame = req.body['frame'];
	// Remove data:image/png;base64,
	data = data.substr(data.indexOf(',') + 1);
	var buffer = new Buffer(data, 'base64');
	fs.writeFile(id + '/screen-' + pad(frame) + '.png',
	  buffer.toString('binary'), 'binary');
  res.send(200);
});

app.get('/export/:id.gif', function(req, res) {
  var id =  req.params.id;
  if (!fs.existsSync(id + '/' + id + '.gif')) {
    execSync('convert ' + id + '/*.png ' + id + '/' + id + '.gif');
  }
  var gif = fs.readFileSync(id + '/' + id + '.gif');
  res.set({
    'Content-type': 'image/gif'
  });
  res.send(gif);
});


var server = app.listen(4343, function() {
  console.log('Listening on port %d', server.address().port);
});
