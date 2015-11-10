CREATE KEYSPACE FileWatch WITH replication = {'class':'SimpleStrategy', 'replication_factor':1};
USE FileWatch;




CREATE TABLE ftpfileaudit (job double, path TEXT, filename TEXT, status TEXT, datecreated TIMESTAMP, PRIMARY KEY (path));

