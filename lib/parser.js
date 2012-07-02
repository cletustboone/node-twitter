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
	this.str_buffer = '';
	this.data = [];
	this.data_length = 0;
	this.last_time = null;
	this.heartbeat_check_frequency = 45; // Check every 90 seconds as per Twitter's documentation.
	this.hb_interval = null;
	return this;
};

// The parser emits events!
Parser.prototype = Object.create(EventEmitter.prototype);

Parser.END        = '\r\n';
Parser.END_LENGTH = 2;

Parser.prototype.receive = function receive(buffer) {
	this.last_time = new Date().getTime();
	this.str_buffer += buffer.toString('utf8');
	this.data.push(buffer);
	this.data_length += buffer.length;
	var index, json, temp_buffer;

	// We have END?
	if (this.str_buffer.indexOf(Parser.END) > -1) {

		// Make a new buffer to put all the shits into
		var buf = new Buffer(this.data_length);
		for(var i=0, len=this.data.length, pos=0; i<len; i++)
		{
			this.data[i].copy(buf,pos);
			pos+=this.data[i].length;
		}

		temp_buffer = buf.toString();
		// At this point, temp_buffer could be "...end of tweet text.\r\n  Start of new tweet...";

		// Where in temp_buffer to \r\n occur?
		index = temp_buffer.indexOf(Parser.END);

		// Capture start of new tweet
		start_of_new_tweet = temp_buffer.slice(index+Parser.END_LENGTH, temp_buffer.length);
		
		// Chop off "\r\n Start of new tweet ..."
		temp_buffer = temp_buffer.slice(0, index);
		//console.log("Start of new tweet: " + start_of_new_tweet);

		// Reset the placeholders
		this.data = [];
		this.data_length = 0;
		this.str_buffer = '';

		try
		{
			json = JSON.parse(temp_buffer);
			this.emit('data',json);
		}
		catch(error)
		{
			this.emit('error',error);
		}
	}
};

Parser.prototype.check_heartbeat = function() {
	
	var self = this; // Have to pass to an anon function in setInterval
	var time_now = new Date().getTime();
	
	if(this.last_time === null || typeof this.last_time == 'undefined') {
		this.last_time = time_now;
		this.hb_interval = setInterval(function() {self.check_heartbeat()}, this.heartbeat_check_frequency*1000);
	} else {
		var elapsed = time_now - this.last_time;
		if((time_now-this.last_time) > (this.heartbeat_check_frequency*1000)) {
			clearInterval(this.hb_interval); // Clear heartbeat check interval.
			this.emit('stall',(time_now - this.last_time));
			this.last_time = time_now; // Reset this so you don't wind up emitting stall event on next check
		}
	}
}