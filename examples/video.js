(function() {
	
	var videos = [
		{
			url: 'http://h.imguol.com/1501/23metron.jpg',
			name: 'Video 1'
		}
	];
	
	function myfun() {
		this.mount();
		
		this.dom.onclick = function() {
			instances.slide.apply(function() {
				if (this.isRunning())
					this.stop();
				else
					this.start();
			});
		}
	}
	
	expose.init = myfun;
	expose.template = '{{#videos}}<p>{{name}}<br/><img src="{{url}}"/></p>{{/videos}}';
	expose.videos = videos;
})();