const app = require('http').createServer();
const { version } = require('../package.json');

// Winston logger
const winston  = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');

const logger = winston.createLogger({
	transports: [ new winston.transports.Console()]
});

const AWS = require('aws-sdk');

AWS.config.update({
	region: 'sa-east-1'
});

const dateObj = new Date();
const month = dateObj.getUTCMonth() + 1; //months from 1-12
const day = dateObj.getUTCDate();
const year = dateObj.getUTCFullYear();

winston.add(new WinstonCloudWatch({
	logGroupName: 'photofied-client-logs',
	logStreamName: `logs_${year}_${month}_${day}`
}));
// End windston logger

require('custom-env').env(process.env.NODE_ENV || 'development');

if (process.env.USE_PORT) process.env.PORT = process.env.USE_PORT;
const ignoreList = process.env.IGNORE_CHANNELS ? process.env.IGNORE_CHANNELS.split(',') : [];

const io = require('socket.io')(app, {
	cors: {
		methods: ['GET', 'POST'],
	},
});

// eslint-disable-next-line no-console
console.log(
	`\nRemote Console Personal Server ver: ${version} host: ${process.env.SERVER_PROTOCOL}://${
		process.env.SERVER_DOMAIN
	} env: ${process.env.NODE_ENV ? process.env.NODE_ENV : 'development'} ${
		process.env.PORT ? `port: ${process.env.PORT}` : 81
	}`
);

app.listen(process.env.PORT || 81);
io.serveClient(false);
io.use((socket, next) => {
	if (socket.request.headers['x-consolere']) return next();
	return next(new Error('Authentication error'));
});

io.on('connection', function (socket) {
	socket.on('command', function (data) {
		if (!data.channel) data.channel = 'public';
		socket.broadcast.to(data.channel).emit('toConsoleRe', data);
	});

	socket.on('channel', function (channel) {
		socket.join(channel);
		if (!ignoreList.includes(channel)) {
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

const preprocess = function(data){
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
		return JSON.stringify(data);
	}else{
		return "";
	}

};
