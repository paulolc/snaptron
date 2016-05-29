const util = require('util');
const remote = require('electron').remote;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

var tempStorage = null;
var mainWindow = remote.getCurrentWindow();
const ipcRenderer = require('electron').ipcRenderer;
var ebot = require('./ebot');
var GLOBALS = {
    ebots: ebot.ebots
};

log('Starting snaptron controller...');

const PROXIMITY_SENSOR_VARNAME = 'sensor de proximidade';
const LIGHT_SENSOR_VARNAME='sensor de luz';
const BUTTON_SENSOR_VARNAME = 'botão';
const VARNAME_BY_SENSOR = { 
    'proximity': PROXIMITY_SENSOR_VARNAME,
    'light': LIGHT_SENSOR_VARNAME,
    'button': BUTTON_SENSOR_VARNAME
};

const SPRITES_EBOTS_SYNC_PERIOD_IN_MS = 2000;
const LAST_OPENED_PROJECT_NAME = mainWindow.LAST_OPENED_PROJECT_NAME;
const SETTINGS_STORAGE_ID = 'settings';
const USER_SETTINGS_FILENAME = '.snaptron';

const BOARD_COSTUMES_DIR = '..';

var BOARDS_INFO = {
    mbot: {
        costumes: {
            offline : { filename: "mbot-gray.png", canvas: null }, 
            connected : { filename: "mbot-green.png", canvas: null }, 
            reconnecting: { filename: "mbot-orange.png", canvas: null },  
            connecting: { filename: "mbot-orange.png", canvas: null },  
            disconnected:  { filename: "mbot-red.png", canvas: null },
        }
    },
    uno: {
        costumes: {
            offline : { filename: "uno-gray.png", canvas: null }, 
            connected : { filename: "uno-green.png", canvas: null }, 
            reconnecting: { filename: "uno-orange.png", canvas: null },  
            connecting: { filename: "uno-orange.png", canvas: null },  
            disconnected:  { filename: "uno-red.png", canvas: null },
        }        
    },
    default: {
        costumes: {
            offline : { filename: "uno-gray.png", canvas: null }, 
            connected : { filename: "uno-green.png", canvas: null }, 
            reconnecting: { filename: "uno-orange.png", canvas: null },  
            connecting: { filename: "uno-orange.png", canvas: null },  
            disconnected:  { filename: "uno-red.png", canvas: null },
        }        
    }
}

if (typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    var userSettingsFile = os.homedir() + '/' + USER_SETTINGS_FILENAME;
    localStorage = (new LocalStorage(userSettingsFile)).getItem( SETTINGS_STORAGE_ID ) ;
    log('User settings loaded from: "'+userSettingsFile+'"');
}

if( !localStorage ){ localStorage = {}; }
( localStorage[ '-snap-setting-design' ]  ? "" : localStorage[ '-snap-setting-design' ] =  'flat' );
( localStorage[ '-snap-setting-language'] ? "" : localStorage[ '-snap-setting-language'] =  'pt' );

setWindowMenu();
overrideSnapFunctions();

var world = new WorldMorph(document.getElementById('world'));
var ide_morph = new IDE_Morph();
ide_morph.logoURL = 'icons/snaptron32x32.png';

ide_morph.loadAllCostumes( function() {
    GLOBALS.syncEbotsWithSpritesInterval = setInterval( syncEbotsWithSprites, SPRITES_EBOTS_SYNC_PERIOD_IN_MS);
});

mainWindow.on( 'close', function(e) {
  log('LAST_OPENED_PROJECT_NAME: ' + LAST_OPENED_PROJECT_NAME);
  ide_morph.globalVariables.vars.projectName = new Variable( ide_morph.projectName );
  disconnectAllBoards();
  clearInterval( GLOBALS.syncEbotsWithSpritesInterval);
  syncEbotsWithSprites();
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

function getBoardOfSprite( sprite ) {
    return GLOBALS.ebots[ sprite.variables.getVar('ebot-port') ];
}
 
function disconnectAllBoards(){    
    var ebotPorts = Object.keys( GLOBALS.ebots )
    ebotPorts.forEach( function( ebotPort ){
        var ebotIdx = ebotPort;
        var ebot = GLOBALS.ebots[ ebotIdx ];    
        ebot.offline();
    }); 
    GLOBALS.ebots = {} 
} 
 
 
function syncEbotsWithSprites(){
        var ebotsByPort = {};
        var spritesByPort = {};
        var ebotPorts = Object.keys( GLOBALS.ebots );
        
        ide_morph.sprites.contents.forEach( function( sprite ){
            var port = getSpriteVar( sprite, 'ebot-port'); 
            if( port ){            
                spritesByPort[ port ] = sprite;
                if( ! GLOBALS.ebots[ port ] ){
                    setSpriteStatus( sprite , 'offline' );
                }
            }
        });
        
        ebotPorts.forEach( function( ebotPort ){
            var ebotIdx = ebotPort;
            var ebot = GLOBALS.ebots[ ebotIdx ];
            var sprite = spritesByPort[ ebotIdx ];
            
            if( ebot.status !== 'offline' ){
                ebot.reconnect = true;
                ebotsByPort[ ebotIdx ] = ebot;                
            }    

            if( sprite ){        
                if( sprite.lastStatus !== ebot.status ){                    
                    console.log( 'switching to costume: ' + ebot.status );
                    sprite.lastStatus = ( sprite.getCostumeIdx() !== 0 ? ebot.status : "" );               
                    setSpriteStatus( sprite , ebot.status );       
                    sprite.ebot = ebot;
                }
            } else {
                if( ebot.status !== 'offline' ){
                    ebot.on('message',function(data){
                        console.log( 'ebot: received message: ' + JSON.stringify(data) );
                        sprite.variables.setVar( VARNAME_BY_SENSOR[ data.sensor ] , data.value);
                    });
                    sprite = ide_morph.createNewSprite( ebot.port );     
                    sprite.ebot = ebot;
                    addVars(sprite, ['ebot-port', 'ebot-type', LIGHT_SENSOR_VARNAME, PROXIMITY_SENSOR_VARNAME, BUTTON_SENSOR_VARNAME ])
                    sprite.variables.setVar( 'ebot-port', ebot.port  );
                    sprite.variables.setVar( 'ebot-type', ebot.board.type  );
                    sprite.lastStatus = "";
                    setSpriteStatus( sprite , ebot.status );       
                }
            }
                    
        });
        
        /* Searching for ebots on startup or on new project should be optional
        if( ebotPorts.length === 0 ){
            ide_morph.connectMbot();
        }
        */
        
        function addVars( sprite, varsToAdd ){
            varsToAdd.forEach( function( varToAdd ){
                    sprite.variables.addVar( varToAdd , -1  );                
            });
            ide_morph.flushBlocksCache('variables');
            ide_morph.refreshPalette();            
        }

        function getSpriteVar( sprite,varName ){
            var val=null;
            try{ val = sprite.variables.getVar(varName); }catch(none){}
            return val;
        }
        

        function setSpriteStatus( sprite, status ){            
            ensureSpriteHasStatusCostume( sprite, status );
            return sprite.doSwitchToCostume( status );
        }   
        
        function ensureSpriteHasStatusCostume( sprite, status ){
            var loadedStatusCostume;
            sprite.doSwitchToCostume( status );
            if( sprite.getCostumeIdx() === 0 ){
                loadedStatusCostume = getCostumeBySpriteStatus( sprite, status); ;
                if( loadedStatusCostume ) {
                    sprite.addCostume( loadedStatusCostume );                
                }                            
            }            
        }
        
        function getCostumeBySpriteStatus( sprite, status ){
            var type = getSpriteVar( sprite, 'ebot-type'); 
            var boardType = ( type === null ? "default" : type );
            return BOARDS_INFO[ boardType ].costumes[ status ].costume;
        }
        
}


function overrideSnapFunctions(){
        
    SpriteMorph.prototype.sendCommand = function( command ){
        console.log( "Sending command '" + JSON.stringify( command ) + "' to: '" + this.name + "'");
        window.ebot.ebots[ this.name ].dispatcher.send( 'command', command );
    }    
    
    var overridenOpenProjectFunction = SnapSerializer.prototype.openProject;
        
    function loadEbotBlocks( ide ){
        ide.getURL( 'ebot-blocks.xml', function( err, responseText ) {
            ide.droppedText( responseText, "ebot-blocks" );
        });        
    }
        
    SnapSerializer.prototype.openProject = function( project, ide ){

        recoverOriginalProjectName();
        overridenOpenProjectFunction( project, ide);
        loadEbotBlocks(ide);

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
            ebot.loadBots(  __dirname + "/mbot.js" , function( readyEbots ) {
                console.log("Ebots scan finished. All connected ebots loaded.");
                thisIdeMorph.ebotsLoading = false;
                msg.destroy();
            });
        }
    };
   
    IDE_Morph.prototype.loadAllCostumes = function( callback ){
        var thisIdeMorph = this;    
        var boardTypes = Object.keys( BOARDS_INFO );

        boardTypes.forEach( function( boardType ){ 
           var costumesData = BOARDS_INFO[ boardType ].costumes ;
           if( ! costumesData ){  return; }
           var costumeImgKeys = Object.keys( costumesData );
           var imgLoadedCount = 0;

           costumeImgKeys.forEach( function( costumeImgKey ){
               var imgData = costumesData[ costumeImgKey ];
               var imgPath = "plugins/" + boardType + "/costumes/" + imgData.filename;
               thisIdeMorph.loadImg( thisIdeMorph.resourceURL( BOARD_COSTUMES_DIR , imgPath ), function( imgCanvas ){
                        thisIdeMorph.hasChangedMedia = true;                                   
                        imgData.canvas = imgCanvas; 
                        imgData.costume = new Costume( imgData.canvas, costumeImgKey );
                        imgLoadedCount++;
                        if( imgLoadedCount >= costumeImgKeys.length){
                            callback();
                        }
                });           
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
       
    var overridenNewProjectFunction = IDE_Morph.prototype.newProject;
        
    IDE_Morph.prototype.newProject = function(){
        disconnectAllBoards();
        overridenNewProjectFunction.bind(this)();
        loadEbotBlocks(this);
    }    

    var overridenCreateSpriteBar = IDE_Morph.prototype.createSpriteBar;
    IDE_Morph.prototype.createSpriteBar = function () {
        overridenCreateSpriteBar.bind(this)();            
        if (this.spriteBarHandle) {this.spriteBarHandle.destroy(); }
        this.spriteBarHandle = new StageHandleMorph(this.spriteBar);
        this.add(this.spriteBarHandle);           
    }
      

    IDE_Morph.prototype.saveSetting = function (key, value) {
        if (localStorage) {
            localStorage['-snap-setting-' + key] = value;
        }
        saveStorage()
    };

    IDE_Morph.prototype.getSetting = function (key) {
        if (localStorage) {
            return localStorage['-snap-setting-' + key];
        }
        return null;
    };

    IDE_Morph.prototype.removeSetting = function (key) {
        if (localStorage) {
            delete localStorage['-snap-setting-' + key];
        }
        saveStorage();
    };

    IDE_Morph.prototype.resourceURL = function (folder, file) {
        // Give a path a file in subfolders.
        // Method can be easily overridden if running in a custom location.
        var resourceURL = 'snap/' + folder + '/' + file;
        console.log( "resourceURL: " + resourceURL);
        return resourceURL;
    };
    
    
}  

function setWindowMenu(){
    const template = [
    {
        label: 'Debug',
        submenu: [
        {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.reload();
            }
        },
        {
            label: 'Toggle Full Screen',
            accelerator: (() => {
            if (process.platform === 'darwin')
                return 'Ctrl+Command+F';
            else
                return 'F11';
            })(),
            click: (item, focusedWindow) => {
            if (focusedWindow)
                focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
            }
        },
        {
            label: 'Toggle Developer Tools',
            accelerator: (() => {
            if (process.platform == 'darwin')
                return 'Alt+Command+I';
            else
                return 'Ctrl+Shift+I';
            })(),
            click: (item, focusedWindow) => {
            if (focusedWindow)
                focusedWindow.webContents.toggleDevTools();
            }
        },
        ]
    }];
    
    Menu.setApplicationMenu( Menu.buildFromTemplate(template) );
    
}
