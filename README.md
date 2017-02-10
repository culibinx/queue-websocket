### Preface

In most cases the data cell through WebSocket not complicated.
Just create the WebSocket, connect, write a callback function to receive the results and send the data to the socket.
It's only good if you accept the data irrespective of the dispatch - asynchronously. While basically all always in javascript asynchronously.

It is much harder to manage these connections, send data synchronously. And depending on which sending data, process them in various ways. For these purposes, the most suitable XMLHttpRequest.

But we need is WebSocket, that send and analyze the data only. Through websocket can manage time off connections without browser limitations, and does not care about that at some proxies do not pass the http headers protocol or some cookie. You can send binary data without any problems with the mime encoding, well, and finally, to build its own protocol.

### Implementation

As a basis, use d3js library. Modules of d3-websocket and d3-redis me were written in the notation d3js, then to export them comfortably.
Please note that these modules nothing to d3js-project have not. They only use its modules.

For more information d3js library can be found at [d3js Wiki](https://github.com/d3/d3/wiki).

In the examples below, you can connect a full library d3.v4.min.js or only specific modules related to the solution of (d3-queue, d3-collection, d3-dispatch).

```html
<!-- use d3js full library -->
<script src="https://d3js.org/d3.v4.min.js"></script>
<!-- or d3js specific modules -->
<script src="https://d3js.org/d3-queue.v3.min.js"></script>
<script src="https://d3js.org/d3-collection.v1.min.js"></script>
<script src="https://d3js.org/d3-dispatch.v1.min.js"></script>
<!-- and implementation websocket -->
<script src="./d3-websocket.v1.js"></script>
<script src="./d3-redis.v1.js"></script>
```

### Examples

**At the same time we send different requests to different resources**
```html
<script src="https://d3js.org/d3.v4.min.js"></script>
<script src="./d3-websocket.v1.js"></script>
<script type="text/javascript">
/* 
    If you send messages in the queue asynchronously, 
    use different websocket handlers 
*/
var url = "ws://echo.websocket.org/"; 
var url_ssl = "wss://echo.websocket.org/"; 
var wsocket = new WebSocket(url);
var wsocket_ssl = new WebSocket(url);
d3.queue()  /* queue async */
    .defer(d3.websocket, wsocket, 'ping to ws')
    .defer(d3.websocket, wsocket_ssl, 'ping to wss')
    .awaitAll(function(error, responses) {
        if (error) throw error;
        console.log('response from ws: ' + resp_ws);
        console.log('response from wss: ' + resp_wss);
        // Do not forget to close the connection is no longer required.
        wsocket.close();
        wsocket_ssl.close();
    });
</script>
```

**Consistently send different requests to different resources**
```html
<script src="https://d3js.org/d3.v4.min.js"></script>
<script src="./d3-websocket.v1.js"></script>
<script type="text/javascript">
var url = "ws://echo.websocket.org/"; 
var url_ssl = "wss://echo.websocket.org/"; 
var wsocket = new WebSocket(url);
var wsocket_ssl = new WebSocket(url);
d3.queue(1) /* queue serial */
    .defer(d3.websocket, wsocket, 'ping to ws')
    .defer(d3.websocket, wsocket_ssl, 'ping to wss')
    .await(function(error, resp1, resp2) {
        if (error) throw error;
        console.log('response from ws: ' + resp1);
        console.log('response from wss: ' + resp2);
        wsocket.close();
        wsocket_ssl.close();
    });
</script>
```

**Consistently send different requests to the same resource**
```html
<script src="https://d3js.org/d3.v4.min.js"></script>
<script src="./d3-websocket.v1.js"></script>
<script type="text/javascript">
var url = "ws://echo.websocket.org/"; 
var wsocket = new WebSocket(url);
d3.queue(1) /* queue serial */
    .defer(d3.websocket, wsocket, 'ping to ws')
    .defer(d3.websocket, wsocket, 'what time is it')
    .await(function(error, ping, resp_one) {
        if (error) throw error;
        if (resp_one == "two o'clock pm") {
            console.log("It's time to go");
            wsocket.close();
        } else {
            d3.queue(1) /* queue serial */
                .defer(d3.websocket, wsocket, 'another discussion')
                .await(function(error, resp_another) {
                    if (error) throw error;
                    console.log('resp_another from ws: ' + resp_another);
                    wsocket.close();
                });
        }
    });
</script>
```

### Processing Redis protocol

D3-redis module was added as an experiment, and is used as a protocol handler [Redis](https://redis.io) through websoket. As parameters for the command is passed an array of strings.

```html
<script src="https://d3js.org/d3.v4.min.js"></script>
<script src="./d3-websocket.v1.js"></script>
<script src="./d3-redis.v1.js"></script>
<script type="text/javascript">
var url = "ws://url_to_websocket_redis"; 
var wsocket = new WebSocket(url);
d3.queue(1) /* queue serial */
    .defer(d3.redis, wsocket, ['PING'])
    .defer(d3.redis, wsocket, ['SET', 'key1', 'value1'])
    .defer(d3.redis, wsocket, ['GET', 'key1'])
    .await(function(error, ping, set, get) {
        if (error) throw error;
        console.log(ping);
        console.log(set);
        console.log(get);
        wsocket.close();
    });
</script>
```

To get "url_to_websocket_redis" you can use such methods:

1. [Websockify](https://github.com/novnc/websockify)
2. Apache HTTP Server + [mod_lua](https://httpd.apache.org/docs/2.4/mod/mod_lua.html) + Lua sockets
3. Apache HTTP Server + mod_cgi + custom wrappers of any interpretators
3. Nginx + custom wrappers of any interpretators
4. other methods and other servers ...

You can put such experiments [mod_websocket_connect](https://github.com/culibinx/mod_websocket_connect) for the Apache HTTP Server. But it is without warranty of any kind, only in test mode.

Of course, the opening of Redis to an external network associated with [security issues](https://redis.io/topics/security).
But in most cases, reference may be made less accessible to a wide public. Allow access only from specific network addresses. Or use the tunnel connection.
If this is not enough. Then we can realize their authorization protocol during normal connection via WebSocket. Then translate (to proxy) connection to the protected mode in case of successful authentication.

### Protocol Processing Disque (Redis)

Protocol [Disque](https://github.com/antirez/disque) coincides with Redis. Therefore, you can also substitute d3.redis protocol handler.

```html
<script src="https://d3js.org/d3.v4.min.js"></script>
<script src="./d3-websocket.v1.js"></script>
<script src="./d3-redis.v1.js"></script>
<script type="text/javascript">
var url = "ws://url_to_websocket_disque"; 
var wsocket = new WebSocket(url);
d3.queue(1) /* queue serial */
    .defer(d3.redis, wsocket, ['PING'])
    .defer(d3.redis, wsocket, ['ADDJOB', 'test_queue', 'message body'])
    .defer(d3.redis, wsocket, ['GETJOB', 'NOHANG', 'FROM', 'test_queue'])
    .await(function(error, ping, addjob, getjob) {
        if (error) throw error;
        console.log(ping);
        console.log(addjob);
        console.log(getjob);
        wsocket.close();
    });
</script>
```

### Conclusion

I hope these ideas and achievements will be useful. If you have suggestions, comments, or you know how to do best - write.
