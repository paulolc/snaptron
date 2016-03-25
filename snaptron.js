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
    connected : { filename: "mbot-green.png", canvas: null }, 
    reconnecting: { filename: "mbot-orange.png", canvas: null },  
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

setInterval( function syncEbotsWithSprites(){
    console.log( new Date().getTime() );
    var ebotsByPort = {};
    var spritesByPort = {};
    var ebotPorts = Object.keys( GLOBALS.ebots );


    ide_morph.sprites.contents.forEach( function( sprite ){
        var port = sprite.variables.vars['ebot-port'].value;
        if( port ){            
            spritesByPort[ port ] = sprite;
        }
    });
    
    ebotPorts.forEach( function( ebotPort ){
        var ebotIdx = ebotPort;
        var ebot = GLOBALS.ebots[ ebotIdx ];
        var sprite = spritesByPort[ ebotIdx ];
        var lastCostume;
        
        if( ebot.status !== 'offline'){
            ebot.reconnect = true;
            ebotsByPort[ ebotIdx ] = ebot;
            
            if( sprite ){         
                lastCostume = sprite.variables.vars['last-costume'].value;
                if( lastCostume !== ebot.status ){
                    console.log( 'switching to costume: ' + ebot.status );       
                    sprite.doSwitchToCostume( ebot.status );
                    sprite.variables.vars['last-costume'].value = ebot.status;
                }
            } else {
                console.log( 'creating new sprite '  );       
                sprite = ide_morph.createNewSprite( ebot.port );     
                sprite.variables.addVar( 'ebot-port', ebot.port  );
                sprite.variables.addVar( 'last-costume', "" );
                ide_morph.loadEbotStatusCostumes( sprite, function(){
                    console.log( "costumes loaded for sprite of ebot: " + ebot.port );
                });                
            }
        }        
        console.log( "     " + ebot.port+": " + ebot.status );        
    });
    
    if( ebotPorts.length === 0 ){
        ide_morph.connectMbot();
    }

}, SPRITES_EBOTS_SYNC_PERIOD_IN_MS);


mainWindow.on( 'close', function(e) {
  log('LAST_OPENED_PROJECT_NAME: ' + LAST_OPENED_PROJECT_NAME);
  ide_morph.globalVariables.vars.projectName = new Variable( ide_morph.projectName );
  ide_morph.rawSaveProject(LAST_OPENED_PROJECT_NAME);
});

world.worldCanvas.focus();
overrideSnapFunctions();
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
    
    IDE_Morph.prototype.loadCostumesImagesNotYetLoaded = function(mbotCostumeImgs, callback ){
        var thisIdeMorph = this;

        var mbotCostumeImgKeys = Object.keys( mbotCostumeImgs );
        var totalStatusImgs = mbotCostumeImgKeys.length ;
        var loadedImgsCount = 0;
        var mbotCostumeImgFile = null;

        mbotCostumeImgKeys.forEach( function( mbotCostumeImgKey ){
            
            var costumeImg = mbotCostumeImgs[ mbotCostumeImgKey ];
            if( ! costumeImg.canvas ){
                mbotCostumeImgFile = costumeImg.filename;
                thisIdeMorph.loadImg( thisIdeMorph.resourceURL( MBOT_DIR, mbotCostumeImgFile ), function( mbotCostumeCanvas ){
                    costumeImg.canvas = mbotCostumeCanvas; 
                    loadedImgsCount++;                   
                    returnWhenAllImagesLoaded(callback);   
                });                
            } else {
                loadedImgsCount++;                   
                returnWhenAllImagesLoaded( callback );
            }
            
            function returnWhenAllImagesLoaded(cb){
                if( totalStatusImgs === loadedImgsCount ){ 
                    cb(); 
                }
            }                    
        });
        
    }
    
    
    IDE_Morph.prototype.loadEbotStatusCostumes = function( sprite, callback ){
        var thisIdeMorph = this;
        thisIdeMorph.loadCostumesImagesNotYetLoaded( MBOT_STATUS_COSTUMES_IMAGES, function(){
                thisIdeMorph.hasChangedMedia = true;                                   
                var ebotStatuses = Object.keys( MBOT_STATUS_COSTUMES_IMAGES );
                    
                ebotStatuses.forEach( function addCostume( ebotStatus ){
                    var ebotCostumeImg = MBOT_STATUS_COSTUMES_IMAGES[ ebotStatus ];
                    var ebotCostume = new Costume( ebotCostumeImg.canvas, ebotStatus );
                    sprite.addCostume( ebotCostume );
                    MBOT_STATUS_COSTUMES_IMAGES[ ebotStatus ].costume = ebotCostume;
                });    
                callback();
                return;
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

