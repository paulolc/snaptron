const util = require('util');
const remote = require('electron').remote;
var mainWindow = remote.getCurrentWindow();
const ipcRenderer = require('electron').ipcRenderer;
var ebot = require('./ebot');
var GLOBALS = {
    ebots: ebot.ebots
}


log('Starting snaptron controller...');

const SPRITES_EBOTS_SYNC_PERIOD_IN_MS = 2000;
const LAST_OPENED_PROJECT_NAME = mainWindow.LAST_OPENED_PROJECT_NAME;
const SETTINGS_STORAGE_ID = 'settings';
const USER_SETTINGS_FILENAME = '.snaptron';
const MBOT_STATUS_COSTUMES_IMAGES = { 
    offline : { filename: "mbot-gray.png", canvas: null }, 
    connected : { filename: "mbot-green.png", canvas: null }, 
    reconnecting: { filename: "mbot-orange.png", canvas: null },  
    connecting: { filename: "mbot-orange.png", canvas: null },  
    disconnected:  { filename: "mbot-red.png", canvas: null },
};
const MBOT_DIR = 'mbot';



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
var ide_morph = new IDE_Morph();

overrideSnapFunctions();
ide_morph.loadAllCostumes( function() {
    setInterval( function syncEbotsWithSprites(){
        console.log( new Date().getTime() );
        var ebotsByPort = {};
        var spritesByPort = {};
        var ebotPorts = Object.keys( GLOBALS.ebots );
        
        ide_morph.sprites.contents.forEach( function( sprite ){
            var port = getSpriteVar( sprite, 'ebot-port'); 
            if( port ){            
                spritesByPort[ port ] = sprite;
            }
        });
        
        ebotPorts.forEach( function( ebotPort ){
            var ebotIdx = ebotPort;
            var ebot = GLOBALS.ebots[ ebotIdx ];
            var sprite = spritesByPort[ ebotIdx ];
            var lastCostume = null;
            
            if( ebot.status !== 'offline' ){
                ebot.reconnect = true;
                ebotsByPort[ ebotIdx ] = ebot;
            }    

            if( sprite ){                         
                if( ! getSpriteVar( sprite, 'last-costume') ){
                    sprite.variables.addVar( 'last-costume', "" );                
                } ;
                if( lastCostume !== ebot.status ){
                    console.log( 'switching to costume: ' + ebot.status );
                    setSpriteStatus( sprite , ebot.status );       
                    lastCostume = ( sprite.getCostumeIdx() !== 0 ? ebot.status : "" );               
                    sprite.variables.setVar('last-costume', ebot.status );
                }
            } else {
                if( ebot.status !== 'offline' ){
                    sprite = ide_morph.createNewSprite( ebot.port );     
                    sprite.variables.addVar( 'ebot-port', ebot.port  );
                    sprite.variables.addVar( 'last-costume', "" );
                    setSpriteStatus( sprite , ebot.status );       
                }
            }
                    
            console.log( "     " + ebot.port+": " + ebot.status );        
        });
        
        if( ebotPorts.length === 0 ){
            ide_morph.connectMbot();
        }

        function getSpriteVar( sprite,varName ){
            var val=null;
            try{ val = sprite.variables.getVar(varName); }catch(none){}
            return val;
        }

        function setSpriteStatus( sprite, status ){            
            var statusCostume = MBOT_STATUS_COSTUMES_IMAGES[ status ].costume;
            if( ! sprite.costumes.contains( statusCostume ) ){
                sprite.addCostume( statusCostume );                
            }
            
            return sprite.doSwitchToCostume( status );
        }

        

    }, SPRITES_EBOTS_SYNC_PERIOD_IN_MS);
    
});


mainWindow.on( 'close', function(e) {
  log('LAST_OPENED_PROJECT_NAME: ' + LAST_OPENED_PROJECT_NAME);
  ide_morph.globalVariables.vars.projectName = new Variable( ide_morph.projectName );
  ide_morph.rawSaveProject(LAST_OPENED_PROJECT_NAME);
});

world.worldCanvas.focus();
ide_morph.openIn(world);
loop();  


function loop() {
    requestAnimationFrame(loop);
    world.doOneCycle();
}

function saveStorage(){   
    localStorage.setItem(SETTINGS_STORAGE_ID, JSON.stringify( tempStorage ) );
    log('Saving storage....');
}

function log( text ){
        ipcRenderer.send('snaptron-logger', text );
}

function overrideSnapFunctions(){
    
    var overridenOpenProjectFunction = SnapSerializer.prototype.openProject;
    
    SnapSerializer.prototype.openProject = function( project, ide ){

        recoverOriginalProjectName();
        overridenOpenProjectFunction( project, ide);

        function recoverOriginalProjectName(){
            var projectNameVar = project.globalVariables.vars.projectName;  
            if( project.name === LAST_OPENED_PROJECT_NAME && projectNameVar ){            
                project.name =  projectNameVar.value ;                    
            }
        }
    }

    IDE_Morph.prototype.connectMbot = function () {
        var msg;
        var thisIdeMorph = this;

        if( ! this.ebotsLoading ){                
            this.ebotsLoading = true;
            msg = thisIdeMorph.showMessage('Searching for connected bots');
            ebot.loadBots( "./mbot.js" , function( readyEbots ) {
                console.log("Ebots scan finished. All connected ebots loaded.");
                thisIdeMorph.ebotsLoading = false;
                msg.destroy();
            });
        }
    };
      
    IDE_Morph.prototype.loadAllCostumes = function( callback ){
        var thisIdeMorph = this;    
        var imgKeys = Object.keys( MBOT_STATUS_COSTUMES_IMAGES );
        var imgLoadedCount = 0;
        imgKeys.forEach( function( imgKey ){
           var imgData =  MBOT_STATUS_COSTUMES_IMAGES[ imgKey ];
           thisIdeMorph.loadImg( thisIdeMorph.resourceURL( MBOT_DIR, imgData.filename ), function( imgCanvas ){
                thisIdeMorph.hasChangedMedia = true;                                   
                imgData.canvas = imgCanvas; 
                imgData.costume = new Costume( imgData.canvas, imgKey );
                imgLoadedCount++;
                if( imgLoadedCount >= imgKeys.length){
                    callback();
                }
           });           
        });
    }
  
    IDE_Morph.prototype.createNewSprite = function( spriteName ){        
        var sprite = new SpriteMorph(this.globalVariables);            
        
        sprite.name = spriteName ; 
        sprite.setCenter(this.stage.center());
        this.stage.add(sprite);

        sprite.setHue(25);
        sprite.setBrightness(75);
        sprite.turn(0);
        sprite.setXPosition( ( ide_morph.sprites.length() - 2 ) * 100  - 80 );
        sprite.setYPosition( -100 );

        this.sprites.add(sprite);
        this.corral.addSprite(sprite);
        this.selectSprite(sprite);
        
        return sprite;
    };
}    

