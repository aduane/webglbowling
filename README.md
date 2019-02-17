# WebGL Bowling Game

A WebGL, browser-based bowling game that utilizes the Cannon.js library for real-time physics.  

Running locally:
This project uses threejs, and loading models needs to be done without running
afoul of browser's same origin policy security restrictions. To do this, I
suggest running from a simple webserver locally rather than visiting
file:///src/webglbowling/index.html.

Included is `start-server.sh`, which is a simple script that runs the WEBrick
webserver and serves files from the working directory on port 8000.

Forked from https://github.com/lettier/webglbowling
Original copyright notice:
_(C) 2014 David Lettier._  
http://www.lettier.com/
