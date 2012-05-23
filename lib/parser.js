// glorious streaming json parser, built specifically for the twitter streaming api
// assumptions:
//   1) ninjas are mammals
//   2) tweets come in chunks of text, surrounded by {}'s, separated by line breaks
//   3) only one tweet per chunk
//
//   p = new parser.instance()
//   p.addListener('object', function...)
//   p.receive(data)
//   p.receive(data)
//   ...

var EventEmitter = require('events').EventEmitter;

var Parser = module.exports = function Parser() {
  // Make sure we call our parents constructor
  EventEmitter.call(this);
  this.buffer = '';
	this.last_time = 0;
	this.heartbeat_check_frequency = 90; // Check every 90 seconds as per Twitter's documentation.
  return this;
};

// The parser emits events!
Parser.prototype = Object.create(EventEmitter.prototype);

Parser.END        = '\r\n';
Parser.END_LENGTH = 2;

Parser.prototype.receive = function receive(buffer) {
	this.last_time = new Date().getTime();
  this.buffer += buffer.toString('utf8');
  var index, json;

  // We have END?
  while ((index = this.buffer.indexOf(Parser.END)) > -1) {
    json = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + Parser.END_LENGTH);
    if (json.length > 0) {
      try {
        json = JSON.parse(json);
        this.emit('data', json);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
};

Parser.prototype.check_heartbeat = function() {
	var time_now = new Date().getTime();
	
	if(time_now - this.last_time > this.heartbeat_check_frequency) {
		this.emit('timeout',(time_now - this.last_time));
	}

	setInterval(self.check_heartbeat, this.heartbeat_check_frequency);
}