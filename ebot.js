const util = require('util');
const remote = require('electron').remote;
const BrowserWindow = remote.BrowserWindow;
const ElectronBotProcess = BrowserWindow;
const ipcMain = remote.ipcMain;
const DEBUG = ( process.env.EBOT_DEBUG === 'true' || process.env.SNAPTRON_DEBUG === 'true' ? true : false );
const EventEmitter = require('events');
const ipcRenderer = require('electron').ipcRenderer;
const five = require("johnny-five");
const fs = require('fs');

const SERIAL_PROBE_TIMEOUT_IN_MS = 15000;
const FIRMATA_GETVERSION_CMD = 0xF9;
const BOARD_WATCHDOG_INTERVAL_IN_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;
const TIME_BETWEEN_RECONNECT_ATTEMPTS_IN_MS = 5000;
const BOARD_PING_PERIOD_IN_MS = 1000;

var serialport = require("serialport");
var SerialPort = serialport.SerialPort;

function ElectronBot( port , jsfile ){
    EventEmitter.call(this);
    this.jsfile = jsfile || null  ;
    this.id = generateId();
    this.port = port;
    this.offline = true;
    this.ready = false;
    this.process = null;
    this.dispatcher = null;
    this.reconnect = false;    
    this.status = 'offline';
    var thisBot = this;
    
    
    this.on('disconnected', function(){
       this.setStatus( 'disconnected' ); 
    });

    this.on('ready', function(){
       this.setStatus( 'connected' ); 
    });

    this.on('reconnecting', function(){
       this.setStatus( 'connecting' ); 
    });

    ipcMain.on( this.id, function( event, type, data ){
        console.log("message received at: " + this.id + ": { type: " + type + ", err: " + util.inspect(data) + ", event: " + util.inspect(event) +"}");
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
                thisBot.reconnectAttemptsRemaining = MAX_RECONNECT_ATTEMPTS;                                
                console.log('ebot emitted ready!');
                thisBot.emit('ready');
                break;
            default:
        }
    });        
    
    this.offline = function(){
        this.disconnect();
        this.status = 'offline';
    }

    this.setStatus = function( status ){
        if( this.status !== 'offline' ){
            this.status = status;            
        } else if ( status === 'connected' ){
            this.status = status;
        }
    }

    this.disconnect = function (){
        this.ready = false;
        this.setStatus( 'disconnected' );
        if( this.process ){
            this.process.destroy();
        }
    }

    this.connect = function (){
        //console.log("connecting...");        
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
        var showWindow = ( DEBUG ? true: false );
        thisBot.process = new ElectronBotProcess( {width: 800, height: 600, show: showWindow } );
        thisBot.process.loadURL('file://' + __dirname + '/ebot.html');  
        if( DEBUG ){
            thisBot.process.webContents.openDevTools();
        }                      

        runJsOnBotProcess(jsfile);
        
        thisBot.dispatcher = thisBot.process.webContents;

        thisBot.process.on('closed', function() {
            console.log("closed!");
            thisBot.dispatcher = null;
            thisBot.process = null;
            if( thisBot.reconnect ){
                if( thisBot.reconnectAttemptsRemaining > 0 ){
                    thisBot.reconnectAttemptsRemaining--
                    console.log("reconnectAttemptsRemaining: " + thisBot.reconnectAttemptsRemaining );
                    console.log("reconnecting in 3s...");
                    thisBot.emit('reconnecting');                
                    setTimeout( thisBot.connect, TIME_BETWEEN_RECONNECT_ATTEMPTS_IN_MS );
                }
            }                
            thisBot.emit('disconnected');
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

    var error = null;
    var myId;
    var startTime = new Date().getTime();


    ipcRenderer.on('connect', function(event, id, portname) {
        document.title = portname;
        myId = id;   
        var port = new SerialPort( portname ); 
        var buffer = null;
                
        connectToBoardIfFound()                
                              
        function connectToBoardIfFound(){  

            port.once('open', function(){ 
                port.write(new Buffer([FIRMATA_GETVERSION_CMD]));
            });
            
            port.once('data', function( data ){
                buffer = data;
                if( data.length !== 3 || data[0] !== FIRMATA_GETVERSION_CMD ){
                    console.log('Response from board not as expected. will call now reportBoardNotFound()');          
                    reportBoardNotFound();                            
                } else {            
                    connectBoard();            
                }
            });

            setTimeout(function(){ 
                if(buffer === null){ reportBoardNotFound() }
            },SERIAL_PROBE_TIMEOUT_IN_MS);
    
            port.once('error', function(err){ 
                reportBoardNotFound();
            });
            
            function reportBoardNotFound(){                
                event.sender.send( myId, 'board-failure', new Error('Board not found on serial port ' + portname) );            
            }
            
        }

        function connectBoard(){
            
            ebot.board = new five.Board( { port: port } );    

            ebot.board.on("error", function( err ) {
                console.log("error: " + util.inspect(err) );
                if( error === null ){
                    error = err;
                    event.sender.send( myId, 'board-failure', err );            
                }
            });

            ebot.board.on("ready", function() {
                setTimeout( checkPortOpened, BOARD_WATCHDOG_INTERVAL_IN_MS, port);
                boardPing = setInterval(function pingBoard(){
                    ebot.board.queryPinState(1, function(value) {
                        currTick++;            
                    });
                }, BOARD_PING_PERIOD_IN_MS);


                ipcRenderer.on('command', function( event, data) {                
                    ebot.emit('command', data.command, data.parameters);
                });

                event.sender.send( myId, 'board-ready' );            
                ebot.emit('ready');

            });
        }

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
        setTimeout( checkPortOpened ,BOARD_WATCHDOG_INTERVAL_IN_MS, port);
    }
}

util.inherits(ElectronBotSlave, EventEmitter);


function ElectronBots(){
    EventEmitter.call(this);  
    this.ebots = {};

    this.loadBots = function( jsfile, callback ){        
        //this.ebots = {};
        var these = this;

        serialport.list(function (err, ports) {
            if(err){ console.log("Error listing serial ports: " + err ); return ;}
            //console.log(util.inspect(ports));        
            var portsCount = ports.length;                                                            
            ports.forEach( createElectronBot );
            
            function createElectronBot( port ) {
                var portPath = port.comName;
                var electronBot = these.ebots[ portPath ];
                
                if( ! electronBot ) {
                    electronBot = new ElectronBot( portPath, jsfile );
                    these.ebots[ portPath ] = electronBot;
                }
                
                electronBot.once('ready', function(){ 
                    these.ebots[ portPath ].removeAllListeners('disconnected');
                    these.emit('ebot-ready', electronBot);
                    returnIfLastPort(); 
                });
                                
                electronBot.once('disconnected', function(){ 
                    console.log('electronBot disconnected on port ' + portPath );
                    these.emit('ebot-disconnected', electronBot);
                    returnIfLastPort(); 
                });

                if( electronBot.status === 'connected' ){
                    electronBot.emit('ready');
                } else {                
                    electronBot.connect(); 
                }
            }
            
            function returnIfLastPort(){ 
                portsCount--;
                console.log( 'portsCount: '+ portsCount);
                if( portsCount === 0 ){
                    callback( these.ebots );
                } 
            }        
            
        });    
    }


}
util.inherits(ElectronBots, EventEmitter);

ebot = new ElectronBotSlave();

module.exports = new ElectronBots();

