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
    content code.

*/

const msgToContent = "imagetweak-C2c", msgToChrome = "imagetweak-c2C";
var listeners = [];

/*  
    send a message from content to Chrome
    obj       data to be sent; must be json-serializable
    callback  function to be called upon succesful completion (if specified
              the data is sent synchronously)                               
*/
function send(obj, callback) {
    if (callback instanceof function) {
        callback(sendSyncMessage(msgToChrome, obj));
    } else {
        sendAsyncMessage(msgToChrome, obj);
    }
}

/* 
    listen for messages from chrome code
*/
function listen(filter, callback) {
    if (!filter instanceof function)
        filter = function() true;
    if (!callback instanceof function)
        throw "callback should be a function";

    listeners.append({ filter: filter, callback: callback });
}

/*
    receive a message from chrome code and dispatch to the appropriate
    callbacks
*/
function receive(msg) {
    for (var i in listeners)
        if (listeners[i].filter(msg))
            async(function() listeners[i].callback(msg));
}

addMessageListener(msgToContent, receive);

exports = {
    send: send,
    listen: listen
};