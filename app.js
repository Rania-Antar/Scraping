var feed2db       = require('./fbfeed2db'),      
    credentials   = require('./credentials'),     
    mongojs       = require('mongojs'),
    fs            = require('fs'),
    Promise       = require('es6-promise').Promise,
    http          = require('http'),
    staticServer  = require('node-static'),
    moment        = require('moment')
;


var fbGroups = [
  // {id:'353600645011444', name: 'Lost And Found Tunisia'}
  {id:'1262213584168454', name: 'Web Scraping'}
  
];

var NUM_DISPLAYED = 200;

var TIMEOUT = 10 /* minutes */ * 60000 /* ms in a minute */;


var FEEDS_JSON = 'public/data/feeds.json';
var connection_string = '127.0.0.1/pi';
var jobNum = 0;


function log(message) {
  console.log(new Date() + '\tJob num: ' + jobNum + '\t---' + message +'---');
}

function getFeedPromises () {
  return fbGroups.map(function(group) {
    return feed2db.feed2db(group.id, group.name);
  });
}

function saveToJson (db) {
  db.fb
    .find({ $or: [{story: {$exists: true}},
                  {message: {$exists: true}}] },
          {_id: 0, id: 1, groupName: 1, groupID: 1, comments: 1, description: 1, updated_time: 1})
    .sort({"updated_time": -1})
    .skip(0)
    .limit(NUM_DISPLAYED)
    .toArray(function dbToJson(err, items) {
      if(err) {
        log('error when fetching data from db: ' + err.message);
        db.close();
      }
      else {
        items.forEach(function(item){
          item.timeAgo = moment(item.updated_time).fromNow();
        });
        fs.writeFile(FEEDS_JSON, 'var feeds = ' + JSON.stringify(items), function (err) {
          if(err) {
            log('error when saving to feeds.json' + err.message);
          }
          log('job finished OK');
          db.close();
        });
      }
    });
}

function getFeeds() {
  jobNum++;
  log('job started');

   var db = mongojs(connection_string, ['fb']);
  
  feed2db.setAccessToken(credentials.fbAccessToken);
  feed2db.setDBConnection(db.fb);

  Promise
    .all(getFeedPromises())
      .then(function(){
        saveToJson(db);
        console.log('done');
      })
  ;
  
}

function startStaticServer() {
  var ipaddress = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
      port = process.env.OPENSHIFT_NODEJS_PORT || 3000,
      file = new staticServer.Server('./public')
  ;

  if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
    connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
                        process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
                        process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
                        process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
                        process.env.OPENSHIFT_APP_NAME;
  }

  http.createServer(function (request, response) {
    request.addListener('end', function () {
      file.serve(request, response);
    }).resume();
  }).listen(port, ipaddress);
}

function start() {
  log('app started');
  moment.locale('ru');
  startStaticServer();
  getFeeds();
  setInterval(getFeeds, TIMEOUT);
}


start();

