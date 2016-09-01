var fs = require('fs');
var ldif = require('ldif');
var Promise = require('bluebird');


module.exports = {

  ASimpleMethod: function(throwError) {
    return new Promise(function (fulfill, reject){
      try {
        console.log("A Simple Method");
        if (throwError) {
          throw "A deliberate Error";
        }
        fulfill("Successfully called ASimpleMethod");
      } catch (ex) {
        reject(ex);
      }
    });
  },

  InspectClass: function(obj) {    
    var objClass, className;   
    var classProto;
    var methods = [];
    var attributes = {};
    var t, a;
    try {
      if (typeof(obj) != 'function') {
          objClass = obj.constructor;
      } else {
          objClass = obj;      
      }
      className = objClass.name;
      classProto = objClass.prototype        
      Object.getOwnPropertyNames(classProto).forEach(function(m) {
          t = typeof(classProto[m]);
          if (t == 'function') {
              methods.push(m);
          } else {
              attributes[m] = t;
          }       
      });
    } catch (err) {
        className = 'undefined';
    }

    var returnObject = { 'ClassName' : className,
            'Methods' : methods,
            'Attributes' : attributes
    }
    return returnObject;
  },
  
  OpenJSONDocument: function(filepath) {
    return new Promise(function (fulfill, reject) {
      fs.readFile( __dirname + '/' + filepath, function (err, data) {
        if (err) {
          reject(err);
        }
        else {
          fulfill(JSON.parse(data.toString()));
        }
      });  
    });
  }
  
};
