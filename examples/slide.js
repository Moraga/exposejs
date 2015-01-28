
include('header', 'footer');

expose.template = 'slide.html';

expose.curr = 0;

expose.timer = null;

expose.start = function() {
	var self = this;
	this.timer = setInterval(function() {
		self.next();
	}, 2000);
};

expose.stop = function() {
	this.timer = clearInterval(this.timer);
};

expose.isRunning = function() {
	return !!this.timer;
}

expose.next = function() {
	var img = this.dom.getElementsByTagName('img'), pos = 0;
	if (++this.curr < img.length)
		pos = this.curr * -300;
	else
		this.curr = 0;
	img[0].style.marginLeft = pos + 'px';
};

expose.init = function() {
	this.images = [
		{src: 'http://h.imguol.com/1501/22infernon.jpg'},
		{src: 'http://h.imguol.com/1501/22carrosh.jpg'},
		{src: 'http://s.dynad.net/stack/5b53DuczDD5zhlwEaQhj8u6GVrdFfie6_SoPeS-nqlc.jpg'},
	];
	this.mount();
	this.start();
};