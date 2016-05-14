const five = require('johnny-five');
const pixel = require("node-pixel");

var buttonSensor = null;
var proximitySensor = null;
var lightSensor = null;
var strip = null;
var wheels = null;
var piezo = null;

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
    var throttlePercentage = 100;
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
    var buttonLastState = "";
    
    piezo = new five.Piezo(8);

    wheels = new MBotWheels();

    strip = new pixel.Strip({
        data: 13,
        length: 2,
        board: ebot.board,
        controller: "FIRMATA",
    });


    buttonSensor = new five.Sensor({
        pin: "A7",
    });

    buttonSensor.on("change", function() {
        var buttonState;
        var emitValue;
        if( this.value > 0 ){
            buttonState = 'up';
        } else {
            buttonState = 'down';
        }

        if( buttonLastState === 'down' &&  buttonState === 'up'  ){
             emitValue = 'up' 
        } else if( buttonLastState === 'up' &&  buttonState === 'down' ) {
             emitValue = 'down'             
        } else {
             emitValue = 'hold'                         
        }
        
        if( buttonLastState !== buttonState ){
            ebot.emit('sensor',{sensor: 'button', value: emitValue});
        }
        
        buttonLastState = buttonState;
        
        
    });

    proximitySensor = new five.Proximity({
        controller: "HCSR04",
        pin: "A3",
        freq: 500 // change this to speed you want data reported at. Slower is better
    });
    
    proximitySensor.on("data", function() {
        ebot.emit('sensor',{sensor: 'proximity', value: this.cm});
    });
    
    lightSensor = new five.Sensor({
        pin: "A6",
        freq: 500 // change this to speed you want data reported at. Slower is better
    });

    lightSensor.on("data", function() {
        ebot.emit('sensor',{sensor: 'light', value: this.value});
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
        case 'play':
            piezo.play({
                song: "C D F D A - A A A A G G G G - - C D F D G - G G G G F F F F - -",
                beats: 1 / 4,
                tempo: 100
            });            
            break;
        case 'led':
            strip.pixel( parameters.pos ).color( parameters.color );            
            strip.show();                
            break;
    }
    
});