const util = require('util');
const remote = require('electron').remote;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

var mainWindow = remote.getCurrentWindow();
const ipcRenderer = require('electron').ipcRenderer;
var ebot = require('./ebot');
var GLOBALS = {
    ebots: ebot.ebots
}


//////////////////////////////////////////////////////////////////////////////////////////////////

/*


var mineflayer = require('mineflayer');
var Vec3 = mineflayer.vec3.Vec3;
var zeroVec = new Vec3(0, 0, 0);

var bot = mineflayer.createBot({
  username: 'CoderDojoLX',
  verbose: true
});

bot.on('message',function(jsonMsg){
    console.log('message: "' + JSON.stringify( jsonMsg ) + "'");    
});

bot.on('chat', function(username, message) {
  if(username === bot.username) return;
  console.log('bot chat:' + message);
  bot.chat(message);
});
*/

/*

function equip(destination,item,done)
{
     if (item!=null && item!=true)
     {
          bot.equip(item, destination, function(err)
          {
               if (err)
               {
                    console.log("unable to equip " + item.name);
                    //console.log(err.stack);
                    setTimeout(function(){done(false);},200);
               }
               else
               {
                    console.log("equipped " + item.name);
                    setTimeout(done,200);
               }
          });
     }
     else if(item==null)
     {
          console.log("I have no such item");// change this maybe : yes : it should be fixed by : either it's a block you can break by hand, either go get a block... (and if it's to build : careful you might die... : figure a way out)
          done();
     }
     else if(item==true) // already equipped
     {
          done();
     }    
}

function relativePos( x, y, z ){
    var vec = new Vec3(x,y,z);
    return bot.entity.position.plus(vec);
}

function blockAtRelativePos( x, y, z ){
    var vec = new Vec3(x,y,z);
    return bot.blockAt( bot.entity.position.plus(vec) ) ;
}

*/
//////////////////////////////////////////////////////////////////////////////////////////////////



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

setWindowMenu();
overrideSnapFunctions();

ide_morph.loadAllCostumes( function() {
    GLOBALS.syncEbotsWithSpritesInterval = setInterval( syncEbotsWithSprites, SPRITES_EBOTS_SYNC_PERIOD_IN_MS);
});

mainWindow.on( 'close', function(e) {
  log('LAST_OPENED_PROJECT_NAME: ' + LAST_OPENED_PROJECT_NAME);
  ide_morph.globalVariables.vars.projectName = new Variable( ide_morph.projectName );
  var ebotPorts = Object.keys( GLOBALS.ebots );
  ebotPorts.forEach( function( ebotPort ){
    var ebotIdx = ebotPort;
    var ebot = GLOBALS.ebots[ ebotIdx ];    
    ebot.offline();
  });  
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

function syncEbotsWithSprites(){
        //console.log( new Date().getTime() );
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
            
            if( ebot.status !== 'offline' ){
                ebot.reconnect = true;
                ebotsByPort[ ebotIdx ] = ebot;
                
            }    

            if( sprite ){        
                if( sprite.lastStatus !== ebot.status ){
                    console.log( 'switching to costume: ' + ebot.status );
                    sprite.lastStatus = ( sprite.getCostumeIdx() !== 0 ? ebot.status : "" );               
                    setSpriteStatus( sprite , ebot.status );       
                }
            } else {
                if( ebot.status !== 'offline' ){
                    ebot.on('message',function(data){
                        console.log( 'ebot: received message: ' + JSON.stringify(data) );
                        sprite.variables.setVar( VARNAME_BY_SENSOR[ data.sensor ] , data.value);
                    });
                    sprite = ide_morph.createNewSprite( ebot.port );     
                    addVars(sprite, ['ebot-port', LIGHT_SENSOR_VARNAME, PROXIMITY_SENSOR_VARNAME, BUTTON_SENSOR_VARNAME ])
                    sprite.variables.setVar( 'ebot-port', ebot.port  );
                    sprite.lastStatus = "";
                    setSpriteStatus( sprite , ebot.status );       
                }
            }
                    
            //console.log( "     " + ebot.port+": " + ebot.status );        
        });
        
        if( ebotPorts.length === 0 ){
            ide_morph.connectMbot();
        }

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
                loadedStatusCostume = MBOT_STATUS_COSTUMES_IMAGES[ status ].costume;
                if( loadedStatusCostume ) {
                    sprite.addCostume( loadedStatusCostume );                
                }                            
            }            
        }
}


function overrideSnapFunctions(){
    
    SpriteMorph.prototype.sendCommand = function( command ){
        console.log( "Sending command '"+command+"' to: '" + this.name + "'");
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
       
    var overridenNewProjectFunction = IDE_Morph.prototype.newProject;
        
    IDE_Morph.prototype.newProject = function(){
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