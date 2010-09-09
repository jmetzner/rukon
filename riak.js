// This file is provided to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file
// except in compliance with the License.  You may obtain
// a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

var Riak = function (port, host, settings) {
  port = port || 8098;
  host = host || 'localhost';

  this.defaults = Riak.prototype.mixin({}, this.defaults, settings);
  this.client = Riak.prototype.getClient(port, host);
}

Riak.prototype.defaults = {
  method: 'GET',
  interface: 'riak',
  headers: {},
  callback: function(response, meta) { Riak.prototype.log(response) },
  errback: function(response, meta) { Riak.prototype.log(meta.statusCode + ": " + response, 'error') },
  returnbody: false,
  debug: true
}

// db operations

Riak.prototype.get = function(bucket, key, options) {
  return this.execute(this.path(bucket, key), options);
}

Riak.prototype.remove = function(bucket, key, options) {
  options = this.ensure(options);
  options.method = 'DELETE';
  return this.execute(this.path(bucket, key), options);
}

Riak.prototype.save = function(bucket, key, data, options) {
  data = this.ensure(data);
  options = this.ensure(options);
  options.method = key ? 'PUT' : 'POST';
  options.data = data;

  return this.execute(this.path(bucket, key), options);
}

Riak.prototype.walk = function(bucket, key, spec, options) {

  var query = spec.map(function(unit) {
    return { link: { bucket: unit[0] || "_", tag: unit[1] || "_", keep: unit[2] ? true : false } };
  }),
    reduce = { reduce :{ language :"erlang", module: "riak_mapreduce", "function" :"reduce_set_union"}},
    map = { map: { name: "Riak.mapValuesJson"}};

  query.push(reduce, map);

  return this.mapReduce({ inputs: [[bucket, key]], "query": query }, options);
}

Riak.prototype.mapReduce = function(query, options) {
  options = this.ensure(options);
  options.interface = 'mapred';
  options.method = 'POST';
  options.headers = { 'content-type': 'application/json' };

  query.query.forEach(function(phase) {
    for (p in phase) { // map, reduce or link
      if (phase[p].language === undefined) {
        phase[p].language = 'javascript';
      };
    }
  })

  options.data = query;

  return this.execute('', options);
}

Riak.prototype.execute = function (url, options) {

  var self = this;
  options = Riak.prototype.mixin({}, this.defaults, options);

  return function(callback, errback) {

    callback = callback || options.callback;
    errback = errback || options.errback;

    if (options.headers['content-type'] === undefined) {
      options.headers['content-type'] = 'application/json';
    }

    if (options.headers['content-type'] === 'application/json') {
      try {
        options.data = self.toJSON(options.data);
      } catch (e) {} // no-op if error
    }

    var queryProperties = {};

    // known url params are added to the query
    ['r', 'w', 'dw', 'rw', 'nocache', 'returnbody', 'keys'].forEach(function(p) {
      if (options[p]) {
       queryProperties[p] = options[p];
      }
    });

    delete queryProperties.__keys__; // workaround for ext.js object prototype
    var query = self.toQuery(queryProperties);

    var path = '/' + options.interface + '/' + url + (query ? ('?' + query) : '');

    self.log(options.method.toUpperCase() + ' ' + path);

    Riak.prototype.executeInternal(self, path, options, callback, errback);

  }
}

// utils

Riak.prototype.path = function(bucket, key) {
  return bucket + '/' + (key ? key : '');
}

Riak.prototype.makeLinks = function(links) {
  var i = this.defaults.interface;
  return links.map(function(link) {
    link.tag = link.tag || "_";
    return '</' + i + '/' + link.bucket + '/' + link.key + '>; riaktag="' + link.tag + '"';
  }).join(", ");
}

Riak.prototype.toQuery = function(query) {
  // use boolean strings since riak expects those
  for (var k in query) {
    if (typeof query[k] == 'boolean') {
      query[k] = String(query[k]);
    }
  }
  return this.stringifyQuery(query);
}

Riak.prototype.toJSON = function(data) {
  return JSON.stringify(data, function(key, val) {
    if (typeof val == 'function') {
      return val.toString();
    }
    return val;
  });
}

Riak.prototype.ensure = function(obj) {
  return obj || {};
}

Riak.prototype.mixin = function() {

  // does not support only one argument

  var isArray = function(obj) {
      return obj.constructor == Array;
  },
    isFunction = function(obj) {
      Object.prototype.toString.call(obj) === "[object Function]";
    }

	// copy reference to target object
	var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !this.isFunction(target) ) {
		target = {};
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging object literal values or arrays
				if ( deep && copy && ( typeof copy === 'object' || this.isArray(copy) ) ) {
					var clone = src && ( typeof src === 'object' || this.isArray(src) ) ? src
						: this.isArray(copy) ? [] : {};

					// Never move original objects, clone them
					target[ name ] = Riak.prototype.mixin( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

// exports

if (typeof exports === 'object') {
 exports.common = Riak;
}