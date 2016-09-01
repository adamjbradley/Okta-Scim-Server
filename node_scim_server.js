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

// Dependencies
var express = require('express');
var app = express();
var url = require('url');
var uuid = require('uuid');
var assert = require('assert');
var bodyParser = require('body-parser');
var fs = require('fs');
var Promise = require('promise');
var ldap = require('ldapjs');

//LDAP Configuration
var baseDN = "ou=system";
var client = ldap.createClient({
  url: 'ldap://127.0.0.1:10389'
});
client.bind('uid=admin,ou=system', 'password', function(err) {
  assert.ifError(err);
});

var schemaDN = "ou=schema";
var ldapSchema = null;
var defaultUserClass = "inetorgperson";

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

//TODO Multi-valued fields not handled
//AJB
function getByValue(arr, value) {
  for (var i=0, iLen=arr.length; i<iLen; i++) {
    if (arr[i].type == value) return arr[i].vals.toString();
  }
}

/**
 *   Constructor for creating SCIM Resource 
 */
function GetSCIMList(rows, startIndex, count, req_url) {
  var scim_resource =  {
    "Resources": [], 
    "itemsPerPage": 0, 
    "schemas": [
      "urn:ietf:params:scim:api:messages:2.0:ListResponse"
    ], 
    "startIndex": 0, 
    "totalResults": 0
  }

  var resources = [];
  var location = ""
  for (var i = (startIndex-1); i < count; i++) {
    location =  req_url + "/" + rows[i]["id"];
    var userResource = GetSCIMUserResource(
      rows[i]["id"],
      rows[i]["emailAddress"],
      rows[i]["userName"],
      rows[i]["givenName"],
      rows[i]["middleName"],
      rows[i]["familyName"],
      location);
    resources.push(userResource);
    location = "";
  }

  scim_resource["Resources"] = resources;
  scim_resource["startIndex"] = startIndex;
  scim_resource["itemsPerPage"] = count;
  scim_resource["totalResults"] = count

  return scim_resource;
}

/**
 *   Constructor for creating SCIM Resource 
 */
function GetSCIMListObject(rows, startIndex, count, req_url, objectType) {
  var scim_resource =  {
    "Resources": [], 
    "itemsPerPage": 0, 
    "schemas": [
      "urn:ietf:params:scim:api:messages:2.0:ListResponse"
    ], 
    "startIndex": 0, 
    "totalResults": 0
  }

  var resources = [];
  var location = ""

  if (objectType == "Schemas") {
  }
  else {
  }

  for (var i = (startIndex-1); i < count; i++) {
    location =  req_url + "/" + rows[i]["id"];
    var userResource = GetSCIMUserResource(
      rows[i]["id"],
      rows[i]["emailAddress"],
      rows[i]["userName"],
      rows[i]["givenName"],
      rows[i]["middleName"],
      rows[i]["familyName"],
      location);
    resources.push(userResource);
    location = "";
  }

  scim_resource["Resources"] = resources;
  scim_resource["startIndex"] = startIndex;
  scim_resource["itemsPerPage"] = count;
  scim_resource["totalResults"] = count

  return scim_resource;
}

/** 
 *   Constructor for creating SCIM Resource 
 */
function GetSCIMListLDAP(entries, startIndex, count, req_url) {
  var scim_resource =  {
    "Resources": [], 
    "itemsPerPage": 0, 
    "schemas": [
      "urn:ietf:params:scim:api:messages:2.0:ListResponse"
    ], 
    "startIndex": 0, 
    "totalResults": 0
  }

  var resources = [];
  var location = ""

  //Iterate through each entry
  for (var i = (startIndex-1); i < count; i++) {

    location =  req_url + "/" + entries[i]["uid"];

    var result = getByValue(entries[i].attributes,"uid");

    var userResource = GetSCIMUserResourceLDAP(
      getByValue(entries[i].attributes,"uid"),
      getByValue(entries[i].attributes,"mail"),
      entries[i]["dn"],
      getByValue(entries[i].attributes,"cn"),
      getByValue(entries[i].attributes,"initials"),
      getByValue(entries[i].attributes,"uid"),
      location);
    resources.push(userResource);
    location = "";
  }

  scim_resource["Resources"] = resources;
  scim_resource["startIndex"] = startIndex;
  scim_resource["itemsPerPage"] = count;
  scim_resource["totalResults"] = count

  return scim_resource;
}

/** 
 *   Constructor for creating LDAP Resource 
 */
function GetSCIMListLDAP(entries, startIndex, count, req_url) {
  var scim_resource =  {
    "Resources": [], 
    "itemsPerPage": 0, 
    "schemas": [
      "urn:ietf:params:scim:api:messages:2.0:ListResponse"
    ], 
    "startIndex": 0, 
    "totalResults": 0
  }

  var resources = [];
  var location = ""

  for (var i = (startIndex-1); i < count; i++) {
    location =  req_url + "/" + entries[i]["uid"];

    var result = getByValue(entries[i].attributes,"uid");

    var userResource = GetSCIMUserResourceLDAP(
      getByValue(entries[i].attributes,"uid"),
      getByValue(entries[i].attributes,"mail"),
      entries[i]["dn"],
      getByValue(entries[i].attributes,"cn"),
      //getByValue(entries[i].attributes,"initials"),
      getByValue(entries[i].attributes,"uid"),
      location);
    resources.push(userResource);
    location = "";
  }

  scim_resource["Resources"] = resources;
  scim_resource["startIndex"] = startIndex;
  scim_resource["itemsPerPage"] = count;
  scim_resource["totalResults"] = count

  return scim_resource;
}

/**
 *  Returns JSON dictionary of SCIM response
 */
function GetSCIMUserResource(id, emailAddress, userName, givenName, middleName, familyName, req_url) {

  var scim_user = {
    "schemas": [ "urn:ietf:params:scim:schemas:core:2.0:User" ],
    "id": null,
    "userName": null,
    "name": {
      "givenName": null,
      "middleName": null,
      "familyName": null,
    },
    "emailAddress": false,
    "meta": {
      "resourceType": "User",
      "location": null,
    }
  };

  scim_user["meta"]["location"] = req_url;
  scim_user["id"] = id;
  scim_user["emailAddress"] = emailAddress;
  scim_user["userName"] = userName;
  scim_user["name"]["givenName"] = givenName;
  scim_user["name"]["middleName"] = middleName;
  scim_user["name"]["familyName"] = familyName;

  return scim_user;
}

/**
 *  Returns JSON dictionary of SCIM response
 */
function GetSCIMUserResourceLDAP(id, emailAddress, userName, givenName, middleName, familyName, req_url) {

  var scim_user = {
    "schemas": [ "urn:ietf:params:scim:schemas:core:2.0:User" ],
    "id": null,
    "userName": null,
    "name": {
      "givenName": null,
      "middleName": null,
      "familyName": null,
    },
    "emailAddress": false,
    "meta": {
      "resourceType": "User",
      "location": null,
    }
  };

  scim_user["meta"]["location"] = req_url;
  scim_user["id"] = id;
  scim_user["emailAddress"] = emailAddress;
  scim_user["userName"] = userName;
  scim_user["name"]["givenName"] = givenName;
  scim_user["name"]["middleName"] = middleName;
  scim_user["name"]["familyName"] = familyName;

  return scim_user;
}

/**
 *  Returns JSON dictionary of LDAP request
 */
function GetLDAPUserResource(id, emailAddress, userName, givenName, middleName, familyName, req_url) {
  var ldap_user = {
    //"dn": null,
    "uid": null,
    "mail": null,
    "cn": null,
    //"initials": null,
    "sn": null,
    "objectClass": [
      'top', 'inetOrgPerson', 'person', 'organizationalPerson'
    ],
    "displayName": null
  };

  //ldap_user["dn"] = id;
  ldap_user["uid"] = id;
  ldap_user["mail"] = emailAddress;
  ldap_user["cn"] = userName;
  //ldap_user["initials"] = middleName;
  ldap_user["sn"] = familyName;
  //ldap_user["objectClass"][0] = "top";
  //ldap_user["objectClass"][1] = "inetOrgPerson";
  //ldap_user["objectClass"][2] = "person";
  //ldap_user["objectClass"][3] = "organizationalPerson";
  //
  ldap_user["displayName"] = userName;
  return ldap_user;
}

var GetLDAPResourceNG = function(schemaMap, object, req_url) {
  return new Promise(function (fulfill, reject) {
    var ldap_object = [];

    if (object == null)
      reject("Object is null");

    if (schemaMap == null)  
      reject("schemaMap is null");
    
    try {
      console.log(schemaMap);
      console.log(schemaMap.length);
      console.log(object);
      
      if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:User') {
        console.log("User");
        var attributes = schemaMap[0].attributes;
        for (var a = 0; a < attributes.length; a++) {
          
          //for (attribute in Object.entries(object)) {
          //  console.log(attribute);
          //}
            
          //if (object[attributes[a].name] != null) {
          //  console.log(attributes[a].name + ":" + object[attributes[a]])
          //}
        }
      }
      else if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:Group') {
        console.log("Group");
      }
      else if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:EnterpriseUser') {
        console.log("Enterprise User");
      }
      else {
        console.error("Unable to determine LDAP object type for SCIM resource");
      }
      
      fulfill(ldap_object);

    } catch (err) {
      console.error(err);
      reject(err);
    }
  });  
}

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
 *  ServiceProviderConfig
 */
app.get("/scim/v2/ServiceProviderConfig", function (req, res){
  return new Promise(function (fulfill, reject){
    GetSCIMSchema().done(function (data) {
      var serviceProviderConfig = data.toString();
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(serviceProviderConfig);
    }, function(error) {
      var scim_error = SCIMError( "Cannot retrieve ServiceProviderConfig", "404");
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));
    });
  });      
});

/**
 *  Test Classes
 */
app.post('/TestCases',  function (req, res) {   
  return new Promise(function (fulfill, reject){
    OpenJSONDocument(userJsonPath).then(function (userJsonData) {
      userJson = JSON.parse(userJsonData);
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end("Success");
      }, function (error) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end(error);
      }).then(function () {
        schemaMapJson = GetLDAPResourceNG(schemaMap, userJson, 'https://localhost').then(function (schemaMapData) {
        schemaMap = JSON.parse(schemaMapJson);
      }, function (error) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end(error);
      })
    });
  });    
});

/**
 *  Schema
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

var GetSchemaMap = function () {
  return new Promise(function (fulfill, reject) {
    OpenJSONDocument(schemaMapPath).then(function (scimSchemaMap) {
      fulfill(scimSchemaMap);
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

var LDAPSearch = function(filter, scope, attributes) {
  return new Promise(function (fulfill, reject) {
    var results = [];
    var opts = {
      filter: filter,
      scope: scope,
      attributes: attributes
    };

    client.search(schemaDN, opts, function(err, result) {  
      result.on('searchEntry', function(entry) {        
        if (entry == null) {
          reject(SCIMError( "Entry Not Found", "404"));
        }
        else {
          results.push(entry);
        }
      });
      result.on('searchReference', function(referral) {
        console.log('referral: ' + referral.uris.join());
      });
      result.on('error', function(err) {
        console.error('error: ' + err.message);
        reject(SCIMError( "Schema Not Found", "404"));
      });
      result.on('end', function(result) {
        console.log('status: ' + result.status);
        fulfill(results);
      });
    });
  });
}


/**
 *  Users
 */

/**
 *  Creates a new User with given attributes
 */
app.post('/scim/v2/Users',  function (req, res) {   
  var url_parts = url.parse(req.url, true);
  var req_url =  url_parts.pathname;

  var user = req.body;
  var id = user['id'];

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: ['uid', 'mail', 'dn', 'cn', 'sn']
  };

  var exists = false;
  var results = [];
  client.search(baseDN, opts, function(err, result) {
    result.on('searchEntry', function(entry) {
      var scim_error = SCIMError( "Conflict - Resource Already Exists", "409");
      res.writeHead(409, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));
      exists = true;
    });
    result.on('searchReference', function(referral) {
      console.log('referral: ' + referral.uris.join());
    });
    result.on('error', function(err) {
      console.error('error: ' + err.message);
      
      var scim_error = SCIMError( String(err), "400");
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));
    });
    result.on('end', function(result) {
      console.log('status: ' + result.status);

      if (!exists) {
        var scimUserResource = GetSCIMUserResourceLDAP(id, user['emailAddress'], id, user.name.givenName, user.name.middleName, user.name.familyName, req_url); 
        if (result.status == 0) {

          
          var ldapUserResource = GetLDAPUserResource(id, user['emailAddress'], id, user.name.givenName, user.name.middleName, user.name.familyName, req_url);
          
          client.add('uid=' + id + ',' + baseDN, ldapUserResource, function(err) {
            assert.ifError(err);
          });

          res.writeHead(201, {'Content-Type': 'text/json'});
          res.end(JSON.stringify(scimUserResource));
        }
        else {
          console.log('Add: Status (unhandled) ' + result.status);

          var scim_error = SCIMError( String(result.status), "400");
          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));
        }
      }      
    });
  });
}); 

/**
 *  Return filtered Users
 *
 *  Pagination supported
 */
app.get("/scim/v2/Users", function (req, res) {
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  startIndex  = query["startIndex"];
  count = query["count"];
  filter = query["filter"];

  var req_url =  url_parts.pathname;
  var selectQuery = "SELECT * FROM Users";
  var queryAtrribute = "";
  var queryValue = "";

  var opts = "";
  if (filter != undefined) {
    queryAtrribute = String(filter.split("eq")[0]).trim();
    queryValue = String(filter.split("eq")[1]).trim();
    opts = {
      filter: '(|(mail= ' + emailAddress + ')' + '(cn=' + userName + ')' + '(id=' + id + '))',
      scope: 'sub',
      attributes: ['uid', 'mail', 'cn', 'sn']
    };
  }
  else {
    opts = {
      filter: '(ObjectClass=inetOrgPerson)',
      scope: 'sub',
      attributes: ['uid', 'mail', 'dn', 'cn', 'sn']
    };
  }

  var results = [];
  client.search(baseDN, opts, function(err, result) {
    result.on('searchEntry', function(entry) {
      console.log('entry: ' + JSON.stringify(entry.object));

      if (entry == null) {
        var scim_error = SCIMError( "User Not Found", "404");
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end(JSON.stringify(scim_error));
      }
      else {
        results.push(entry);
      }
    });
    result.on('searchReference', function(referral) {
      console.log('referral: ' + referral.uris.join());
    });
    result.on('error', function(err) {
      console.error('error: ' + err.message);
      
      var scim_error = SCIMError( String(err), "400");
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));
    });
    result.on('end', function(result) {
      console.log('status: ' + result.status);

      var scimResource = GetSCIMListLDAP(results, 1, results.length, req_url);
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify(scimResource))
    });
  });
  
  /*
  db.all(selectQuery , function(err, rows) {
    if (err == null) {
      if (rows === undefined) {
        var scim_error = SCIMError( "User Not Found", "404");
          res.writeHead(404, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));
      } else {
          // If requested no. of users is less than all users
          if (rows.length < count) {
            count = rows.length
          }
          
          var scimResource = GetSCIMList(rows,startIndex,count,req_url);
          res.writeHead(200, {'Content-Type': 'application/json'})
          res.end(JSON.stringify(scimResource))
        }
    } else {
        var scim_error = SCIMError( String(err), "400");
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end(JSON.stringify(scim_error));
      }
  });
  */
});

/**
 *  Return User with identifier
 *
 *  Updates response code with '404' if unable to locate User
 */
app.get("/scim/v2/Users/:userId", function (req, res){
  var id = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: ['uid', 'mail', 'dn', 'cn', 'sn']
  };

  var exists = false;
  var results = [];
  client.search(baseDN, opts, function(err, result) {
    result.on('searchEntry', function(entry) {
      results.push(entry);
      exists = true;
    });
    result.on('searchReference', function(referral) {
      console.log('referral: ' + referral.uris.join());
    });
    result.on('error', function(err) {
      console.error('error: ' + err.message);
      
      var scim_error = SCIMError( String(err), "400");
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));
    });
    result.on('end', function(result) {
      console.log('status: ' + result.status);

      if (exists) {
        var scimResource = GetSCIMListLDAP(results, 1, results.length, req_url);
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify(scimResource))

      } else {
        var scim_error = SCIMError( "User does not exist", "400");
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end(JSON.stringify(scim_error));

        console.log('Add: Status (unhandled) ' + result.status);
      } 
    });
  });
});

/**
 *  Update User attributes via Put MUST
 */
app.put("/scim/v2/Users/:userId", function (req, res) {

  var userId = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var op = "";
  var value = "";  

  console.log("Put: Update attributes(s)");

  var scim_error = SCIMError( "Put Operation Not Supported", "400");
  res.writeHead(404, {'Content-Type': 'application/text' });
  res.end(JSON.stringify(scim_error));
});

/**
 *  Update User attributes via Patch OPTIONAL
 */
app.patch("/scim/v2/Users/:userId", function (req, res) {

  var userId = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var op = "";
  var value = "";  
  var operations = req.body.Operations;    

  for (var i=0; operations.length; i++) {
    op = operations[i].op;
    //value = jsonReqBody["Operations"][0]["value"];
    //var attribute = Object.keys(value)[0];
    //var attrValue = value[attribute];

    var scim_error = SCIMError( "Patch: Operation Not Supported", "403");
    res.writeHead(403, {'Content-Type': 'application/text' });
    res.end(JSON.stringify(scim_error));

    if (op == "add") {
      console.log("Patch: Add attribute");
    }
    else if (op == "replace") {
      console.log("Patch: Replace attribute");

      /*
      var updateUsersQuery = "UPDATE 'Users' SET "+ attribute + " = '" + attrValue + "'WHERE id = '" + String(userId) + "'";
      db.run(updateUsersQuery, function(err) {
        if (err == null) {
          var queryById = "SELECT * FROM Users WHERE id='"+userId+"'";
          
          db.get(queryById, function(err, rows) {
            if (err == null) {
              var scimUserResource = GetSCIMUserResource(userId, rows.emailAddress, rows.userName, rows.givenName, rows.middleName, rows.familyName, req_url);         
              res.writeHead(200, {'Content-Type': 'application/json'});
              res.end(JSON.stringify(scimUserResource));    
            } else {
                var scim_error = SCIMError( String(err), "400");
                res.writeHead(400, {'Content-Type': 'application/text' });
                res.end(JSON.stringify(scim_error));
            }
          });
        } else {
          var scim_error = SCIMError( String(err), "400");
          res.writeHead(400, { 'Content-Type': 'application/text' });
          res.end(JSON.stringify(scim_error));
        }       
      });
      */
    }
    else if (op == "remove") {
      console.log("Patch: Remove attribute");
    } else {  
      console.log("Patch: Operation not supported");
    }  
  }
  
  /*
  var op = "";
  var value = "";
  var requestBody = "";
  req.on('data', function (data) {
    requestBody += data;
    
    var jsonReqBody = JSON.parse(requestBody);
    op = jsonReqBody["Operations"][0]["op"];
    value = jsonReqBody["Operations"][0]["value"];
    var attribute = Object.keys(value)[0];
    var attrValue = value[attribute];

    if (op == "replace") {
      var updateUsersQuery = "UPDATE 'Users' SET "+ attribute + " = '"
                            + attrValue + "'WHERE id = '" + String(userId) + "'";
      db.run(updateUsersQuery, function(err) {
        if (err == null) {
          var queryById = "SELECT * FROM Users WHERE id='"+userId+"'";
          
          db.get(queryById, function(err, rows) {
            if (err == null) {
              var scimUserResource = GetSCIMUserResource(userId, rows.emailAddress, rows.userName,
                rows.givenName, rows.middleName, rows.familyName, req_url);         
              res.writeHead(200, {'Content-Type': 'application/json'});
              res.end(JSON.stringify(scimUserResource));    
            } else {
                var scim_error = SCIMError( String(err), "400");
                res.writeHead(400, {'Content-Type': 'application/text' });
                res.end(JSON.stringify(scim_error));
            }
          });
        } else {
          var scim_error = SCIMError( String(err), "400");
          res.writeHead(400, { 'Content-Type': 'application/text' });
          res.end(JSON.stringify(scim_error));
        }       
      });
    } else {
        var scim_error = SCIMError( "Operation Not Supported", "403");
        res.writeHead(403, {'Content-Type': 'application/text' });
        res.end(JSON.stringify(scim_error));
      }  
  });
  */ 

});

/**
 *  Delete User via Delete
 */
app.delete("/scim/v2/Users/:userId", function (req, res) {

  var id = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var opts = {
    filter: '(|(uid=' + id + '))',
    scope: 'sub',
    attributes: ['uid', 'mail', 'dn', 'cn', 'sn']
  };

  var exists = false;
  var results = [];
  client.search(baseDN, opts, function(err, result) {
    result.on('searchEntry', function(entry) {
      exists = true;
    });
    result.on('searchReference', function(referral) {
      console.log('referral: ' + referral.uris.join());
    });
    result.on('error', function(err) {
      console.error('error: ' + err.message);
      
      var scim_error = SCIMError( String(err), "400");
      res.writeHead(400, {'Content-Type': 'text/plain'});
      res.end(JSON.stringify(scim_error));
    });
    result.on('end', function(result) {
      console.log('status: ' + result.status);

      if (exists) {
          client.del('uid=' + id + ',' + baseDN, function(err) {
            assert.ifError(err);
          });

          var scim_message = SCIMSuccess( String("Success"), "400");
          res.writeHead(201, {'Content-Type': 'text/json'});
          res.end(JSON.stringify(scim_message));      
        }
        else {
          var scim_error = SCIMError( "User does not exist", "400");
          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.end(JSON.stringify(scim_error));

          console.log('Add: Status (unhandled) ' + result.status);
        } 
    });
  });
});    

/**
 *  Groups
 */

/**
 *  Creates a new Group with given attributes
 */
app.post('/scim/v2/Groups',  function (req, res) {   
  var userId = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var scim_error = SCIMError( "Not implented", "400");
  res.writeHead(400, {'Content-Type': 'application/text' });
  res.end(JSON.stringify(scim_error));
}); 

/**
 *  Retrieve a new Group
 */
app.get('/scim/v2/Groups',  function (req, res) {   
  var userId = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var scim_error = SCIMError( "Not implented", "400");
  res.writeHead(400, {'Content-Type': 'application/text' });
  res.end(JSON.stringify(scim_error));
}); 

/**
 *  Update Group membership
 */
app.patch('/scim/v2/Groups',  function (req, res) {   
  var userId = req.params.userId;
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var scim_error = SCIMError( "Not implented", "400");
  res.writeHead(400, {'Content-Type': 'application/text' });
  res.end(JSON.stringify(scim_error));
});

/**
 *  Delete a Group
 */
app.delete('/scim/v2/Groups',  function (req, res) {   
  var url_parts = url.parse(req.url, true);
  var req_url = url_parts.pathname;

  var scim_error = SCIMError( "Not implented", "400");
  res.writeHead(400, {'Content-Type': 'application/text' });
  res.end(JSON.stringify(scim_error));
});


/* 
  LDAP
*/

/**
 *  Default URL
 */
app.get('/scim/v2', function (req, res) { res.send('SCIM'); });

/**
 *  Instantiates or connects to DB
 */
var server = app.listen(8081, function () {
    //Retrieve LDAP, SCIM Schema and Schema Map
    return new Promise(function (fulfill, reject) {
      OpenJSONDocument(scimSchemaPath).then(function (scimSchemaData) {
        scimSchema = JSON.parse(scimSchemaData);
      }, reject).then(function (schemaData) {
        LDAPSearch('objectclass=*','sub', []).then(function (schemaData) {
        ldapSchema = schemaData;
      }, reject).then(function (schemaMapData) {
        OpenJSONDocument(schemaMapPath).then(function (schemaMapData) {
        schemaMap = JSON.parse(schemaMapData);        
      }, reject)
      }); 
    });
  });    
});

var reject = function(error) {
  log.error(error);
}