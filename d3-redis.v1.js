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

function quick_uuid() {
    return 'm' + Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

function isObject(item) {
  return item !== null && typeof item === "object" && !Array.isArray(item) && item === Object(item);
}

function itemToArray(item) {
  var arr = [];
  if (item && item != undefined && item !== null) {
      if (isObject(item)) {
          for (var key in item) {
              if ( item.hasOwnProperty( key ) && typeof item[key] !== "function" ) {
                  arr = arr.concat(itemToArray(key));
                  arr = arr.concat(itemToArray(item[key]));
              }
          }
      } else if (item.isArray) {
          for (var i = 0; i < item.length; i++) {
              arr = arr.concat(itemToArray(item[i]));
          }
      } else {
          if (typeof item[key] !== "function" && item.length) 
              { arr.push(item); }
      }
  }
  return arr;
}

function arrayToItem(arr) {
  var item = {};
  if (arr && arr != undefined && arr !== null && arr.isArray) {
    for (var i = 0; i < arr.length; i+=2) {
      var key = arr[i];
      var val = (i+1) < arr.length ? arr[i+1] : '';
      item[key] = val;
    }
  }
  return item;
}

function byte_count(s) {
    return encodeURI(s).split(/%..|./).length - 1;
}

// Redis protocol

// send command
function data_to_redis(data)
{
  var msgs = '';
  var filtered = itemToArray(data);
  if (!filtered.length) return msgs;
  for (var i = 0; i < filtered.length; i++) {
      msgs += command_to_redis(filtered[i]);
  }
  return '*' + filtered.length + '\r\n' + msgs;
}
function command_to_redis(command)
{ return '$' + byte_count(command) + '\r\n' + command + '\r\n'; }

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

function parse_reply_custom(data_d) {
  var result = {status:false};
  if (!data_d.length) { return result; }
  var data_arr = data_d.split('\r\n');
  if (!data_arr.length) { result['error'] = data_d; return result; }
  var data_f = data_arr.shift();
  if (!data_arr.length) { result['error'] = data_d; return result; }
  data_arr.pop();
  var sub_f = data_f&&data_f.length?data_f.substr(0,1):'';
  var data_c;
  if (sub_f == '-') {
      result['error'] = data_f.substr(1) + (data_arr.length?'\r\n'+data_arr.join('\r\n'):'');
      result['status'] = false;
      return result;
  } else if (sub_f == ':') {
      data_c = parseInt(data_f.substr(1));
      result['body'] = ''+data_c;
      result['status'] = true;
      return result;
  } else if (sub_f == '+') {
      result['body'] = data_f.substr(1) + (data_arr.length?'\r\n'+data_arr.join('\r\n'):'');
      result['status'] = true;
      return result;
  } else if (sub_f == '$') {
      data_c = parseInt(data_f.substr(1));
      result['len'] = ''+data_c;
      result['status'] = true;
      result['body'] = data_arr.join('\r\n');
  } else if (sub_f == '*') {
      data_c = parseInt(data_f.substr(1));
      result['count'] = ''+data_c;
      result['status'] = true;
      result['elements'] = [];
      if (data_c) {
          data_f = data_arr.shift();
          sub_f = data_f&&data_f.length?data_f.substr(0,1):'';
          data_c = parseInt(sub_f == '$' || sub_f == '*' ? data_f.substr(1) : data_f);
          if (data_c) {
              data_d = data_arr.join('\r\n');
              var re = /\r\n[\*|\$][0-9]{1,}\r\n/g;
              data_arr = data_d.split(re);
              if (data_arr.length && data_arr[0].length) { data_arr[0] = data_arr[0].replace(/^[\*|\$][0-9]{1,}\r\n/g,''); }
              result['elements'] = data_arr;
          } else {
              result['body'] = data_f + (data_arr.length?'\r\n'+data_arr.join('\r\n'):'');
          }
      }
  } else {
      result['status'] = false;
      result['error'] = 'unknown';
      result['body'] = data_f + (data_arr.length?'\r\n'+data_arr.join('\r\n'):'');
  }
  return result;
}

var redissocket = function(url, data, callback) {
  return d3.websocket(url, data_to_redis(data), callback).response(parse_reply_result);
}

var redissocket_custom_parse_reply = function(url, data, callback) {
  return d3.websocket(url, data_to_redis(data), callback).response(parse_reply_custom);
}

exports.quick_uuid = quick_uuid;
exports.itemToArray = itemToArray;
exports.arrayToItem = arrayToItem;
exports.redis = redissocket;
exports.redisx = redissocket_custom_parse_reply;

Object.defineProperty(exports, '__esModule', { value: true });

})));
