"use strict";
/*

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

    ---------------------------------------------------------------------------

    This file contains support code for Electrolysis (multiprocess Firefox) in
    chrome code.

*/

const Cc = Component.classes, Ci = Component.interfaces;
const mm = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIChromeFrameMessageManager);

const msgToContent = "imagetweak-C2c", msgToChrome = "imagetweak-c2C";
var listeners = [];

/*  
    send a message from Chrome to content
    obj       data to be sent; must be json-serializable
    target    recipient of the message (if false the message is sent globally)
    callback  function to be called upon succesful completion (if specified
              the data is sent synchronously)                               
*/
function send(obj, target, callback) {
    if (!target)
        target = mm;
    else if (target instanceof Window)
        target = target.messageManager;
    else
        throw "Unknown target";
        
    if (callback instanceof function) {
        callback(target.sendSyncMessage(msgToContent, obj));
    } else {
        target.sendAsyncMessage(msgToContent, obj);
    }
}

/* 
    listen for messages from content code
*/
function listen(filter, callback) {
    if (filter instanceof Window)
        filter = function(msg) filter == msg.target;
    else if (!filter instanceof function)
        throw "filter should be a function";
    if (!callback instanceof function)
        throw "callback should be a function";
        
    listeners.append({ filter: filter, callback: callback });
}

/*
    receive a message from content code and dispatch to the appropriate
    callbacks
*/
function receive(msg) {
    for (var i in listeners)
        if (listeners[i].filter(msg))
            async(function() listeners[i].callback(msg));
}

mm.addMessageListener(msgToChrome, receive);

exports = {
    send: send,
    listen: listen
};