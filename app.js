/*
 ===========================================================================

   A Node.js application to show an example use of the DirectoryWatcher.js
   Module


   Target Node.js version: v0.10.22

 ===========================================================================
*/

// Imports / Requires
var JSFtp = require("jsftp");
var dirwatch = require("./modules/DirectoryWatcher.js");
var kue = require("kue");                                                    
var jobs = kue.createQueue();
var cassandra = require('cassandra-driver');
var async = require('async');
var client = new cassandra.Client({contactPoints: ['127.0.0.1'], keyspace: 'filewatch'});
var moment = require('moment');

// Create a monitor object that will watch a directory
// and all it's sub-directories (recursive) in this case
// we'll assume you're on a windows machine with a folder 
// named "sim" on your c: drive.
// should work on both linux and windows, update the path
// to some appropriate test directory of your own.
// you can monitor only a single folder and none of its child
// directories by simply changing the recursive parameter to
// to false
// Pull in configuration from JSON config file
var fs = require('fs');
var appconfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var simMonitor = new dirwatch.DirectoryWatcher(appconfig.sourcedir, true);

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
    host: appconfig.host, //"192.168.1.82",
    port: appconfig.port, // defaults to 21
    user: appconfig.user, // defaults to "anonymous"
    pass: appconfig.password,
    debugMode: true // defaults to "@anonymous"
  });

  console.log("Calling Upload: " + fileDetail.fullPath); 
  Ftp.put(fileDetail.fullPath, fileDetail.fileName, function (err) {
    if (!err) {
      console.log("upload success");
      // add code to fileDetail.fullPathupdate audit log of success
      var newpath = fileDetail.fullPath.replace(/\\/g, '\\\\');
      var newfile = fileDetail.fileName.replace(/\\/g, '\\\\');
      cqlCmd = "INSERT INTO ftpfileaudit (job,path,filename,status,datecreated) VALUES " +
      "(1,'" + newpath + "','" + newfile + "','complete','" + moment().format() + "')";
     //cqlCmd = "DELETE FROM ftpfileaudit WHERE path = 'test'"
     client.execute(cqlCmd, function (err, result) {
           if (!err) {
               console.log("Audit Updated.");
           } else {
               console.log("Audit update failed. Error:", err)
           }
       });
      
    }
    else {
      console.log("upload failure");
      // add queuing code to try again and audit log of failed job pending 
      // (including file and date of attempt and # tries)
      retryFTP('ftpRetry', fileDetail.fullPath, fileDetail.fileName);

    }
  });
 
});

function retryFTP (name, path, fileName){
 name = name || 'Default_Name';
 path = path || 'Default_Path';
 fileName = fileName || 'Default_FileName';
 var job = jobs.create('ftpRetry', {
   name: 'ftpRetry',
   path: path,
   fileName: fileName
 });
 job
   .on('complete', function (){
     console.log('Job', job.id, 'with name', job.data.name, 'is    done');
     var newpath = path.replace(/\\/g, '\\\\');
     var newfile = fileName.replace(/\\/g, '\\\\');
     cqlCmd = "INSERT INTO ftpfileaudit (job,path,filename,status,datecreated) VALUES (" +
      job.id + ",'" + path + "','" + fileName + "','complete','" + Date() + "')";
     client.execute(cqlCmd, function (err, result) {
           if (!err) {
               console.log("Audit Updated.");
           }
       });
   })
   .on('failed', function (){
     console.log('Job', job.id, 'with name', job.data.name, 'has  failed');
     var newpath = path.replace(/\\/g, '\\\\');
     var newfile = fileName.replace(/\\/g, '\\\\');
     cqlCmd = "INSERT INTO ftpfileaudit (job,path,filename,status,datecreated) VALUES (" +
      job.id + ",'" + path + "','" + fileName + "','failed','" + Date() + "')";
     client.execute(cqlCmd, function (err, result) {
           if (!err) {
               console.log("Audit Updated.");
           }
       });
   });
 job.save();
}
jobs.process('ftpRetry', function (job, done){
 /* carry out all the job function here */
 // Upload the file to the ftp server
  var Ftp = new JSFtp({
    host: appconfig.host, //"192.168.1.82",
    port: appconfig.port, // defaults to 21
    user: appconfig.user, // defaults to "anonymous"
    pass: appconfig.password,
    debugMode: true // defaults to "@anonymous"
  });

  console.log("Calling Upload: " + job.data.path); 
  Ftp.put(job.data.path, job.data.fileName, function (err) {
    if (!err) {
      console.log("upload success");
      // add code to update audit log of success
      done && done();
    }
    else {
      console.log("upload failure, re-queueing");
      // add queuing code to try again and audit log of failed job pending 
      // (including file and date of attempt and # tries)
      //var err = new Error('FTP connect or send error');
      done(err);
    }
  }); 
 //done && done();
});

// Let us know that directory monitoring is happening and where.
console.log("Directory Monitoring of " + simMonitor.root + " has started");
