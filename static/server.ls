http = require \http

ecstatic = require \ecstatic
proxy = require \http-proxy

/*
cluster = require \cluster
numCpus = require \os .cpus!length


if cluster.isMaster
    for i from 0 to numCpus - 1
        cluster.fork!

    cluster.on \exit (worker, code, signal) ->
        console.log 'Worker ' + worker.id + ' died'
else
*/

http.createServer (ecstatic {
    root: "#__dirname/public"
    autoIndex: true }) .listen 8082

console.log "HTTP static server listening on port 8082 .."

opts =
    router:
        'localhost/api': 'localhost:8080/curiosity/api/'
        'localhost': 'localhost:8082'

proxy.createServer opts .listen 80

console.log "Proxy listening on port 80 .."
