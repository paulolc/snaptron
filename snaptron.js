
var ebot = require('./ebot');
var ebots;


const SETTINGS_STORAGE_ID = 'settings';
const USER_SETTINGS_FILENAME = '.snaptron';
const MBOT_STATUS_COSTUMES_IMAGES = { 
    connected : { filename: "mbot-green.png", canvas: null }, 
    reconnecting: { filename: "mbot-orange.png", canvas: null },  
    disconnected:  { filename: "mbot-red.png", canvas: null },
};
const MBOT_DIR = 'mbot';

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
var ide_morph = new IDE_Morph();

ebot.on('ebot-ready', function( ebotReady ){
   console.log( 'got ebot-ready: ' + ebotReady.port );
   ide_morph.addNewEbotSprite( ebotReady );
});


world.worldCanvas.focus();
ide_morph.openIn(world);
overrideSnapFunctions();
loop();  


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
    
    var snapSavedOpenProjectFunction = SnapSerializer.prototype.openProject;
    SnapSerializer.prototype.openProject = function( project, ide ){
        snapSavedOpenProjectFunction( project, ide);
        console.log( 'Project Opened!');
    }
    

    IDE_Morph.prototype.connectMbot = function () {
        var msg;
        var thisIdeMorph = this;
        if( ! this.ebotsLoading ){                
            this.ebotsLoading = true;
            msg = thisIdeMorph.showMessage('Searching for connected bots');
            ebot.loadBots( "./mbot.js" , function( readyEbots ) {
                ebots = readyEbots;
                thisIdeMorph.ebotsLoading = false;
                console.log(Object.keys( ebots ));
                msg.destroy();
            });
        }
    };

    IDE_Morph.prototype.addNewEbotSprite = function ( bot ) {
        var thisIdeMorph = this;
        var spritesByEbotPort = getSpritesByEbotPort();
          
        if( ! this.templateBot ){
            if( ! existsSpriteForEbot( bot ) ){
                this.createEbotSprite( bot, function( ebotSprite ) {
                    ebotSprite.variables.vars['ebot-port'] = new Variable( bot.port );
                    thisIdeMorph.templateBot = ebotSprite;
                });                                
            } else {
                this.templateBot = spritesByEbotPort.first;
            }            
        } else {
            if( ! existsSpriteForEbot( bot ) ){
                this.duplicateSprite( this.templateBot );
                this.currentSprite.name = bot.port;
            }                                
        }

        function existsSpriteForEbot( bot ){
            return spritesByEbotPort[ bot.port ]
        }

        function getSpritesByEbotPort(){
            var spritesByEbotPort = { first: null };
            for( var i = 1; i <= thisIdeMorph.sprites.length(); i++){
                var currSprite = thisIdeMorph.sprites.at(i);
                if( spriteIsEbot( currSprite )  ){
                    if( ! spritesByEbotPort.first ){
                        spritesByEbotPort.first = currSprite.ebot;
                    }
                    spritesByEbotPort[ currSprite.ebot.port ] = currSprite.ebot;
                }
            }
            return spritesByEbotPort;
        }
        
        function spriteIsEbot( sprite ){
            return sprite.variables.vars['ebot-port'];
        }        
        
    };

    IDE_Morph.prototype.createEbotSprite = function( bot, callback ){        
        this.addEbotSprite( bot );
        var thisIdeMorph = this;
        var currentSprite = this.currentSprite;
        loadCostumes( function afterCostumesLoaded(){
                console.log('All costumes loaded');
                callback();   
        });
        
        
        function loadCostumes( cb ){
            Object.keys( MBOT_STATUS_COSTUMES_IMAGES ).forEach( function( mbotCostumeImgKey ){
                var mbotCostumeImgFile = MBOT_STATUS_COSTUMES_IMAGES[ mbotCostumeImgKey ].filename;
                thisIdeMorph.loadImg( thisIdeMorph.resourceURL( MBOT_DIR, mbotCostumeImgFile ), function( mbotCostumeCanvas ){
                    MBOT_STATUS_COSTUMES_IMAGES[ mbotCostumeImgKey ].canvas = mbotCostumeCanvas;
                    MBOT_STATUS_COSTUMES_IMAGES[ mbotCostumeImgKey ].costume = new Costume( mbotCostumeCanvas, mbotCostumeImgKey );
                    currentSprite.addCostume( MBOT_STATUS_COSTUMES_IMAGES[ mbotCostumeImgKey ].costume );     
                    thisIdeMorph.hasChangedMedia = true;                                   
                    returnWhenAllCostumesLoaded(cb);   
                });

                function returnWhenAllCostumesLoaded(){
                    if( Object.keys( MBOT_STATUS_COSTUMES_IMAGES ).length === currentSprite.costumes.length() ){ 
                        currentSprite.wearCostume( MBOT_STATUS_COSTUMES_IMAGES[ "connected" ].costume );
                        cb(); 
                    }
                }                    
            });
        }
    };



    IDE_Morph.prototype.addEbotSprite = function ( bot ) {
        var sprite = new SpriteMorph(this.globalVariables);            
        sprite.ebot = bot;
        sprite.ebot.reconnect = true;
        sprite.ebot.on('ready',function(){
            console.log('sprite ebot received ready!');
            sprite.wearCostume( MBOT_STATUS_COSTUMES_IMAGES[ "connected" ].costume );                
        });
        sprite.ebot.on('disconnected',function(){
            sprite.wearCostume( MBOT_STATUS_COSTUMES_IMAGES[ "disconnected" ].costume );                
        });
        sprite.ebot.on('reconnecting',function(){
            sprite.wearCostume( MBOT_STATUS_COSTUMES_IMAGES[ "reconnecting" ].costume );                
        });
        
        sprite.name = bot.port ; //this.newSpriteName(sprite.name);
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
