/** Copyright © 2016, Okta, Inc.
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

//External Modules
var express = require('express');
var app = express();
var url = require('url');
var uuid = require('uuid');
var assert = require('assert');
var bodyParser = require('body-parser');
var fs = require('fs');
var ldap = require('ldapjs');
var promise = require('bluebird');

// Local modules
var jsHelper = require('./jshelper');
var ldapHelper = require('./ldaphelper');

var LDAPConnect = ldapHelper.LDAPConnect,
  LDAPConnectPromise = ldapHelper.LDAPConnectPromise,
  LDAPSearchPromise = ldapHelper.LDAPSearchPromise,
  LDAPSearchAsyncPromise = ldapHelper.LDAPSearchAsyncPromise,
  LDAPToSCIMObject = ldapHelper.LDAPToSCIMObject,
  SCIMToLDAPObject = ldapHelper.SCIMToLDAPObject,
  GetSCIMList = ldapHelper.GetSCIMList,
  OpenJSONDocument = jsHelper.OpenJSONDocument,
  SCIMToLDAPModifyObject = ldapHelper.SCIMToLDAPModifyObject,
  JSONToLDAPModifyObject = ldapHelper.JSONToLDAPModifyObject,
  LDAPToSCIMGroupObject = ldapHelper.LDAPToSCIMGroupObject;

//LDAP Configuration
var client = null;
var ldapUrl = 'ldap://127.0.0.1:10389';
var failDN = "uid=auser,ou=system";
var schemaDN = "ou=schema";
var username = "uid=admin,ou=system";
var password = "password";
var baseDN = "ou=system";

//LDAP Schema
var ldapSchema = null;

//Service Provider Configuration
var serviceProviderConfigPath = "./ServiceProviderConfigSchema.json";

//SCIM Configuration
var scimSchemaPath = "./Schema.json";
var scimSchema = null;

//Schema Map
var schemaMapPath = "./SchemaMap.json";
var schemaMap = null;

//Test Classes
var userJsonPath = "./User.json";
var userJson = "./User.json";
    
//Express Settings
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/**
 *  Returns an error message and status code
 */
function SCIMError(errorMessage, statusCode) {
  var scim_error = {
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
    "detail": null,
    "status": null
  }

  scim_error["detail"] = errorMessage;
  scim_error["status"] = statusCode;

  return scim_error;
}

/**
 *  Returns a success message and status code
 */
function SCIMSuccess(message, statusCode) {
  var scim_message = {
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:Success"],
    "detail": null,
    "status": null
  }

  scim_message["detail"] = message;
  scim_message["status"] = statusCode;

  return scim_message;
}

/**
 *  SCIM Schema
 */
app.get("/scim/v2/Schemas", function (req, res) {
  GetSCIMSchema()
    .then(function (result) {
      ldapSchema = result;
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(ldapSchema));
    }).catch(function(message) {
      console.log('Error:' + message);
    });
});

var GetSCIMSchema = function () {
  return new Promise(function (fulfill, reject) {
    OpenJSONDocument(scimSchemaPath).then(function (scimSchemaData) {
      fulfill(scimSchemaData);
    }, function(error) {
      reject(error);
    });
  });
}

/**
 *  LDAP Schema
 */
app.get("/LDAPSchema", function (req, res) {

  var opts = {
    filter: 'objectclass=*',
    scope: 'sub',
    attributes: []
  };

  LDAPSearchAsyncPromise(client, schemaDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(res, 'Object not found');
    }).then(function(result) {     
      ldapSchema = result;    
    }).catch(function(message) {
      console.log('Error:' + message);
    }).finally(function() {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(ldapSchema));
    });
});

/**
 *  Users
 */

/**
 *  Return filtered Users
 */
app.get("/scim/v2/Users", function (req, res) {
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  startIndex  = query["startIndex"];
  count = query["count"];
  filter = query["filter"];

  var req_url =  url_parts.pathname;
  var queryAtrribute = "";
  var queryValue = "";

  var opts = {
    filter: '(ObjectClass=inetOrgPerson)',
    scope: 'sub',
    attributes: []
  };

  var scimObjects = [];
  LDAPSearchAsyncPromise(client, baseDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(result, 'Object not found');
    }).then(function(result) {

      for (var i=0; i<result.length; i++){
        LDAPToSCIMObject(schemaMap, result[i], "http://localhost", baseDN)
          .then(function (result) {
            scimObjects.push(result);
          }).catch(function(message) {
            console.log('Error:' + message);
          });
      }

    })
    .catch(function(message) {
      console.log('Error:' + message);
    }).finally(function(result){
      var scimResource = GetSCIMList(100, 0, scimObjects, 'http://localhost');
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify(scimResource))
    });
});

/**
 *  Return User with identifier
 */
app.get("/scim/v2/Users/:userId", function (req, res){
  var id = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url =  url_parts.pathname;

  var users = null;
  var exists = false;
  var results = [];

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: []
  };

  LDAPSearchAsyncPromise(client, baseDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(result, 'Object not found');
    }).then(function(result) {
      if (result.length == 0)
        exists = false;
      else { 
        exists = true;
        users = result[0];
      }
    }).then(function(result) {

      LDAPToSCIMObject(schemaMap, users, "http://localhost", baseDN)
        .then(function (result) {
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(result));
        }).catch(function(message) {
          console.log('Error:' + message);
        });

    }).catch(function(message) {
      console.log('Error:' + message);

      var scim_error = SCIMError( "Cannot retrieve User", "404");
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));

    }).finally(function() {
    });

}); 

/**
 *  Add User
 */
app.post('/scim/v2/Users',  function (req, res) {   

  var url_parts = url.parse(req.url, true);
  var req_url =  url_parts.pathname;

  var users = req.body;
  var id = users['id'];

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: []
  };

  var exists = false;
  var results = [];
  LDAPSearchAsyncPromise(client, baseDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(result, 'Object not found');
    }).then(function(result) {
      if (result.length == 0)
        exists = false;
      else {
        var scim_error = SCIMError( "Conflict - Resource Already Exists", "409");
        res.writeHead(409, {'Content-Type': 'text/plain'});
        res.end(JSON.stringify(scim_error));
        exists = true;
      }
    }).catch(function(message) {
      var objectClass = [ "top" , "inetOrgPerson", "person", "organizationalPerson"];
      SCIMToLDAPObject(schemaMap, users, "http://localhost", baseDN, objectClass)      
        .then(function (result) {
          client.add('uid=' + id + ',' + baseDN, result, function(err) {
            assert.ifError(err);
          });
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(result));
        }).catch(function(message) {
          console.log('Error:' + message);
          var scim_error = SCIMError( "Unable to convert LDAP to SCIM", "409");
          res.writeHead(409, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));
        });
      
    }).finally(function() {
    });
    
}); 

/**
 *  Delete User
 */
app.delete("/scim/v2/Users/:userId", function (req, res) {

  var id = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url =  url_parts.pathname;

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: []
  };

  var exists = false;
  var results = [];
  LDAPSearchAsyncPromise(client, baseDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(result, 'Object not found');
    }).then(function(result) {
        
      client.del('uid=' + id + ',' + baseDN, function(err) {
        assert.ifError(err);
      });

      var scim_message = SCIMSuccess( String("Success"), "400");
      res.writeHead(201, {'Content-Type': 'text/json'});
      res.end(JSON.stringify(scim_message));
      return;

    }).catch(function(message) {
      var scim_error = SCIMError( "User does not exist", "400");
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));
      
    }).finally(function() {
    });

});

/**
 *  Update User attributes via Put MUST
 */
app.put("/scim/v2/Users/:userId", function (req, res) {
  
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var users = req.body;
  var id = req.params.userId;

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: []
  };

  var exists = false;
  var results = [];
  LDAPSearchAsyncPromise(client, baseDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(result, 'Object not found');
    }).then(function(result) {
      if (result.length == 1) {
        var objectClass = [ "top" , "inetOrgPerson", "person", "organizationalPerson"];
        SCIMToLDAPModifyObject(schemaMap, users, "http://localhost", baseDN, objectClass)      
          .then(function (result) {
            client.modify('uid=' + id + ',' + baseDN, result, function(err) {
              assert.ifError(err);
            });
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(result));
          }).catch(function(message) {
            console.log('Error:' + message);
            var scim_error = SCIMError( "Unable to convert LDAP to SCIM", "409");
            res.writeHead(409, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(scim_error));
          });
      }
      else {
        var scim_error = SCIMError( "Resource does not exists", "409");
        res.writeHead(409, {'Content-Type': 'text/plain'});
        res.end(JSON.stringify(scim_error));
        exists = false;
      }

    }).catch(function(message) {
        var scim_error = SCIMError( "Resource does not exists", "409");
        res.writeHead(409, {'Content-Type': 'text/plain'});
        res.end(JSON.stringify(scim_error));
    }).finally(function() {
    });

});

/**
 *  Update User attributes via Patch OPTIONAL
 */
app.patch("/scim/v2/Users/:userId", function (req, res) {

  var userId = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var scim_error = SCIMError( "Patch: Operation Not Supported", "403");
  res.writeHead(403, {'Content-Type': 'application/text' });
  res.end(JSON.stringify(scim_error));
  return; 

  /*
  var op = "";
  var value = "";  
  var operations = req.body.Operations;    

  for (var i=0; i < operations.length; i++) {
    op = operations[i].op;    
    if (op == "add") {
      console.log("Patch: Add attribute");
    }
    else if (op == "replace") {
      console.log("Patch: Replace attribute");
    }
    else if (op == "remove") {
      console.log("Patch: Remove attribute");
    } else {  
      console.log("Patch: Operation not supported");
    }  
  }
  */

});

/**
 *  Groups
 */

/**
 *  Return filtered Groups
 */
app.get("/scim/v2/Groups", function (req, res) {
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  startIndex  = query["startIndex"];
  count = query["count"];
  filter = query["filter"];

  var req_url =  url_parts.pathname;
  var queryAtrribute = "";
  var queryValue = "";

  var opts = {
    filter: '(ObjectClass=groupOfUniqueNames)',
    scope: 'sub',
    attributes: []
  };

  var scimObjects = [];
  LDAPSearchAsyncPromise(client, baseDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(result, 'Object not found');
    }).then(function(result) {

      for (var i=0; i<result.length; i++){
        LDAPToSCIMGroupObject(schemaMap, result[i], "http://localhost", baseDN)
          .then(function (result) {
            scimObjects.push(result);
          }).catch(function(message) {
            console.log('Error:' + message);
          });
      }

    })
    .catch(function(message) {
      console.log('Error:' + message);
    }).finally(function(result){
      var scimResource = GetSCIMList(100, 0, scimObjects, 'http://localhost');
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify(scimResource))
    });
});

/**
 *  Default URL
 */
app.get('/scim/v2', function (req, res) { res.send('SCIM'); });

var server = app.listen(8081, function () {
  client = ldap.createClient({
    url: ldapUrl
  });
  promise.promisifyAll(client);

  if (LDAPConnectPromise(ldap, client, username, password))
    console.log("Connected to LDAP Server");  

  OpenJSONDocument(schemaMapPath)
    .then(function (res) {
      scimSchemaMap = res;
    }).catch(function(message) {
      console.log('Error:' + message);
    });
});