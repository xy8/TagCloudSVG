/* ===================================================================
 *
 * Author: Robin van Westrenen-Broekmans
 * GitHub: https://github.com/tribbin/TagCloudSVG
 *
 * TagCloudSVG is a modern and highly customizable TagCloud using SVG.
 *
 * Code for quickly adding TagCloudSVG on your webpage:
 *
 *     <script src='tagcloudsvg.js' type='text/javascript'></script>
 *     <script>new TagCloudSVG();</script>
 *
 * But you want choose the position of the SVG-element and use your own data:
 *
 *     <script src='tagcloudsvg.js' type='text/javascript'></script>
 *
 *     <svg class='tagcloudsvg'></svg>
 *
 *     <script>
 *         var myData = [
 *             { "label": "Never gonna give you up," },
 *             { "label": "never gonna let you down." },
 *             { "label": "Never gonna run around" },
 *             { "label": "and desert you." },
 *             { "label": "Click me!", "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
 *         ];
 *         var myTagCloudSVG = new TagCloudSVG(myData);
 *     </script>
 *
 * Any default value or function in TagCloudSVG can be replaced:
 *
 *     myTagCloudSVG.config.fps = 20;
 *     myTagCloudSVG.config.fontSize = 50;
 *     myTagCloudSVG.cloud = myCloudData;
 *     myTagCloudSVG.animate = myAnimationFunction;
 *
 * For the newest version or more information, please visit:
 *
 *     https://github.com/tribbin/TagCloudSVG
 *
 * =================================================================== */

class TagCloudSVG {

	// Make new instance of TagCloudSVG, providing optional cloud-data and CSS-id.
	constructor(cloud = null, id = null) {

		this.cloud = [];

		// Set the Object's cloud-data that is provided as parameter.
		if (cloud) {
			this.cloud = cloud;
		} else {
			for (var i = 0; i < 50; i++) {
				var tag = {"label": i};
				this.cloud.push(tag);
			}
		}

		/* ===================================================================
		 * Code under this line are default configuration variables.
		 * Don't change these values; change your own TagCloudSVG:
		 *
		 *     myTagCloudSVG.config.fps = 20;
		 *     myTagCloudSVG.animate = myAnimationFunction;
		 *
		 * =================================================================== */
		this.config = {
			"fps": 30,		// Targeted number of frames per second for rendering.
			"fontSize": 80,		// Fixed SVG font-size for stepless scaling.
			"restackInterval": 500,	// Number of milliseconds between re-stacking the tags' elements.
		};

		// This function is called every time a frame is being rendered.
		this.animate = function() {
			this.rotateAndZoom(0.01,0.008,0.005,0.01);
		};

		/* ===================================================================
		   Code under this line are working-functions and -variables.
		   There should be no need to alter this code.
		   =================================================================== */

		// Drawing variables.
		this.drawing = {
			"boundry": 500,				// Rough SVG cloud size (radius from center) reference for projecting nodes.
			"zoom": 0,				// Initial Math.sin(zoom) Z-axis translation value.
			"rotx": 0, "roty": 0, "rotz": 0,	// Initial SVG node perspective variables; X, Y and Z rotation.
			"restackPending": true,			// Every restackInterval the restackPending will be set to true.
			"restackIndex": null,			// Position to restack from. This is a mystical variable.
			"lastAnimate": 0,			// This variable will be updated to Date.now() before every rendered frame for timing a constant frame-rate.
			"sipf": null,				// Sorted items per frame: tags.length/(restackInterval/(1000/fps)); will be updated when tags are added to the cloud.
		};

		// Decide the Object's SVG-element.
		if (id) {
			this.svg = document.getElementById(id); // If the CSS ids are given, you can use multiple instances of TagCloudSVG.
		} else {
			this.svg = document.getElementsByClassName('tagcloudsvg')[0] // No 'name' parameter value? Get the first tagcloudsvg.
			|| document.getElementsByTagName('svg')[0] // No class 'tagcloudsvg' found? Get the first SVG element.
			|| document.body.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg")); // No SVG element found? Create one.
		}

		// Set XML NameSpace to SVG standard.
		this.svg.setAttribute('xmlns','http://www.w3.org/2000/svg');

		// If no SVG viewBox is set, one will be set.
		if (!this.svg.hasAttribute('viewBox')) {
			this.svg.setAttribute('viewBox', '-960 -540 1920 1080');
		}

		// Generate node-coordinates for every tag and add these to the tags' JSON-data.
		this.addNodes();

		// Create SVG elements for all tags.
		for (var i = 0; i < this.cloud.length; i++) {
			this.addElement(this.cloud[i]);
		}

		// Periodically call for re-ordering of the SVG-elements to avoid rendering-mistakes of overlapping elements.
		this.requestRestack = function() {
			var restackPending = this.drawing.restackPending; // To avoid variable-scope issue in anonymous function.
			setInterval(
				function() {		 		  // This function.
					restackPending = true;		  // This variable.
				}
				,this.config.restackInterval
			);
		}

		// Render next frame.
		this.nextFrame = function() {

			var self = this; // To avoid variable-scope issue in anonymous function.

			// This is a special function-name to inform the browser that a frame is being rendered for fluid timing.
			requestAnimationFrame(
				function() {
					self.nextFrame();
				}
			);

			// Calculate how long ago animate() is called last.
			var now = Date.now();
			var delta = now - this.drawing.lastAnimate;

			// Limit rendering to config.fps frames-per-second.
			if (delta > 1000/this.config.fps) {
				this.drawing.lastAnimate = now - (delta % 1000/this.config.fps);
				this.animate();
				// Restack the SVG DOM-elements according to perspective's Z-axis.
				if(this.drawing.restackPending) {
					this.restackTagsFromIndex();
				}
			}

		}

		this.nextFrame();
	}



	// Add 'node' arrays with [x,y,z] coordinates to all tags in JSON data.
	addNodes() {

		var tagsWithoutNodes = this.cloud.filter(
			function(tag) {
				return (!tag.node);
			}
		);

		// Create semi-equally spread points on a sphere for all tags in the cloud.
		var coordinates = PointsOnSphere(tagsWithoutNodes.length);

		// Bind these points as node-coordinates to the tags.
		for (var i = 0; i < tagsWithoutNodes.length; i++) {
			tagsWithoutNodes[i].node = coordinates[i];
		}

	}

	// Return the rotated (rotx, roty, rotz) and zoomed (zoom) perspective coordinates for a node.
	// A node is an array of tree coordinates: [x,y,z].
	getPerspective(node) {

		var tmpy = [];
		var tmpx = [];
		var perspective = [];

		// Rotate around Y-axis
		tmpy[0] = node[2]*Math.sin(this.drawing.roty) - node[0]*Math.cos(this.drawing.roty);
		tmpy[1] = node[1];
		tmpy[2] = node[0]*Math.sin(this.drawing.roty) + node[2]*Math.cos(this.drawing.roty);

		// Rotate around X-axis
		tmpx[0] = tmpy[0];
		tmpx[1] = tmpy[2]*Math.sin(this.drawing.rotx) - tmpy[1]*Math.cos(this.drawing.rotx);
		tmpx[2] = tmpy[1]*Math.sin(this.drawing.rotx) + tmpy[2]*Math.cos(this.drawing.rotx);

		// Rotate around Z-axis
		perspective[0] = tmpx[1]*Math.sin(this.drawing.rotz) - tmpx[0]*Math.cos(this.drawing.rotz);
		perspective[1] = tmpx[0]*Math.sin(this.drawing.rotz) + tmpx[1]*Math.cos(this.drawing.rotz);

		// Translate Z-axis (zoom)
		perspective[2] = (Math.sin(this.drawing.zoom)/10) + tmpx[2];

		return perspective;
	}

	// Alter the perspective and projection of the SVG nodes.
	// The dx, dy, dz and dzoom parameters are deltas.
	// Math.sin(zoom) is used for X-axis translation.
	// A full 'wobble' with zoom: 2*Math.PI
	// A full rotation around an axis: 2*Math.PI
	rotateAndZoom(dx,dy,dz,dzoom) {

		this.drawing.rotx += dx;
		this.drawing.roty += dy;
		this.drawing.rotz += dz;

		this.drawing.zoom += dzoom;

		// Reposition the tags' SVG-elements.
		for (var i = 0; i < this.cloud.length; i++) {

			var tag = this.cloud[i];

			var x = 0;
			var y = 0;
			var z = 0;

			// Tags with 'inanimate' tag will never change perspective.
			if (tag.class.indexOf('inanimate') > -1) {

				x = tag.node[0];
				y = tag.node[1];
				z = tag.node[2];

			} else {

				// Get the tag's coordinates, corrected for X,Y & Z-axis rotation and zoom.
				var tagPerspective = this.getPerspective(tag.node);

				// Short variable names for easier reading of formulas.
				x = tagPerspective[0];
				y = tagPerspective[1];
				z = tagPerspective[2];

			}

			// Convert z range [-1 ... 1] to custom perspective scaling between [0 ... 1].
			var scaling = 1+z/3;

			// Projected 2D coordinates.
			var px = x*scaling*this.drawing.boundry;
			var py = y*scaling*this.drawing.boundry;

			// X & Y projection coordinate translation and Z projection scaling of tag.
			tag.element.setAttribute("transform", "translate(" + px + "," + py + "), scale(" + scaling + ")" );

			// Change opacity based on distance (projected Z-axis).
			tag.element.style.opacity = (z*2+5/2)/3;

		}

	}

	// Sort the tags' SVG-elements and restack them for correctly rendering overlapping tags.
	restack(start,end) {

		// If the restacking is started at (or above?) the top of the stack, the elements are sorted again.
		if(end >= this.elements.length-1) {
			// Sort elements by opacity; the opacity is in direct relation with the perspective's Z-axis distance.
			this.elements.sort(
				function(a, b) {
					// Use defined opacity; not the computer-calculated opacity.
					return a.style.opacity > b.style.opacity;
				}
			);
			end = this.elements.length-1;
			this.svg.appendChild(this.elements[end--]);
		}

		// Re-append the tags' SVG-elements in order. Appended DOM-nodes are not copied, but moved.
		for (var i = end; i >= start && i > -1; i--) {
			this.svg.insertBefore(this.elements[i],this.elements[i+1]);
		}

		// Done restacking? Reset variables. Or update the restackIndex.
		if (start <= 0) {
			this.drawing.restackPending = false;
			this.drawing.restackIndex = null;
		} else {
			this.drawing.restackIndex = start-1;
		}
	}

	// This function figures out where it left off restacking and continues. It works: don't touch it.
	restackTagsFromIndex() {
		if (!this.drawing.restackIndex) {
			this.drawing.restackIndex = this.elements.length-1;
		}
		this.restack(this.drawing.restackIndex-(this.drawing.sipf>1?this.drawing.sipf-1:0), this.drawing.restackIndex);
	}

	// This function adds a single SVG-element (representing a tag) to the SVG (representing the cloud).
	addElement(tag, hide = false) {

		// Create and insert SVG-element.
		tag.element = this.svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", tag.type ? tag.type : "text"));

		// Insert pre-defined attributes.
		if(tag.attributes) {
			for (var i = 0; i < tag.attributes.length; i++) {
				for (var property in tag.attributes[i]) {
					tag.element.setAttribute(property,tag.attributes[i][property]);
				}
			}
		}

		// Optional hiding of element to avoid it from popping up in the center at position x=0, y=0.
		if (hide) {
			tag.element.style.display = 'none';
		}

		// Add ID defined in JSON to the tag's SVG element.
		if (tag.id) {
			tag.element.id = tag.id;
		}

		// Add all classes defined in JSON to the tag's SVG element.
		if (tag.class) {
			for (var i=0; i < tag.class.length; i++) {
				tag.element.classList.add(tag.class[i]);
			}
		} else {
			// If tag.class does not exist in JSON, add empty Array for proper working of code.
			tag.class = [];
		}

		// Add default 'tag' class to all tag elements.
		tag.element.classList.add('tag');

		// Some actions that are SVG text-element specific.
		if (!tag.type || tag.type == 'text') {
			tag.element.setAttribute('font-size', this.config.fontSize); // Set the SVG text-element's font-size.
			tag.element.innerHTML = (tag.label ? tag.label : ""); // Add label of the tag as HTML text.

		}

		// Check if the tag has a link.
		if (tag.link) {

			// Create anchor-element.
			var anchor = this.svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg","a"));

			// Set link reference for anchor-element.
			anchor.setAttribute('href',tag.link);

			// Set class 'link' for the tag's original element.
			tag.element.classList.add('link');

			// Move 'tag' class from the tag's original element to the anchor element.
			tag.element.classList.remove('tag');
			anchor.classList.add('tag');

			// Wrap the anchor-element around the tag's-element.
			this.svg.replaceChild(anchor,tag.element);
			anchor.appendChild(tag.element);

			// The anchor-element is now the tag's main element.
			tag.element = anchor;
		}

		// Add the element to the elements-array.
		this.elements = Array.prototype.slice.call(this.svg.getElementsByClassName('tag'));

		// Recalculate the number of restacked items per frame.
		this.drawing.sipf = Math.floor(this.elements.length/(this.drawing.restackInterval/(1000/this.drawing.fps)));
	}
}

/* ===================================================================
   Code under this line is supporting code to make your life easier.
   =================================================================== */

// Get JSON from an URL. The callback parameter is optional, but necessary for actions that must be executed after JSON-retrieval.
// The callback-function must have two parameters: error (null if there is no error) and the data (if there is an error).
// Without a provided callback, the JSON data is returned. If the retrieval fails, null is returned.
function getJSON(url, callback = null) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, (callback));
	xhr.responseType = 'json';
	xhr.onreadystatechange = function() {
		if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
			if(callback) {
				callback(null, xhr.response);
			} else {
				return xhr.response;
			}
		}
	};
	xhr.onerror = function() {
		callback("JSON could not be retrieved.");
		return null;
	}
	xhr.send();
}


/* ===================================================================
   Code under this line is a piece of altered code from TagCanvas 1.12
   Copyright (C) 2010-2011 Graham Breach
   For more information, please contact <graham@goat1000.com>
   =================================================================== */

function PointsOnSphere(n) {
	var i, y, r, phi, pts = [], inc = Math.PI * (3-Math.sqrt(5)), off = 2/n;
	for(i = 0; i < n; ++i) {
		y = i * off - 1 + (off / 2);
		r = Math.sqrt(1 - y*y);
		phi = i * inc;
		pts.push([Math.cos(phi)*r, y, Math.sin(phi)*r]);
	}
	return pts;
}
