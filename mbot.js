
const pixel = require("node-pixel");

var strip = null;

ebot.on('ready', function(){
    strip = new pixel.Strip({
        data: 13,
        length: 2,
        board: ebot.board,
        controller: "FIRMATA",
    });
    
});

ebot.on('command', function( command, parameters ){
    switch( command ){
        case 'led':
            strip.pixel( parameters.pos ).color( parameters.color );            
            strip.show();                
        break;
    }
    
});