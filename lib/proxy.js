var U = require("url"),
	P = require("path"),
	http = require("http");

var proxy = module.exports = function(dest) {

	var target = dest;
	if(typeof(dest) === "string") {
		target = U.parse(dest);
	}

	return function(req, res) {
		var url = {}
		url.host = target.host;
		url.path = target.path + U.parse(req.url).path;
		url.protocol = target.protocol;
		url.port = target.port;
		url.hostname = target.hostname;
		url.headers = req.headers;
		url.method = req.method;

		var proxy = http.request(url, function(proxyRes) {
			res.writeHead(proxyRes.statusCode, proxyRes.headers);
			proxyRes.pipe(res);
		});

		req.pipe(proxy);

		proxy.on("error", function(err) {
			req.emit("error", err);
			proxy.end();
		});
	};
};
