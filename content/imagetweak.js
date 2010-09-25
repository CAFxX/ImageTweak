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

var ImageTweakHelper = {
        // shamelessly taken from mozilla/browser/base/content/nsContextMenu.js
        getComputedURL: function(aElem, aProp) { 
                var url = aElem.ownerDocument.defaultView.getComputedStyle(aElem, "").getPropertyCSSValue(aProp);
                return url.primitiveType == CSSPrimitiveValue.CSS_URI ? url.getStringValue() : null;
        },

        // clips value to min < value < max
        clip: function(value, min, max) {
                if ( max == undefined ) {
                        max = Math.abs(min);
                        min = -min;
                }
                return Math.min( max, Math.max( value, min ) );
        },
        
        // compare the running version of firefox to the one passed
        // returns <0, 0, >0 if the running version is older, the same or newer, respectively
        compareVersionNumber: function(compareVersion) {
                var info = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);  
                var currentVersion = info.version.split("."); // Returns "2.0.0.1" for Firefox version 2.0.0.1  
                var compareVersion = compareVersion.split(".");
                for ( i=0; i<4; i++ ) {
                        if ( currentVersion[i] == undefined ) 
                                currentVersion[i] = 0; 
                        else 
                                currentVersion[i] = parseInt(currentVersion[i]);
                        if ( compareVersion[i] == undefined ) 
                                compareVersion[i] = 0; 
                        else 
                                compareVersion[i] = parseInt(compareVersion[i]);
                        if ( compareVersion[i] != currentVersion[i] ) 
                                return currentVersion[i] - compareVersion[i];
                }
                return 0;
        },
        
        // opens a new tab and browse to the specified URL
        browse: function(url) {
                var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
                var browser = wm.getMostRecentWindow("navigator:browser").getBrowser();
                browser.selectedTab = browser.addTab(url);
        },
};

/***********************************************************************************************************************************************************/

// creates the ImageTweak object for the specified window
function ImageTweak( hWindow ) {
        this.Window = hWindow; // reference to the current window
        this.Document = this.Window.document; // reference to the current document
        if ( this.Document instanceof ImageDocument ) {
                //this.Browser = gBrowser.getBrowserForDocument( this.Document );
                this.Browser = null;
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
                this.ScrollInterval = 10; //ms
                this.ImageMax = 32767; // maximum physical image size
        }
        this.Prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
};

// this structure holds informations about the preferences used by ImageTweak
// see ImageTweak.GetPref for further informations
ImageTweak.prototype.Preferences = {
        AutomaticResizing:              { pref: "browser.enable_automatic_image_resizing"                                                                                                               },
        ZoomTypeFitEnabled:             { pref: "extensions.imagetweak.zoomtype.full"                                                                                                                   }, // originally called "ZoomTypeFullEnabled"
        ZoomTypeFillEnabled:            { pref: "extensions.imagetweak.zoomtype.fill"                                                                                                                   },
        ZoomTypeFreeEnabled:            { pref: "extensions.imagetweak.zoomtype.free"                                                                                                                   },
        ZoomTypeUnscaledEnabled:        { pref: "extensions.imagetweak.zoomtype.unscaled"                                                                                                               },
        DefaultZoomType:                { pref: "extensions.imagetweak.zoomtype.default"                                                                                                                },
        ClipMovement:                   { pref: "extensions.imagetweak.clip_movement"                                                                                                                   },
        BackgroundColor:                { pref: "extensions.imagetweak.bgcolor"                                                                                                                         },
        BorderColor:                    { pref: "extensions.imagetweak.bordercolor"                                                                                                                     },
        ZoomFactor:                     { pref: "extensions.imagetweak.zoomexp2",                       parse: function(v) { return parseFloat(v)/100.0; }                                              },
        ShortcutImg:                    { pref: "extensions.imagetweak.shortcut.img"                                                                                                                    },
        ShortcutBg:                     { pref: "extensions.imagetweak.shortcut.bg"                                                                                                                     },
        ZoomOnPointer:                  { pref: "extensions.imagetweak.zoomonpointer"                                                                                                                   },
        InvertMouseWheel:               { pref: "extensions.imagetweak.invertmousewheel"                                                                                                                },
        InvertKeyboard:                 { pref: "extensions.imagetweak.invertkeyboard"                                                                                                                  },
        StartFromTopLeft:               { pref: "extensions.imagetweak.startfromtopleft"                                                                                                                },
        Scrolling:                      { pref: "general.autoScroll"                                                                                                                                    },
        LegacyScrolling:                { pref: "extensions.imagetweak.legacyscrolling"                                                                                                                 },
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

        var boundingWidth       = ImageTweakHelper.clip( this.RotatedWidth() * Coordinates.CurZoom,             1, this.ImageMax );
        var boundingHeight      = ImageTweakHelper.clip( this.RotatedHeight() * Coordinates.CurZoom,            1, this.ImageMax );
        Coordinates.imgWidth    = ImageTweakHelper.clip( this.Image.naturalWidth * Coordinates.CurZoom,         1, this.ImageMax );
        Coordinates.imgHeight   = ImageTweakHelper.clip( this.Image.naturalHeight * Coordinates.CurZoom,        1, this.ImageMax );

        switch (this.ZoomType) {
                case "free":
                        switch ( this.GetPref("ClipMovement") ) {
                                case false:
                                case 0:
                                default:
                                        Coordinates.CurX = this.CenterX;
                                        Coordinates.CurY = this.CenterY;
                                        break;
                                case 1:
                                        Coordinates.CurX = this.CenterX = ImageTweakHelper.clip( this.CenterX, Math.abs( ( boundingWidth - this.Window.innerWidth ) / 2 ) );
                                        Coordinates.CurY = this.CenterY = ImageTweakHelper.clip( this.CenterY, Math.abs( ( boundingHeight - this.Window.innerHeight ) / 2 ) );
                                        break;
                                case 2:
                                        Coordinates.CurX = this.CenterX = ImageTweakHelper.clip( this.CenterX, Math.abs( ( boundingWidth + this.Window.innerWidth ) / 2 ) );
                                        Coordinates.CurY = this.CenterY = ImageTweakHelper.clip( this.CenterY, Math.abs( ( boundingHeight + this.Window.innerHeight ) / 2 ) );
                                        break;
                                case true:
                                case 3:
                                        Coordinates.CurX = this.CenterX = ImageTweakHelper.clip( this.CenterX, Math.max( 0, ( boundingWidth - this.Window.innerWidth ) / 2 ) );
                                        Coordinates.CurY = this.CenterY = ImageTweakHelper.clip( this.CenterY, Math.max( 0, ( boundingHeight - this.Window.innerHeight ) / 2 ) );
                                        break;
                                case 4:
                                        Coordinates.CurX = this.CenterX = ImageTweakHelper.clip( this.CenterX, Math.max( 0, ( boundingWidth + this.Window.innerWidth ) / 2 ) );
                                        Coordinates.CurY = this.CenterY = ImageTweakHelper.clip( this.CenterY, Math.max( 0, ( boundingHeight + this.Window.innerHeight ) / 2 ) );
                                        break;
                        }
                        break;
                case "fill":
                case "pixel":
                        if ( this.GetPref("StartFromTopLeft") ) {
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
        
        var CurCSS = "position:absolute;" + 
                "border:"   + ( this.GetPref("BorderColor") != "" ? "1px solid " + this.GetPref("BorderColor") : "none" ) + ";" +
                "left:"         + Math.round(Coordinates.imgLeft)       + "px;" +
                "top:"          + Math.round(Coordinates.imgTop)        + "px;" + 
                "width:"        + Math.round(Coordinates.imgWidth)      + "px;" + 
                "height:"       + Math.round(Coordinates.imgHeight)     + "px;" +
                "-moz-transform: rotate(" + this.Rotation + "deg);";
        if ( this.Image.style.cssText != CurCSS ) this.Image.style.cssText = CurCSS;

        var CurTitleZoom = ", " + Math.round( Coordinates.CurZoom * 100 ) + "%";
        var CurTitleRotation = ( this.Rotation % 360 != 0 ? ", " + ( ( ( this.Rotation % 360 ) + 360 ) % 360 ) + "°" : "" );
        var CurTitle = this.Title.substring( 0, this.Title.lastIndexOf( ")" ) ) + CurTitleZoom + CurTitleRotation + ")";
        if ( this.Document.title != CurTitle ) this.Document.title = CurTitle;
        
        if ( this.Scrolling ) {
                this.StartScroll();
        }
};

/* Event Handlers ******************************************************************************************************************************************/

ImageTweak.prototype.OnResize = function OnResize(event) {
        if (this.ZoomType == "fit" || this.ZoomType == "fill") {
                this.DefaultZoomType();
        }
        this.Repaint();
};

ImageTweak.prototype.OnDragStart = function OnDragStart(event) { 
        // if ( event.button == 0 ) {
                this.Dragging = true;
                //event.dataTransfer.mozSetDataAt("image/png", this.Image, 0);
                //event.dataTransfer.mozSetDataAt("application/x-moz-file", this.Image, 0);
                event.dataTransfer.setData("text/uri-list", this.Image.URL);
                event.dataTransfer.setData("text/plain", this.Image.URL);
                this.Document.body.style.cursor = "move";
                this.ClientXDrag = this.ClientXPrev;
                this.ClientYDrag = this.ClientYPrev;
        // }
};

ImageTweak.prototype.OnDragEnd = function OnDragEnd(event) { 
        // if ( event.button == 0 ) {
                this.Dragging = false;
                this.Document.body.style.cursor = "auto";
        // }       
};

ImageTweak.prototype.OnDrag = function OnDrag(event) { 
        // if ( this.Dragging && this.ClientXPrev != null ) {
                this.PerformMove( this.ClientXDrag - this.ClientXPrev, this.ClientYDrag - this.ClientYPrev );
        // }               
        this.ClientXPrev = this.ClientXDrag;
        this.ClientYPrev = this.ClientYDrag;
};

ImageTweak.prototype.OnDragEnterWindow = function OnDragEnterWindow(event) { 
        // if ( event.button == 0 ) {
                event.dataTransfer.effectAllowed = "none";
        // }
};

ImageTweak.prototype.OnDragExitWindow = function OnDragExitWindow(event) { 
        // if ( event.button == 0 ) {
                event.dataTransfer.effectAllowed = "all";
        // }
};

ImageTweak.prototype.OnDragOverWindow = function OnDragOverWindow(event) { 
        this.ClientXDrag = event.clientX;
        this.ClientYDrag = event.clientY;
};

ImageTweak.prototype.OnMouseDown = function OnMouseDown(event) {
        if (event.button == 1 && event.ctrlKey == false && this.GetPref("Scrolling")) {
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
        if ( event.altKey || event.shiftKey || event.metaKey ) {
                return true;
        } else if ( ( this.GetPref( "LegacyScrolling" ) && !event.ctrlKey ) || ( !this.GetPref( "LegacyScrolling" ) && event.ctrlKey ) ) {
                var ZoomDelta = ( event.detail > 0 ? 1 : -1 ) * ( this.GetPref( "InvertMouseWheel" ) ? 1 : -1 ); 
                this.PerformZoom( ZoomDelta, this.ClientXPrev, this.ClientYPrev ); // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=352179 - darn you, mozilla!
                event.preventDefault();
        } else if ( ( this.GetPref( "LegacyScrolling" ) && event.ctrlKey ) || ( !this.GetPref( "LegacyScrolling" ) && !event.ctrlKey ) ) {
                var MoveDelta = ( event.detail > 0 ? 1 : -1 ) * ( this.GetPref( "InvertMouseWheel" ) ? 1 : -1 ) * Math.min( this.Window.innerWidth, this.Window.innerHeight ) / 10;
                this.PerformMove( 0, MoveDelta ); 
                event.preventDefault();
        }
};

ImageTweak.prototype.OnKeyPress = function OnKeyPress(event) {
        if ( event.altKey || event.metaKey ) {
                return true;
        }
        var MoveDelta = ( Math.min( this.Window.innerWidth, this.Window.innerHeight ) / 10 ) * ( this.GetPref("InvertKeyboard") ? -1 : 1 );
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
        }
        if ( event.target.tagName == "IMG" && this.GetPref("ShortcutImg") ) {
                URL = event.target.src;
        } else if ( ImageTweakHelper.getComputedURL( event.target, "background-image" ) != "" && this.GetPref("ShortcutBg") ) {
                URL = makeURLAbsolute( event.target.baseURI, ImageTweakHelper.getComputedURL( event.target, "background-image" ) )
        }
        if ( URL != "" && Target( URL ) ) {
                event.preventDefault();
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
        var imgZoomFactor = this.GetPref("ZoomFactor");
        var imgZoomNew = Math.pow(imgZoomFactor, Math.round(delta + Math.log(this.Zoom) / Math.log(imgZoomFactor)));
        if ( imgZoomNew <= this.ZoomMax ) {
                var imgZoomRatio = imgZoomNew / this.Zoom;
                var imgZoomDirRatio = imgZoomRatio * ( delta < 0 ? -1 : 1 );
                if ( px != undefined && this.GetPref("ZoomOnPointer") && imgZoomNew >= this.FitZoom() ) {
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
}

ImageTweak.prototype.StartScroll = function StartScroll(event) {
        if ( this.Window.innerWidth < this.Image.width || this.Window.innerHeight < this.Image.height || this.GetPref("ClipMovement") == false ) {
                this.Scrolling = true;
                if ( ( this.Window.innerWidth < this.Image.width && this.Window.innerHeight < this.Image.height ) || this.GetPref("ClipMovement") == false ) {
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
                        hImageTweak = this;
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

ImageTweak.prototype.GetPref = function GetPref(id) {
        var p;
        switch ( this.Prefs.getPrefType( this.Preferences[ id ].pref ) ) {
                case this.Prefs.PREF_BOOL:      p = this.Prefs.getBoolPref( this.Preferences[id].pref ); break;
                case this.Prefs.PREF_STRING:    p = this.Prefs.getCharPref( this.Preferences[id].pref ); break;
                case this.Prefs.PREF_INT:       p = this.Prefs.getIntPref( this.Preferences[id].pref ); break;
        }
        if ( this.Preferences[ id ].parse ) {
                p = this.Preferences[ id ].parse(p);
        }
        return p;
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
        this.PerformZoomTypeSwitch( this.GetPref("DefaultZoomType"), false );
};

ImageTweak.prototype.ZoomTypes = {
        free:           { next:'fit',   condition:'this.GetPref("ZoomTypeFreeEnabled")' },
        fit:            { next:'fill',  condition:'this.FitZoom() < 1 && this.GetPref("ZoomTypeFitEnabled")' },
        fill:           { next:'pixel', condition:'this.FillZoom() < 1 && this.GetPref("ZoomTypeFillEnabled")' },
        pixel:          { next:'free',  condition:'this.GetPref("ZoomTypeUnscaledEnabled") || this.FitZoom() >= 1' }
};

ImageTweak.prototype.PerformZoomTypeSwitch = function PerformZoomTypeSwitch( imgZoomType, SkipCondition ) {
        if ( imgZoomType == undefined ) { 
                imgZoomType = this.ZoomTypes[ this.ZoomType ].next;
                SkipCondition = false;
        } else if ( SkipCondition == undefined ) {
                SkipCondition = true;
        } else {
                SkipCondition = false;
        }
        while ( imgZoomType != this.ZoomType && !( eval( this.ZoomTypes[ imgZoomType ].condition ) || SkipCondition ) ) {
                imgZoomType = this.ZoomTypes[ imgZoomType ].next;
        }
        this.ZoomType = imgZoomType;
        this.Repaint();
};

ImageTweak.prototype.PluginEventListeners = function PluginEventListeners() {
        var hImageTweak = this;
        if ( this.Inited ) {
        } else if ( ( this.Document instanceof ImageDocument ) === false ) { 
                // not a standalone image! so, what? let's plug in our supa-dupa source image click handler
                this.Inited = true;
                this.Document.addEventListener( 'click',        function(e) { hImageTweak.RegularDocumentOnMouseClick(e); }, false );
        } else if ( !this.Image.naturalWidth ) {
                // we are not ready yet... keep waiting...
                if ( this.TimeoutHandle != null ) {
                        clearTimeout( this.TimeoutHandle );
                }
                this.TimeoutHandle = setTimeout( function() { hImageTweak.PluginEventListeners(); }, 50 );
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
                // initialize our structure
                this.Title = this.Document.title; // this has to go after disabling automatic_image_resizing
                this.ZoomMax = Math.min( this.ImageMax / this.Image.naturalWidth, this.ImageMax / this.Image.naturalHeight );
                this.DefaultZoomType();
                // basic customizations
                this.Document.body.style.cssText += "background-color:" + this.GetPref("BackgroundColor") + "; overflow:hidden;";
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

function ImageTweakEntryPoint() {
        // remove the old unused zoomexp pref
        if ( Components.classes["@mozilla.org/content-pref/service;1"] ) { 
                Components.classes["@mozilla.org/content-pref/service;1"].getService(Components.interfaces.nsIContentPrefService).removePref(null, "extensions.imagetweak.zoomexp");
        }
        var ImageTweakStartEventHandler = function(e) {
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
        }
        //var browser = document.getElementById("appcontent");
        gBrowser.addEventListener("load", ImageTweakStartEventHandler, true);
        gBrowser.addEventListener("focus", ImageTweakStartEventHandler, true);
        gBrowser.addEventListener("DOMContentLoaded", ImageTweakStartEventHandler, true);
        gBrowser.addEventListener("DOMFrameContentLoaded", ImageTweakStartEventHandler, true);
        gBrowser.tabContainer.addEventListener("TabOpen", ImageTweakStartEventHandler, true);
};

