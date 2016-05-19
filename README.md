# Snaptron
It's snap, the visual, blocks based programming language stuffed in electron to control firmata based robots via the serial port.
It was inspired by [Snap4Arduino](http://s4a.cat/snap/) and [mBlock](http://www.mblock.cc/).

Snaptron's main features:
- Support for multiple connected robots. A Snap! sprite is assigned to each robot so you can control it independently. 
- No need to know on which serial port the robot is. Snaptron scans all serial ports for signs of a connected robot
- Provides visual feedback of the robot connection status (connected, reconnecting, disconnected, offline)
- Automatically detects robots disconnection and makes a predetermined number of attempts to reconnect
- Automatically saves the project on exit
- Automatically loads the last opened project when application starts

# Install and run

You can install and run snaptron by running

```bash
git clone https://github.com/paulolc/snaptron.git
npm install
npm start
```

# Build Windows 7 x64 installer

After cloning the repository, you can run:

```bash
npm run dist
```

# Discuss

Gitter room for anyone interested in discussing anything related with snaptron:
[![Join the chat at https://gitter.im/paulolc/snaptron](https://badges.gitter.im/paulolc/snaptron.svg)](https://gitter.im/paulolc/snaptron?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

