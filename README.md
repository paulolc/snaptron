It's snap, the visual, blocks based programming language stuffed in electron to control mBots.

Still not in a usable state. A lot of stuff is missing to get this to work even in a minimal way.
Some blocks are in portuguese and only mBots are supported for the moment.

Meanwhile you can use Snap4Arduino or mBlock.

Gitter room for anyone interested in discussing anything related with snaptron:
[![Join the chat at https://gitter.im/paulolc/snaptron](https://badges.gitter.im/paulolc/snaptron.svg)](https://gitter.im/paulolc/snaptron?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

The snaptron's main features:
- Support for multiple connected robots. A Snap! sprite is assigned to each robot so you can control it independently. 
- No need to know on which serial port the robot is. Snaptron scans all serial ports for signs of a connected robot
- Provides visual feedback of the robot connection status (connected, reconnecting, disconnected, offline)
- Automatically detects robots disconnection and makes a predetermined number of attempts to reconnect
- Automatically saves the project on exit
- Automatically loads the last opened project when application starts
