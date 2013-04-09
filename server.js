var cluster = require("cluster")
var config = require("./config")
var url = require("url")

if(cluster.isMaster) {
	var numCpus = require("os").cpus().length

	for(var i = 0; i < numCpus; i++) {
		var opts = {
			proxy: i % 2 == 0
		}

		cluster.fork(opts)
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
config.api.uri = config.api.uri || "localhost:8080/api"
config.api.path = config.api.path || "/api"
config.files.host = config.files.host || "localhost:8081"
config.files.port = (config.files.port === undefined) ? 8081 : config.files.port

var id = cluster.worker.id;

var http = require("http")
var path = require("path")
//var httpProxy = require("http-proxy")
var lactate = require("lactate")
var Proxy = require("./lib/proxy")

var getStaticServer = function() {
	var root = path.join(__dirname, config.files.root)

	var log = logger("STATIC", id)

	var files = lactate.Lactate({
		root: root,
	})

	var staticServe = function(req, res) {
		files.serve(req, res)
	}

	return function(req, res) {

		var originalUrl = req.url
		var path = url.parse(originalUrl).pathname
		req.url = path
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
				return staticServe(req, res)
		}

		req.url = "/index.html"

		return staticServe(req, res)
	}
}

var getProxyServer = function() {
	var proxy = require("http-proxy")

	var files = config.files.host + ":" + config.files.port

	var opts = {
		pathnameOnly: true,
		router: {
			"/api": config.api.url,
			"/": files
		}
	}

	var serveStatic = getStaticServer()

	var proxy = Proxy(config.api.url)

	var func = function(req, res) {
		req.on("error", function(err) {
			console.log(err);
			res.writeHead(500);
			res.end();
		});
		var path = url.parse(req.url).pathname
		if(path !== null && path.match(/^\/api/)) {
			return proxy(req, res)
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


var server = getProxyServer()
if(config.proxy.https) {
	var host = config.proxy.host === "0.0.0.0" ? "localhost" : config.proxy.host
	http.createServer(function(req, res) {
		var target = url.parse(req.url)
		target.protocol = "https"
		target.host = req.headers.host || host

		console.log(url.format(target))
		res.statusCode = 302
		res.setHeader("Location", url.format(target))
		res.end()
	}).listen(80)
}

server.listen(config.proxy.https ? 443 : config.proxy.port, config.proxy.host)
console.log("Listening on port " + (config.proxy.https ? 443 : config.proxy.port))

