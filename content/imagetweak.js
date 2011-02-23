/************************************************************************************************************************************************************

	ImageTweak
	2006-2011 CAFxX
	http://cafxx.strayorange.com
	
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


// creates the ImageTweak object for the specified window
function ImageTweak( hWindow ) {
    this.Window = hWindow; // reference to the current window
    this.Document = this.Window.document; // reference to the current document
    if ( this.Document instanceof ImageDocument ) {
        this.Browser = gBrowser.getBrowserForDocument( this.Document );
        this.BrowserAutoscroll = false;
        this.Image = this.Document.images[0]; // in a nsImageDocument there's just one image
        this.Zoom = 1; // start zoom = 1 (will be overriden later)
        this.ZoomMax = null; // max zoom to be used (to keep the image smaller than ImageMax pixel)
        this.CenterX = 0; // coordinates of the center of the image on the screen
        this.CenterY = 0;
        this.Rotation = 0; // in degrees
        this.Dragging = false; // dragging flag
        this.Scrolling = false; // scrolling flag
        this.ZoomType = null; // zoom type (see ImageTweak.ZoomTypes)
        this.ClientXPrev = null; // last known position of the mouse pointer
        this.ClientYPrev = null;
        this.ClientXStart = null; // position of the mouse pointer when scrolling started
        this.ClientYStart = null;
        this.ClientXDrag = null; // position of the mouse pointer during drag (curse you mozilla!!!!)
        this.ClientYDrag = null;
        this.Title = null; // nsImageDocument original title
        this.Inited = false; // initialization flag
        this.TimeoutHandle = null; // Timeout handle used during image loading
        this.ScrollIntervalHandle = null; // Interval handle used for scrolling
        this.ScrollInterval = 25; //ms
        this.ImageMax = 32767; // maximum physical image size
    }
};

// compute the current coordinates of the image (such as width, height, top, left, etc) using the parameters specified in the ImageTweak object
ImageTweak.prototype.ScreenCoordinates = function ScreenCoordinates() {
    var Coordinates = { CurZoom: null, CurX: null, CurY: null, imgWidth: null, imgHeight: null, imgLeft: null, imgTop: null };

    switch (this.ZoomType) {
        case "free":    Coordinates.CurZoom = this.Zoom; break;
        case "fit":     Coordinates.CurZoom = this.FitZoom(); break;
        case "fill":    Coordinates.CurZoom = this.FillZoom(); break;
        case "pixel":   Coordinates.CurZoom = 1; break;
    }

    var boundingWidth       = ImageTweak.clip( this.RotatedWidth() * Coordinates.CurZoom,             1, this.ImageMax );
    var boundingHeight      = ImageTweak.clip( this.RotatedHeight() * Coordinates.CurZoom,            1, this.ImageMax );
    Coordinates.imgWidth    = ImageTweak.clip( this.Image.naturalWidth * Coordinates.CurZoom,         1, this.ImageMax );
    Coordinates.imgHeight   = ImageTweak.clip( this.Image.naturalHeight * Coordinates.CurZoom,        1, this.ImageMax );

    switch (this.ZoomType) {
        case "free":
            switch ( ImageTweak.getPref("ClipMovement") ) {
                case false:
                case 0:
                default:
                    Coordinates.CurX = this.CenterX;
                    Coordinates.CurY = this.CenterY;
                    break;
                case 1:
                    Coordinates.CurX = this.CenterX = ImageTweak.clip( this.CenterX, Math.abs( ( boundingWidth - this.Window.innerWidth ) / 2 ) );
                    Coordinates.CurY = this.CenterY = ImageTweak.clip( this.CenterY, Math.abs( ( boundingHeight - this.Window.innerHeight ) / 2 ) );
                    break;
                case 2:
                    Coordinates.CurX = this.CenterX = ImageTweak.clip( this.CenterX, Math.abs( ( boundingWidth + this.Window.innerWidth ) / 2 ) );
                    Coordinates.CurY = this.CenterY = ImageTweak.clip( this.CenterY, Math.abs( ( boundingHeight + this.Window.innerHeight ) / 2 ) );
                    break;
                case true:
                case 3:
                    Coordinates.CurX = this.CenterX = ImageTweak.clip( this.CenterX, Math.max( 0, ( boundingWidth - this.Window.innerWidth ) / 2 ) );
                    Coordinates.CurY = this.CenterY = ImageTweak.clip( this.CenterY, Math.max( 0, ( boundingHeight - this.Window.innerHeight ) / 2 ) );
                    break;
                case 4:
                    Coordinates.CurX = this.CenterX = ImageTweak.clip( this.CenterX, Math.max( 0, ( boundingWidth + this.Window.innerWidth ) / 2 ) );
                    Coordinates.CurY = this.CenterY = ImageTweak.clip( this.CenterY, Math.max( 0, ( boundingHeight + this.Window.innerHeight ) / 2 ) );
                    break;
            }
            break;
        case "fill":
        case "pixel":
            if ( ImageTweak.getPref("StartFromTopLeft") ) {
                Coordinates.CurX = this.Window.innerWidth < boundingWidth ? -( this.Window.innerWidth - boundingWidth ) / 2 : 0;
                Coordinates.CurY = this.Window.innerHeight < boundingHeight ? -( this.Window.innerHeight - boundingHeight ) / 2 : 0;
                break;
            }
        case "fit":
            Coordinates.CurX = 0;
            Coordinates.CurY = 0;
            break;
    }

    Coordinates.imgLeft     = ( this.Window.innerWidth - Coordinates.imgWidth ) / 2 + Coordinates.CurX;
    Coordinates.imgTop      = ( this.Window.innerHeight - Coordinates.imgHeight ) / 2 + Coordinates.CurY;

    return Coordinates;
}

// Repaint updates the image CSS style according to the computed coordinates
// It also updates the title displayed in the titlebar
ImageTweak.prototype.Repaint = function Repaint() {
    var Coordinates = this.ScreenCoordinates();
	var ShadowBlur = Math.sqrt( this.Window.innerWidth * this.Window.innerHeight ) / 50;
	
    var CurCSS = "position:absolute;" +
            "border:"   + ( ImageTweak.getPref("BorderColor") != "" ? "1px solid " + ImageTweak.getPref("BorderColor") : "none" ) + ";" +
            "left:"     + Math.round(Coordinates.imgLeft)       + "px;" +
            "top:"      + Math.round(Coordinates.imgTop)        + "px;" +
            "width:"    + Math.round(Coordinates.imgWidth)      + "px;" +
            "height:"   + Math.round(Coordinates.imgHeight)     + "px;" +
            "-moz-transform: rotate(" + this.Rotation + "deg);" +
			"-moz-box-shadow: 0 0 " + Math.round(ShadowBlur) + "px 0 black;";
    if ( this.Image.style.cssText != CurCSS ) this.Image.style.cssText = CurCSS;

    var CurTitleZoom = ", " + Math.round( Coordinates.CurZoom * 100 ) + "%";
    var CurTitleRotation = ( this.Rotation % 360 != 0 ? ", " + ( ( ( this.Rotation % 360 ) + 360 ) % 360 ) + "°" : "" );
    var CurTitle = this.Title.substring( 0, this.Title.lastIndexOf( ")" ) ) + CurTitleZoom + CurTitleRotation + ")";
    if ( this.Document.title != CurTitle ) 
        this.Document.title = CurTitle;
    this.Document.body.style.backgroundColor = ImageTweak.getPref("BackgroundColor");

    if ( this.Scrolling )
        this.StartScroll();
};

/* Event Handlers ******************************************************************************************************************************************/

ImageTweak.prototype.OnResize = function OnResize(event) {
    if (this.ZoomType == "fit" || this.ZoomType == "fill") {
        this.DefaultZoomType();
    }
    this.Repaint();
};

ImageTweak.prototype.OnDragStart = function OnDragStart(event) {
    this.Dragging = true;
    event.dataTransfer.setData("text/uri-list", this.Image.URL);
    event.dataTransfer.setData("text/plain", this.Image.URL);
    event.dataTransfer.effectAllowed = "none";
    this.Document.body.style.cursor = "move";
    this.ClientXDrag = this.ClientXPrev;
    this.ClientYDrag = this.ClientYPrev;
};

ImageTweak.prototype.OnDragEnd = function OnDragEnd(event) {
    this.Dragging = false;
    this.Document.body.style.cursor = "auto";
};

ImageTweak.prototype.OnDrag = function OnDrag(event) {
    this.PerformMove( this.ClientXDrag - this.ClientXPrev, this.ClientYDrag - this.ClientYPrev );
    this.ClientXPrev = this.ClientXDrag;
    this.ClientYPrev = this.ClientYDrag;
	event.preventDefault();
    this.Document.body.style.cursor = "move";
};

ImageTweak.prototype.OnDragEnterWindow = function OnDragEnterWindow(event) {
    event.dataTransfer.effectAllowed = "none";
};

ImageTweak.prototype.OnDragExitWindow = function OnDragExitWindow(event) {
    event.dataTransfer.effectAllowed = "all";
};

ImageTweak.prototype.OnDragOverWindow = function OnDragOverWindow(event) {
    this.ClientXDrag = event.clientX;
    this.ClientYDrag = event.clientY;
	event.preventDefault();
    this.Document.body.style.cursor = "move";
};

ImageTweak.prototype.OnMouseDown = function OnMouseDown(event) {
    if ( event.button == 1 && event.ctrlKey == false && ImageTweak.getPref("Scrolling") ) {
        if ( this.Scrolling ) {
            this.StopScroll(event);
        } else {
            this.StartScroll(event);
        }
    }
};

ImageTweak.prototype.OnMouseUp = function OnMouseUp(event) {
    if (event.button == 1 && this.ClientXStart != event.clientX && this.ClientYStart != event.clientY) {
        this.StopScroll(event);
    }
};

ImageTweak.prototype.OnMouseMove = function OnMouseMove(event) {
    this.ClientXPrev = event.clientX;
    this.ClientYPrev = event.clientY;
};

ImageTweak.prototype.OnMouseWheel = function OnMouseWheel(event) {
    if ( event.shiftKey || event.metaKey ) {
        return true;
    } else if ( event.ctrlKey && event.altKey ) {
        this.PerformRotation( event.detail > 0 ? 90 : -90 );
        event.preventDefault();
    } else if ( ( ImageTweak.getPref( "LegacyScrolling" ) && !event.ctrlKey ) || ( !ImageTweak.getPref( "LegacyScrolling" ) && event.ctrlKey ) ) {
        var ZoomDelta = ( event.detail > 0 ? 1 : -1 ) * ( ImageTweak.getPref( "InvertMouseWheel" ) ? 1 : -1 );
        this.PerformZoom( ZoomDelta, this.ClientXPrev, this.ClientYPrev ); // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=352179 - darn you, mozilla!
        event.preventDefault();
    } else if ( ( ImageTweak.getPref( "LegacyScrolling" ) && event.ctrlKey ) || ( !ImageTweak.getPref( "LegacyScrolling" ) && !event.ctrlKey ) ) {
        var MoveDelta = ( event.detail > 0 ? 1 : -1 ) * ( ImageTweak.getPref( "InvertMouseWheel" ) ? 1 : -1 ) * Math.min( this.Window.innerWidth, this.Window.innerHeight ) / 10;
        if (event.axis == event.HORIZONTAL_AXIS)
            this.PerformMove( MoveDelta, 0 );
        else 
            this.PerformMove( 0, MoveDelta );
        event.preventDefault();
    }
};

ImageTweak.prototype.OnKeyPress = function OnKeyPress(event) {
    if ( event.altKey || event.metaKey ) {
        return true;
    }
    var MoveDelta = ( Math.min( this.Window.innerWidth, this.Window.innerHeight ) / 10 ) * ( ImageTweak.getPref("InvertKeyboard") ? -1 : 1 );
    var MovePageDelta = ( this.Window.innerHeight ) * ( ImageTweak.getPref("InvertKeyboard") ? -1 : 1 );
    var EventIsHandled = true;
    if ( event.ctrlKey ) {
        switch (event.keyCode + event.charCode) {
            case 43: /* plus sign */                this.PerformZoom( 1 ); break;
            case 45: /* minus sign */               this.PerformZoom( -1 ); break;
            case 48: /* 0 */                        this.DefaultZoomType(); break;
            default:                                EventIsHandled = false;
        }
    } else {
        switch (event.keyCode + event.charCode) {
            case 32: /* space */                    this.PerformZoomTypeSwitch( ); break;
            case 37: /* left arrow */               this.PerformMove( MoveDelta, 0 ); break;
            case 38: /* up arrow */                 this.PerformMove( 0, MoveDelta ); break;
            case 39: /* right arrow */              this.PerformMove( -MoveDelta, 0 ); break;
            case 40: /* down arrow */               this.PerformMove( 0, -MoveDelta ); break;
            case 43: /* plus sign */                this.PerformZoom( 1 ); break;
            case 45: /* minus sign */               this.PerformZoom( -1 ); break;
            case 60: /* < */                        this.PerformRotation( -90 ); break;
            case 62: /* > */                        this.PerformRotation( 90 ); break;
            case 48: /* 0 */                        this.DefaultZoomType(); break;
            case 49: /* 1 */                        this.PerformZoomTypeSwitch( "fit" ); break;
            case 50: /* 2 */                        this.PerformZoomTypeSwitch( "fill" ); break;
            case 51: /* 3 */                        this.PerformZoomTypeSwitch( "pixel" ); break;
            case 52: /* 4 */                        this.PerformZoomTypeSwitch( "free" ); break;
            case 34: /* page down */                this.PerformMove( 0, -MovePageDelta ); break;
            case 33: /* page up */                  this.PerformMove( 0, MovePageDelta ); break;
            default:                                EventIsHandled = false;
        }
    }
    if ( EventIsHandled == true ) event.preventDefault();
};

ImageTweak.prototype.OnDoubleClick = function OnDoubleClick(event) {
    if (event.button == 0) {
        this.PerformZoomTypeSwitch();
        event.preventDefault();
    }
};

ImageTweak.prototype.Targets = {
    DoNotOpen:              function(url) { return false; },
    OpenInCurrentTab:       function(url) { content.document.location.assign( url ); return true; },
    OpenInNewTab:           function(url) { gBrowser.addTab( url ); return true; },
    OpenInNewTabFocus:      function(url) { gBrowser.selectedTab = gBrowser.addTab( url ); return true; },
    OpenInNewWindow:        function(url) { window.open( url ); return true; },
};

ImageTweak.prototype.RegularDocumentOnMouseClick = function RegularDocumentOnMouseClick(event) {
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
        URL = this.GetElementImageURL( event.target );
    }
    if ( URL != "" && Target( URL ) ) {
        event.preventDefault();
    }
};

ImageTweak.prototype.RegularDocumentOnMouseDoubleClick = function RegularDocumentOnMouseDoubleClick(event) {
    var Target = this.Targets.DoNotOpen;
    var URL = "";
    if ( event.button == 2 ) {
        Target = this.Targets.OpenInCurrentTab;
        URL = this.GetElementImageURL( event.target );
    }
    if ( URL != "" && Target( URL ) ) {
        event.preventDefault();
        document.getElementById("contentAreaContextMenu").hidePopup(); 
    }
};

ImageTweak.prototype.OnUnload = function OnUnload(event) {
    this.Browser.setAttribute("autoscroll", this.BrowserAutoscroll);
};

/* Internal functions **************************************************************************************************************************************/

ImageTweak.prototype.PerformMove = function PerformMove(dx, dy) {
    this.ConvertToFree();
    this.CenterX += dx;
    this.CenterY += dy;
    this.Repaint();
};

ImageTweak.prototype.PerformZoom = function PerformZoom(delta, px, py) {
    this.ConvertToFree();
    var imgZoomFactor = ImageTweak.getPref("ZoomFactor");
    var imgZoomNew = Math.pow(imgZoomFactor, Math.round(delta + Math.log(this.Zoom) / Math.log(imgZoomFactor)));
    if ( imgZoomNew <= this.ZoomMax ) {
        var imgZoomRatio = imgZoomNew / this.Zoom;
        var imgZoomDirRatio = imgZoomRatio * ( delta < 0 ? -1 : 1 );
        if ( typeof px != "undefined" && ImageTweak.getPref("ZoomOnPointer") && imgZoomNew >= this.FitZoom() ) {
            this.CenterX = px - this.Window.innerWidth / 2 + (this.CenterX + this.Window.innerWidth / 2 - px) * imgZoomRatio;
            this.CenterY = py - this.Window.innerHeight / 2 + (this.CenterY + this.Window.innerHeight / 2 - py) * imgZoomRatio;
        } else {
            this.CenterX *= imgZoomRatio;
            this.CenterY *= imgZoomRatio;
        }
        this.Zoom = imgZoomNew;
        this.Repaint();
    }
};

ImageTweak.prototype.PerformRotation = function PerformRotation( degrees ) {
    this.Rotation += degrees;
    this.Repaint();
};

ImageTweak.prototype.StartScroll = function StartScroll(event) {
    if ( this.Window.innerWidth < this.Image.width || this.Window.innerHeight < this.Image.height || ImageTweak.getPref("ClipMovement") == false ) {
        this.Scrolling = true;
        if ( ( this.Window.innerWidth < this.Image.width && this.Window.innerHeight < this.Image.height ) || ImageTweak.getPref("ClipMovement") == false ) {
            this.Document.body.style.cursor = "move";
        } else if ( this.Window.innerWidth < this.Image.width ) {
            this.Document.body.style.cursor = "W-resize";
        } else {
            this.Document.body.style.cursor = "N-resize";
        }
        if ( event ) {
            this.ClientXStart = event.clientX;
            this.ClientYStart = event.clientY;
            event.preventDefault();
        }
        if ( !this.ScrollIntervalHandle ) {
            var hImageTweak = this;
            this.ScrollIntervalHandle = setInterval( function (offset) { hImageTweak.PerformScroll(offset); }, this.ScrollInterval );
        }
    } else {
        this.StopScroll();
    }
};

ImageTweak.prototype.StopScroll = function StopScroll(event) {
    this.Scrolling = false;
    this.Document.body.style.cursor = "auto";
    clearInterval( this.ScrollIntervalHandle );
    this.ScrollIntervalHandle = null;
    if ( event ) {
        event.preventDefault();
    }
};

ImageTweak.prototype.PerformScroll = function PerformScroll(offset) {
    if ( this.Scrolling && this.ClientXStart != null ) {
        var ScaleFactor = ( this.ScrollInterval + offset ) / this.ScrollInterval * 0.1;
        this.PerformMove( ( this.ClientXStart - this.ClientXPrev ) * ScaleFactor, ( this.ClientYStart - this.ClientYPrev ) * ScaleFactor );
    }
};

ImageTweak.prototype.ConvertToFree = function ConvertToFree() {
    if ( this.ZoomType == "free" )
        return;
    var Coordinates = this.ScreenCoordinates();
    this.Zoom = Coordinates.CurZoom;
    this.CenterX = Coordinates.CurX;
    this.CenterY = Coordinates.CurY;
    this.ZoomType = "free";
};

ImageTweak.prototype.RotatedWidth = function RotatedWidth() {
    var RotationRadians = this.Rotation / 180 * Math.PI;
    return this.Image.naturalWidth * Math.abs( Math.cos( RotationRadians ) ) + this.Image.naturalHeight * Math.abs( Math.sin( RotationRadians ) );
};

ImageTweak.prototype.RotatedHeight = function RotatedHeight() {
    var RotationRadians = this.Rotation / 180 * Math.PI;
    return this.Image.naturalWidth * Math.abs( Math.sin( RotationRadians ) ) + this.Image.naturalHeight * Math.abs( Math.cos( RotationRadians ) );
};

ImageTweak.prototype.FitZoom = function FitZoom() {
    return Math.min( this.Window.innerWidth / this.RotatedWidth(), this.Window.innerHeight / this.RotatedHeight() );
};

ImageTweak.prototype.FillZoom = function FillZoom() {
    return Math.max( this.Window.innerWidth / this.RotatedWidth(), this.Window.innerHeight / this.RotatedHeight() );
};

ImageTweak.prototype.DefaultZoomType = function DefaultZoomType() {
    this.PerformZoomTypeSwitch( ImageTweak.getPref("DefaultZoomType"), false );
};

ImageTweak.prototype.ZoomTypes = {
    free: { 
		next:'fit',   
		condition: function(_this) { 
			return ImageTweak.getPref("ZoomTypeFreeEnabled") 
		}
	},
    fit: { 
		next:'fill',  
		condition: function (_this) {
			return _this.FitZoom() < 1 && ImageTweak.getPref("ZoomTypeFitEnabled");
		}
	},
    fill: { 
		next:'pixel', 
		condition: function (_this) {
			return _this.FillZoom() < 1 && ImageTweak.getPref("ZoomTypeFillEnabled");
		}
	},
    pixel: { 
		next:'free',
		condition: function (_this) {
			return _this.FitZoom() >= 1 || ImageTweak.getPref("ZoomTypeUnscaledEnabled");
		}
	}
};

ImageTweak.prototype.PerformZoomTypeSwitch = function PerformZoomTypeSwitch( imgZoomType, SkipCondition ) {
    if ( typeof imgZoomType == "undefined" ) {
        imgZoomType = this.ZoomTypes[ this.ZoomType ].next;
        SkipCondition = false;
    } else if ( typeof SkipCondition == "undefined" ) {
        SkipCondition = true;
    } else {
        SkipCondition = false;
    }
    while ( imgZoomType != this.ZoomType && !( this.ZoomTypes[ imgZoomType ].condition(this) || SkipCondition ) ) {
        imgZoomType = this.ZoomTypes[ imgZoomType ].next;
    }
    this.ZoomType = imgZoomType;
    this.Repaint();
};

ImageTweak.prototype.GetElementImageURL = function GetElementImageURL(elem) {
    if ( elem.tagName == "IMG" && ImageTweak.getPref("ShortcutImg") )
        return elem.src;
    var bgImgUrl = ImageTweak.getComputedURL( elem, "background-image" );
    if ( bgImgUrl != "" && bgImgUrl != null && ImageTweak.getPref("ShortcutBg") ) 
        return makeURLAbsolute( elem.baseURI, bgImgUrl );
    return "";
};

ImageTweak.prototype.InjectContentFlag = function InjectContentFlag() {
    // http://stackoverflow.com/questions/5089941/allow-content-documents-to-detect-my-firefox-addon
    var s = new Components.utils.Sandbox(this.Window);
    s.window = this.Window;
    Components.utils.evalInSandbox(
        "window.wrappedJSObject.navigator.__defineGetter__('imageViewer', function(){ return true; });", 
        s
    );
};

ImageTweak.prototype.PluginEventListeners = function PluginEventListeners() {
    var hImageTweak = this;
    if ( this.Inited ) {
    } else if ( ( this.Document instanceof ImageDocument ) === false ) {
        // not a standalone image! so, what? let's plug in our supa-dupa source image click handler
        this.Document.addEventListener( 'click', function(e) { hImageTweak.RegularDocumentOnMouseClick(e); }, false );
        this.Document.addEventListener( 'dblclick', function(e) { hImageTweak.RegularDocumentOnMouseDoubleClick(e); }, false );
        // inject the navigator.imageViewer flag
        this.InjectContentFlag();
        this.Inited = true;
    } else if ( !this.Image.naturalWidth ) {
        // we are not ready yet... keep waiting...
        if ( this.TimeoutHandle != null )
            clearTimeout( this.TimeoutHandle );
        this.TimeoutHandle = setTimeout( function() { 
            hImageTweak.PluginEventListeners(); 
        }, 50 );
    } else {
        // disable all automatic_image_resizing-related behaviours
        this.Document.restoreImage();
        this.Image.removeEventListener( 'click', this.Document, false );
        this.Image.removeEventListener( 'resize', this.Document, false );
        this.Image.removeEventListener( 'keypress', this.Document, false );
        this.Image.style.cursor = "auto";
        // disable autoscrolling for this window
        this.Browser = gBrowser.getBrowserForDocument( this.Window.top.document );
        this.BrowserAutoscroll = this.Browser.getAttribute("autoscroll");
        this.Browser.setAttribute("autoscroll", "false");
        // document styles
        this.Document.body.style.overflow = "hidden";
        this.Document.body.style.width = "100%";
        this.Document.body.style.height = "100%";
        this.Document.body.style.margin = "0";
        this.Document.body.style.padding = "0";
        // initialize our structure
        this.Title = this.Document.title; // this has to go after disabling automatic_image_resizing
        this.ZoomMax = Math.min( this.ImageMax / this.Image.naturalWidth, this.ImageMax / this.Image.naturalHeight );
        this.DefaultZoomType();
        // plugin our (supa-dupa!) event listeners
        this.Document.addEventListener( 'DOMMouseScroll', function(e) { hImageTweak.OnMouseWheel(e); }, false );
        this.Document.addEventListener( 'mousemove', function(e) { hImageTweak.OnMouseMove(e); }, false );
        this.Document.addEventListener( 'mouseup', function(e) { hImageTweak.OnMouseUp(e); }, true );
        this.Document.addEventListener( 'mousedown', function(e) { hImageTweak.OnMouseDown(e); }, true );
        this.Document.addEventListener( 'dblclick', function(e) { hImageTweak.OnDoubleClick(e); }, false );
        this.Window.addEventListener( 'unload', function(e) { hImageTweak.OnUnload(e); }, false );
        this.Window.addEventListener( 'resize', function(e) { hImageTweak.OnResize(e); }, false );
        this.Window.addEventListener( 'keypress', function(e) { hImageTweak.OnKeyPress(e); }, false );
        this.Window.addEventListener( 'drag', function(e) { hImageTweak.OnDrag(e); }, false );
        this.Window.addEventListener( 'dragstart', function(e) { hImageTweak.OnDragStart(e); }, false );
        this.Window.addEventListener( 'dragend', function(e) { hImageTweak.OnDragEnd(e); }, false );
        this.Window.addEventListener( 'dragenter', function(e) { hImageTweak.OnDragEnterWindow(e); }, false );
        this.Window.addEventListener( 'dragleave', function(e) { hImageTweak.OnDragExitWindow(e); }, false );
        this.Window.addEventListener( 'dragover', function(e) { hImageTweak.OnDragOverWindow(e); }, false ); // WTF!!!!
        // go! go! go!
        this.Inited = true;
        this.Repaint();
    }
};

// shamelessly taken from mozilla/browser/base/content/nsContextMenu.js
ImageTweak.getComputedURL = function(aElem, aProp) {
	var url = aElem.ownerDocument.defaultView.getComputedStyle(aElem, "").getPropertyCSSValue(aProp)[0]; // FIXME: what's the [0] for?!?!
	return url.primitiveType == CSSPrimitiveValue.CSS_URI ? url.getStringValue() : null;
};

// clips value to min < value < max
ImageTweak.clip = function(value, min, max) {
	if ( typeof max == "undefined" ) {
		max = Math.abs(min);
		min = -min;
	}
	return Math.min( max, Math.max( value, min ) );
};

// opens a new tab and browse to the specified URL
ImageTweak.browse = function(url) {
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	var browser = wm.getMostRecentWindow("navigator:browser").getBrowser();
	browser.selectedTab = browser.addTab(url);
};

ImageTweak.enabled = function(doc) {
	return doc ? ImageTweak.enabledForDocument(doc) : true;
};
	
ImageTweak.enabledForDocument = function(doc) {
	return typeof doc.ImageTweak.Image != "undefined";
};

// ImageTweak.entryPoint is the global entry point for imagetweak
// This function is called from overlay.xul
ImageTweak.entryPoint = function() {
	gBrowser.addEventListener("load", ImageTweak.startEventHandler, true);
	gBrowser.addEventListener("focus", ImageTweak.startEventHandler, true);
	gBrowser.addEventListener("DOMContentLoaded", ImageTweak.startEventHandler, true);
	gBrowser.addEventListener("DOMFrameContentLoaded", ImageTweak.startEventHandler, true);
	gBrowser.tabContainer.addEventListener("TabOpen", ImageTweak.startEventHandler, true);
};

// startEventHandler handles all the pageload, tabopen, tabfocus, etc. events registered in entryPoint
ImageTweak.startEventHandler = function(e) {
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
			hWindow.document.ImageTweak = new ImageTweak( hWindow );
		}
		hWindow.document.ImageTweak.PluginEventListeners();
	}
};

ImageTweak.parseColorExtended = function(v) {
	var match = /([0-9]*(?:[.,][0-9]*)?)\s*%/.exec(v);
	if (match) {
		var L = ImageTweak.clip( Math.round( parseFloat(match[1]) / 100 * 255 ), 0, 255 );
		return "rgb("+L+","+L+","+L+")";
	} 
	return v;
};

ImageTweak.log = function(msg) {
	ImageTweak.console.logStringMessage(msg);
};

ImageTweak.console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

ImageTweak.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

// this structure holds informations about the preferences used by ImageTweak
// see ImageTweak.GetPref for further informations
ImageTweak.preferences = {
    AutomaticResizing:              { pref: "browser.enable_automatic_image_resizing"                                                                    },
    ZoomTypeFitEnabled:             { pref: "extensions.imagetweak.zoomtype.full"                                                                        }, // originally called "ZoomTypeFullEnabled"
    ZoomTypeFillEnabled:            { pref: "extensions.imagetweak.zoomtype.fill"                                                                        },
    ZoomTypeFreeEnabled:            { pref: "extensions.imagetweak.zoomtype.free"                                                                        },
    ZoomTypeUnscaledEnabled:        { pref: "extensions.imagetweak.zoomtype.unscaled"                                                                    },
    DefaultZoomType:                { pref: "extensions.imagetweak.zoomtype.default"                                                                     },
    ClipMovement:                   { pref: "extensions.imagetweak.clip_movement"                                                                        },
    BackgroundColor:                { pref: "extensions.imagetweak.bgcolor",                        parse: ImageTweak.parseColorExtended                 },
    BorderColor:                    { pref: "extensions.imagetweak.bordercolor",                    parse: ImageTweak.parseColorExtended                 },
    ZoomFactor:                     { pref: "extensions.imagetweak.zoomexp2",                       parse: function(v) { return parseFloat(v)/100.0; }   },
    ShortcutImg:                    { pref: "extensions.imagetweak.shortcut.img"                                                                         },
    ShortcutBg:                     { pref: "extensions.imagetweak.shortcut.bg"                                                                          },
    ZoomOnPointer:                  { pref: "extensions.imagetweak.zoomonpointer"                                                                        },
    InvertMouseWheel:               { pref: "extensions.imagetweak.invertmousewheel"                                                                     },
    InvertKeyboard:                 { pref: "extensions.imagetweak.invertkeyboard"                                                                       },
    StartFromTopLeft:               { pref: "extensions.imagetweak.startfromtopleft"                                                                     },
    Scrolling:                      { pref: "general.autoScroll"                                                                                         },
    LegacyScrolling:                { pref: "extensions.imagetweak.legacyscrolling"                                                                      },
};

ImageTweak.getPref = function getPref(id) {
    var p;
    switch ( ImageTweak.prefs.getPrefType( ImageTweak.preferences[ id ].pref ) ) {
        case ImageTweak.prefs.PREF_BOOL:      p = ImageTweak.prefs.getBoolPref( ImageTweak.preferences[id].pref ); break;
        case ImageTweak.prefs.PREF_STRING:    p = ImageTweak.prefs.getCharPref( ImageTweak.preferences[id].pref ); break;
        case ImageTweak.prefs.PREF_INT:       p = ImageTweak.prefs.getIntPref( ImageTweak.preferences[id].pref ); break;
    }
    return ImageTweak.preferences[ id ].parse ? ImageTweak.preferences[ id ].parse(p) : p;
};

