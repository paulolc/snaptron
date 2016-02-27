const five = require('johnny-five');
const pixel = require("node-pixel");


var strip = null;
var wheels = null;

function MBotWheels(){
    var l_motor = new five.Motor({pins: {pwm: 6, dir: 7}});
    var r_motor = new five.Motor({pins: {pwm: 5, dir: 4}});
    const max_speed_l = 150;
    const max_speed_r = 150;

    this.left = new MBotWheel( l_motor , max_speed_l, true);
    this.right = new MBotWheel( r_motor , max_speed_r,  false);
    
    this.stop = function(){
        this.left.stop();
        this.right.stop();
    }
    
    this.move = function( parameters ){
        switch( parameters.direction ){
            case "forward":
                this.left.forward();
                this.right.forward();
                break;
            case "backward":
                this.left.reverse();
                this.right.reverse();
                break;
            case "left":
                this.left.reverse();
                this.right.forward();
                break;
            case "right":
                this.left.forward();
                this.right.reverse();
                break;
        }
    }    
    
}

function MBotWheel( aMotor, theMaxSpeed, reversed ){
    var throttlePercentage = 50;
    var isReversed = reversed;
    var maxSpeed = throttlePercentage / 100 * theMaxSpeed;
    var motor = aMotor;

    function move( inReverse ){
        if( inReverse ){
            motor.reverse( maxSpeed );            
        } else {
            motor.forward( maxSpeed );
        }        
    }

    this.forward = function( duration ){
        move( isReversed );
    }

    this.reverse = function( duration ){
        move( ! isReversed );
    }
    
    this.stop = function(){
        motor.stop();
    }
    
}


ebot.on('ready', function(){
    wheels = new MBotWheels();

    strip = new pixel.Strip({
        data: 13,
        length: 2,
        board: ebot.board,
        controller: "FIRMATA",
    });
    
});

ebot.on('command', function( command, parameters ){
    switch( command ){
        case 'move':
            wheels.move( parameters );
            break;
        case 'stop':
            wheels.stop();
            break;
        case 'led':
            strip.pixel( parameters.pos ).color( parameters.color );            
            strip.show();                
            break;
    }
    
});