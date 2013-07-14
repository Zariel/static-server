# A simple static and proxy server

I needed a static server to host my AngularJS app which could also route
requests to my application server backend so I wrote this very simple server.

It uses wltsmrz/Lactate as the static file server and my own simple reverse HTTP proxy.

## Config
Placing a 'config.js' file in the root directory which contains some options for the server. For example

```Javascript
var path = require("path")
var fs = require("fs")

module.exports = {
	files: {
		root: path.normalize("../web-app/build"),
	},
	proxy: {
		host: "0.0.0.0",
		port: 80,
		https: {
			key: fs.readFileSync("keys/cert.pem"),
			cert: fs.readFileSync("keys/cert.pem")
		}
	},
	api: {
		url: "http://localhost:8080/api/server"
	}
}
```