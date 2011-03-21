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

if (Cc != Components.classes)
    var Cc = Components.classes;
if (Ci != Components.interfaces)
    var Ci = Components.interfaces;
if (Cu != Components.utils)
    var Cu = Components.utils;

/*  creates the ImageTweak object for the specified window
    this is used also for non-ImageDocuments because we need to register the listeners */
function ImageTweak( hWindow ) {
    this.Window = hWindow; // reference to the current window
    this.Document = this.Window.document; // reference to the current document
    this.Listeners = [];
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
        this.ContinuousTone = null; // is the image continuous tone?
        this.Transparent = null;  // is the image transparent?
        this.InvertResamplingAlgorithm = false; // override the normal resampling algorithm
        this.EmptyDragImage = null; // used to prevent the drag image from appearing in fx4
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

    var boundingWidth       = ImageTweak.clip( this.RotatedWidth() * Coordinates.CurZoom,             1, ImageTweak.ImageMax );
    var boundingHeight      = ImageTweak.clip( this.RotatedHeight() * Coordinates.CurZoom,            1, ImageTweak.ImageMax );
    Coordinates.imgWidth    = ImageTweak.clip( this.Image.naturalWidth * Coordinates.CurZoom,         1, ImageTweak.ImageMax );
    Coordinates.imgHeight   = ImageTweak.clip( this.Image.naturalHeight * Coordinates.CurZoom,        1, ImageTweak.ImageMax );

    switch (this.ZoomType) {
        case "free":
            switch ( ImageTweak.pref.ClipMovement ) {
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
            if ( ImageTweak.pref.StartFromTopLeft ) {
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

	var CurCSS =    "position:absolute;" +
                    "image-rendering:" + this.GetResamplingAlgorithm() + ";" +
                    "left:"     + Math.round(Coordinates.imgLeft)       + "px;" +
                    "top:"      + Math.round(Coordinates.imgTop)        + "px;" +
                    "width:"    + Math.round(Coordinates.imgWidth)      + "px;" +
                    "height:"   + Math.round(Coordinates.imgHeight)     + "px;" +
                    "-moz-transform: rotate(" + this.Rotation + "deg);";
	
	if (ImageTweak.pref.ShadowColor != "" && !this.Transparent) {
		var ShadowBlur = Math.sqrt( this.Window.innerWidth * this.Window.innerHeight ) * 0.025; // magic
		CurCSS += "-moz-box-shadow: 0 0 " + Math.round(ShadowBlur) + "px 0 " + ImageTweak.pref.ShadowColor + ";";
		CurCSS += "background-color: " + ImageTweak.pref.ShadowColor + ";";
	}
	
	if (ImageTweak.pref.BorderColor != "") {
        CurCSS += "border: 1px solid " + ImageTweak.pref.BorderColor + ";";
	} else {
        CurCSS += "border: none;";
	}
			
    if ( this.Image.style.cssText != CurCSS ) 
        this.Image.style.cssText = CurCSS;

    var CurTitleZoom = ", " + Math.round( Coordinates.CurZoom * 100 ) + "%";
    var CurTitleRotation = ( this.Rotation % 360 != 0 ? ", " + ( ( ( this.Rotation % 360 ) + 360 ) % 360 ) + "°" : "" );
    var CurTitle = this.Title.substring( 0, this.Title.lastIndexOf( ")" ) ) + CurTitleZoom + CurTitleRotation + ")";
    if ( this.Document.title != CurTitle ) 
        this.Document.title = CurTitle;

    this.Document.body.style.backgroundColor = ImageTweak.pref.BackgroundColor;

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
    this.ClientXDrag = this.ClientXPrev;
    this.ClientYDrag = this.ClientYPrev;
    event.dataTransfer.setData("text/uri-list", this.Image.URL);
    event.dataTransfer.setData("text/plain", this.Image.URL);
    event.dataTransfer.setDragImage(this.EmptyDragImage, 0, 0);
    this.SetMouseCursor();
};

ImageTweak.prototype.OnDragEnd = function OnDragEnd(event) {
    this.Dragging = false;
    this.SetMouseCursor();
};

ImageTweak.prototype.OnDrag = function OnDrag(event) {
    this.PerformMove( this.ClientXDrag - this.ClientXPrev, this.ClientYDrag - this.ClientYPrev );
    this.ClientXPrev = this.ClientXDrag;
    this.ClientYPrev = this.ClientYDrag;
    this.SetMouseCursor();
};

ImageTweak.prototype.OnDragEnterWindow = function OnDragEnterWindow(event) {
    this.SetDragBehavior(event, false);
};

ImageTweak.prototype.OnDragExitWindow = function OnDragExitWindow(event) {
    this.SetDragBehavior(event, true);
};

ImageTweak.prototype.OnDragOverWindow = function OnDragOverWindow(event) {
    this.ClientXDrag = event.clientX;
    this.ClientYDrag = event.clientY;
    this.SetDragBehavior(event, false);
    this.SetMouseCursor();
};

ImageTweak.prototype.OnMouseDown = function OnMouseDown(event) {
    if ( event.button == 1 && event.ctrlKey == false && ImageTweak.pref.Scrolling ) {
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
    this.SetMouseCursor();
};

ImageTweak.prototype.OnMouseWheel = function OnMouseWheel(event) {
    if ( event.shiftKey || event.metaKey ) {
        return true;
    } else if ( event.ctrlKey && event.altKey ) {
        this.PerformRotation( event.detail > 0 ? 90 : -90 );
        event.preventDefault();
    } else if ( ( ImageTweak.pref.LegacyScrolling && !event.ctrlKey ) || ( !ImageTweak.pref.LegacyScrolling && event.ctrlKey ) ) {
        var ZoomDelta = ( event.detail > 0 ? 1 : -1 ) * ( ImageTweak.pref.InvertMouseWheel ? 1 : -1 );
        this.PerformZoom( ZoomDelta, this.ClientXPrev, this.ClientYPrev ); // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=352179 - darn you, mozilla!
        event.preventDefault();
    } else if ( ( ImageTweak.pref.LegacyScrolling && event.ctrlKey ) || ( !ImageTweak.pref.LegacyScrolling && !event.ctrlKey ) ) {
        var MoveDelta = ( event.detail > 0 ? 1 : -1 ) * ( ImageTweak.pref.InvertMouseWheel ? 1 : -1 ) * Math.min( this.Window.innerWidth, this.Window.innerHeight ) / 10;
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
    var MoveDelta = ( Math.min( this.Window.innerWidth, this.Window.innerHeight ) / 10 ) * ( ImageTweak.pref.InvertKeyboard ? -1 : 1 );
    var MovePageDelta = ( this.Window.innerHeight ) * ( ImageTweak.pref.InvertKeyboard ? -1 : 1 );
    if ( event.ctrlKey ) {
        switch (event.keyCode + event.charCode) {
            case 43: /* plus sign */                this.PerformZoom( 1 ); break;
            case 45: /* minus sign */               this.PerformZoom( -1 ); break;
            case 48: /* 0 */                        this.DefaultZoomType(); break;
            default:                                return;
        }
    } else {
        switch (event.keyCode + event.charCode) {
            case 32: /* space */                    this.PerformZoomTypeSwitch(); break;
            case 37: /* left arrow */               this.PerformMove( MoveDelta, 0 ); break;
            case 38: /* up arrow */                 this.PerformMove( 0, MoveDelta ); break;
            case 39: /* right arrow */              this.PerformMove( -MoveDelta, 0 ); break;
            case 40: /* down arrow */               this.PerformMove( 0, -MoveDelta ); break;
            case 43: /* plus sign */                this.PerformZoom( 1 ); break;
            case 45: /* minus sign */               this.PerformZoom( -1 ); break;
            case 60: /* < */                        this.PerformRotation( -90 ); break;
            case 62: /* > */                        this.PerformRotation( 90 ); break;
            case 48: /* 0 */                        this.DefaultZoomType(); break;
            case 49: /* 1 */                        this.PerformZoomTypeSwitch( "fit", true ); break;
            case 50: /* 2 */                        this.PerformZoomTypeSwitch( "fill", true ); break;
            case 51: /* 3 */                        this.PerformZoomTypeSwitch( "pixel", true ); break;
            case 52: /* 4 */                        this.PerformZoomTypeSwitch( "free", true ); break;
            case 34: /* page down */                this.PerformMove( 0, -MovePageDelta ); break;
            case 33: /* page up */                  this.PerformMove( 0, MovePageDelta ); break;
            case 112: /* p */                       this.SwitchResamplingAlgorithm(); break;
            default:                                return;
        }
    }
    event.preventDefault();
};

ImageTweak.prototype.OnDoubleClick = function OnDoubleClick(event) {
    if (event.button == 0) {
        this.PerformZoomTypeSwitch();
        event.preventDefault();
    }
};

ImageTweak.prototype.RegularDocumentOnMouseClick = function RegularDocumentOnMouseClick(event) {
    var Target = ImageTweak.Targets.DoNotOpen;
    var URL = "";
    if ( event.button == 2 ) {
        if ( event.ctrlKey && event.altKey && event.shiftKey ) {
            Target = ImageTweak.Targets.OpenInNewWindow;
        } else if ( event.ctrlKey && event.altKey ) {
            Target = ImageTweak.Targets.OpenInNewTab;
        } else if ( event.ctrlKey ) {
            Target = ImageTweak.Targets.OpenInCurrentTab;
        }
        URL = this.GetElementImageURL( event.target );
    }
    if ( URL != "" && Target( URL ) ) {
        event.preventDefault();
    }
};

ImageTweak.prototype.RegularDocumentOnMouseDoubleClick = function RegularDocumentOnMouseDoubleClick(event) {
    var Target = ImageTweak.Targets.DoNotOpen;
    var URL = "";
    if ( event.button == 2 ) {
        Target = ImageTweak.Targets.OpenInCurrentTab;
        URL = this.GetElementImageURL( event.target );
    }
    if ( URL != "" && Target( URL ) ) {
        event.preventDefault();
        document.getElementById("contentAreaContextMenu").hidePopup(); 
    }
};

ImageTweak.prototype.OnUnload = function OnUnload(event) {
    this.Browser.setAttribute("autoscroll", this.BrowserAutoscroll);
    this.Cleanup();
};

ImageTweak.prototype.OnSelection = function OnSelection(event) {
    this.ClearSelection();
};

ImageTweak.prototype.OnLoad = function OnLoad(event) {
    if (this.ContinuousTone == null)
        this.ContinuousTone = ImageTweak.isContinuousToneImage(this.Image);
    if (this.Transparent == null)
        this.Transparent = ImageTweak.isTransparentImage(this.Image);
    this.Repaint();
};

/* Internal functions **************************************************************************************************************************************/

// move the image of the specified offset
ImageTweak.prototype.PerformMove = function PerformMove(dx, dy) {
    this.ConvertToFree();
    this.CenterX += dx;
    this.CenterY += dy;
    this.Repaint();
};

// zooms the image, optionally around a pivot point (px, py)
ImageTweak.prototype.PerformZoom = function PerformZoom(delta, px, py) {
    this.ConvertToFree();
    var imgZoomFactor = ImageTweak.pref.ZoomFactor;
    var imgZoomNew = Math.pow(imgZoomFactor, Math.round(delta + Math.log(this.Zoom) / Math.log(imgZoomFactor)));
    if ( imgZoomNew <= this.ZoomMax ) {
        var imgZoomRatio = imgZoomNew / this.Zoom;
        var imgZoomDirRatio = imgZoomRatio * ( delta < 0 ? -1 : 1 );
        if ( typeof px != "undefined" && ImageTweak.pref.ZoomOnPointer && imgZoomNew >= this.FitZoom() ) {
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

// rotate the image
ImageTweak.prototype.PerformRotation = function PerformRotation( degrees ) {
    this.Rotation += degrees;
    this.Repaint();
};

ImageTweak.prototype.StartScroll = function StartScroll(event) {
    if ( this.Window.innerWidth < this.Image.width || this.Window.innerHeight < this.Image.height || ImageTweak.pref.ClipMovement == false ) {
        this.Scrolling = true;
        if ( event ) {
            this.ClientXStart = event.clientX;
            this.ClientYStart = event.clientY;
            event.preventDefault();
        }
        if ( !this.ScrollIntervalHandle ) {
            var hImageTweak = this;
            this.ScrollIntervalHandle = setInterval( function (offset) { hImageTweak.PerformScroll(offset); }, ImageTweak.ScrollInterval );
        }
    } else {
        this.StopScroll();
    }
    this.SetMouseCursor();
};

ImageTweak.prototype.StopScroll = function StopScroll(event) {
    this.Scrolling = false;
    this.SetMouseCursor();
    clearInterval( this.ScrollIntervalHandle );
    this.ScrollIntervalHandle = null;
    if ( event ) {
        event.preventDefault();
    }
};

// set the mouse coursor shape as appropriate for the current context/action
ImageTweak.prototype.SetMouseCursor = function SetMouseCursor() {
    if (this.Scrolling || this.Dragging) {
        if ( ( this.Window.innerWidth < this.Image.width && this.Window.innerHeight < this.Image.height ) || ImageTweak.pref.ClipMovement == false ) {
            this.Document.body.style.cursor = "move";
        } else if ( this.Window.innerWidth < this.Image.width ) {
            this.Document.body.style.cursor = "W-resize";
        } else {
            this.Document.body.style.cursor = "N-resize";
        }
    } else {
        this.Document.body.style.cursor = "auto";
    }
};

ImageTweak.prototype.SetDragBehavior = function SetDragBehavior(event, showImage) {
    event.dataTransfer.effectAllowed = showImage ? "all" : "none";
};

ImageTweak.prototype.PerformScroll = function PerformScroll(offset) {
    if ( this.Scrolling && this.ClientXStart != null ) {
        var ScaleFactor = ( ImageTweak.ScrollInterval + offset ) / ImageTweak.ScrollInterval * 0.1;
        this.PerformMove( ( this.ClientXStart - this.ClientXPrev ) * ScaleFactor, ( this.ClientYStart - this.ClientYPrev ) * ScaleFactor );
    }
};

// take the current zoom level and tranform it into free zoom
ImageTweak.prototype.ConvertToFree = function ConvertToFree() {
    if ( this.ZoomType == "free" )
        return;
    var Coordinates = this.ScreenCoordinates();
    this.Zoom = Coordinates.CurZoom;
    this.CenterX = Coordinates.CurX;
    this.CenterY = Coordinates.CurY;
    this.ZoomType = "free";
};

// return the width of the bounding box for the (optionally) rotated image
ImageTweak.prototype.RotatedWidth = function RotatedWidth() {
    var RotationRadians = this.Rotation / 180 * Math.PI;
    return this.Image.naturalWidth * Math.abs( Math.cos( RotationRadians ) ) + this.Image.naturalHeight * Math.abs( Math.sin( RotationRadians ) );
};

// return the height of the bounding box for the (optionally) rotated image
ImageTweak.prototype.RotatedHeight = function RotatedHeight() {
    var RotationRadians = this.Rotation / 180 * Math.PI;
    return this.Image.naturalWidth * Math.abs( Math.sin( RotationRadians ) ) + this.Image.naturalHeight * Math.abs( Math.cos( RotationRadians ) );
};

// return the normalized zoom ratio for fit
ImageTweak.prototype.FitZoom = function FitZoom() {
    return Math.min( this.Window.innerWidth / this.RotatedWidth(), this.Window.innerHeight / this.RotatedHeight() );
};

// return the normalized zoom ratio for fill
ImageTweak.prototype.FillZoom = function FillZoom() {
    return Math.max( this.Window.innerWidth / this.RotatedWidth(), this.Window.innerHeight / this.RotatedHeight() );
};

// reset the view to the default zoom ratio
ImageTweak.prototype.DefaultZoomType = function DefaultZoomType() {
    this.PerformZoomTypeSwitch( ImageTweak.pref.DefaultZoomType, false );
};

ImageTweak.ZoomTypes = {
    free: { 
        next:'fit',   
        condition: function(_this) ImageTweak.pref.ZoomTypeFreeEnabled
    },
    fit: { 
        next:'fill',  
        condition: function(_this) _this.FitZoom() < 1 && ImageTweak.pref.ZoomTypeFitEnabled
    },
    fill: { 
        next:'pixel', 
        condition: function(_this) _this.FillZoom() < 1 && ImageTweak.pref.ZoomTypeFillEnabled
    },
    pixel: { 
        next:'free',
        condition: function(_this) _this.FitZoom() >= 1 || ImageTweak.pref.ZoomTypeUnscaledEnabled
    }
};

ImageTweak.prototype.PerformZoomTypeSwitch = function PerformZoomTypeSwitch( imgZoomType, SkipCondition ) {
    if ( typeof imgZoomType == "undefined" ) 
        imgZoomType = ImageTweak.ZoomTypes[ this.ZoomType ].next;
    if ( typeof SkipCondition == "undefined" )
        SkipCondition = false;
    ImageTweak.log(imgZoomType + " " + SkipCondition);
    while ( imgZoomType != this.ZoomType && !( ImageTweak.ZoomTypes[ imgZoomType ].condition(this) || SkipCondition ) )
        imgZoomType = ImageTweak.ZoomTypes[ imgZoomType ].next;
    ImageTweak.log(imgZoomType);
    this.ZoomType = imgZoomType;
    this.Repaint();
};

ImageTweak.prototype.GetResamplingAlgorithm = function GetResamplingAlgorithm() {
    const bilinear = "optimizeQuality";
    const nearestNeighbor = "-moz-crisp-edges";
    var algorithm = nearestNeighbor;
    if ( ImageTweak.pref.ResamplingAlgorithm && this.ContinuousTone !== false )
        algorithm = bilinear;
    if ( this.InvertResamplingAlgorithm )
        algorithm = algorithm == bilinear ? nearestNeighbor : bilinear;
    if ( this.Zoom < 2 )
        algorithm = bilinear;
    return algorithm;
};

// override the default resampling algorithm
ImageTweak.prototype.SwitchResamplingAlgorithm = function SwitchResamplingAlgorithm() {
    this.InvertResamplingAlgorithm = !this.InvertResamplingAlgorithm;
    this.Repaint();
};

// get the image URL of the element (either image or background)
ImageTweak.prototype.GetElementImageURL = function GetElementImageURL(elem) {
    if ( elem.tagName == "IMG" && ImageTweak.pref.ShortcutImg )
        return elem.src;
    var bgImgUrl = ImageTweak.getComputedURL( elem, "background-image" );
    if ( bgImgUrl != "" && bgImgUrl != null && ImageTweak.pref.ShortcutBg ) 
        return makeURLAbsolute( elem.baseURI, bgImgUrl );
    return "";
};

// remove any current selection 
ImageTweak.prototype.ClearSelection = function ClearSelection() {
    this.Window.getSelection().removeAllRanges();
};

// inject the imageViewer flag in the navigator object
// http://stackoverflow.com/questions/5089941/allow-content-documents-to-detect-my-firefox-addon
ImageTweak.prototype.InjectContentFlag = function InjectContentFlag() {
    try {
        var s = new Cu.Sandbox(this.Window);
        s.window = this.Window;
        Cu.evalInSandbox(
            "try { window.wrappedJSObject.navigator.__defineGetter__('imageViewer', function(){ return true; }); } catch(e) {}", 
            s
        );
        return true;
    } catch (e) {
        return false;
    }
};

// destroy the current ImageTweak instance: after this function is called, no other functions may be called
ImageTweak.prototype.Cleanup = function Cleanup() {
    // null the DOM reference to this IT instance
    if (this.Document && this.Document.ImageTweak)
        this.Document.ImageTweak = null; 
    // unregister all event listeners
    var listener;
    while (listener = this.Listeners.pop())
        listener.target.removeEventListener(listener.eventName, listener.listener, listener.bubbling);
    // null all class members
    for (var i in this)
        this[i] = null;
};

// register an event listener to be automatically unregistered during cleanup
ImageTweak.prototype.addEventListener = function addEventListener(target, eventName, listener, bubbling) {
    target.addEventListener(eventName, listener, bubbling);
    this.Listeners.push({target: target, eventName: eventName, listener: listener, bubbling: bubbling});
};

ImageTweak.prototype.PluginEventListeners = function PluginEventListeners() {
    var hImageTweak = this;
    if ( this.Inited ) {
        // go fullscreen if needed
        window.fullScreen = ImageTweak.pref.AutomaticFullScreen && this.Document instanceof ImageDocument;
    } else if ( ( this.Document instanceof ImageDocument ) === false ) {
        // not a standalone image! so, what? let's plug in our supa-dupa source image click handler
        this.Document.addEventListener( 'click', function(e) { hImageTweak.RegularDocumentOnMouseClick(e); }, false );
        this.Document.addEventListener( 'dblclick', function(e) { hImageTweak.RegularDocumentOnMouseDoubleClick(e); }, false );
        // inject the navigator.imageViewer flag
        if (ImageTweak.pref.ContentDetectable)
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
        this.ZoomMax = Math.min( ImageTweak.ImageMax / this.Image.naturalWidth, ImageTweak.ImageMax / this.Image.naturalHeight );
        this.DefaultZoomType();
        // plugin our (supa-dupa!) event listeners
        this.addEventListener( this.Document, 'DOMMouseScroll', function(e) { hImageTweak.OnMouseWheel(e); }, false );
        this.addEventListener( this.Document, 'mousemove', function(e) { hImageTweak.OnMouseMove(e); }, false );
        this.addEventListener( this.Document, 'mouseup', function(e) { hImageTweak.OnMouseUp(e); }, true );
        this.addEventListener( this.Document, 'mousedown', function(e) { hImageTweak.OnMouseDown(e); }, true );
        this.addEventListener( this.Document, 'dblclick', function(e) { hImageTweak.OnDoubleClick(e); }, false );
        this.addEventListener( this.Window, 'load', function(e) { hImageTweak.OnLoad(e); }, false );
        this.addEventListener( this.Window, 'unload', function(e) { hImageTweak.OnUnload(e); }, false );
        this.addEventListener( this.Window, 'resize', function(e) { hImageTweak.OnResize(e); }, false );
        this.addEventListener( this.Window, 'keypress', function(e) { hImageTweak.OnKeyPress(e); }, false );
        this.addEventListener( this.Window, 'drag', function(e) { hImageTweak.OnDrag(e); }, false );
        this.addEventListener( this.Window, 'dragstart', function(e) { hImageTweak.OnDragStart(e); }, false );
        this.addEventListener( this.Window, 'dragend', function(e) { hImageTweak.OnDragEnd(e); }, false );
        this.addEventListener( this.Window, 'dragenter', function(e) { hImageTweak.OnDragEnterWindow(e); }, false );
        this.addEventListener( this.Window, 'dragleave', function(e) { hImageTweak.OnDragExitWindow(e); }, false );
        this.addEventListener( this.Window, 'dragover', function(e) { hImageTweak.OnDragOverWindow(e); }, false ); // WTF!!!!
        this.addEventListener( this.Window, 'keyup', function(e) { hImageTweak.OnSelection(e); }, false ); 
        this.addEventListener( this.Window, 'mouseup', function(e) { hImageTweak.OnSelection(e); }, false ); 
        // create an empty canvas to be used as drag image
        var empty = ImageTweak.getCanvas( this.Document, 1, 1 );
        this.EmptyDragImage = empty.canvas;
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
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    var browser = wm.getMostRecentWindow("navigator:browser").getBrowser();
    browser.selectedTab = browser.addTab(url);
};

// see README.md for a description of this function
ImageTweak.enabled = function(doc) {
    return doc ? ImageTweak.enabledForDocument(doc) : true;
};
    
// see README.md for a description of this function
ImageTweak.enabledForDocument = function(doc) {
    return typeof doc.ImageTweak.Image != "undefined" ? doc.ImageTweak : false;
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

// parse a CSS color, also allowing a percentage to be used (interpreted as a grayscale value)
ImageTweak.parseColorExtended = function(v) {
    var match = /([0-9]*(?:[.,][0-9]*)?)\s*%/.exec(v);
    if (match) {
        var L = ImageTweak.clip( Math.round( parseFloat(match[1]) / 100 * 255 ), 0, 255 );
        return "rgb("+L+","+L+","+L+")";
    } 
    return v;
};

// console logging function
ImageTweak.log = function(msg) {
    if (ImageTweak.pref.LoggingEnabled)
        Application.console.log(msg);
};

// create getters in pref for all items in preferences
(function() {
    var preferences = {
        AutomaticResizing:              { pref: "browser.enable_automatic_image_resizing"                                                                    },
        ZoomTypeFitEnabled:             { pref: "extensions.imagetweak.zoomtype.full"                                                                        },
        ZoomTypeFillEnabled:            { pref: "extensions.imagetweak.zoomtype.fill"                                                                        },
        ZoomTypeFreeEnabled:            { pref: "extensions.imagetweak.zoomtype.free"                                                                        },
        ZoomTypeUnscaledEnabled:        { pref: "extensions.imagetweak.zoomtype.unscaled"                                                                    },
        DefaultZoomType:                { pref: "extensions.imagetweak.zoomtype.default"                                                                     },
        ClipMovement:                   { pref: "extensions.imagetweak.clip_movement"                                                                        },
        BackgroundColor:                { pref: "extensions.imagetweak.bgcolor",                        parse: ImageTweak.parseColorExtended                 },
        BorderColor:                    { pref: "extensions.imagetweak.bordercolor",                    parse: ImageTweak.parseColorExtended                 },
        ShadowColor:                    { pref: "extensions.imagetweak.shadowcolor",                    parse: ImageTweak.parseColorExtended                 },
        ZoomFactor:                     { pref: "extensions.imagetweak.zoomexp2",                       parse: function(v) { return parseFloat(v)/100.0; }   },
        ShortcutImg:                    { pref: "extensions.imagetweak.shortcut.img"                                                                         },
        ShortcutBg:                     { pref: "extensions.imagetweak.shortcut.bg"                                                                          },
        ZoomOnPointer:                  { pref: "extensions.imagetweak.zoomonpointer"                                                                        },
        InvertMouseWheel:               { pref: "extensions.imagetweak.invertmousewheel"                                                                     },
        InvertKeyboard:                 { pref: "extensions.imagetweak.invertkeyboard"                                                                       },
        StartFromTopLeft:               { pref: "extensions.imagetweak.startfromtopleft"                                                                     },
        Scrolling:                      { pref: "general.autoScroll"                                                                                         },
        LegacyScrolling:                { pref: "extensions.imagetweak.legacyscrolling"                                                                      },
        ContentDetectable:              { pref: "extensions.imagetweak.contentdetectable"                                                                    },
        ResamplingAlgorithm:            { pref: "extensions.imagetweak.resamplingalgorithm"                                                                  },
        ContextMenu:                    { pref: "extensions.imagetweak.contextmenu"                                                                          },
        LoggingEnabled:                 { pref: "extensions.imagetweak.loggingenabled"                                                                       },
        AutomaticFullScreen:            { pref: "extensions.imagetweak.automaticfullscreen"                                                                  }
    };

    ImageTweak.pref = {};
    for (var pref in preferences) {
        let id = pref;
        ImageTweak.pref.__defineGetter__(pref, function() { 
            var p = Application.prefs.getValue( preferences[ id ].pref, null );
            return preferences[ id ].parse ? preferences[ id ].parse(p) : p;
        });
    }
})();

// detect if the current image is "continuous tone" or not
// for now this means having more than 32 different colors or not
ImageTweak.isContinuousToneImage = function isContinuousToneImage(img) {
    const colorsThreshold = 32;
    var { canvas, ctx, data } = ImageTweak.getImageCanvas(img);
    
    var colors = [];
    for (var i=0; i < data.data.length && colors.length < colorsThreshold; i+=4) {
        var color = ( data.data[i] * 256 + data.data[i+1] ) * 256 + data.data[i+2];
        if (colors.indexOf(color) == -1)
            colors.push(color);
    }
    
    return colors.length > colorsThreshold;
};

// detect if the current image has any transparent pixel
ImageTweak.isTransparentImage = function isTransparentImage(img) { 
    switch (img.ownerDocument.contentType) {
        case "image/gif":
        case "image/png":
            var { canvas, ctx, data } = ImageTweak.getImageCanvas(img);
            for (var i=3; i < data.data.length; i+=4)
                if (data.data[i] != 255)
                    return true;
        default:
            return false;
    }
};


// get a canvas filled with the contents of the image img
ImageTweak.getImageCanvas = function getImageCanvas(img) {
    var { canvas, ctx } = ImageTweak.getCanvas(img.ownerDocument, img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0);
    return {
        canvas: canvas,
        ctx: ctx,
        data: ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
    };
};

// get an empty canvas of size (w, h)
ImageTweak.getCanvas = function getCanvas(doc, w, h) {
    var canvas = doc.createElementNS("http://www.w3.org/1999/xhtml","html:canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    return {
        canvas: canvas,
        ctx: ctx
    };
};

ImageTweak.Targets = {
    DoNotOpen:              function(url) { return false; },
    OpenInCurrentTab:       function(url) { content.document.location.assign( url ); return true; },
    OpenInNewTab:           function(url) { gBrowser.addTab( url ); return true; },
    OpenInNewTabFocus:      function(url) { gBrowser.selectedTab = gBrowser.addTab( url ); return true; },
    OpenInNewWindow:        function(url) { window.open( url ); return true; },
};

// broadcast a call to repaint to all open tabs
// this is used to instantly propagate changes to the pref window
// FIXME: use preflisteners?
ImageTweak.RepaintAll = function RepaintAll(url) {   
    Application.windows.forEach(function(Window) {
        Window.tabs.forEach(function(Tab) {
            var IT = ImageTweak.enabled(Tab.document);
            if (IT) 
                IT.Repaint();
        });
    });
};

// DelayedExecute(fn) is equivalent to setTimeout(fn, 0), only faster
// adapted from http://dbaron.org/log/20100309-faster-timeouts
(function() {
    var timeouts = [];
    const messageName = "ImageTweakDelayedExecution";

    ImageTweak.DelayedExecute = function DelayedExecute(fn) {
        timeouts.push(fn);
        window.postMessage(messageName, "*");
    };

    window.addEventListener("message", function (event) {
        if (event.data == messageName) {
            event.stopPropagation();
            while (timeouts.length > 0)
                timeouts.shift()();
        }
    }, true);
})();

// the UUID of this extension
ImageTweak.UUID = "{DB2EA31C-58F5-48b7-8D60-CB0739257904}";

// ms between calls to the scroll event handler - somewhat higher than 60fps
ImageTweak.ScrollInterval = 15; 

// maximum image size in pixel supported by gecko
ImageTweak.ImageMax = 32767;
