const app = require('http').createServer((req,res)=>{
	// Defining the / endpoint as a health endpoint to keep the instance alive in heroku
	if(req.url === "/"){
		res.writeHead(200,{"Content-Type":"text/html"});
		res.write("{}");
		res.end();
	}
});
const { version } = require('../package.json');

/** //////////// Winston logger **/
const winston  = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const AWS = require('aws-sdk');

// Configure AWS region
AWS.config.update({
	region: 'sa-east-1'
});

// Split logs by day using the log stream name
const dateObj = new Date();
const month = dateObj.getUTCMonth() + 1; //months from 1-12
const day = dateObj.getUTCDate();
const year = dateObj.getUTCFullYear();

winston.add(new WinstonCloudWatch({
	logGroupName: 'photofied-client-logs',
	logStreamName: `logs_${year}_${month}_${day}`
}));

/**  //////////// End winston logger */
require('custom-env').env(process.env.NODE_ENV || 'development');

if (process.env.USE_PORT) process.env.PORT = process.env.USE_PORT;
const allowedChannels = process.env.ALLOWED_CHANELLS ? process.env.ALLOWED_CHANELLS.split(',') : [];

const io = require('socket.io')(app, {
	cors: {
		methods: ['GET', 'POST'],
		origin: process.env.CORS_ALLOWED_ORIGIN.split(",")
	},
});

app.listen(process.env.PORT || 81);
io.serveClient(false);
io.use((socket, next) => {
	if (socket.request.headers['x-consolere']) return next();
	return next(new Error('Authentication error'));
});

// Handle socket events
io.on('connection', function (socket) {
	socket.on('command', function (data) {
		if (!data.channel) data.channel = 'public';
		socket.broadcast.to(data.channel).emit('toConsoleRe', data);
	});

	socket.on('channel', function (channel) {
		socket.join(channel);
		if (allowedChannels.includes(channel)) {
			socket.join(channel);
			// eslint-disable-next-line no-console
			console.info('join channel:', channel);
		}
	});

	socket.on('toServerRe', function (data, cb) {
		if (!data.channel) data.channel = 'public';
		if (data.loopback) {
			io.to(data.channel).emit('toConsoleRe', data);
		} else {
			let logLevel = data.level;
			if(data.level === 'log')
				logLevel = 'info';
			winston.log(logLevel, preprocess(data));
			socket.broadcast.to(data.channel).emit('toConsoleRe', data);
		}
		if (cb !== undefined) cb('success');
	});
});

// Looks up the list of args and checks if an arg is a well formed JSON using a regex
// If one of the args is an stringified JSON, it parses the arg and re stringifies the entire array
// This is used to stored the data in AWS log stream in a more readable format
const preprocess = function(data){
	const channel = data.channel;
	if(data && data.args){
		data.args = data.args.map(d=>{
			let d1 = d.replace("[color=red]","");
			d1 = d1.replace("[/color]","");
			if (/^[\],:{}\s]*$/.test(d1.replace(/\\["\\\/bfnrtu]/g, '@').
			replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
			replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
				d1 = JSON.parse(d1);
			}
			return d1;
		});
		data.channel = channel;
		return JSON.stringify(data);
	}else{
		return "";
	}

};

// Server Up message
// eslint-disable-next-line no-console
console.log(
	`\nRemote Console Personal Server ver: ${version} host: ${process.env.SERVER_PROTOCOL}://${
		process.env.SERVER_DOMAIN
	} env: ${process.env.NODE_ENV ? process.env.NODE_ENV : 'development'} ${
		process.env.PORT ? `port: ${process.env.PORT}` : 81
	}`
);
