/**
 * Expose
 * Object design, include, inheritance and js/css loader
 */

'use strict';

/**
 * Expose definition object
 * @var {Object}
 */
var expose;

/**
 * Libraries loaded
 * @var {Object}
 */
var lib = {};

/**
 * Instances container
 * @var {Object}
 */
var instances = {};

//
//  Shortcuts
//
var slice = Array.prototype.slice;

/**
 * Define a expose lib
 * @param {String} name Lib name
 * @param {Array} dependencies
 * @param {Function callback
 */
function def(name, dependencies, callback) {
	// builder function
	function make() {
		// applies the callback
		if (callback) {
			expose = {};
			callback.apply(null, dependencies.map(function(dependency) {
				return lib[dependency];
			}));
		}
		
		// two types of libraries
		// classes
		if ('init' in expose) {
			// class
			function F() {
				def.init(this, F, slice.call(arguments, 0));
			}
			
			// definition
			F.prototype = expose;
			
			// appends def prototype (base inheritance)
			for (var prop in def.prototype) {
				if (typeof F.prototype[prop] == 'undefined') {
					F.prototype[prop] = def.prototype[prop];
				}
			}
			
			// constructor data
			F.selector = 'selector' in expose ? expose.selector : '.' + name;
			F.template = 'template' in expose ? expose.template : false;
			F.inherit  = expose.inherit  || [];
			F.include  = expose.include  || [];
			F.mode     = 'normal';
			F.class	   = name;
			
			// initialization mode
			for (var mode in def.mode) {
				var index = F.include.indexOf(mode);
				if (index != -1) {
					F.mode = mode;
					if ('include' in def.mode[mode]) {
						F.include[index] = def.mode[mode].include;
					}
					else {
						F.include.splice(index, 1);
					}
				}
			}
			
			// registers
			lib[name] = F;
			instances[name] = [];
		}
		// static objects
		else if (Object.keys(expose).length) {
			expose.inherit = expose.inherit || [];
			expose.include = expose.include || [];
			lib[name] = expose;
		}
		// nothing to do
		// else {}
	}
	
	// runs builder after load all dependencies
	dependencies && dependencies.constructor == Array
		? load(dependencies.slice(0), make, null, true)
		: make(callback = dependencies, dependencies = []);
}

/**
 * Initialize expose classes
 * @param {Function} F Class
 * @param {mixed} args
 * @param {Function} callback
 */
def.init = function(obj, F, args, callback) {
	// register pending init
	++def.done.count;
	
	// sync initialization
	todo(
		// inheritance
		function(done) {
			F.inherit.length ?
				load(F.inherit, done, function(name, S) {
					var dest = F.prototype || F;
					var base = S.prototype || S;
					for (var prop in base) {
						if (typeof dest[prop] == 'undefined') {
							dest[prop] = base[prop];
						}
					}
				}, true) : done();
		},
		// includes as composition
		function(done) {
			F.include.length ?
				load(F.include, done, function(name, S) {
					(F.prototype || F)[name] = S;
				}, true) : done();
		},
		// load template
		function(done) {
			if (F.template) {
				// DOM Element
				if (F.template.indexOf('\n') == -1) {
					try {
						var elem = document.querySelector(F.template);
						if (elem) {
							F.prototype.template = elem.innerHTML;
							F.template = '';
							done();
						}
					} catch (e) {}
				}
				// external file
				if (F.template.match(/^(https?:)?\/+[a-z0-9]|\..{2,4}$/)) {
					var xhr = new XMLHttpRequest;
					xhr.open('GET', F.template);
					xhr.onload = function() {
						F.prototype.template = xhr.responseText;
						F.template = '';
						done();
					};
					xhr.send();
				}
				// assumes the string
				else {
					F.prototype.template = F.template;
					F.template = '';
					done();
				}
			}
			else {
				done();
			}
		},
		// initialize
		function() {
			// set DOM element
			if (F.selector)
				obj.dom = args.shift();
			
			// call init by initialization mode
			if (typeof obj.init == 'function')
				def.mode[F.mode || 'normal'].init(obj, args);
			
			// register to instances
			instances[F.class].push(obj);
			
			// objects loaded (one or set)
			if (--def.done.count == 0)
				def.done();
		}
	);
}

/**
 * Class initialization modes
 * @var {Object}
 */
def.mode = {};

// normal
def.mode.normal = {
	init: function(obj, args) {
		obj.init.apply(obj, args);
	}
};

// AngularJS
def.mode.angular = {
	include: 'https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular.min.js',
	// function fired once, override to new function or object
	module: function() {
		return angular.module('expose', []);
	},
	init: function(obj, args) {
		var timer = window.setInterval(function() {
			if (typeof angular != 'undefined') {
				if (typeof def.mode.angular.module == 'function')
					def.mode.angular.module = def.mode.angular.module();
				var controllerName = 'auto-' + Math.random();
				obj.dom.setAttribute('ng-controller', controllerName);
				def.mode.angular.module.controller(controllerName, obj.init);
				// start controller
				angular.element(obj.dom).ready(function() {
					angular.bootstrap(obj.dom, [def.mode.angular.module.name]);
				});
				timer = window.clearInterval(timer);
			}
		}, 50);
	}
};

/**
 * Expose classes prototype
 * Default properties and methods
 * @var {Object}
 */
def.prototype = {
	// event attacher (depends jQuery)
	on: function(event, selector, callback) {
		var scope = this;
		if (window === selector) {
			window.addEventListener(event, function(event) {
				callback.call(scope, event);
			});
		}
		else {
			$(this.dom).on(event, selector, function(event) {
				callback.apply(scope, arguments);
			});
		}
	},
	
	// template language (depends Mustache)
	mount: function() {
		this.dom.innerHTML = Mustache.to_html(this.template, this.data || this);
	},
	
	// evaluates strings
	parse: function(content, fail) {
		try {
			return JSON.parse(content) || fail;
		} catch (e) {}
		return fail;
	},
	
	// json request (depends jQuery)
	getjson: function(url, success, error) {
		var scope = this;
		
		// current page
		if (typeof url != 'string')
			url = '?' + $.param(url);
		
		// request object
		var request = {url: url, data: 'json'};
		
		// success callback
		if (success)
			request.success = function() {
				success.apply(scope, arguments);}
		
		// error callback
		if (error)
			request.error = function() {
				error.apply(scope, arguments);}
		
		return $.ajax(request);
	}
};

/**
 * Trigger expose init end callbacks
 */
def.done = function() {
	for (var i = 0; i < def.done.queue.length;
		def.done.queue[i++]());
}

/**
 * Items pending init
 * @var {number}
 */
def.done.count = 0;

/**
 * Expose init callback queue
 * @var {Array}
 */
def.done.queue = [];

/**
 * Expose inherit shortcut definition
 * @param {...String} libraries
 */
function inherit() {
	expose.inherit = (expose.inherit || []).concat(slice.call(arguments))
}

/**
 * Expose include shortcut definition
 * @param {...String} libraries
 */
function include() {
	expose.include = (expose.include || []).concat(slice.call(arguments));
}

/**
 * Renderizes DOM Elements and expose classes
 * @return {Array} New instances
 */
function render() {
	var init = [];
	
	for (name in lib) {
		var elem = lib[name].selector ? document.querySelectorAll(lib[name].selector) : [];
		for (var i = 0; i < elem.length; ++i) {
			if (elem[i].getAttribute('initiated') != 'true') {
				elem[i].setAttribute('initiated', 'true');
				init.push(new lib[name](elem[i]));
			}
		}
	}
	
	// triggers even nothing initialized
	if (!init.length)
		def.done();
	
	return init;
}

/**
 * Add callbacks to render done queue
 * @parma {Function} callback
 */
function ready(callback) {
	def.done.queue.push(callback);
}

/**
 * Javascript and Stylesheet/CSS loader
 * @param {string} item Filename/URL
 * @param {Function} callback
 * @param {Boolean} autoinit Initiate expose lib
 */
function load(list, callback, stepback, autoinit) {
	var item = list.shift();
	load[item.indexOf('.css') != -1 ? 'css' : 'js'].call(this, item, function(name, resource) {
		stepback && stepback.call(this, name, resource);
		list.length
			// continue loading the list (with a less)
			? load.call(this, list, callback, stepback, autoinit)
			// at end
			: callback && callback.call(this);
	}, autoinit);
}

/** 
 * Javascript loader
 * @param {string} item Filename/URL
 * @param {Function} callback
 * @param {Boolean} autoinit Initiate expose lib
 */
load.js = function(item, callback, autoinit) {
	var name = item.match(/([^\/?#]+)(?:\?|#|$)/)[1].replace('min.js', '');
	
	// already loaded
	if (name in lib) {
		return callback.call(this, name, lib[name]);
	}
	
	var head = document.getElementsByTagName('head')[0] || document.documentElement;
	var base = document.getElementsByTagName('base')[0];
	var node = document.createElement('script');
	var scope = this;
	
	node.type = 'text/javascript';
	node.async = true;
	
	// prepares expose
	expose = {};
	
	// on script load
	node.onload = node.onreadystatechange = function() {
		// fully loaded
		if (!node.readyState || /loaded|complete/.test(node.readyState)) {
			// remove event/bubble
			node.onload = node.onreadystatechange = null;
			node.parentNode.removeChild(node);
			
			// expose pattern
			if (Object.keys(expose).length) {
				def(item);
			}
			
			// depth load
			if (autoinit && item in lib) {
				def.init(lib[item], null, function() {
					callback && callback.call(scope, item, lib[item]);
				});
			}
			else {
				callback && callback.call(scope, item, lib[item]);
			}
		}
	}
	
	node.src = item + (item.indexOf('.js') == -1 ? '.js' : '');
	base ? head.insertBefore(node, base) : head.appendChild(node);
};

/**
 * Stylesheets/CSS loader
 * @param {string} item Filename/URL
 * @param {Function} callback
 * @param {Boolean} autoinit Initiate expose lib
 */
load.css = function(item, callback) {
	var head = document.getElementsByTagName('head')[0] || document.documentElement;
	var node = document.createElement('link');
	var scope = this;
	node.rel = 'stylesheet';
	node.href = item;
	node.onload = function() {
		callback && callback.call(scope, item);
	};
	head.appendChild(node);
};

/**
 * Queue fn execution
 * @param {Function} ...fn
 */
function todo() {
	var tasks = slice.call(arguments);
	var scope = this;
	tasks.shift().call(scope, function() {
		if (tasks.length)
			todo.apply(scope, tasks);
	});
}
