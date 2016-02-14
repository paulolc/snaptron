
var ElectronBotController = require('./ebot').ElectronBot;

var allbots = {};

var botPort = "COM5";
var ElectronBots = {};
ElectronBots[ botPort ] = new ElectronBotController( botPort , './mbot.js') ;
ElectronBots[ botPort ].connect();
ElectronBots[ botPort ].on('disconnected', function(){
    console.log("disconnected");
    console.log("reconnecting in 5s...");
    setTimeout( function(){
        console.log("reconnecting NOW!");
        ElectronBots[ botPort ].connect();
    }, 5000);    
});

/*
var serialport = require("serialport");
serialport.list(function (err, ports) {
    if(err){ console.log("Error listing serial ports: " + err ); return ;}
    ports.forEach( function( port ) {
    console.log(port.comName);
    console.log(port.pnpId);
    console.log(port.manufacturer);
  });
});
*/


const SETTINGS_STORAGE_ID = 'settings';
const USER_SETTINGS_FILENAME = '.snaptron';

// hey stupid, don't use globals, mkay?
if (typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    var userSettingsFile = os.homedir() + '/' + USER_SETTINGS_FILENAME;
    localStorage = new LocalStorage(userSettingsFile);
    log('User settings loaded from: "'+userSettingsFile+'"');
}

var tempStorage = JSON.parse( localStorage.getItem( SETTINGS_STORAGE_ID ));
if( !tempStorage ){ tempStorage = {}; }
( tempStorage[ '-snap-setting-design' ]  ? "" : tempStorage[ '-snap-setting-design' ] =  'flat' );
( tempStorage[ '-snap-setting-language'] ? "" : tempStorage[ '-snap-setting-language'] =  'pt' );

var world = new WorldMorph(document.getElementById('world'));
world.worldCanvas.focus();

var ide_morph = new IDE_Morph();
ide_morph.openIn(world);
overrideSnapFunctions();
loop();  

function startSnap4mbot(){}



function loop() {
    requestAnimationFrame(loop);
    world.doOneCycle();
}

function saveStorage(){
    localStorage.setItem(SETTINGS_STORAGE_ID, JSON.stringify( tempStorage ) );
}

function log( text, type){
    var date = new Date();
    var inSandbox = ( typeof chrome.app === 'undefined' )
    console.log("[INFO](%s) %02d/%02d/%02d %02d:%02d:%02d.%03d - %s", 
        (inSandbox? 'S': ' '), 
        date.getFullYear(), 
        date.getMonth(), 
        date.getDate(), 
        date.getHours(), 
        date.getMinutes(), 
        date.getSeconds(), 
        date.getMilliseconds(), 
        text
        );
}

    function overrideSnapFunctions(){
        
/*
        IDE_Morph.prototype.getURL = function (url, callback) {                        
            myself = this;
            channel.call( { 
                method: "get_url",
                params: url,
                success: function( responseText ){ 
                    callback( responseText );
                },
                error: function( err ){
                    myself.showMessage( err );
                }                       
            });
        }

        IDE_Morph.prototype.loadImg = function( url, callback ){
            channel.call( { 
                method: "get_imgbase64",
                params: url,
                success: function( dataUrl ){ 
                    var img = new Image();
                    img.onload = function () {
                        var canvas = newCanvas(new Point(img.width, img.height));
                        canvas.getContext('2d').drawImage(img, 0, 0);
                        callback( canvas );
                    };                
                    img.src = dataUrl;
                },
                error: function( err ){
                    myself.showMessage( err );
                }                       
            });            
        }
*/

        IDE_Morph.prototype.connectMbot = function () {
            //if( !mBotResetOngoing ){
                startSnap4mbot();   
            //}
        };

        IDE_Morph.prototype.serialSelectMenu = function () {
            var menu,
                stage = this.stage,
                world = this.world(),
                myself = this,
                pos = this.controlBar.serialSelectButton.bottomLeft(),
                shiftClicked = (world.currentKey === 16);

            function addPreference(label, toggle, test, onHint, offHint, hide) {
                var on = '\u25c9 ',
                    off = '\u25EF ';
                if (!hide || shiftClicked) {
                    menu.addItem(
                        (test ? on : off) + localize(label),
                        toggle,
                        test ? onHint : offHint,
                        hide ? new Color(100, 0, 0) : null
                    );
                }
            }

            menu = new MenuMorph(this);
            menu.addLine();
            var sortedSerialPorts = serialPorts.map( function( serialPort ){
                return serialPort.path;
            }).sort( function naturalCompare(a, b) {
                var ax = [], bx = [];

                a.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { ax.push([$1 || Infinity, $2 || ""]) });
                b.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { bx.push([$1 || Infinity, $2 || ""]) });
                
                while(ax.length && bx.length) {
                    var an = ax.shift();
                    var bn = bx.shift();
                    var nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
                    if(nn) return nn;
                }

                return ax.length - bx.length;
            });
            
            sortedSerialPorts.forEach( function( serialPort ){
                addPreference(
                    serialPort + ':',
                    'selectSerialPort',
                    false,
                    'click to select ' + serialPort,
                    'click to select ' + serialPort,
                    false
                );
                
            });
            
            menu.popup(world, pos);
        };
    }
