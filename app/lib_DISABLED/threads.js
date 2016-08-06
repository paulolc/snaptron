Process.prototype.connectArduino = function (port) {
    /*
    var sprite = this.homeContext.receiver;

    if (!sprite.arduino.connecting) {
        sprite.arduino.connecting = true;
        if (sprite.arduino.board === undefined) {
            sprite.arduino.connect(port);
        }
    }

    if (sprite.arduino.justConnected) {
        sprite.arduino.justConnected = undefined;
        return;
    }

    if (sprite.arduino.board && sprite.arduino.board.connected) {
        return;
    }

    this.pushContext('doYield');
    this.pushContext();
    */
};

/*
    sprite.arduino.isBoardReady()
    sprite.arduino.board

    board.pinMode(pin, val);
    board.digitalWrite(pin, val);    
    board.servoWrite(pin, numericValue);
    board.digitalRead(pin, function(value) { board.pins[pin].value = value });
    board.analogWrite(pin, value);
    
    board.pins[pin].mode
    board.pins[pin].supportedModes
    board.HIGH
    board.LOW
    
*/

function isBoardReady( sprite ){
    
    if( ! sprite.ebot ) {
        throw new Error(localize('Not an arduino sprite'));	        
    }

    if( ! sprite.ebot  || sprite.ebot && sprite.ebot.status != 'connected' ) {
        throw new Error(localize('Board not connected'));	        
    }    
    
    
}


Process.prototype.setPinMode = function (pin, mode) {
    var sprite = this.homeContext.receiver;

    isBoardReady( sprite );

 //   if (sprite.ebot.isBoardReady()) {

        var board = sprite.ebot.board, 
            val;

        switch(mode[0]) {
            case 'digital input': val = board.MODES.INPUT; break;
            case 'digital output': val = board.MODES.OUTPUT; break;
            case 'PWM': val = board.MODES.PWM; break;
            case 'servo': val = board.MODES.SERVO; break;
            case 'analog input': val = board.MODES.ANALOG; break;
        }

        if (this.context.pinSet === undefined) {
            if (board.pins[pin].supportedModes.indexOf(val) > -1) {	
                board.pinMode(pin, val);
            } else { 
                return null;
            }
        }

        if (board.pins[pin].mode === val) {
            this.context.pinSet = true;
            return null;
        }

        this.pushContext('doYield');
        this.pushContext();
//    } else {
//        throw new Error(localize('Arduino not connected'));	
//    }
};

Process.prototype.servoWrite = function (pin, value) {
    var sprite = this.homeContext.receiver;

    isBoardReady( sprite );

//    if (sprite.ebot.isBoardReady()) {

        var board = sprite.ebot.board,
            numericValue;

        if (board.pins[pin].mode != board.MODES.SERVO) {
            board.pinMode(pin, board.MODES.SERVO);
        }

        switch (value[0]) {
            case 'clockwise':
                numericValue = 1200;
            break;
            case 'counter-clockwise':
                numericValue = 1700;
            break;
            case 'stopped':
                numericValue = 1500;
            break;
            case 'disconnected':
                this.digitalWrite(pin, false);
                return null;
            default:
                numericValue = value;
            break;
        }
        board.servoWrite(pin, numericValue);
        return null;
//    } else {
//        throw new Error(localize('Arduino not connected'));			
//    }
};

Process.prototype.reportAnalogReading = function (pin) {
    var sprite = this.homeContext.receiver;

    isBoardReady( sprite );

//    if (sprite.ebot.isBoardReady()) {

        var board = sprite.ebot.board; 

        if (board.pins[board.analogPins[pin]].mode != board.MODES.ANALOG) {
            board.pinMode(board.analogPins[pin], board.MODES.ANALOG);
        }

        // Ugly hack that fixes issue #5
        // "say" block inside a "forever" loop shows only first reading on GNU/Linux and MS-Windows
        // Until we find the source of the problem and a cleaner solution...

        if (!this.context.justRead) {
            this.context.justRead = true;
        } else {
            this.context.justRead = false;
            return board.pins[board.analogPins[pin]].value;
        }

        this.pushContext('doYield');
        this.pushContext();

  //  } else {
  //      throw new Error(localize('Arduino not connected'));	
  //  }
};

Process.prototype.reportDigitalReading = function (pin) {
    var sprite = this.homeContext.receiver;

    isBoardReady( sprite );

//    if (sprite.ebot.isBoardReady()) {
        var board = sprite.ebot.board; 

        if (board.pins[pin].mode != board.MODES.INPUT) {
            board.pinMode(pin, board.MODES.INPUT);
            board.digitalRead(pin, function(value) { board.pins[pin].value = value });
        }
        return board.pins[pin].value == 1;
//    } else {
//        throw new Error(localize('Arduino not connected'));		
//    }
};

Process.prototype.digitalWrite = function (pin, booleanValue) {
    var sprite = this.homeContext.receiver;

    isBoardReady( sprite );

//    if (sprite.ebot.isBoardReady()) {
        var board = sprite.ebot.board,
            val = booleanValue ? board.HIGH : board.LOW;

        if (board.pins[pin].mode != board.MODES.OUTPUT) {
            board.pinMode(pin, board.MODES.OUTPUT);
        }

        board.digitalWrite(pin, val);

        return null;
//    } else {
//        throw new Error(localize('Arduino not connected'));
//    }
};

Process.prototype.pwmWrite = function (pin, value) {
    var sprite = this.homeContext.receiver;

    isBoardReady( sprite );

//    if (sprite.ebot.isBoardReady()) {
        var board = sprite.ebot.board; 

        if (board.pins[pin].mode != board.MODES.PWM) {
            board.pinMode(pin, board.MODES.PWM);
        }

        board.analogWrite(pin, value);
        return null;
//    } else {
//        throw new Error(localize('Arduino not connected'));
//    }
};
