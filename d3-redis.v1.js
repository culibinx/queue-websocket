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
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-websocket')) :
  typeof define === 'function' && define.amd ? define(['exports', 'd3-websocket'], factory) :
  (factory((global.d3 = global.d3 || {}),global.d3,global.d3));
}(this, (function (exports,d3Websocket) { 'use strict';

// Helpers functions
if (!Array.prototype.isArray) Array.prototype.isArray = true;

function byte_count(s) {
    return encodeURI(s).split(/%..|./).length - 1;
}

// Redis protocol

// send command
function data_to_redis(data)
{
  var msgs = '';
  if (!data || data == undefined || !data.isArray) {
    return '*1\r\n' + command_to_redis('PING');
  } 
  if (data.isArray) {
    var filtered = data.filter(function(n){ return n != undefined && n.length });
    if (!filtered.length)
      return msgs;
    for (var i = 0; i < filtered.length; i++) {
        msgs += command_to_redis(filtered[i]);
    }
    return '*' + filtered.length + '\r\n' + msgs;
  } 
  return msgs;
}

function command_to_redis(command)
{
  return '$' + byte_count(command) + '\r\n' + command + '\r\n';
}


// parse response
function parse_reply_result(result) {
    return {'data':parse_reply_message(result)};
}

function parse_reply_message(reply) {
    if (reply.indexOf('*') == 0) {
        var els = parse_reply_object(reply);
        return {'status':true,'elements':els};
    }
    return parse_reply(reply);
}

function parse_reply(el) {
    var status = false;
    var error = NaN;
    var text = el && el != 'undefined' ? el.split('\r\n')
                .filter(function(n){ return n != undefined && n.length  })
                .join('\r\n') : ''; 
    if (text.indexOf('+') == 0 || text.indexOf(':') == 0 || text.indexOf('$') == 0) {
        // ok
        status = true;
        if (text.indexOf('$') == 0) {
          var arr = el.split('\r\n');
          if (arr.length > 1) {
            var len = arr.shift().substring(1);
            arr.pop();
            text = arr.join('\r\n');
            return {'status':status,'len':len,'body':text};
          } else {
            return {'status':'false','error':'unknown'};
          }
        } else {
          text = text.substring(1);
          return {'status':status,'body':text};
        }
        
    } else if (text.indexOf('-') == 0) {
        // error
        text = text.substring(1);
        var arr = text.split(' ');
        error = arr.shift();
        text = arr.join(' ');
    }
    return {'status':status,'error':error,'body':text};
}

function parse_reply_object(reply) {
    var els = {};
    // check null
    if (!reply || reply === undefined) return els;
    var ptr = 0;
    var length = reply.length;
    // check length
    if (!length || !reply_is_count(reply,ptr)) return els;
    // find count elements
    var pointer_el = find_count_reply(reply,ptr,length);
    var count_el = pointer_el[0];
    ptr = pointer_el[1];
    // check count elements
    if (!count_el || ptr >= length) return els;
    // element cycle
    var name = undefined;
    var length_el = 0;
    for (var el = 0; el < count_el*2; el++) {
    //for (;;) {
      // find length name or check value is
      if (!length_el && reply_is_count(reply,ptr)) {
          var value_is_count = reply_value_is_count(reply,ptr);
          var value_is_subarray = reply_value_is_subarray(reply,ptr);
          var pointer_args = find_count_reply(reply,ptr,length);
          length_el = pointer_args[0];
          ptr = pointer_args[1];
          // value is count
          if (value_is_count) {
            if (name !== undefined) {
              els[name] = length_el;
              name = undefined;
            }
            length_el = 0;
          }
          // value is subarray
          if (value_is_subarray) {
            var ptr_sub = ptr;
            var els_sub = [];
            for (var el_sub = 0; el_sub < length_el; el_sub++) {
              var value_is_ok_string = reply_value_is_ok_string(reply,ptr_sub);
              var pointer_args_sub = find_count_reply(reply,ptr_sub,length);
              var length_el_sub = pointer_args_sub[0];
              var start = 0;
              var end = 0;
              if (value_is_ok_string || !length_el_sub) {
                start = ptr_sub;
                end = pointer_args_sub[1]-2;
                if (value_is_ok_string)
                  start++;
              } else {
                start = pointer_args_sub[1];
                end = start + length_el_sub;
              }
              var body = reply.substring(start,end);
              // disable empty value
              if (start < end)
                els_sub.push(body);
              ptr_sub = end + 2;
              // check eof
              if (ptr_sub > length) break;
            }
            if (name == undefined) {
                name = '0';
            }
            els[name] = els_sub;
            name = undefined;
            ptr = ptr_sub;
            length_el = 0;
          }
      } 
      // name or value
      else {
          var start = ptr;
          var end = start + length_el;
          ptr = end + 2;
          var body = reply.substring(start,end);
          if (name !== undefined) {
            els[name] = body;
            name = undefined;
          } else {
            name = body;
          }
          length_el = 0;
      }
      // check eof
      if (ptr > length) return els;
    }
    return els;
}

function reply_is_count(reply,start) {
  var prefix = reply.substring(start,start+1);
  return (prefix == '*' || prefix == '$' || prefix == ':');
}

function reply_value_is_count(reply,start) {
  var prefix = reply.substring(start,start+1);
  return (prefix == ':');
}

function reply_value_is_ok_string(reply,start) {
  var prefix = reply.substring(start,start+1);
  return (prefix == '+');
}

function reply_value_is_error_string(reply,start) {
  var prefix = reply.substring(start,start+1);
  return (prefix == '-');
}

function reply_value_is_subarray(reply,start) {
  var prefix = reply.substring(start,start+1);
  return (prefix == '*');
}

function find_count_reply(reply, start, length, prefix) {
  var ptr = parseInt(start);
  var len = parseInt(length);
  if (!len) { len = reply.length; }
  var value = 0;
  while(ptr < len) {
      if (!prefix || (prefix && reply[ptr] == prefix)) {
        ptr++;
        var _ptr = ptr;
        while(reply[ptr] != '\r' && reply[ptr+1] != '\n' && ptr < length) {
          ptr++;
        }
        value = parseInt(reply.substring(_ptr, ptr));
        ptr+=2;
        break;
      }
      ptr++;
  }
  return [value, ptr];
}

var redissocket = function(url, data, callback) {
  return d3.websocket(url, data_to_redis(data), callback).response(parse_reply_result);
}

exports.redis = redissocket;

Object.defineProperty(exports, '__esModule', { value: true });

})));
