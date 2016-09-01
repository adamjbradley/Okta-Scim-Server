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
  LDAPToSCIMObject = ldapHelper.LDAPToSCIMObject;

//LDAP Configuration
var client = null;
var url = 'ldap://127.0.0.1:10389';
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
  return new Promise(function (fulfill, reject){
    GetSCIMSchema().done(function (data) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(data);
    }, function(error) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end(error);
    });
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

var OpenJSONDocument = function(filepath) {
  return new Promise(function (fulfill, reject) {
    fs.readFile( __dirname + '/' + filepath, function (err, data) {
      if (err) {
        reject(err);
      }
      else {
        fulfill(data.toString());
      }
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
    .then(function (res) {
      return LDAPSearchPromise(res, 'Object not found');
    }).then(function(res) {     
      ldapSchema = res;    
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
 *  Return User with identifier
 *
 *  Updates response code with '404' if unable to locate User
 */
app.get("/scim/v2/Users/:userId", function (req, res){
  var id = req.params.userId;

  var users = null;
  var exists = false;
  var results = [];

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: []
  };

  console.log(baseDN);
  console.log(opts);
  LDAPSearchAsyncPromise(client, baseDN, opts)
    .then(function (result) {
      return LDAPSearchPromise(result, 'Object not found');
    }).then(function(result) {
      if (result.length == 0)
        exists = false;
      else { 
        exists = true;
        users = result[0];
        console.log(users);
      }
    }).then(function(result) {

      LDAPToSCIMObject(scimSchemaMap, users, "http://localhost", "o=system")
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
 *  Default URL
 */
app.get('/scim/v2', function (req, res) { res.send('SCIM'); });

var server = app.listen(8081, function () {
  client = ldap.createClient({
    url: url
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