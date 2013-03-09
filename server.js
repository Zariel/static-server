var http = require("http")
var cluster = require("cluster")

var proxy = require("http-proxy")
var express = require("express")
var ecstatic = require("ecstatic")

var config = require("./config")

var root = config.root

var logger = function(req, res, next) {
	console.log("(%d) => %s %s", cluster.worker.id, req.method, req.url)

	return next()
}

var app = express()

app.use(logger)

app.use(ecstatic({
    root: root,
    cache: 0,
    gzip: true,
    handleError: false,
    autoIndex: true
}))

app.use(function(req, res, next) {
	return res.status(200).sendfile(root + "/index.html")
})

var opts = {
	router: {
		'localhost/api': 'localhost:8080/curiosity/api',
		'.*': 'localhost:8082'
	}
}

var httpServer = http.createServer(app)
var proxyServer = proxy.createServer(logger, opts)

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
} else {
	var id = cluster.worker.id;
	if (process.env.proxy === "true") {
		console.log("[" + id + "] HTTP Proxy listening on port 80 ..")
		proxyServer.listen(80)
	} else {
		console.log("[" + id + "] HTTP static server listening on port 8082 ..")
		httpServer.listen(8082)
	}
}
