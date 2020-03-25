var _         = require('lodash'),
    graph     = require('fbgraph'),               
    Promise   = require('es6-promise').Promise,
    db                                            
;

var DESCRIPTION_THRESHOLD = 140; 
graph.setVersion('2.3');

var fbSimpleFields = ['id','message','story','created_time','updated_time'];

var getGraphData = function(group) {
  return new Promise(function(resolve, reject) {
    var fbParams = 'fields='+fbSimpleFields.join()+',from,full_picture,comments.limit(1).summary(true)&locale=ru_RU';

    var url = '/'+group.id+'/feed?' + fbParams;
    graph.get(url, handler);

    function handler(err, res) {
      if (err) {
        console.log('Error in Graph API feed call:', err);
        reject(this);
      }
      else {
        resolve({group: group, response: res});
      }
    }
  });
};

var processGraphData = function(obj) {
  var rawData = obj.response,
      group = obj.group
  ;

  return new Promise(function(resolve, reject){
    var data = (rawData && rawData.data) || [];
    var currentTime = new Date();

    var items = data.map(function(item) {
      var description = item.message || item.story || '';
      if (description.length > DESCRIPTION_THRESHOLD + 5)
        description = description.substring(0, DESCRIPTION_THRESHOLD) + '...';
      return _.extend(
        {
          groupID: group.id,
          groupName: group.name,
          from: item.from ? item.from.name : '',
          description:  description,
          timeStamp: currentTime
        },
        _.pick(item, fbSimpleFields)
      );
    });
    resolve({group: group, items: items});
  });
};

function storeGraphData(obj) {
  return new Promise(function(resolve, reject) {
    var ids = _.pluck(obj.items, 'id');
    console.log(ids);
    if (db) {
      db.remove({'id':{'$in': ids}}, function() {
        db.insert(obj.items, { ordered: false });
        resolve(obj.items);
      });
    }
    else {
      console.log('DB connection error');
      reject('DB connection error');
    }
  });
}

function feed2db ( id, name ) {
  return getGraphData({id: id, name: name})
            .then(processGraphData)
            .then(storeGraphData)
    ;
}

module.exports = {
  setAccessToken: function(token) { graph.setAccessToken(token); },
  setDBConnection: function(_db) { db = _db;},
  feed2db: feed2db
};