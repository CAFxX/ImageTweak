![ImageTweak icon](https://github.com/CAFxX/ImageTweak/raw/master/skin/imagetweak128.png)
# ImageTweak 
Mozilla Firefox add-on for improving the image viewing UX 

[Homepage](http://cafxx.strayorange.com/ImageTweak) - 
[Downloads](https://addons.mozilla.org/en-US/firefox/addon/3683) - 
[User guide](https://github.com/CAFxX/ImageTweak/wiki/ImageTweak-user-guide) - 
[Source code (GitHub)](http://github.com/CAFxX/ImageTweak) - 
[Contact me](mailto:imagetweak@cafxx.strayorange.com)

ImageTweak is an add-on for Firefox, Iceweasel and SeaMonkey that enhances the vision of images in the browser by allowing zooming, rotating and viewing them against a custom/neutral/dark/black background.

ImageTweak is free software licensed under the terms of the [GPLv3](http://www.gnu.org/licenses/gpl-3.0-standalone.html).

![GPLv3 logo](http://www.gnu.org/graphics/gplv3-88x31.png)

## User guide
An updated [user guide](https://github.com/CAFxX/ImageTweak/wiki/ImageTweak-user-guide) is available.

## Contribute
You can contribute code to ImageTweak by sending patches or pull requests, a [list of planned features](http://github.com/CAFxX/ImageTweak/wiki) is available. Alternatively you can make donations to support the development of ImageTweak on [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/3683) or by sending bitcoins to 1265ciMoFwnX4y4gGxXNGkiD7Qu24oYSqw.

You can also help by [reporting bugs](http://github.com/CAFxX/ImageTweak/issues) (please, try to be as acccurate as possible by including your OS, browser version, extensions installed, plugins and exact steps to reproduce the bug: if I can't reproduce it, most likely I won't be able to fix it!), [suggesting new features](http://github.com/CAFxX/ImageTweak/wiki) or by [translating ImageTweak in your language](http://www.babelzilla.org/).

## Detecting ImageTweak from other extensions (chrome code)
Other extensions that wish to play nice with ImageTweak can use the following function to test for the presence of ImageTweak.

	/* 
		Check if ImageTweak is installed and enabled.
		The argument doc is optional.
		* isImageTweakEnabled() returns true if ImageTweak is enabled.
		* isImageTweakEnabled(document) returns true if the content document 
		  is being displayed using ImageTweak
        This works only if run from a browser.xul overlay.
	*/
	function isImageTweakEnabled(doc) {
		try {
			return ImageTweak ? ImageTweak.enabled(doc) : false;
		} catch (e) {
			return false;
		}
	}

## Detecting ImageTweak from web pages (content code)
Since version 0.21 ImageTweak injects the imageViewer flag in the navigator object. 
Web pages that want to know if an advanced image viewer is available in the browser
can query navigator.imageViewer:

	if (navigator.imageViewer) {
		// an advanced image viewer is available in the browser
	} else {
		// no advanced image viewer available
	}
	
This behaviour is on by default but can be disabled by unticking the "Notify websites"
checkbox in the preference window or by setting the extensions.imagetweak.contentdetectable 
preference to false.

Please note that the flag does not contain any information about the name or version
of the extension that is providing the image viewer.

Websites may check for this flag to decide between using their custom image viewer 
or letting the native image viewer do its job.