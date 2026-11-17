'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Loads one or more files from src/ into an isolated VM sandbox and returns the sandbox
 * object, so a test can pull out the specific function(s) it wants to exercise. Apps
 * Script concatenates every src file into one shared global scope at runtime; this does
 * the same thing locally, with minimal stand-ins for the GAS services a file might touch
 * at load time, so files can be loaded without a live Apps Script project.
 */
module.exports = function loadSrc() {
  const fileNames = Array.prototype.slice.call(arguments);
  const sandbox = {
    Logger: { log: function () {} },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function () { return null; } }; } },
    LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } },
    Utilities: { formatDate: function () { return ''; } },
    Session: { getScriptTimeZone: function () { return 'America/New_York'; } }
  };
  vm.createContext(sandbox);

  fileNames.forEach(function (fileName) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'src', fileName), 'utf8');
    vm.runInContext(code, sandbox, { filename: fileName });
  });

  return sandbox;
};
