
/*
        var five = require("johnny-five");
        var pixel = require("node-pixel");

        var port = "COM5";
        var opts = {};
        //opts.port = process.argv[2] || "";
        opts.port = port;

        var board = new five.Board(opts);
        var strip = null;

        var fps = 3; // how many frames per second do you want to try?

        board.on("error", function() {
            
        });        

        board.on("ready", function() {

            console.log("Board ready, lets add light");

            strip = new pixel.Strip({
                data: 13,
                length: 2,
                board: this,
                controller: "FIRMATA",
            });

            strip.on("ready", function() {

                console.log("Strip ready, let's go");

                var colors = ["#440000", "#000044"];
                var current_colors = [0,1];
                var current_pos = [0,1];
                var blinker = setInterval(function() {

                    strip.color("#000"); // blanks it out
                    for (var i=0; i< current_pos.length; i++) {
                        if (++current_pos[i] >= strip.stripLength()) {
                            current_pos[i] = 0;
                            if (++current_colors[i] >= colors.length) current_colors[i] = 0;
                        }
                        strip.pixel(current_pos[i]).color(colors[current_colors[i]]);
                    }
                    strip.show();
                }, 1000/fps);
            });
        });
*/        

const ipcRenderer = require('electron').ipcRenderer;
const util = require('util');        
const five = require("johnny-five");
const pixel = require("node-pixel");
const EventEmitter = require('events');
var SerialPort = require("serialport").SerialPort;


function ElectronBotSlave(){
    EventEmitter.call(this);        
    this.board = null;
    var ebot = this;
    this.board = null;



    var currTick = 0;
    var lastTick = -1;
    var boardPing = null;

    var port = null;
    var strip = null;

    var error = null;
    var myId;


    ipcRenderer.on('connect', function(event, id, portname) {
        
        myId = id;   
        port = new SerialPort( portname );
        ebot.board = new five.Board( { port: port } );    

        ebot.board.on("error", function( err ) {
            console.log("error: " + util.inspect(err) );
            if( error === null ){
                error = err;
                event.sender.send( myId, 'board-failure', err );            
            }
        });

        ebot.board.on("ready", function() {

            setTimeout( checkPortOpened ,2000, port);
            boardPing = setInterval(function pingBoard(){
                ebot.board.queryPinState(1, function(value) {
                    currTick++;            
                });
            }, 1000);
        });
                
        ebot.board.on("ready", function() {

            strip = new pixel.Strip({
                data: 13,
                length: 2,
                board: this,
                controller: "FIRMATA",
            });

            ipcRenderer.on('command', function( event, data) {                
                var command = data.command;
                var parameters = data.parameters;
                switch( command ){
                    case 'led':
                        strip.pixel( parameters.pos ).color( parameters.color );            
                        strip.show();                
                    break;
                }
            });

            event.sender.send( myId, 'board-ready' );            

        });

    });


    function checkPortOpened( port ) {
        if( currTick == lastTick ){
            console.log("BOARD DISCONNECTED!");
            // Stop the board pings otherwise the listeners will pile up and leak
            clearInterval( boardPing );
            ipcRenderer.send( myId, 'board-disconnected', new Error('board disconnected'));
        } else {
            console.log("TICKS: " + currTick ); 
        }
        lastTick = currTick;                
        setTimeout( checkPortOpened ,2000, port);
    }


}
util.inherits(ElectronBotSlave, EventEmitter);

var electronbot = new ElectronBotSlave();











/*


board.on("ready", function() {

    //console.log(util.inspect(board));

    //this.pinMode(20, five.Pin.ANALOG);

    setTimeout( checkPortOpened ,2000, port);

    boardPing = setInterval(function pingBoard(){
        board.queryPinState(1, function(value) {
            currTick++;            
        });
    }, 1000);



    this.pinMode(21, five.Pin.INPUT);
    this.digitalRead(21,function(value) {
        console.log("button value: " + value);
    });
    

    port.on('error', function( err ){
       console.log("ERROR detected on the serial board"); 
    });






  var sensor1 = new five.Sensor({
    pin: "A6",
    freq: 1000 // change this to speed you want data reported at. Slower is better
  });

  var sensor2 = new five.Sensor({
    pin: "A6",
    freq: 2000// change this to speed you want data reported at. Slower is better
  });


  sensor1.on("data", function() {
    console.log("sensor1: " + this.value);
  });

  sensor2.on("data", function() {
    console.log("sensor2: " + this.value);
  });


});
*/