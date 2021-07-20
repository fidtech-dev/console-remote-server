const app = require('http').createServer();
const { version } = require('../package.json');

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
			socket.broadcast.to(data.channel).emit('toConsoleRe', data);
		}
		if (cb !== undefined) cb('success');
	});
});
