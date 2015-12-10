/**
 * --------
 * ExposeJS
 * --------
 *
 * Object design, include, inheritance and js/css loader
 *
 */

/**
 * Objeto expose.
 * Todas as defições são feitas aqui.
 * Ao final de cada processamento o valor
 * é zerado para uma nova definição.
 * @var {Object}
 */
var expose;

/**
 * Índice de libs e componentes
 * Contém a estrutura para iniciar uma nova instância.
 * Um objeto expose processado alimenta essa lista.
 * Antes de carregar um novo recurso a lista é consultada.
 * @var {Object}
 */
var lib = {};

/**
 * Container de instâncias
 * Toda lib (com init) instânciada popula o objeto instances.
 * É possível consultar, rever instâncias e com a analise é
 * possível controlar melhor recursos alocados em cada página.
 * @var {Object}
 */
var instances = {};

//
//  Shortcuts
//
var slice = Array.prototype.slice;

/**
 * Processa um objeto expose
 * @param {String} name Nome/classificação
 * @param {Array} dependencies Array de depedências de primeiro nível.
 * Dependências de primeiro nível são carregadas antes de criar o novo pacote.
 * Depedências de segundo nível, definidas em chamadas de include() e inheirt() são
 * requiridas somente ao instanciar (e apenas na primeira vez) um objeto.
 * @param {Function} callback Função com as definições/regras da nova lib
 * @return void
 */
function def(name, dependencies, callback) {
	// construtor de pacotes/libs
	function make() {
		// executa o callback para obter as definições
		if (callback) {
			// apaga processamentos anteriores
			expose = {};
			callback.apply(null, dependencies.map(function(dependency) {
				return lib[dependency];
			}));
		}
		
		// há dois tipos genéricos de libs que podem
		// ser gerados por expose
		// 1) classes, que geram instâncias
		if ('init' in expose) {
			// classe
			function F() {
				// arrays em prototype iniciam viciados
				// o que é definido numa instância vai para o prototipo
				for (var prop in F.prototype)
					if ((F.prototype[prop] || {}).constructor == Array)
						this[prop] = F.prototype[prop].slice(0);
				// construtor (dependências, modo de inicialização e outras regras)
				def.init(this, F, slice.call(arguments, 0));
			}

			// popula o prototype da classe com as definições em expose
			F.prototype = expose;
			
			// acrescenta as definições do modelo geral
			for (var prop in def.prototype) {
				if (typeof F.prototype[prop] == 'undefined') {
					F.prototype[prop] = def.prototype[prop];
				}
			}
			
			// metadados para o construtor
			F.selector = 'selector' in expose ? expose.selector : '.' + name;
			F.template = 'template' in expose ? expose.template : false;
			F.inherit  = expose.inherit  || [];
			F.include  = expose.include  || [];
			F.mode     = 'normal';
			F.class	   = name;
			
			// configura o modo de inicialização
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
			
			// popula registros globais
			lib[name] = F;
			instances[name] = [];
		}
		// 2) ferramentas, conjunto de funções e propriedades
		else if (Object.keys(expose).length) {
			expose.inherit = expose.inherit || [];
			expose.include = expose.include || [];
			lib[name] = expose;
		}
		// outro tipo de lib?
		// else {}
		
		// limpa para um novo processamento
		expose = {};
	}
	
	// inicia o construtor de lib ao cumprir as depedências (se tiver)
	dependencies && dependencies.constructor == Array
		? load(dependencies.slice(0), make, null, true)
		: make(callback = dependencies, dependencies = []);
}

/**
 * Construtor de classes expose (toda lib que tiver init definido passa aqui)
 * @param {Function} F Class
 * @param {mixed} args
 * @param {Function} callback
 */
def.init = function(obj, F, args, callback) {
	// registro de instâncias pendentes
	++def.done.count;
	
	// passo-a-passo de definição
	todo(
		// cumpre a herança (inherit)
		function(done) {
			F.inherit.length ?
				// carrega as libs uma a uma e mescla seus protótipos
				// ou métodos e propriedades (um lib do tipo tool pode fazer parte de uma classe)
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
		// cumpre a composição (include)
		function(done) {
			F.include.length ?
				// carrega as libs uma a uma e cria sua referência
				load(F.include, done, function(name, S) {
					(F.prototype || F)[name] = S;
				}, true) : done();
		},
		// carregamento do template
		function(done) {
			if (F.template) {
				// template pode ser um elemento no DOM
				// expose.template = '.selector'
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
				// pode vir de uma fonte externa (xhr)
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
				// ou ser a própria string
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
		// inicialização
		function() {
			// init
			if (args !== false) {
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
			
			// dispara o callback do usuário (new lib(function...))
			if (typeof callback == 'function')
				callback();
		}
	);
}

/**
 * Modos de inicialização
 * Aqui é possível separar e expandir a interação de classes expose
 * Expose é um objeto simples, métodos e propriedades simples que podem
 * ser alterados para se adaptar a qualquer lib.
 * AngularJS tem seu modo de inicialização.
 * @var {Object}
 */
def.mode = {};

// modo normal
def.mode.normal = {
	init: function(obj, args) {
		obj.init.apply(obj, args);
	}
};

// modo AngularJS
def.mode.angular = {
	// dependência (core do AngularJS)
	include: 'https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular.min.js',
	// configura o app principal. essa função é executada
	// apenas uma vez e é redefinda pelo seu redtorno
	module: function() {
		return angular.module('expose', []);
	},
	init: function(obj, args) {
		// o init é disparado após o carregamento da depedência, no caso o angular
		// mas nem sempre o fim do carregamento do arquivo js significa que a lib
		// está pronta para uso. por isso o timeout
		var timer = window.setInterval(function() {
			if (typeof angular != 'undefined') {
				// define, se não estiver o app principal
				if (typeof def.mode.angular.module == 'function')
					def.mode.angular.module = def.mode.angular.module();
				// gera um novo aleatório para a controler
				var controllerName = 'auto-' + Math.random();
				obj.dom.setAttribute('ng-controller', controllerName);
				// encontra as depedência angular e guarda
				// esse processo é necessário para manter o this na controller
				// do angular com escopo da expose (include, inherit, etc)
				var fnstr = obj.init.toString();
				fnstr = fnstr.substr(fnstr.indexOf('(') + 1);
				fnstr = fnstr.substr(0, fnstr.indexOf(')')).split(/,\s*/);
				fnstr.push(obj.init.bind(obj));
				def.mode.angular.module.controller(controllerName, fnstr);
				// inicia a controller
				angular.element(obj.dom).ready(function() {
					angular.bootstrap(obj.dom, [def.mode.angular.module.name]);
				});
				timer = window.clearInterval(timer);
			}
		}, 50);
	}
};

/**
 * Protótipo base de classes expose.
 * Métodos e propriedades definidas aqui são comuns para todos objetos
 * Igual ao $.fn. do jQuery
 * @var {Object}
 */
def.prototype = {
	// montagem de template (deprecated)
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
	
	// json request (depende de jQuery)
	getjson: function(url, success, error) {
		var scope = this;
		
		// current page
		if (typeof url != 'string')
			url = '?' + $.param(url);
		
		url += '&dev';
		
		// request object
		var request = {url: url, data: 'json'};
		
		// fires getjson
		this.emit('getjson');
		
		// success callback
		if (success) {
			function callback() {
				success.apply(this, arguments);
				setTimeout(render, 10);
				this.emit('getjson:end');
			}

			request.success = function(data) {
				var arguments_ = arguments;
				if (data.components) {
					lib.components.load(data.components, function() {
						callback.apply(scope, arguments_);
					});
				}
				else {
					callback.apply(scope, arguments_);
				}
			}
		}
		
		// error callback
		if (error)
			request.error = function() {
				error.apply(scope, arguments);
				this.emit('getjson:end');
			}
		
		return $.ajax(request);
	},
	
	// retorna a instância modal ao qual a lib pertence, quando houver
	getModal: function() {
		var elem = this.dom;
		while (elem && elem.className) {
			if (elem.className.indexOf('modal-wrapper') != -1) {
				for (var i = instances.modal.length; i--; )
					if (instances.modal[i].dom === elem)
						return instances.modal[i];
				break;
			}
			elem = elem.parentNode;
		}
		return false;
	}
};

/**
 * Eventos artificiais
 * Fora dos eventos comuns no DOM
 */

/**
 * Namespace para eventos
 * @var {Object}
 */
var events = {};

/**
 * Array com os eventos registrados
 * @var {Array}
 */
events.events = [];

/**
 * Eventos em andamento (intervalado ou com timeout)
 * @var {Array}
 */
events.running = [];

/**
 * Registra um novo evento
 * @param {String} name Nome do evento
 * @param {Object} object Objeto principal ao qual o evento pertence
 * @param {Function} callback Função
 * @reeturn {Number} O índice do evento no array de eventos (momentâneo)
 */
events.push = function(name, object, callback) {
	return this.events.push([name, object, callback]) - 1;
};

/**
 * Dispara um evento
 * @param {String} name Nome do evento
 * @param {Object} objeto Objeto de referência
 * @param {Mixed} data Dados para o callback (como argumento)
 */
events.emit = function(name, object, data) {
	var item, holder, index;
	for (var i = 0; i < this.events.length; i++) {
		item = this.events[i];
		if (name == item[0] && (!object || object === item[1])) {
			// call user function
			holder = item[2].apply(item[1], data);
			// persistent
			if (holder) {
				// prepare
				holder.scope = item[1];
				holder.event = name;
				// create and register
				(function(ev) {				
					if ('timeout' in ev) {
						ev.id = setTimeout(function() {
							ev.call.call(ev.scope);
							ev.cancel();
						}, ev.timeout);
						
						ev.cancel = function() {
							// clear timeout checking
							if (ev.id)
								ev.id = clearTimeout(ev.id);
							// search and remove from running stack
							for (var i = events.running.length; i--; )
								if (events.running[i] === ev)
									break;
							
							if (i != -1)
								events.running.splice(i, 1);
						};
					}
					else if ('interval' in ev) {
						ev.id = setInterval(function() {
							ev.call.call(ev.scope);
						}, ev.interval);
						
						ev.cancel = function() {
							ev.id = clearInterval(ev.id);
							// search and remove from stack
							for (var i = events.running.length; i--; )
								if (events.running[i] === ev)
									break;
							if (i != -1)
								events.running.splice(i, 1);
						};
					}
					
					// register
					events.running.push(ev)
					
				})(holder);
			}
		}
	}
};

/**
 * Revoga (cancela) um evento em andamento
 * @param {String} name Nome do evento
 * @param {Object} objeto Objeto de referência
 */
events.revoke = function(name, object) {
	var item;
	for (var i = events.running.length; i--; ) {
		item = events.running[i];
		if (name == item.event && (!object || object === item.scope))
			item.cancel();
	}
};

/**
 * Remove um evento do registro
 * @param {String} name Nome do evento
 * @param {Object} objeto Objeto de referência
 */
events.off = function(name, object) {
	this.events = this.events.reduce(function(rest, item) {
		if (item[0] == name && (!object || object === item[1]))
			rest.push(item);
		return rest;
	}, []);
};

//
// Métodos para manipulação de eventos em objetos expose
//

/**
 * Adiciona um evento (no DOM/jQuery ou artificial)
 * @param {String} event Nome do evento
 * @param {String|Function} selector Seletor ou callback
 * @param {Function} callback
 */
def.prototype.on = function(event, selector, callback) {
	// DOM (requer jQuery)
	if (callback) {
		var scope = this;
		if (window === selector) {
			window.addEventListener(event, function(event) {
				callback.call(scope, event);
			});
		}
		else {
			$(this.dom).on(event, selector, function(event) {
				callback.call(scope, event, this);
			});
		}
	}
	// artificial (ver events)
	else {
		events.push(event, this, selector);
	}
};

/**
 * Remove um evento do DOM ou artificial
 * @param {String} event Nome do eventor
 * @param {String} selector Seletor para eventos no DOM
 */
def.prototype.off = function(event, selector) {
	// DOM (requer jQuery)
	if (selector) {
		$(selector, this.dom).off(event);
	}
	// artificial (ver events)
	else {
		events.off(event, this);
	}
};

/**
 * Dispara um evento no DOM ou artificial
 * @param {String} event Nome do eventor
 * @param {String} selector Seletor para eventos no DOM
 */
def.prototype.trigger = function(event, selector) {
	// DOM (requer jQuery)
	if (typeof selector == 'string' || selector instanceof jQuery)
		$(selector, this.dom).trigger(event);
	// artificial (ver events)
	else
		this.emit(event, selector);
};

/**
 * Dispara um evento artificial
 * @param {String} event Nome do eventor
 * @param {Mixed} data Dados como argumento para o callback
 */
def.prototype.emit = function(event, data) {
	events.emit(event, this, data);
};

/**
 * Revoga (cancela) um evento em andamento
 * @param {String} event Nome do eventor
 */
def.prototype.revoke = function(event) {
	events.revoke(event, this);
};

/**
 * Dispara um evento global (sem verificação de objeto)
 * @param {String} event Nome do eventor
 * @param {Mixed} data Dados como argumento para o callback
 */
def.prototype.transmit = function(event, data) {
	events.emit(event, null, data);
};

//
// Ferramentas de instâncias
//

/**
 * Executa métodos de componentes
 * @param {String} component Nome do componente
 * @param {String} method Método
 * @param {Mixed} args Dados para o método
 * @return {mixed}
 */
instances.$apply = function(component, method, args) {
	return component in instances && instances[component].length && typeof instances[component][0][method] == 'function'
		? instances[component][0][method].apply(instances[component][0], args)
		: undefined;
};

/**
 * Controle de carregamento de instâncias e callback
 * @return void
 */
def.done = function() {
	for (var i = 0; i < def.done.queue.length;
		def.done.queue[i++]());
}

/**
 * Número de instâncias pendentes
 * @var {number}
 */
def.done.count = 0;

/**
 * Fila de callbacks de inicialização de instâncias
 * @var {Array}
 */
def.done.queue = [];

//
// Funções auxiliares
// para o uso de expose
//

/**
 * Define depedências (de composição) da nova lib
 * @param {...String} libs
 */
function inherit() {
	expose.inherit = (expose.inherit || []).concat(slice.call(arguments))
}

/**
 * Define depedências (de herança) da nova lib
 * @param {...String} libs
 */
function include() {
	expose.include = (expose.include || []).concat(slice.call(arguments));
}

//
// Funções de manipulação geral
//

/**
 * Renderiza novos elementos no DOM
 * @return {Array} Novas instâncias
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
	
	// sempre após o render o done/ready é disparado
	// mesmo que nenhuma lib tenha sido inicializada (rever)
	if (!init.length)
		def.done();
	
	return init;
}

/**
 * Adiciona uma função na escuta de renderizações
 * @parma {Function} callback
 */
function ready(callback) {
	def.done.queue.push(callback);
}

/**
 * Carregador de Javascript e CSS externo
 * Interface única para Javascript e CSS, mas executa funções específicas para cada tipo
 * @param {Array} list Lista de URLs
 * @param {Function} callback Função executada após carregar todos os arquivos
 * @param {Function} stepback Função executa após o carregar cada arquivo
 * @param {Boolean} autoinit Autoinicializa (carrega dependências) libs expose
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
 * Carregado específico para Javascript
 * @param {string} item URL
 * @param {Function} callback
 * @param {Boolean} autoinit Autoinicializa libs expose
 */
load.js = function(item, callback, autoinit) {
	var name;
	
	// base de busca do arquivo
	//  não há barras, considera js de um componente
	// usa proxy do projeto
	if (item.indexOf('/') == -1) {
		name = item;
		item = 'http://jsuol.com.br/c/_template/v2/script.js?tpl=' + item;
	}
	// sem // busca o arquivo como base ao jsuol
	else if (item.indexOf('//') == -1) {
		name = item.substr(item.lastIndexOf('/') + 1);
		item = 'http://jsuol.com.br/c/_template/v2/' + item;
	}
	// path absoluto
	// nome da lib é extraído por expressão regular
	else {
		name = item.match(/([^\/?#]+)(?:\?|#|$)/)[1].replace('min.js', '');
	}
	
	// verifica se a lib já não foi carregada
	// toda lib carregada popula o registro global lib
	if (name in lib) {
		return callback.call(this, name, lib[name]);
	}
	
	// objetos para o carregamento
	var head = document.getElementsByTagName('head')[0] || document.documentElement;
	var base = document.getElementsByTagName('base')[0];
	var node = document.createElement('script');
	var scope = this;
	
	node.type = 'text/javascript';
	node.async = true;
	
	// limpa processamentos anteriores
	expose = {};
	
	// evento padrão - no carregamento do script
	node.onload = node.onreadystatechange = function() {
		// apenas quanto tiver totalmente carregado
		if (!node.readyState || /loaded|complete/.test(node.readyState)) {
			// remove rastros (previne bolha de execução)
			node.onload = node.onreadystatechange = null;
			node.parentNode.removeChild(node);
			// há expose, gerar lib
			if (Object.keys(expose).length) {
				def(item);
			}
			// autoinicialização
			// cumpre as depedências antes de executar o callback
			if (autoinit && item in lib) {
				def.init(lib[item], lib[item], false, function() {
					callback && callback.call(scope, item, lib[item]);
				});
			}
			// não é lib expose ou não deve ser autocarregada
			// executa callback geral
			else {
				callback && callback.call(scope, item, lib[item]);
			}
		}
	}
	
	// acrescenta extensão quando necessário
	// e inicia o carregamento do arquivo externo
	node.src = item + (item.indexOf('.js') == -1 ? '.js' : '');
	base ? head.insertBefore(node, base) : head.appendChild(node);
};

/**
 * Carregador específico de arquivos CSS
 * @param {string} item URL
 * @param {Function} callback
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
 * Execução em fila controlada (similar a promises)
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

/**
 * Ferramenta para clonar objetos
 * @return {Object}
 */
function clone(obj) {
	if (obj == null || typeof obj != 'object')
		return obj;
	var tmp = obj.constructor();
	for (var key in obj)
		if (obj.hasOwnProperty(key))
			tmp[key] = clone(obj[key]);
	return tmp;
}
