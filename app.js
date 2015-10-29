/*
 ===========================================================================

   A Node.js application to show an example use of the DirectoryWatcher.js
   Module

   Current Version: 0.0.1
                    December 19 2013 

   Author(s): George H. Slaterpryce III
   License: CPOL : The Code Project Open License 1.02
            http://www.codeproject.com/info/cpol10.aspx

   Copyright: (c) 2013 Slaterpryce Intellect Corp

   If you modify this code please add your name and what was modified to this
   header, as well as the date modified.

   Target Node.js version: v0.10.22

 ===========================================================================
*/

// Imports / Requires
var JSFtp = require("jsftp");
var dirwatch = require("./modules/DirectoryWatcher.js");

// Create a monitor object that will watch a directory
// and all it's sub-directories (recursive) in this case
// we'll assume you're on a windows machine with a folder 
// named "sim" on your c: drive.
// should work on both linux and windows, update the path
// to some appropriate test directory of your own.
// you can monitor only a single folder and none of its child
// directories by simply changing the recursive parameter to
// to false
var simMonitor = new dirwatch.DirectoryWatcher("C:\\sim", true);

// start the monitor and have it check for updates
// every half second.
simMonitor.start(500);

// Log to the console when a file is removed
simMonitor.on("fileRemoved", function (filePath) {
  console.log("File Deleted: " + filePath);
});

// Log to the console when a folder is removed
simMonitor.on("folderRemoved", function (folderPath) {
  console.log("Folder Removed: " + folderPath);
});

// log to the console when a folder is added
simMonitor.on("folderAdded", function (folderPath) {
  console.log(folderPath);
});

// Log to the console when a file is changed.
simMonitor.on("fileChanged", function (fileDetail, changes) {
  console.log("File Changed: " + fileDetail.fullPath);
  for (var key in changes) {
    console.log("  + " + key + " changed...");
    console.log("    - From: " + ((changes[key].baseValue instanceof Date) ? changes[key].baseValue.toISOString() : changes[key].baseValue));
    console.log("    - To  : " + ((changes[key].comparedValue instanceof Date) ? changes[key].comparedValue.toISOString() : changes[key].comparedValue));
  }
});

// log to the console when a file is added.
simMonitor.on("fileAdded", function (fileDetail) {
  console.log("File Added: " + fileDetail.fullPath);
  // Upload the file to the ftp server
  var Ftp = new JSFtp({
    host: "192.168.1.82",
    port: 21, // defaults to 21
    user: "ftp-user", // defaults to "anonymous"
    pass: "ftp1234",
    debugMode: true // defaults to "@anonymous"
  });

  console.log("Calling Upload: " + fileDetail.fullPath); 
  Ftp.put(fileDetail.fullPath, fileDetail.fileName, function (err) {
    if (!err) {
      console.log("upload success");
    }
    else {
      console.log("upload failure");
    }
  });
 
});

// Let us know that directory monitoring is happening and where.
console.log("Directory Monitoring of " + simMonitor.root + " has started");