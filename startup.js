'use strict';
const DEBUG = ( process.env.SNAPTRON_DEBUG === 'true' ? true : false );
const LAST_OPENED_PROJECT_NAME = '(last opened project)';
const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window
const log = console.log;
const ipcMain = require('electron').ipcMain;



ipcMain.on('snaptron-logger', function( event, msg){
    console.log( msg );
});

var handleStartupEvent = function() {
  if (process.platform !== 'win32') {
    return false;
  }

  var squirrelCommand = process.argv[1];
  switch (squirrelCommand) {
    case '--squirrel-install':
    case '--squirrel-updated':

      // Optionally do things such as:
      //
      // - Install desktop and start menu shortcuts
      
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Always quit when done
      app.quit();

      return true;
    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Always quit when done
      app.quit();

      return true;
    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated
      app.quit();
      return true;
  }
};

handleStartupEvent();


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;    

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
        app.quit();
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
    console.log("App ready.");
    // Create the browser window.
    mainWindow = new BrowserWindow({width: 800, height: 600});

    // and load the index.html of the app.
    mainWindow.LAST_OPENED_PROJECT_NAME = LAST_OPENED_PROJECT_NAME;
    mainWindow.loadURL('file://' + __dirname + '/snaptron.html#load:' + LAST_OPENED_PROJECT_NAME );

    // Open the DevTools.
    if( DEBUG ){
        mainWindow.webContents.openDevTools();
    }
    
    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
        app.quit();     
    });

});

    