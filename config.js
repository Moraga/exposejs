(function(undefined) {
	'use strict';
	
	/**
	 * Main aliases
	 * @var object
	 */
	var alias = {
		// title: 'some.large.path.from.config'
	};
	
	// set up your config variable
	var config = window.config || {};
	
	expose.selector = false;
	
	/**
	 * Gets a config property value
	 * @param string prop Path or alias of the property
	 * @param mixed empty Alternative value when undefined
	 * @return mixed
	 */
	expose.get = function(prop, empty, chunk) {
		for (prop=(alias[prop] || prop).split('.'), chunk=config; chunk && prop.length; chunk=chunk[prop.shift()]);
		return chunk !== undefined ? chunk : empty;
	};
})();