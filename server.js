var cluster = require("cluster")
var config = require("./config")

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

var getStaticServer = function() {
	var http = require("http")
	var path = require("path")

	var express = require("express")
	var ecstatic = require("ecstatic")

	var root = path.join(__dirname, config.files.root)

	var app = express()

	var log = logger("STATIC", id)
	app.use(log)

	app.use(function(req, res, next) {
		var path = url.parse(req.originalUrl).pathname
		var folder = path.match(/^\/[^\/]*\//)

		if(folder === null) {
			return next()
		}

		var root = folder[0]
		switch(root) {
			case "/css/":
			case "/js/":
			case "/partials/":
			case "/font/":
			case "/img/":
				return next()
		}

		req.url = "/index.html"
		console.log(req.originalUrl + " => " + req.url)

		next()
	})

	var server = ecstatic({
		root: root,
		cache: "no-cache",
		gzip: true,
		handleError: true,
		autoIndex: true
	})

	app.use(server)

	var httpServer = http.createServer(app)

	return httpServer
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

	var proxyServer = proxy.createServer(logger("PROXY", id), opts)

	return proxyServer
}

if(id % 2 == 0) {
	console.log("[" + id + "] HTTP Proxy listening on " + config.proxy.host + ":" + config.proxy.port)
	getProxyServer().listen(config.proxy.port, config.proxy.host)
} else {
	console.log("[" + id + "] HTTP static server listening on " + config.files.host + ":" + config.files.port)
	getStaticServer().listen(config.files.port, config.files.host)
}
