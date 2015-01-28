'use strict';

var expose, lib = {}, instances = {};

function load(deps, callback, step) {
	var dep = deps.shift(), clas;
	expose = {};
	load.js(dep, function() {
		!isEmpty(expose) && (clas = def(dep));
		step && step.call(null, dep, clas);
		deps.length ? load(deps, callback, step) : callback && callback();
	});
}

load.js = function(src, callback) {
	if (src in lib) {
		expose = lib[src].prototype;
		return callback();
	}
	var head = document.getElementsByTagName('head')[0] || document.documentElement,
		base = document.getElementsByTagName('base')[0],
		node = document.createElement('script');
	node.type = 'text/javascript';
	node.async = true;
	node.onload = node.onreadystatechange = function() {
		if (!node.readyState || /loaded|complete/.test(node.readyState)) {
			node.onload = node.onreadystatechange = null;
			node.parentNode.removeChild(node);
			callback && callback();
		}
	};
	node.src = src + '.js';
	base ? head.insertBefore(node, base) : head.appendChild(node);
};

load.css = function() {};

function render() {
	var k, elem, i;
	for (k in lib) {
		elem = lib[k].selector ? document.querySelectorAll(lib[k].selector) :
				(lib[k].initiated ? [] : [null]);
		if (elem.length) {
			lib[k].initiated = true;
			for (i=0; i < elem.length; i++) {
				if (elem[i]) {
					if (elem[i].getAttribute('init') == 'true')
						continue;
					else
						elem[i].setAttribute('init', 'true');
				}
				else if (!lib[k].init)
					continue;
				new lib[k](elem[i]);
			}
		}
	}
}

function todo() {
	var tasks = Array.prototype.slice.call(arguments), scope = this;
	tasks.shift().call(scope, function() {
		if (tasks.length)
			todo.apply(scope, tasks);
	});
}

function create(proto) {
	function F(dom) {
		var self = this;
		
		instances[F.nam].push(this);
		
		this.dom = dom;
		
		this.mount = function() {
			this.dom.innerHTML = Mustache.to_html(this.template, this.data || this);
		};
		
		todo.call(this,
			function(done) {
				this.inherit ?
					load(this.inherit.slice(0), done, function(name, clas) {
						for (var k in clas.prototype)
							if (typeof self[k] == 'undefined')
								self[k] = clas.prototype[k];
					}) : done();
			},
			function(done) {
				this.include ?
					load(this.include.slice(0), done, function(name, clas) {
						self[name] = new clas;
					}) : done();
			},
			function(done) {
				if (this.template && !F.template) {
					var node;
					if (this.template.match(/.\..{2,4}$/)) {
						var xhr = new XMLHttpRequest;
						xhr.open('GET', this.template);
						xhr.onload = function() {
							F.template = xhr.responseText;
							done();
						};
						xhr.send();
					}
					else {
						try {
							// /^[.#]?[a-z][a-z0-9-_]+(?:\s*[>]?\s*[.#]?[a-z][a-z0-9-_]+)+$/
							node = document.querySelector(this.template);
						} catch (e) {}
						F.template = node ? node.innerHTML : this.template;
						done();
					}
				}
				else {
					done();
				}
			},
			function(done) {
				this.template = F.template;
				if ('init' in this)
					this.init();
			}
		);
	}
	F.prototype = proto;
	return F;
}

function def(name, func) {
	var clas;
	func && func(expose = {});
	clas = create(expose);
	clas.nam = name;
	clas.selector = typeof expose.selector != 'undefined' ? expose.selector : '.' + name;
	clas.initiated = false;
	clas.init = !!expose.init;
	lib[name] = clas;
	if (!instances[name]) {
		instances[name] = [];
		instances[name].apply = function(exec) {
			for (var i=0; i < instances[name].length; exec.call(instances[name][i++]));
		};
	}
	return clas;
}

function inherit() {
	expose.inherit = (expose.inherit || []).concat(Array.prototype.slice.call(arguments));
}

function include() {
	expose.include = (expose.include || []).concat(Array.prototype.slice.call(arguments));
}

function extend(obj) {
	for (var i=1, len=arguments.length, k; i < len; i++)
		for (k in arguments[i])
			obj[k] = arguments[i][k];
	return obj;
}

function isEmpty(obj) {
	if (obj == null || obj.length === 0)
		return true;
	else if (obj.length > 0)
		return false;
	for (var key in obj)
		if (obj.hasOwnProperty(key))
			return false;
	return true;
}