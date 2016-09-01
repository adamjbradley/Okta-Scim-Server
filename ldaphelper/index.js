var assert = require('assert');
var Promise = require('bluebird');
var automapper = require('automapper-ts');
var ldif = require('ldif');

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

  LDAPConnectPromise: function(ldap, client, bindDN, password) {
    return new Promise(function (fulfill, reject) {
      console.log("LDAPConnectPromise Entering");
      client.bindAsync('uid=admin,ou=system', 'password')
      .then(function() {
        console.log('LDAPConnectPromise bind Successful');
      })
      .catch (function(err) {
        console.log('LDAPConnectPromise bind Unuccessful' + err);
        reject(err);
      })
      .finally(function() {
        console.log("LDAPConnectPromise Leaving");
      })
    });
  },

  LDAPSearchAsyncPromise: function(client, baseDN, opts) {
    return new Promise(function (fulfill, reject) {
      client.searchAsync(baseDN, opts)
        .then(function(res) {
          fulfill(res);
        })
        .then(function() {
          console.log('LDAPSearchAsyncPromise Search Completed Successfully');
        })
        .catch(function(message) {
          console.log('LDAPSearchAsyncPromise Error:' + message);
        });
      });
  },

  LDAPSearchPromise: function(res, notfoundtext) {
    var results = [];
    return new Promise(function(fulfill, reject) {
      var found = false;
      res.on('searchEntry', function(entry) {
        found = true;
        if (entry != null)
          results.push(entry.object);
      });
      res.on('error', function(e) {
        reject(e.message);
      });
      res.on('end', function() {
        if (!found) {
          reject(notfoundtext);
        }
        console.log('LDAPSearchPromise returned ' + results.length + " results");    
        fulfill(results);  
      });
    });
  },

  SCIMToLDAPObject: function(schemaMap, object, req_url, baseDN, objectClass) {
    return new Promise(function (fulfill, reject) {
      try {

        var ldap_object = [];

        if (object == null) 
          new Error("Object is null");

        if (schemaMap == null)  
          new Error("SchemaMap is null");
                
        if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:User') {
          console.log("Processing a User");

          //var attributes = schemaMap[0].attributes;
          //for (var a = 0; a < attributes.length; a++) {              
          //  if (object[attributes[a].name] != null) {
          //    console.log(attributes[a].name + ":" + object[attributes[a].name])
          //  }
          //}

          var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
          var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';

          var forAllMembersSpy = 
          function (destinationObject, destinationProperty, value) {
            destinationObject[destinationProperty] = value;
          };

          automapper
              .createMap(fromKey, toKey)
              .forMember('objectClass', objectClass)
              //.forMember('dn', function(opts) { return opts.sourceObject['id'] + ',' + baseDN })
              .forMember('cn', function(opts) { opts.mapFrom('id'); })
              //.forMember('mail', function(opts) {opts.mapFrom('emails'); })
              .forMember('givenName', function(opts) {opts.mapFrom('name.givenName'); })                            
              .forMember('sn', function(opts) {opts.mapFrom('name.familyName'); })                            
              .forMember('uid', function(opts) {opts.mapFrom('id'); })
              .forMember('displayName', function(opts) { return opts.sourceObject['name'].givenName + " " + opts.sourceObject['name'].familyName; })
              .forSourceMember('schemas', function(opts) {opts.ignore(); })
              .forSourceMember('meta', function(opts) {opts.ignore(); })
              .ignoreAllNonExisting();
              //.forAllMembers(forAllMembersSpy);
          
          // act
          ldap_object = automapper.map(fromKey, toKey, object);

        }
        else if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:Group') {
          console.log("Processing a Group");
        }
        else if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:EnterpriseUser') {
          console.log("Processing an Enterprise User");
        }
        else {
          console.error("Unable to determine LDAP object type for SCIM resource");
        }

        console.log(ldap_object);
        fulfill(ldap_object);

      } catch (ex) {
        console.error(ex.message);
        reject(ex);
      }
    });  
  },

  LDIFToSCIMObject: function(schemaMap, object, req_url) {
    return new Promise(function (fulfill, reject) {
      try {

        var ldap_object = [];
        if (object == null) 
          new Error("Object is null");

        if (schemaMap == null)  
          new Error("SchemaMap is null");
                
        var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
        var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';

        automapper
            .createMap(fromKey, toKey)
            .forMember("schemas", ['urn:ietf:params:scim:schemas:core:2.0:User'])
            .forMember('id', function(opts) { opts.mapFrom('attributes.uid'); })
            .forMember('username', function(opts) { opts.mapFrom('uid'); })
            .forMember('name.givenName', function(opts) { opts.mapFrom('attributes.givenName'); })
            .forMember('name.familyName', function(opts) { opts.mapFrom('attributes.sn'); })
            .forMember('emails', function(opts) { opts.mapFrom('mail'); })
            .forMember('displayName', function(opts) { opts.mapFrom('attributes.displayName'); })
            .ignoreAllNonExisting();

        // act
        ldap_object = automapper.map(fromKey, toKey, object);

        fulfill(ldap_object);
      } catch (ex) {
        console.error(ex.message);
        reject(ex);
      }
    });  
  },

  LDAPToSCIMObject: function(schemaMap, object, req_url) {
    return new Promise(function (fulfill, reject) {
      try {

        var ldap_object = [];
        if (object == null) 
          new Error("Object is null");

        if (schemaMap == null)  
          new Error("SchemaMap is null");
                
        var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
        var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';

        automapper
            .createMap(fromKey, toKey)
            .forMember("schemas", ['urn:ietf:params:scim:schemas:core:2.0:User'])
            .forMember('id', function(opts) { opts.mapFrom('uid'); })
            .forMember('username', function(opts) { opts.mapFrom('dn'); })
            .forMember('name.givenName', function(opts) { opts.mapFrom('givenName'); })
            .forMember('name.familyName', function(opts) { opts.mapFrom('sn'); })
            .forMember('emails', function(opts) { opts.mapFrom('mail'); })
            .forMember('displayName', function(opts) { opts.mapFrom('displayName'); })
            .ignoreAllNonExisting();

        // act
        ldap_object = automapper.map(fromKey, toKey, object);

        fulfill(ldap_object);
      } catch (ex) {
        console.error(ex.message);
        reject(ex);
      }
    });  
  },


  OpenLDIFDocument: function(filepath) {
    return new Promise(function (fulfill, reject) {
      var results = [];
      try {
        var file = ldif.parseFile(filepath), output_options = {};
        fulfill(file);
      }
      catch (ex) {
        reject(ex);
      }  
    });
  },

};

