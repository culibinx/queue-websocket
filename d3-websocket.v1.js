/*
 * Copyright 2017 culibinx@gmail.com
 *
 * This module is not part of the project d3js, although it is designed as an extension. 
 * In order to make it convenient to connect depending on export.
 * The rest of the dependencies are located here https://d3js.org
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND!
*/

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-collection'), require('d3-dispatch')) :
  typeof define === 'function' && define.amd ? define(['exports', 'd3-collection', 'd3-dispatch'], factory) :
  (factory((global.d3 = global.d3 || {}),global.d3,global.d3));
}(this, (function (exports,d3Collection,d3Dispatch) { 'use strict';

if (typeof(WebSocket) == 'undefined' && typeof(MozWebSocket) != 'undefined') WebSocket = MozWebSocket;

var websocket = function(url, data, callback) {
  var websocket,
      event = d3Dispatch.dispatch("load", "error"),
      ws = (typeof url === "string") ? new WebSocket(url) : url,
      response,
      interval = 25,
      timeout = 5000;

  "onopen" in ws
      ws.onopen = ws.onerror = ws.onclose = ws.onmessage = respond

  function respond(o) {
    var state = ws ? ws.readyState : -1, result;
    // readyState [-1, CONNECTING = 0, OPEN = 1, CLOSING = 2, CLOSED = 3];
    if (state == 1 && o) {
      if (o.data) {
        if (o.data instanceof Blob) {
            var reader = new window.FileReader();
            reader.readAsText(o.data);
            reader.onloadend = function() {
                if (response) {
                  try {
                    result = response.call(websocket, reader.result);
                  } catch (e) {
                    event.call("error", websocket, e);
                    return;
                  }
                } else {
                  result = reader.result;
                }
                event.call("load", websocket, result);
            }
        } else {
            if (response) {
              try {
                result = response.call(websocket, o.data);
              } catch (e) {
                event.call("error", websocket, e);
                return;
              }
            } else {
              result = o.data;
            }
            event.call("load", websocket, result);
        }
      }
    } else {
      if (state > 1) {
        // try reopen websocket connection on this error
        event.call("error", websocket, 'CLOSED');
      } else {
        // check this error
        event.call("error", websocket, o);
      }
    }
  }

  websocket = {
    timeout: function(value) {
      if (!arguments.length) return timeout;
      timeout = +value;
      return websocket;
    },

    interval: function(value) {
      if (!arguments.length) return interval;
      interval = +value;
      return websocket;
    },

    // Specify how to convert the response content to a specific type;
    // changes the callback value on "load" events.
    response: function(value) {
      response = value;
      return websocket;
    },

    // If callback is non-null, it will be used for error and load events.
    send: function(callback) {
      if (callback == null && typeof data === "function") callback = data, data = null;
      if (callback != null && callback.length === 1) callback = fix_callback(callback);
      if (callback != null) websocket.on("error", callback).on("load", function(ws) { callback(null, ws); });
      (function ready_send (i) {          
         setTimeout(function () {   
            if (ws.readyState != 1 && (i-=interval)) {
              ready_send(i);
            } else {
              if (ws.readyState != 1) {
                event.call("error", websocket, 'timeout expired: ' + ws.url);
              } else {
                ws.send(data?data:'');
              }
            }
         }, interval)
      })(timeout);
      
      return websocket;
    },

    abort: function() {
      return websocket;
    },

    close: function() {
      if (ws) ws.close();
      return websocket;
    },

    on: function() {
      var value = event.on.apply(event, arguments);
      return value === event ? websocket : value;
    }
  };

  if (callback != null && ws) {
    if (typeof callback !== "function") throw new Error("invalid callback: " + callback);
    if (data == null || !data.length) throw new Error("empty data");
    return websocket.send(callback);
  }

  return websocket;
};

function fix_callback(callback) {
  return function(error, ws) {
    callback(error == null ? ws : null);
  };
}

exports.websocket = websocket;

Object.defineProperty(exports, '__esModule', { value: true });

})));
