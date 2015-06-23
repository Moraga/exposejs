'use strict';

var expose, lib = {}, instances = {};

function def(name, deps, setf) {
	function make() {
		setf && setf.apply(null, deps.map(function(item) {return lib[item]}), expose = {});
		// class definition
		if ('init' in expose) {
			function F() {
				def.init.apply(this, [F].concat(Array.prototype.slice.call(arguments, 0)));
			}
			// inheritance
			F.prototype = expose;
			for (var k in def.prototype)
				if (!(k in F.prototype))
					F.prototype[k] = def.prototype[k];
			// constructor
			F.selector = 'selector' in expose ? expose.selector : '.' + name;
			F.template = 'template' in expose ? expose.template : false;
			F.inherit = expose.inherit || [];
			F.include = expose.include || [];
			lib[name] = F;
			// registering
			instances[name] = [];
		}
		else if (Object.keys(expose).length) {
			expose.inherit = expose.inherit || [];
			expose.include = expose.include || [];
			lib[name] = expose;
		}
	}
	
	deps && deps.constructor == Array
		? load(deps.slice(0), make, null, true)
		: make(setf = deps, deps = []);
}

def.init = function(F, node, back) {
	todo.call(this,
		function(done) {
			F.inherit.length
				? load.call(this, F.inherit, done, function(name, S) {
					var dest = F.prototype || F, supr = S.prototype || S, prop;
					for (prop in supr)
						if (!(prop in dest))
							dest[prop] = supr[prop];
				}, true)
				: done();
		},
		function(done) {
			F.include.length
				? load.call(this, F.include, done, function(name, S) {
					(F.prototype || F)[name] = S;
				}, true)
				: done();
		},
		function(done) {
			if (F.template) {
				var xhr = new XMLHttpRequest;
				xhr.open('GET', F.template);
				xhr.onload = function() {
					F.prototype.template = xhr.responseText;
					done();
				};
				xhr.send();
			}
			else {
				done();
			}
		},
		function(done) {
			if (F.constructor == Function && this instanceof F) {
				this.dom = node;
				'init' in this && this.init();
			}
			back && back.call(this);
			done();
		}
	);
};

def.prototype.mount = function() {
	this.dom.innerHTML = Mustache.to_html(this.template, this.data || this);
};

def.prototype.on = function(ev, selector, back) {
	var items = this.dom.querySelectorAll(selector), self = this, i = 0;
	for (; i < items.length; i++) {
		items[i].addEventListener(ev, function(event) {
			back.call(self, this, event);
		}, true);
	}
};

function inherit() {
	expose.inherit = (expose.inherit || []).concat(Array.prototype.slice.call(arguments));
}

function include() {
	expose.include = (expose.include || []).concat(Array.prototype.slice.call(arguments));
}

function load(list, back, step, dept) {
	var item = list.shift();
	load.js.call(this, item, function(name, code) {
		step && step.call(this, name, code);
		list.length
			? load.call(this, list, back, step, dept)
			: back && back.apply(this);
	}, dept);
}

load.js = function(item, back, dept) {
	var name = load.js.re.exec(item)[1].replace('min.js', '');
	if (name in lib)
		return back.call(this, name, lib[name]);
	var head = document.getElementsByTagName('head')[0] || document.documentElement,
		base = document.getElementsByTagName('base')[0],
		node = document.createElement('script'),
		self = this;
	node.type = 'text/javascript';
	node.async = true;
	expose = {};
	node.onload = node.onreadystatechange = function() {
		if (!node.readyState || /loaded|complete/.test(node.readyState)) {
			node.onload = node.onreadystatechange = null;
			node.parentNode.removeChild(node);
			// inline
			if (!lib[item] && Object.keys(expose).length) {
				def(item);
			}
			// dept load
			if (dept && item in lib) {
				def.init(lib[item], null, function() {
					back && back.call(self, item, lib[item]);
				});
			}
			else {
				back && back.call(self, item, lib[item]);
			}
		}
	};
	node.src = item + (item.indexOf('.js') == -1 ? '.js' : '');
	base ? head.insertBefore(node, base) : head.appendChild(node);
};

load.js.re = /([^\/?#]+)(?:\?|#|$)/;

function render() {
	var name, elem, i, j = 0;
	for (name in lib) {
		elem = lib[name].selector ? document.querySelectorAll(lib[name].selector) : [];
		for (i = 0; i < elem.length; i++) {
			if (elem[i].getAttribute('initiated') != 'true') {
				elem[i].setAttribute('initiated', 'true');
				new lib[name](elem[i]);
				j++;
			}
		}
	}
	return j;
}

function todo() {
	var tasks = Array.prototype.slice.call(arguments), scope = this;
	tasks.shift().call(scope, function() {
		if (tasks.length)
			todo.apply(scope, tasks);
	});
}