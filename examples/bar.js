
expose.name = 'BAR LIB';

expose.init = function() {
	this.dom.innerHTML = '' +
		'<h1>'+ this.name +'</h1>' +
		'<p>Content</p>';
};