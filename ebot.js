const util = require('util');
const remote = require('electron').remote;
const BrowserWindow = remote.BrowserWindow;
const ElectronBotProcess = BrowserWindow;
const ipcMain = remote.ipcMain;
const EventEmitter = require('events');
const ipcRenderer = require('electron').ipcRenderer;
const five = require("johnny-five");

var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
const fs = require('fs');

var SerialPort = require("serialport").SerialPort;

function ElectronBot( port , jsfile ){
    EventEmitter.call(this);

    this.jsfile = jsfile || null  ;
    this.id = generateId();
    this.port = port;
    this.ready = false;
    this.process = null;
    this.dispatcher = null;
    this.reconnect = false;    
    var thisBot = this;

    ipcMain.on( this.id, function( event, type, data ){
        console.log("message received: { type: " + type + ", err: " + util.inspect(data) + ", event: " + util.inspect(event) +"}");
        switch(type){
            case 'board-message':
                thisBot.emit('message', data);
                break;
            case 'board-disconnected':            
            case 'board-failure':                
                thisBot.disconnect();                
                break;
            case 'board-ready':
                thisBot.ready = true;
                thisBot.emit('ready');
                break;
            default:
        }
    });        

    this.disconnect = function (){
        if( this.process ){
            this.process.destroy();
        }
    }

    this.connect = function (){
        console.log("connecting...");        
        if( thisBot.process === null  ){
            forkBot( thisBot.jsfile );
        }
    }    

    function runJsOnBotProcess( jsfile ){
        if( jsfile !== null ){
            fs.readFile( thisBot.jsfile , 'utf-8' , function(err, jscode){
                if(err){ console.log("Error loading electronbot slave jscode from file: '" + thisBot.jsfile + "'"); return ; }
                thisBot.process.webContents.executeJavaScript(jscode,true);
            });        
        }
    }

    function forkBot( jsfile ){
        thisBot.process = new ElectronBotProcess( {width: 800, height: 600} );
        thisBot.process.loadURL('file://' + __dirname + '/ebot.html');                

        runJsOnBotProcess(jsfile);

        thisBot.process.webContents.openDevTools();
        thisBot.dispatcher = thisBot.process.webContents;

        thisBot.process.on('closed', function() {
            console.log("closed!");
            thisBot.dispatcher = null;
            thisBot.process = null;
            thisBot.emit('disconnected');
            if( thisBot.reconnect ){
                console.log("reconnecting in 3s...");
                setTimeout( thisBot.connect, 3000 );
            }                
        });        

        var dispatcher = thisBot.dispatcher;         
        dispatcher.once('did-finish-load',function(){
            thisBot.connecting = false;
            dispatcher.send( 'connect', thisBot.id , thisBot.port );            
        });        
    }

    function generateId(){
        return Math.round((Math.random()*1e17)).toString(16).toUpperCase();
    }    
};
util.inherits(ElectronBot, EventEmitter);


function ElectronBotSlave(){
    EventEmitter.call(this);        
    this.board = null;
    var ebot = this;
    this.board = null;



    var currTick = 0;
    var lastTick = -1;
    var boardPing = null;

    var port = null;

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


            ipcRenderer.on('command', function( event, data) {                
                ebot.emit('command', data.command, data.parameters);
            });

            event.sender.send( myId, 'board-ready' );            
            ebot.emit('ready');

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


var ElectronBots = {

    ebots: {},

    loadBots: function( jsfile, callback ){        
        this.ebots = {};
        var these = this;

        serialport.list(function (err, ports) {
            if(err){ console.log("Error listing serial ports: " + err ); return ;}
            var portsRemaining = ports.map( function( elem, idx, remaining){
                return elem.comName;                
            });
                        
            ports.forEach( createElectronBot );
            these.ebots[ portsRemaining.pop() ].connect();
            
            
            function createElectronBot( port ) {
                var portPath = port.comName;
                var electronBot = these.ebots[ portPath ] || new ElectronBot( portPath, jsfile );
                these.ebots[ portPath ] = electronBot;
                
                electronBot.once('ready', function(){ 
                    these.ebots[ portPath ].removeAllListeners('disconnected');
                    returnIfLastPort(); 
                });
                                
                electronBot.once('disconnected', function(){ 
                    delete these.ebots[ portPath ];
                    returnIfLastPort(); 
                });
                                
                //console.log(port.comName);
                //console.log(port.pnpId);
                //console.log(port.manufacturer);
            }
            
            
            function returnIfLastPort(){           
                if( ! portsRemaining ){ return }     
                if( portsRemaining.length === 0 ){
                    portsRemaining = null;
                    callback( these.ebots );
                } else {
                    these.ebots[ portsRemaining.pop() ].connect();
                }
            }        
                        
        });    
    }

}

ebot = new ElectronBotSlave();
//ebot.ElectronBot = ElectronBot;


module.exports = ElectronBots;

