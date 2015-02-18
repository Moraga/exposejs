(function(undefined) {
	'use strict';
	
	/**
	 * Download control
	 * @var object
	 */
	var queue = {};
	
	expose.selector = false;
	
	/**
	 * Loads a JSONP
	 * @param string url JSONP URL
	 * @param function callback Função callback
	 * @return string A URL usada no carregamento
	 */
	expose.get = function(url, callback) {
		var name, wait;
		
		// callback parameter
		// fetch from url
		if (name = url.match(/(?:callback|jsonp?)=([^?&\b]+)/))
			name = name[1];
		else {
			// as open parameter=?
			url = url.replace(/([?&][^=]+=)\?/, function() {
				return arguments[1] + (name = '_');
			});
			
			// not set, set one
			if (!name)
				url += (url.indexOf('?') == -1 ? '?' : '&') + 'callback=' + (name = '_');
		}
		
		// defines the standard callback
		if (window[name] === undefined)
			window[name] = function(data) {
				queue[name][0][1](data);
				queue[name].shift();
				if (queue[name].length)
					load.js(queue[name][0][0]);
				else try {
					window[name] = undefined;
					delete window[name];
				} catch (e) {}
			};
		
		// there are urls with the same callback loading?
		// queuing and wait
		if (queue[name] && queue[name].length)
			queue[name].push([url, callback]);
		// queuing and starts loading
		else {
			queue[name] = [[url, callback]];
			load.js(url);
 		}
		
		return url;
	};
})();