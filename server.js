var cluster = require("cluster")
var config = require("./config")
var url = require("url")

if(cluster.isMaster) {
	var numCpus = require("os").cpus().length

	for(var i = 0; i < numCpus; i++) {
		cluster.fork()
	}

	cluster.on('exit', function(worker, code, signal) {
		return console.log('Worker ' + worker.id + ' died')
	})

	return
}

var logger = function(from, id) {
	return function(req, res, next) {
		console.log("[%s] (%d) => %s %s", from, id, req.method, req.url)

		return next()
	}
}

config.proxy = config.proxy || {}
config.proxy.host = config.proxy.host || "localhost"
config.proxy.port = (config.proxy.port === undefined) ? 80 : config.proxy.port
config.proxy.api = config.proxy.api || {}

var id = cluster.worker.id;

var http = require("http")
var path = require("path")
var lactate = require("lactate")
var Proxy = require("./lib/proxy")

var errorLog = function(req, res, err) {
	console.log(err)
}

var getStaticServer = function(id) {
	var root = path.join(__dirname, config.files.root)

	var log = logger("STATIC", id)

	var files = lactate.Lactate({
		root: root,
	})

	var staticServe = function(req, res) {
		console.log("[" + id + "] (STATIC) => " + req.url)

		files.serve(req, res)
	}

	return function(req, res) {

		var originalUrl = req.url
		var path = url.parse(originalUrl).pathname
		var folder = path.match(/^\/[^\/]*\//)

		if(folder === null) {
			req.url = "/index.html"
			return staticServe(req, res)
		}

		var root = folder[0]
		switch(root) {
			case "/css/":
			case "/js/":
			case "/partials/":
			case "/font/":
			case "/img/":
				req.url = path
				return staticServe(req, res)
		}

		req.url = "/index.html"
		return staticServe(req, res)
	}
}

String.prototype.startsWith = function(str) {
	return this.substring(0, str.length) === str
}

var getProxyServer = function(id) {

	var serveStatic = getStaticServer(id)

	var targets = config.api.routes
	var proxies = {}

	for(var matcher in targets) {
		var target = targets[matcher]
		proxies[matcher] = Proxy(target)
	}

	var func = function(req, res) {
		// All errors from the proxy are sent back to here
		req.on("error", function(err) {
			errorLog(req, res, err)
			res.writeHead(500);
			res.end();
		});

		var path = url.parse(req.url).pathname
		if(path !== null) {
			for(var matcher in proxies) {
				if(path.startsWith(matcher)) {
					if(config.api.stripMatched) {
						req.url = req.url.substring(matcher.length)
					}

					console.log("[" + id + "] (PROXY) => " + req.url)
					return proxies[matcher](req, res)
				}
			}
		}

		return serveStatic(req, res)
	}

	var httpServer
	if(config.proxy.https) {
		httpServer = require("https").createServer(config.proxy.https, func)
	} else {
		httpServer = require("http").createServer(func)
	}

	return httpServer
}


var server = getProxyServer(cluster.worker.id)
if(config.proxy.https) {
	var host = config.proxy.host === "0.0.0.0" ? "localhost" : config.proxy.host
	http.createServer(function(req, res) {
		var target = url.parse(req.url)
		target.protocol = "https"
		target.host = req.headers.host || host

		res.statusCode = 301
		res.setHeader("Location", url.format(target))
		res.end()
	}).listen(80, config.proxy.host)
}

server.listen(config.proxy.https ? 443 : config.proxy.port, config.proxy.host)
console.log("Listening on port " + (config.proxy.https ? 443 : config.proxy.port))
