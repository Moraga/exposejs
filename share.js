(function(undefined) {
	'use strict';
	
	include('config');
	
	/**
	 * Share sources
	 *
	 * get: share data URL and callback function
	 * set: share destination URL
	 * win: window settings
	 *
	 * @var object
	 */
	var options = {
		comment: {},
		facebook: {
			get: ['http://graph.facebook.com/?id=http://www.uol.com.br/', function() {
				return this.shares;
			}],
			set: 'https://www.facebook.com/dialog/feed?app_id={{fid}}&display=popup&link={{&url}}&picture={{&image}}&name={{text}}&redirect_uri={{&redir}}',
			win: 'width=626,height=316,left=350,top=350'
		},
		gplus: {
			set: 'https://plus.google.com/share?url={{&url}}',
			win: 'width=500,height=436,left=350,top=350'
		},
		// mail: {
			// set: 'http://www.yoursiteservice.com/',
			// win: 'width=780,height=490,left=350,top=350'
		// },
		pinterest: {},
		twitter: {
			get: ['http://urls.api.twitter.com/1/urls/count.json?url={{&url}}', function() {
				return this.count;
			}],
			set: 'https://twitter.com/intent/tweet?url={{&url}}&text={{text}}&via={{via}}',
			win: 'width=450,height=270,scrollbars=yes,left=350,top=350'
		},
		whatsapp: {}
	};
	
	/**
	 * Items configuration
	 * @var array
	 */
	expose.conf = [];
	
	/**
	 * Blocked items (Not displayed)
	 * @var array
	 */
	expose.deny = [];
	
	/**
	 * More items (hidden on more button)
	 * @var array
	 */
	expose.more = [];
	
	/**
	 * Share data stack
	 * @var array
	 */
	expose.history = [];
	
	/**
	 * Share items
	 * @var array
	 */
	expose.items = [];
	
	/**
	 * Mustache template
	 * @var string
	 */
	expose.template = '' +
		'{{#items}}' +
		'<div class="{{name}} item {{flag}}" rel="{{name}}">' +
			'<div class="x">{{name}} <span></span></div>' +
			'{{#subitems}}' +
			'<div class="{{name}} item" rel="{{name}}">' +
				'<div class="x">{{name}} <span></span></div>' +
			'</div>' +
			'{{/subitems}}' +
		'</div>' +
		'{{/items}}';
	
	/**
	 * Renders the share bar
	 * @return bool
	 */
	expose.render = function() {
		var self = this, i = 0, len = this.conf.length, items;
		for (; i < len; i++) {
			if (this.conf[i] == 'more') {
				this.items.push({
					name: 'more',
					flag: 'hassub',
					subitems: Object.keys(options)
						.map(function(name) {
							return self.more.indexOf(name) > -1 || !self.more.length && self.deny.indexOf(name) == -1 && self.conf.indexOf(name) == -1 && options[name]
								? $.extend({name: name}, options[name])
								: null;
						})
						.filter(function(value) {
							return value !== null;
						})
				});
			}
			else {
				this.items.push($.extend({name: this.conf[i]}, options[name]));
			}
		}
		
		this.mount();
		
		for (items = document.querySelectorAll('.item'); i < items.length; i++) {
			items[i].onclick = function() {
				var rel = this.getAttribute('rel');
				if (options[rel] && options[rel].set) {
					if (options[rel].win)
						window.open(Mustache.to_html(options[rel].set, self.history[self.history.length - 1]), 'shareUOL', options[rel].win);
				}
			}
		}
	};
	
	/**
	 * Adds share data
	 * @param object data
	 * @param bool extend
	 * @return number Total items in the stack
	 */
	expose.push = function(data, extend) {
		return this.history.push(extend ? $.extend({}, this.history[0], data) : data);
	};
	
	/**
	 * Remove share data from stack (previous added)
	 * @return object|false The data removed or false, if just one
	 */
	expose.pop = function() {
		return this.history.length > 1 ? this.history.pop() : false;
	};
	
	/**
	 * Get shared info to populates the bar
	 * @return void
	 */
	expose.poplov = function() {
		var items = this.dom.querySelectorAll('.item'), i = 0, rel;
		for (; i < items.length; i++) {
			rel = items[i].getAttribute('rel');
			if (options[rel] && options[rel].get) {
				(function() {
					var xhr = new XMLHttpRequest,
						ele = items[i],
						opt = options[rel];
					xhr.open('GET', opt.get[0]);
					xhr.onload = function() {
						try {
							ele.querySelector('span').innerHTML = opt.get[1].call(JSON.parse(xhr.responseText));
						} catch (e) {}
					};
					xhr.send();
				})();
			}
		}
	};
	
	/**
	 * Get share sources (read-only)
	 * @return object
	 */
	expose.options = function() {
		return options;
	};
	
	
	/**
	 * Constructor
	 * @return void
	 */
	expose.init = function() {
		// get settings from tag attributes
		this.conf = this.dom.getAttribute('data-conf');
		this.conf = this.conf ? this.conf.split(/\s*,\s*/g) : Object.keys(options);
		this.deny = this.dom.getAttribute('data-deny');
		this.deny = this.deny ? this.deny.split(/\s*,\s*/g) : [];
		this.more = this.dom.getAttribute('data-more');
		this.more = this.more ? this.more.split(/\s*,\s*/) : [];
		
		// default share data
		this.push({
			date: new Date,
			description: '',
			fid: '',
			image: this.config.get('image'),
			url: window.location.href,
			redir: window.location.href,
			text: this.config.get('title', document.title),
		});
		
		this.render();
		this.poplov();
	};
})();