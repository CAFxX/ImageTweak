/************************************************************************************************************************************************************	

	ImageTweak
	2006-2009 CAFxX
	http://cafxx.strayorange.com

	LICENSE
		This program is free software: you can redistribute it and/or modify
		it under the terms of the GNU General Public License as published by
		the Free Software Foundation, either version 3 of the License, or
		(at your option) any later version.

		This program is distributed in the hope that it will be useful,
		but WITHOUT ANY WARRANTY; without even the implied warranty of
		MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
		GNU General Public License for more details.

		You should have received a copy of the GNU General Public License
		along with this program.  If not, see <http://www.gnu.org/licenses/>.
		
************************************************************************************************************************************************************/

var ImageTweak = {
	Helper: {
		// shamelessly taken from mozilla/browser/base/content/nsContextMenu.js
		GetComputedURL: function GetComputedURL(aElem, aProp) { 
			var url = aElem.ownerDocument.defaultView.getComputedStyle(aElem, "").getPropertyCSSValue(aProp);
			return url.primitiveType == CSSPrimitiveValue.CSS_URI ? url.getStringValue() : null;
		},

		// clips value to min < value < max
		Clip: function Clip(value, min, max) {
			if ( typeof(max) == "undefined" ) {
				max = Math.abs(min);
				min = -min;
			}
			return Math.min( max, Math.max( value, min ) );
		},
		
		// generate a random 32 bit integer (I know, there are better ways)
		Random: function Random() {
			var R=0, i, j;
			while ( R == 0 ) {
				for (i=0, j=1; i<8; i++, j=j*16) {
					R += Math.floor( Math.random() * 17 ) * j;
				}
			}
			return R;
		},
		
		// compare the running version of firefox to the one passed
		// returns <0, 0, >0 if the running version is older, the same or newer, respectively
		ComparePlatformVersionNumber: function ComparePlatformVersionNumber(compareVersion) {
			var info = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);  
			var currentVersion = info.version.split("."); // Returns "2.0.0.1" for Firefox version 2.0.0.1  
			var compareVersion = compareVersion.split(".");
			for ( i=0; i<4; i++ ) {
				if ( typeof(currentVersion[i]) == "undefined" ) 
					currentVersion[i] = 0; 
				else 
					currentVersion[i] = parseInt(currentVersion[i]);
				if ( typeof(compareVersion[i]) == "undefined" ) 
					compareVersion[i] = 0; 
				else 
					compareVersion[i] = parseInt(compareVersion[i]);
				if ( compareVersion[i] != currentVersion[i] ) 
					return currentVersion[i] - compareVersion[i];
			}
			return 0;
		},
		
		// return the current version of ImageTweak
		GetVersion: function GetVersion() {
			return Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{DB2EA31C-58F5-48b7-8D60-CB0739257904}").version;	
		},
		
		// opens a new tab and browse to the specified URL
		Browse: function Browse(url) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
			var browser = wm.getMostRecentWindow("navigator:browser").getBrowser();
			browser.selectedTab = browser.addTab(url);
		},
		
		// this function prints msg to the error console
		// for release builds it's a no-op
		log: function(msg) { 
/**/			ImageTweak.Helper.console.logStringMessage( "ImageTweak " + arguments.callee.caller.name + ( typeof(msg) != "undefined" ? " " + msg : "" ) );
		},
/**/	
/**/		console: Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService),
/**/	
/**/		dump: function(arr,level) {
/**/			var dumped_text = "";
/**/			if(!level) level = 0;
/**/			if (level>0) return "";
/**/
/**/			//The padding given at the beginning of the line.
/**/			var level_padding = "";
/**/			for (var j=0;j<level+1;j++) level_padding += "    ";
/**/
/**/			if(typeof(arr) == 'object') { //Array/Hashes/Objects
/**/				for(var item in arr) {
/**/					var value = arr[item];
/**/
/**/					if(typeof(value) == 'object') { //If it is an array,
/**/						dumped_text += level_padding + "'" + item + "' ...\n";
/**/						dumped_text += ImageTweak.Helper.dump(value,level+1);
/**/					} else {
/**/						dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
/**/					}
/**/				}
/**/			} else { //Stings/Chars/Numbers etc.
/**/				dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
/**/			}
/**/			return dumped_text;
/**/		},

		prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
	},

	GenerateUID: function GenerateUID() {
		if ( this.GetPref("UID") == 0 ) {
			ImageTweak.Helper.prefs.setIntPref( ImageTweak.Preferences.UID.pref, ImageTweak.Helper.Random() );
		}
	},

	GatherFeedback: function GatherFeedback() {
		var data = {};
		for ( pref in ImageTweak.Preferences ) {
			data[ pref ] = ImageTweak.GetPref( pref );
		}
		data["Version"] = ImageTweak.Helper.GetVersion();
		return data;
	},

	PrepareFeedback: function PrepareFeedback() {
		var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
		if ( nativeJSON ) {
			data = nativeJSON.encode( ImageTweak.GatherFeedback() );
	/**/		ImageTweak.Helper.log( data );
			return data;
		}
		return false;
	},
	
	SendFeedback: function SendFeedback() {
		if ( ImageTweak.GetPref("Feedback") == false )
			return false;
		var data = ImageTweak.PrepareFeedback();
		if ( data == false )
			return false;
		var req = new XMLHttpRequest();
		if ( req == false )
			return false;
		req.open('POST', 'http://cafxx.strayorange.com/app/ImageTweakFeedbackSink.php', /* async */ true);
		req.send( data );
		// Don't bother waiting for the response: even if it fails we don't care
		return true;
	},

	// this structure holds informations about the preferences used by ImageTweak
	// see ImageTweak.GetPref for further informations
	Preferences: {
		AutomaticResizing: 		{ pref: "browser.enable_automatic_image_resizing" 														},
		ZoomTypeFitEnabled: 	{ pref: "extensions.imagetweak.zoomtype.full"															}, // originally called "ZoomTypeFullEnabled"
		ZoomTypeFillEnabled:	{ pref: "extensions.imagetweak.zoomtype.fill"															},
		ZoomTypeFreeEnabled:	{ pref: "extensions.imagetweak.zoomtype.free"															},
		ZoomTypeUnscaledEnabled:{ pref: "extensions.imagetweak.zoomtype.unscaled" 														},
		DefaultZoomType: 		{ pref: "extensions.imagetweak.zoomtype.default" 														},
		ClipMovement:			{ pref: "extensions.imagetweak.clip_movement"															},
		BackgroundColor: 		{ pref: "extensions.imagetweak.bgcolor" 																},
		BorderColor:			{ pref: "extensions.imagetweak.bordercolor"																},
		ZoomFactor: 			{ pref: "extensions.imagetweak.zoomexp2",			parse: function(v) { return parseFloat(v)/100.0; } 	},
		ShortcutImg:			{ pref: "extensions.imagetweak.shortcut.img"															},
		ShortcutBg:				{ pref: "extensions.imagetweak.shortcut.bg"																},
		ZoomOnPointer:			{ pref: "extensions.imagetweak.zoomonpointer"															},
		InvertMouseWheel:		{ pref: "extensions.imagetweak.invertmousewheel"														},
		InvertKeyboard:			{ pref: "extensions.imagetweak.invertkeyboard"															},
		StartFromTopLeft:		{ pref: "extensions.imagetweak.startfromtopleft"														},
		Scrolling:				{ pref: "general.autoScroll"																			},
		LegacyScrolling:		{ pref: "extensions.imagetweak.legacyscrolling"															},
		EmulateScrolling:		{ pref: "extensions.imagetweak.emulatescrolling"														},
		Feedback:				{ pref: "extensions.imagetweak.feedback"																},
		UID:					{ pref: "extensions.imagetweak.UID"																		},
		Fullscreen:				{ pref: "extensions.imagetweak.fullscreen",			parse: function(v) { return false; }					},
	},

	GetPref: function GetPref(id) {
		var p;
		switch ( this.Helper.prefs.getPrefType( this.Preferences[id].pref ) ) {
			case this.Helper.prefs.PREF_BOOL: 	p = this.Helper.prefs.getBoolPref( this.Preferences[id].pref ); break;
			case this.Helper.prefs.PREF_STRING:	p = this.Helper.prefs.getCharPref( this.Preferences[id].pref ); break;
			case this.Helper.prefs.PREF_INT: 	p = this.Helper.prefs.getIntPref( this.Preferences[id].pref ); break;
		}
		if ( this.Preferences[id].parse ) {
			p = this.Preferences[id].parse(p);
		}
		return p;
	},

/***********************************************************************************************************************************************************/

// creates the ImageTweak object for the specified window
	Document: function Document( hWindow ) {
/**/		ImageTweak.Helper.log(">");
		this.Window = hWindow; // reference to the current window
		if ( this.Window ) {
			this.Document = this.Window.document; // reference to the current document
			if ( this.Document instanceof ImageDocument ) {
				this.Browser = gBrowser.getBrowserForDocument( this.Document );
				this.Image = this.Document.images[0]; // in a nsImageDocument there's just one image
				this.ZoomMax = null; // max zoom to be used (to keep the image smaller than ImageMax pixel)
				this.FreeZoom = 1; // start zoom = 1 (will be overriden later)
				this.FreeTop = 0;
				this.FreeLeft = 0;
				this.Rotation = 0; // in degrees
				this.Dragging = false; // dragging flag
				this.ZoomType = null; // zoom type (see ImageTweak.ZoomTypes)
				this.ClientXPrev = null; // last known position of the mouse pointer
				this.ClientYPrev = null;
				this.Title = null; // nsImageDocument original title
				this.Inited = false; // initialization flag
				this.TimeoutHandle = null; // Timeout handle used during image loading
				this.ImageMax = 32767; // maximum physical image size
			}
		}
/**/		ImageTweak.Helper.log("<");
	},

	EntryPoint: function EntryPoint() {
	/**/	ImageTweak.Helper.log(">");
		// generate a UID if necessary
		ImageTweak.GenerateUID();
		//var browser = document.getElementById("appcontent");
		gBrowser.addEventListener("load", ImageTweak.StartEventHandler, true);
		gBrowser.addEventListener("focus", ImageTweak.StartEventHandler, true);
		gBrowser.addEventListener("DOMContentLoaded", ImageTweak.StartEventHandler, true);
		gBrowser.addEventListener("DOMFrameContentLoaded", ImageTweak.StartEventHandler, true);
		gBrowser.tabContainer.addEventListener("TabOpen", ImageTweak.StartEventHandler, true);
	/**/	ImageTweak.Helper.log("<");
	},
	
	// callback for on(page/tab/window/whatver)load
	StartEventHandler: function StartEventHandler(e) {
		var hWindow;
		// find the handle to the window where the event occurred
		if ( e.originalTarget && e.originalTarget.defaultView ) 
			hWindow = e.originalTarget.defaultView;
		else if ( e.originalTarget && e.originalTarget.contentWindow )
			hWindow = e.originalTarget.contentWindow;
		else if ( e.target && e.target.linkedBrowser && e.target.linkedBrowser.contentWindow ) 
			hWindow = e.target.linkedBrowser.contentWindow;
		// if we found it, start ImageTweak
		if ( hWindow && hWindow.document ) {
			if ( !hWindow.document.ImageTweak ) {
				hWindow.document.ImageTweak = new ImageTweak.Document( hWindow );
			}
			hWindow.document.ImageTweak.PluginEventListeners();
		}
	},
};
	
// compute the current coordinates of the image (such as width, height, top, left, etc) using the parameters specified in the ImageTweak object
ImageTweak.Document.prototype.ScreenCoordinates = function ScreenCoordinates() {
	var Coordinates = {	CurZoom: null, CurX: null, CurY: null, imgWidth: null, imgHeight: null, imgLeft: null, imgTop: null };

	switch (this.ZoomType) {
		case "free":	Coordinates.CurZoom = this.Zoom; break;
		case "fit":		Coordinates.CurZoom = this.FitZoom(); break;
		case "fill":	Coordinates.CurZoom = this.FillZoom(); break;
		case "pixel": 	Coordinates.CurZoom = 1; break;
	}

	var boundingWidth		= ImageTweak.Helper.Clip( this.RotatedWidth() * Coordinates.CurZoom,		1, this.ImageMax );
	var boundingHeight		= ImageTweak.Helper.Clip( this.RotatedHeight() * Coordinates.CurZoom,		1, this.ImageMax );
	Coordinates.imgWidth	= ImageTweak.Helper.Clip( this.Image.naturalWidth * Coordinates.CurZoom,	1, this.ImageMax );
	Coordinates.imgHeight	= ImageTweak.Helper.Clip( this.Image.naturalHeight * Coordinates.CurZoom,	1, this.ImageMax );
	Coordinates.pageWidth	= Math.max( boundingWidth + this.Window.innerWidth * 2, boundingWidth * 2 + this.Window.innerWidth );
	Coordinates.pageHeight	= Math.max( boundingHeight + this.Window.innerHeight * 2, boundingHeight * 2 + this.Window.innerHeight );
	Coordinates.imgLeft		= ( Coordinates.pageWidth - Coordinates.imgWidth ) / 2;
	Coordinates.imgTop		= ( Coordinates.pageHeight - Coordinates.imgHeight ) / 2;
	
	switch ( this.ZoomType ) {
		case "free":
			switch ( ImageTweak.GetPref("ClipMovement") ) {
				case false:
				case 0:
				default:
					Coordinates.CurX = this.FreeLeft;
					Coordinates.CurY = this.FreeTop;
					break;
				case 1:
					Coordinates.CurX = this.FreeLeft = ImageTweak.Helper.Clip( this.FreeLeft, Math.abs( ( boundingWidth - this.Window.innerWidth ) / 2 ) );
					Coordinates.CurY = this.FreeTop = ImageTweak.Helper.Clip( this.FreeTop, Math.abs( ( boundingHeight - this.Window.innerHeight ) / 2 ) );
					break;
				case 2:
					Coordinates.CurX = this.FreeLeft = ImageTweak.Helper.Clip( this.FreeLeft, Math.abs( ( boundingWidth + this.Window.innerWidth ) / 2 ) );
					Coordinates.CurY = this.FreeTop = ImageTweak.Helper.Clip( this.FreeTop, Math.abs( ( boundingHeight + this.Window.innerHeight ) / 2 ) );
					break;
				case true:
				case 3:
					Coordinates.CurX = this.FreeLeft = ImageTweak.Helper.Clip( this.FreeLeft, Math.max( 0, ( boundingWidth - this.Window.innerWidth ) / 2 ) );
					Coordinates.CurY = this.FreeTop = ImageTweak.Helper.Clip( this.FreeTop, Math.max( 0, ( boundingHeight - this.Window.innerHeight ) / 2 ) );
					break;
				case 4:
					Coordinates.CurX = this.FreeLeft = ImageTweak.Helper.Clip( this.FreeLeft, Math.max( 0, ( boundingWidth + this.Window.innerWidth ) / 2 ) );
					Coordinates.CurY = this.FreeTop = ImageTweak.Helper.Clip( this.FreeTop, Math.max( 0, ( boundingHeight + this.Window.innerHeight ) / 2 ) );
					break;
			}
			break;
		case "fill":
		case "pixel":
			if ( ImageTweak.GetPref("StartFromTopLeft") ) {
				if (this.Window.innerWidth < Coordinates.imgWidth)
					Coordinates.CurX = Coordinates.imgLeft;
				else
					Coordinates.CurX = ( Coordinates.pageWidth - this.Window.innerWidth ) / 2;
				if (this.Window.innerHeight < Coordinates.imgHeight)
					Coordinates.CurY = Coordinates.imgTop;
				else
					Coordinates.CurY = ( Coordinates.pageHeight - this.Window.innerHeight ) / 2;
				break;
			}
		case "fit":
			Coordinates.CurX = ( Coordinates.pageWidth - this.Window.innerWidth ) / 2;
			Coordinates.CurY = ( Coordinates.pageHeight - this.Window.innerHeight ) / 2;
			break;
	}

	return Coordinates;
};

// Repaint updates the image CSS style according to the computed coordinates
// It also update the title displayed in the titlebar
ImageTweak.Document.prototype.Repaint = function Repaint() {
	var Coordinates = this.ScreenCoordinates();

	this.Document.body.style.width	= Math.round( Coordinates.pageWidth ) + "px";
	this.Document.body.style.height	= Math.round( Coordinates.pageHeight ) + "px";
	this.Document.body.style.backgroundColor = ImageTweak.GetPref("BackgroundColor");
	this.Image.style.border			= ( ImageTweak.GetPref("BorderColor") != "" ? "1px solid " + ImageTweak.GetPref("BorderColor") : "none" );
	this.Image.style.left			= Math.round(Coordinates.imgLeft) + "px";
	this.Image.style.top			= Math.round(Coordinates.imgTop) + "px";
	this.Image.style.width			= Math.round(Coordinates.imgWidth) + "px";
	this.Image.style.height			= Math.round(Coordinates.imgHeight) + "px";
	this.Image.style.MozTransform	= "rotate(" + this.Rotation + "deg);";
	this.Window.scrollTo( Coordinates.CurX, Coordinates.CurY );
	
	var CurTitleZoom = ", " + Math.round( Coordinates.CurZoom * 100 ) + "%";
	var CurTitleRotation = ( this.Rotation % 360 != 0 ? ", " + ( ( ( this.Rotation % 360 ) + 360 ) % 360 ) + "°" : "" );
	var CurTitle = this.Title.substring( 0, this.Title.lastIndexOf( ")" ) ) + CurTitleZoom + CurTitleRotation + ")";
	if ( this.Document.title != CurTitle ) this.Document.title = CurTitle;
};

/* Event Handlers ******************************************************************************************************************************************/

ImageTweak.Document.prototype.OnResize = function OnResize(event) {
	if ( this.ZoomType == "fit" || this.ZoomType == "fill" ) {
		this.DefaultZoomType();
	}
	this.Repaint();
};

// start dragging when the button is clicked
ImageTweak.Document.prototype.OnMouseDown = function OnMouseDown(event) {
	if ( event.button == 0 && event.ctrlKey == false ) {
		this.Dragging = true;
		this.Document.body.style.cursor = "move";
		event.preventDefault(); 
	}
};

// stop dragging when the button is released
ImageTweak.Document.prototype.OnMouseUp = function OnMouseUp(event) {
	if ( event.button == 0 ) {
		this.Dragging = false;
		this.Document.body.style.cursor = "auto";
		event.preventDefault();
	}
};

// if the button is pressed, move the image
ImageTweak.Document.prototype.OnMouseMove = function OnMouseMove(event) {
	// TODO: if ctrl is pressed stop dragging and allow drag-and-drop (?)
	if ( this.Dragging && this.ClientXPrev != null ) {
		this.PerformMove( event.clientX - this.ClientXPrev, event.clientY - this.ClientYPrev );
		event.preventDefault();
	}
	this.ClientXPrev = event.clientX;
	this.ClientYPrev = event.clientY;
};

ImageTweak.Document.prototype.OnMouseWheel = function OnMouseWheel(event) { 
	if ( event.altKey || event.shiftKey || event.metaKey ) {
		return true;
	} else if ( ( ImageTweak.GetPref( "LegacyScrolling" ) && !event.ctrlKey ) || ( !ImageTweak.GetPref( "LegacyScrolling" ) && event.ctrlKey ) ) {
		var ZoomDelta = ( event.detail > 0 ? 1 : -1 ) * ( ImageTweak.GetPref( "InvertMouseWheel" ) ? 1 : -1 ); 
		this.PerformZoom( ZoomDelta, this.ClientXPrev, this.ClientYPrev ); // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=352179 - darn you, mozilla!
		event.preventDefault();
	} else if ( ( ImageTweak.GetPref( "LegacyScrolling" ) && event.ctrlKey ) || ( !ImageTweak.GetPref( "LegacyScrolling" ) && !event.ctrlKey ) ) {
		if ( this.PerformScroll( ( event.detail > 0 ? 1 : -1 ), true ) )  
			event.preventDefault();
	}
};

ImageTweak.Document.prototype.OnKeyPress = function OnKeyPress(event) {
	if (event.altKey || event.metaKey) {
		return true;
	}
	var MoveDelta = ( Math.min( this.Window.innerWidth, this.Window.innerHeight ) / 10 ) * ( ImageTweak.GetPref("InvertKeyboard") ? -1 : 1 );
	var EventIsHandled = true;
	if ( event.ctrlKey ) {
		switch (event.keyCode + event.charCode) {
			case 43: /* plus sign */		this.PerformZoom( 1 ); break;
			case 45: /* minus sign */		this.PerformZoom( -1 ); break;
			case 48: /* 0 */			this.DefaultZoomType(); break;
			default: 				EventIsHandled = false;
		}
	} else {
		switch (event.keyCode + event.charCode) {
			case 32: /* space */		this.PerformZoomTypeSwitch( ); break;
			case 43: /* plus sign */		this.PerformZoom( 1 ); break;
			case 45: /* minus sign */		this.PerformZoom( -1 ); break;
			case 60: /* < */			this.PerformRotation( -90 ); break;
			case 62: /* > */			this.PerformRotation( 90 ); break;
			case 48: /* 0 */			this.DefaultZoomType(); break;
			case 49: /* 1 */			this.PerformZoomTypeSwitch( "fit" ); break;
			case 50: /* 2 */			this.PerformZoomTypeSwitch( "fill" ); break;
			case 51: /* 3 */			this.PerformZoomTypeSwitch( "pixel" ); break;
			case 52: /* 4 */			this.PerformZoomTypeSwitch( "free" ); break;
			default: 				EventIsHandled = false;
		}
	}
	if ( EventIsHandled == true ) {
		event.preventDefault();
	}
};

ImageTweak.Document.prototype.OnDoubleClick = function OnDoubleClick(event) {
	if ( event.button == 0 ) {
		this.PerformZoomTypeSwitch();
		event.preventDefault();
	}
};

ImageTweak.Document.prototype.Targets = {	
	DoNotOpen:			function(url) { return false; }, 
	OpenInCurrentTab:	function(url) { content.document.location.assign( url ); return true; }, 
	OpenInNewTab:		function(url) { gBrowser.addTab( url ); return true; }, 
	OpenInNewTabFocus:	function(url) { gBrowser.selectedTab = gBrowser.addTab( url ); return true; }, 
	OpenInNewWindow:	function(url) { window.open( url ); return true; },
};

ImageTweak.Document.prototype.RegularDocumentOnMouseClick = function RegularDocumentOnMouseClick(event) { 
/**/	ImageTweak.Helper.log(">");
	var Target = this.Targets.DoNotOpen;
	var URL = "";
	if ( event.button == 2 ) {
		if ( event.ctrlKey && event.altKey && event.shiftKey ) {
			Target = this.Targets.OpenInNewWindow;
		} else if ( event.ctrlKey && event.altKey ) {
			Target = this.Targets.OpenInNewTab;
		} else if ( event.ctrlKey ) {
			Target = this.Targets.OpenInCurrentTab;
		}
	}
	if ( event.target.tagName == "IMG" && ImageTweak.GetPref("ShortcutImg") ) {
		URL = event.target.src;
	} else if ( ImageTweak.Helper.GetComputedURL( event.target, "background-image" ) != "" && ImageTweak.GetPref("ShortcutBg") ) {
		URL = makeURLAbsolute( event.target.baseURI, ImageTweak.Helper.GetComputedURL( event.target, "background-image" ) )
	}
	if ( URL != "" && Target( URL ) ) {
		event.preventDefault();
	}
/**/	ImageTweak.Helper.log("<");
};

ImageTweak.Document.prototype.OnUnload = function OnUnload(event) { 
/**/	ImageTweak.Helper.log(">");
	if ( ImageTweak.GetPref("Fullscreen") && this.Window.fullScreen ) BrowserFullScreen();
/**/	ImageTweak.Helper.log("<");
};

/* Internal functions **************************************************************************************************************************************/

ImageTweak.Document.prototype.PerformMove = function PerformMove(dx, dy) {
/**/	ImageTweak.Helper.log(">");
/**/	ImageTweak.Helper.log("dx " + dx + " dy " + dy);
	this.ConvertToFree();
	this.FreeLeft = this.Window.scrollX - dx;
	this.FreeTop = this.Window.scrollY - dy;
	this.Repaint();
/**/	ImageTweak.Helper.log("<");
};

ImageTweak.Document.prototype.PerformScroll = function PerformScroll(delta, vertical) {
/**/	ImageTweak.Helper.log(">");
/**/	ImageTweak.Helper.log("delta " + delta + " vertical " + vertical);
	if ( ImageTweak.GetPref("EmulateScrolling") ) {
		if ( vertical ) {
			if ( delta > 0 ) goDoCommand("cmd_scrollLineDown")
			else if ( delta < 0 ) goDoCommand("cmd_scrollLineUp")
		} else {
			if ( delta > 0 ) goDoCommand("cmd_scrollLineLeft")
			else if ( delta < 0 ) goDoCommand("cmd_scrollLineRight")
		}
		return true; // by returning true we prevent the event from propagating
	} else {
		return false; // by returning false we let the event propagate - someone else will have to deal with it
	}
/**/	ImageTweak.Helper.log("<");
};

ImageTweak.Document.prototype.PerformZoom = function PerformZoom(delta, px, py) {
/**/	ImageTweak.Helper.log("> delta " + delta + " px " + px + " py " + py);
	this.ConvertToFree();
	var imgZoomFactor = ImageTweak.GetPref("ZoomFactor");
	var imgZoomNew = Math.pow( imgZoomFactor, Math.round( delta + Math.log(this.Zoom) / Math.log(imgZoomFactor) ) );
	if ( imgZoomNew <= this.ZoomMax ) {
		var imgZoomRatio = imgZoomNew / this.Zoom;
		var imgZoomDirRatio = imgZoomRatio * ( delta < 0 ? -1 : 1 );
		var Coordinates = this.ScreenCoordinates();
		if ( typeof(px) == "undefined" || typeof(py) == "undefined" || ImageTweak.GetPref("ZoomOnPointer") == false /* || imgZoomNew < this.FitZoom() */ ) {
			px = this.Window.innerWidth / 2;
			py = this.Window.innerHeight / 2;
		}
		this.FreeLeft = ( px + this.Window.scrollX - Coordinates.imgLeft ) / this.Zoom * imgZoomNew + this.Window.scrollX - px;
		this.FreeTop = ( py + this.Window.scrollY - Coordinates.imgTop ) / this.Zoom * imgZoomNew + this.Window.scrollY - py;
		this.Zoom = imgZoomNew;
/**/		ImageTweak.Helper.log( "Zoom " + this.Zoom + " FreeLeft " + this.FreeLeft + " FreeTop " + this.FreeTop );
		this.Repaint();
	}
/**/	ImageTweak.Helper.log("<");
};

ImageTweak.Document.prototype.PerformRotation = function PerformRotation( degrees ) {
/**/	ImageTweak.Helper.log("> " + degrees + "°");
	if ( ImageTweak.Helper.ComparePlatformVersionNumber( "3.1" ) >= 0 ) {
		//this.ConvertToFree();
		this.Rotation += degrees;
		this.Repaint();
	}
/**/	ImageTweak.Helper.log("<");
}

ImageTweak.Document.prototype.ConvertToFree = function ConvertToFree() {
	if ( this.ZoomType == "free" ) 
		return;
	var Coordinates = this.ScreenCoordinates();
	this.Zoom = Coordinates.CurZoom;
	this.FreeLeft = Coordinates.CurX;
	this.FreeTop = Coordinates.CurY;
	this.ZoomType = "free";
};

ImageTweak.Document.prototype.RotatedWidth = function RotatedWidth() {
	var RotationRadians = this.Rotation / 180 * Math.PI;
	return this.Image.naturalWidth * Math.abs( Math.cos( RotationRadians ) ) + this.Image.naturalHeight * Math.abs( Math.sin( RotationRadians ) );
};

ImageTweak.Document.prototype.RotatedHeight = function RotatedHeight() {
	var RotationRadians = this.Rotation / 180 * Math.PI;
	return this.Image.naturalWidth * Math.abs( Math.sin( RotationRadians ) ) + this.Image.naturalHeight * Math.abs( Math.cos( RotationRadians ) );
};

ImageTweak.Document.prototype.FitZoom = function FitZoom() {
	return Math.min( this.Window.innerWidth / this.RotatedWidth(), this.Window.innerHeight / this.RotatedHeight() );
};

ImageTweak.Document.prototype.FillZoom = function FillZoom() {
	return Math.max( this.Window.innerWidth / this.RotatedWidth(), this.Window.innerHeight / this.RotatedHeight() );
};

ImageTweak.Document.prototype.DefaultZoomType = function DefaultZoomType() {
	this.PerformZoomTypeSwitch( ImageTweak.GetPref("DefaultZoomType"), false );
};

ImageTweak.Document.prototype.ZoomTypes = {
	free:		{ next:'fit',	condition:'ImageTweak.GetPref("ZoomTypeFreeEnabled")' },
	fit:		{ next:'fill',	condition:'this.FitZoom() < 1 && ImageTweak.GetPref("ZoomTypeFitEnabled")' },
	fill:		{ next:'pixel',	condition:'this.FillZoom() < 1 && ImageTweak.GetPref("ZoomTypeFillEnabled")' },
	pixel:		{ next:'free',	condition:'ImageTweak.GetPref("ZoomTypeUnscaledEnabled") || this.FitZoom() >= 1' }
};

ImageTweak.Document.prototype.PerformZoomTypeSwitch = function PerformZoomTypeSwitch( imgZoomType, SkipCondition ) {
/**/	ImageTweak.Helper.log(">");
	if ( typeof(imgZoomType) == "undefined" ) { 
		imgZoomType = this.ZoomTypes[this.ZoomType].next;
		SkipCondition = false;
	} else if ( typeof(SkipCondition) == "undefined" ) {
		SkipCondition = true;
	} else {
		SkipCondition = false;
	}
	if ( this.ZoomType == "free" ) {
		this.FreeLeft = this.Window.scrollX;
		this.FreeTop = this.Window.scrollY;
	}
	while ( imgZoomType != this.ZoomType && !( eval( this.ZoomTypes[imgZoomType].condition ) || SkipCondition ) ) {
/**/		ImageTweak.Helper.log( this.ZoomType + " -> " + imgZoomType );
		imgZoomType = this.ZoomTypes[imgZoomType].next;
	}
/**/	ImageTweak.Helper.log("final: " + this.ZoomType + " -> " + imgZoomType);
	this.ZoomType = imgZoomType;
	this.Repaint();
/**/	ImageTweak.Helper.log("<");
};

ImageTweak.Document.prototype.PluginEventListeners = function PluginEventListeners() {
/**/	ImageTweak.Helper.log(">");
	var hImageTweak = this; // needed for closures
	if ( this.Inited ) {
/**/		ImageTweak.Helper.log("already inited");
	} else if ( ( this.Document instanceof ImageDocument ) === false ) { 
		// not a standalone image! so, what? let's plug in our supa-dupa source image click handler
/**/		ImageTweak.Helper.log("!ImageDocument" );
		if ( ImageTweak.GetPref("ShortcutImg") || ImageTweak.GetPref("ShortcutBg") ) {
			this.Document.addEventListener( 'click', function(e) { hImageTweak.RegularDocumentOnMouseClick(e); }, false );
		}
		this.Inited = true;
	} else if ( !this.Image.naturalWidth ) {
		// we are not ready yet... keep waiting...
/**/		ImageTweak.Helper.log("ImageDocument not ready yet");
		if ( this.TimeoutHandle != null ) {
			clearTimeout( this.TimeoutHandle );
		}
		this.TimeoutHandle = setTimeout( function() { hImageTweak.PluginEventListeners(); }, 50 );
	} else {
/**/		ImageTweak.Helper.log("ImageDocument");
		// disable all automatic_image_resizing-related behaviours
		this.Document.restoreImage();
		this.Image.removeEventListener( 'click', this.Document, false );
		this.Image.removeEventListener( 'resize', this.Document, false );
		this.Image.removeEventListener( 'keypress', this.Document, false );
		this.Image.style.cursor = "auto";
		if ( ImageTweak.GetPref("Fullscreen") ) BrowserFullScreen();
		// initialize our structure
		this.Title = this.Document.title; // this has to go after disabling automatic_image_resizing
		this.ZoomMax = Math.min( this.ImageMax / this.Image.naturalWidth, this.ImageMax / this.Image.naturalHeight );
		this.DefaultZoomType();
		// basic customizations
		this.Document.body.style.display = "block";
		this.Document.body.style.overflow = "hidden";
		this.Image.style.position = "absolute";
		// attach our event listeners
		this.Document.addEventListener( 'DOMMouseScroll', function(e) { hImageTweak.OnMouseWheel(e); }, false );
		this.Document.addEventListener( 'mousemove', function(e) { hImageTweak.OnMouseMove(e); }, false );
		this.Document.addEventListener( 'mouseup', function(e) { hImageTweak.OnMouseUp(e); }, true );
		this.Document.addEventListener( 'mousedown', function(e) { hImageTweak.OnMouseDown(e); }, true );
		this.Document.addEventListener( 'dblclick', function(e) { hImageTweak.OnDoubleClick(e); }, false );
		this.Window.addEventListener( 'unload', function(e) { hImageTweak.OnUnload(e); }, false );
		this.Window.addEventListener( 'resize', function(e) { hImageTweak.OnResize(e); }, false );
		this.Window.addEventListener( 'keypress', function(e) { hImageTweak.OnKeyPress(e); }, false );
		// go! go! go!
		this.Inited = true;
/**/		ImageTweak.Helper.log("inited");
		this.Repaint();
	}
/**/	ImageTweak.Helper.log("<");
};

