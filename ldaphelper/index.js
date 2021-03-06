var assert = require('assert');
var Promise = require('bluebird');
var automapper = require('automapper-ts');
var ldif = require('ldif');

var self = module.exports = {

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
      client.bindAsync(bindDN, password)
        .then(function(res) {
          console.log('LDAPConnectPromise bind Successful');
          //fulfill("success");
        })
        .catch (function(err) {
          console.log('LDAPConnectPromise bind Unuccessful' + err);
          //reject(err);
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
              .forMember('mail', function(opts) {opts.mapFrom('emails'); })                            
              .forMember('mail', function (opts) {opts.condition(function (sourceObject) {return sourceObject.emails != null;});})
              .forMember('givenName', function(opts) {opts.mapFrom('name.givenName'); })                            
              .forMember('sn', function(opts) {opts.mapFrom('name.familyName'); })                            
              //.forMember('uid', function(opts) {opts.mapFrom('id'); })
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
        fulfill(ldap_object);

      } catch (ex) {
        console.error(ex.message);
        reject(ex);
      }
    });  
  },

  SCIMToLDAPModifyObject: function(schemaMap, object, req_url, baseDN, objectClass) {
    return new Promise(function (fulfill, reject) {
      try {

        var ldap_object = [];

        if (object == null) 
          new Error("Object is null");

        if (schemaMap == null)  
          new Error("SchemaMap is null");
                
        if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:User') {
          console.log("Processing a User");

          var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
          var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';

          var forAllMembersSpy = 
          function (destinationObject, destinationProperty, value) {
            destinationObject[destinationProperty] = value;
          };

          automapper
              .createMap(fromKey, toKey)
              .forMember('mail', function(opts) {opts.mapFrom('emails'); })                            
              .forMember('mail', function (opts) {opts.condition(function (sourceObject) {return sourceObject.emails != null;});})
              .forMember('givenName', function(opts) {opts.mapFrom('name.givenName'); })                            
              .forMember('sn', function(opts) {opts.mapFrom('name.familyName'); })                            
              .forMember('displayName', function(opts) { return opts.sourceObject['name'].givenName + " " + opts.sourceObject['name'].familyName; })
              .forSourceMember('schemas', function(opts) {opts.ignore(); })
              .forSourceMember('meta', function(opts) {opts.ignore(); })
              .forSourceMember('objectClass', function(opts) {opts.ignore(); })
              .forSourceMember('controls', function(opts) {opts.ignore(); })
              .ignoreAllNonExisting();          
          // act
          ldap_object = automapper.map(fromKey, toKey, object);

          automapper
            .createMap(fromKey, toKey)
            .forMember('operation', 'replace')
            .forMember('modification', ldap_object)
            .ignoreAllNonExisting();
        
          // act
          ldap_object = automapper.map(fromKey, toKey, ldap_object);

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
        fulfill(ldap_object);

      } catch (ex) {
        console.error(ex.message);
        reject(ex);
      }
    });  
  },

  JSONToLDAPModifyObject: function(schemaMap, object, req_url, baseDN, objectClass) {
    return new Promise(function (fulfill, reject) {
      try {

        var ldap_object = [];

        if (object == null) 
          new Error("Object is null");

        if (schemaMap == null)  
          new Error("SchemaMap is null");
                
        if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:User') {
          console.log("Processing a User");

          var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
          var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';

          var forAllMembersSpy = 
          function (destinationObject, destinationProperty, value) {
            destinationObject[destinationProperty] = value;
          };

          automapper
              .createMap(fromKey, toKey)
              .forMember('mail', function (opts) { opts.condition(function (sourceObject) { return sourceObject.prop != null; }); })
              .forMember('givenName', function(opts) {opts.mapFrom('name.givenName'); })                            
              .forMember('sn', function(opts) {opts.mapFrom('name.familyName'); })                            
              .forMember('displayName', function(opts) { return opts.sourceObject['name'].givenName + " " + opts.sourceObject['name'].familyName; })
              .forSourceMember('schemas', function(opts) {opts.ignore(); })
              .forSourceMember('meta', function(opts) {opts.ignore(); })
              .forSourceMember('objectClass', function(opts) {opts.ignore(); })
              .forSourceMember('controls', function(opts) {opts.ignore(); })
              .ignoreAllNonExisting();          
          // act
          ldap_object = automapper.map(fromKey, toKey, object);

          automapper
            .createMap(fromKey, toKey)
            .forMember('operation', 'add')
            .forMember('modification', ldap_object)
            .ignoreAllNonExisting();
        
          // act
          ldap_object = automapper.map(fromKey, toKey, ldap_object);

        }
        else if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:Group') {
          console.log("Processing a Group");

          var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
          var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';

          automapper
              .createMap(fromKey, toKey)
              .forMember("resourceType", "Group")
              .forMember('created', Date.now)
              .forMember('LastModified', Date.now)
              .forMember('location', 'https://localhost')
              .forMember('version', null)
              .ignoreAllNonExisting();
          ldap_object = automapper.map(fromKey, toKey, object);
      
          automapper
              .createMap(fromKey, toKey)
              .forMember("schemas", ['urn:ietf:params:scim:schemas:core:2.0:Group'])
              .forMember('id', function(opts) { opts.mapFrom('uid'); })
              .forMember('username', function(opts) { opts.mapFrom('dn'); })
              .forMember('name.givenName', function(opts) { opts.mapFrom('givenName'); })
              .forMember('name.familyName', function(opts) { opts.mapFrom('sn'); })
              .forMember('emails', function(opts) { opts.mapFrom('mail'); })
              .forMember('displayName', function(opts) { opts.mapFrom('displayName'); })
              .forMember('meta', ldap_object)
              .ignoreAllNonExisting();

          // act
          ldap_object = automapper.map(fromKey, toKey, ldap_object);
        }
        else if (object.schemas[0] == 'urn:ietf:params:scim:schemas:core:2.0:EnterpriseUser') {
          console.log("Processing an Enterprise User");
        }
        else {
          console.error("Unable to determine LDAP object type for SCIM resource");
        }

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
            //.forMember('id', function(opts) { opts.mapFrom('attributes.uid'); })
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

  LDAPToSCIMGroupObject: function(schemaMap, object, req_url) {
    return new Promise(function (fulfill, reject) {
      try {

        var ldap_object = [];
        if (object == null) 
          new Error("Object is null");

        if (schemaMap == null)  
          new Error("SchemaMap is null");
                
        var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
        var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';

        //Groups
        var members = [];
        for (var i=0; i<object.uniqueMember.length; i++){
          ldap_object = [];
          automapper
              .createMap(fromKey, toKey)
              .forMember('value', function(opts) { return object.uniqueMember[i]; })
              .forMember('$ref', function(opts) { return "https://localhost/" + opts.sourceObject['cn']; })
              .forMember('display', function(opts) { opts.mapFrom('cn'); })
              .ignoreAllNonExisting();
          // act
          ldap_object = automapper.map(fromKey, toKey, object);
          members.push(ldap_object);
        }

        automapper
            .createMap(fromKey, toKey)
            .forMember("schemas", ['urn:ietf:params:scim:schemas:core:2.0:Group'])
            .forMember('id', function(opts) { opts.mapFrom('cn'); })
            .forMember('displayName', function(opts) { opts.mapFrom('description'); })
            .forMember('members', members)
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

  //Convert JSON MV attribute to LDAP
  ProcessMVAttribute: function(scimSchemaMap, object, i, destinationAttribute, usePrimary, valueAttribute) {

    var attributes = [];

    attributeName = scimSchemaMap.attributes[i].name;
    var value = object[scimSchemaMap.attributes[i].name];

    //SCIM entry
    var entry = [];

    //LDAP is flat
    var values = [];
    if (valueAttribute == null)
      valueAttribute = "value";

    // Iterate through each value
    for (var j=0; j < object[scimSchemaMap.attributes[i].name].length; j++) {
      value = object[scimSchemaMap.attributes[i].name][j];                      
      subAttributes = [];                      

      //Process SubAttributes
      if (scimSchemaMap.attributes[i].subAttributes != null) {
        //console.log("SA " + scimSchemaMap.attributes[i].subAttributes.length);    
        for (var k=0; k < scimSchemaMap.attributes[i].subAttributes.length; k++) {
          var subAttributeName = scimSchemaMap.attributes[i].subAttributes[k].name;
          value = object[scimSchemaMap.attributes[i].name][j][subAttributeName];
          //console.log("SAV " + subAttributeName + ": " + value);
          if (subAttributeName == "value")
            values.push( { [destinationAttribute] : value  } );
          
          entry = { [subAttributeName] : value };          
          subAttributes.push(entry);
        }

        //Process the Entry
        if (usePrimary)
        {
          if (entry.primary)
            attributes.push(subAttributes);
        }
        else {
          attributes.push(subAttributes);
        }
      }
      else
      {
        throw e;
      }
    }
    
    //console.log(JSON.stringify(values));
    //return attributes;
    return values;
  },

  // NG
  SCIMToLDAPObjectNG: function(scimSchemaMap, object, req_url) {
    return new Promise(function (fulfill, reject) {
      try {

        if (object == null) 
          throw Error("Object is null");
        if (scimSchemaMap == null)  
          throw Error("SchemaMap is null");

        //Result object    
        var result = [];
    
        //Loop through each item in the schema map, strip empty attributes
        var attributes = [];
        var subAttributes = [];
        
        for (var i=0; i < scimSchemaMap[0].attributes.length; i++) {
          //Read through each attribute
          if (object[scimSchemaMap[0].attributes[i].name] != null) {

            var attributeName = scimSchemaMap[0].attributes[i].name;
            var destinationAttributeName = scimSchemaMap[0].attributes[i].ldapName;
            
            //Multi-valued
            if (scimSchemaMap[0].attributes[i].multiValued == true) {
              if (scimSchemaMap[0].attributes[i].usePrimary)
                attributes = self.ProcessMVAttribute(scimSchemaMap[0], object, i, destinationAttributeName, true);
              else
                attributes = self.ProcessMVAttribute(scimSchemaMap[0], object, i, destinationAttributeName, false);

              result.push( attributes );
            }                  
            else if (scimSchemaMap[0].attributes[i].multiValued == false) {
              // Complex Type
              if (scimSchemaMap[0].attributes[i].type == "complex") {
        
                var attributeName = scimSchemaMap[0].attributes[i].name;
                console.log("AN " + attributeName);

                //Handle sub-attributes                      
                for (var k=0; k < scimSchemaMap[0].attributes[i].subAttributes.length; k++) {
                  var subAttributeName = scimSchemaMap[0].attributes[i].subAttributes[k].name;
                  var subAttributeValue = object[attributeName][subAttributeName];
                  var destinationAttributeName = scimSchemaMap[0].attributes[i].subAttributes[k].ldapName;

                  if (subAttributeValue != null) {
                    console.log("SAN " + subAttributeName + ": SAV " + JSON.stringify(subAttributeValue));
                    result.push( { [destinationAttributeName] : subAttributeValue } );
                  }
                }
              }
              else {
                // Simple Type      
                var attributeName = scimSchemaMap[0].attributes[i].name;
                var attributeValue = object[attributeName];
                result.push( { [destinationAttributeName] : attributeValue } );
              }
            } 
            else {
              throw e;
            }                   
          }         
        }
        
        fulfill(result);

      } catch (ex) {
        console.error(ex.message);
        reject(ex);
      }
    });  
  },

  //Convert JSON MV attribute to LDAP
  ProcessLDAPMVAttribute: function(scimSchemaMap, object, i, destinationAttribute, usePrimary, valueAttribute) {

    var attributes = [];

    attributeName = scimSchemaMap.attributes[i].name;
    var value = object[scimSchemaMap.attributes[i].name];

    //SCIM entry
    var entry = [];

    //LDAP is flat
    var values = [];
    if (valueAttribute == null)
      valueAttribute = "value";

    // Iterate through each value
    for (var j=0; j < object[scimSchemaMap.attributes[i].name].length; j++) {
      value = object[scimSchemaMap.attributes[i].name][j];                      
      subAttributes = [];                      

      //Process SubAttributes
      if (scimSchemaMap.attributes[i].subAttributes != null) {
        //console.log("SA " + scimSchemaMap.attributes[i].subAttributes.length);    
        for (var k=0; k < scimSchemaMap.attributes[i].subAttributes.length; k++) {
          var subAttributeName = scimSchemaMap.attributes[i].subAttributes[k].name;
          value = object[scimSchemaMap.attributes[i].name][j][subAttributeName];
          //console.log("SAV " + subAttributeName + ": " + value);
          if (subAttributeName == "value")
            values.push( { [destinationAttribute] : value  } );
          
          entry = { [subAttributeName] : value };          
          subAttributes.push(entry);
        }

        //Process the Entry
        if (usePrimary)
        {
          if (entry.primary)
            attributes.push(subAttributes);
        }
        else {
          attributes.push(subAttributes);
        }
      }
      else
      {
        throw e;
      }

      // Object Mapping
      //var ldap_attribute = {};
      //var fromKey = '{C4056539-FA86-4398-A10B-C41D3A791F26}';
      //var toKey = '{01C64E8D-CDB5-4307-9011-0C7F1E70D115}';
      //automapper
      //    .createMap(fromKey, toKey) 
      //    .forMember(destinationAttribute, function (opts) { 
      //       return JSON.stringify(values);
      //     });      
      //ldap_attribute = automapper.map(fromKey, toKey, object);
    }
    
    //console.log(JSON.stringify(values));
    //return attributes;
    return JSON.stringify(values);
  },

  // NG
  LDAPToSCIMObjectNG: function(scimSchemaMap, object, req_url) {
    return new Promise(function (fulfill, reject) {
      try {

        if (object == null) 
          throw Error("Object is null");
        if (scimSchemaMap == null)  
          throw Error("SchemaMap is null");
        
        object = JSON.stringify(object);
        console.log(object);

        //Result object    
        var result = [];
    
        //Loop through each item in the schema map, strip empty attributes
        var attributes = [];
        var subAttributes = [];

        for (var i=0; i < scimSchemaMap[0].attributes.length; i++) {
          //Read through each attribute
          var attributeName = scimSchemaMap[0].attributes[i].ldapName;
          var destinationAttributeName = scimSchemaMap[0].attributes[i].name;
          var attributeValue = null;

          if (scimSchemaMap[0].attributes[i].multiValued == true) {
            
            //emails, phoneNumbers, ims, photos, addresses, groups, entitlements, roles, x509Certificates
            var attributeValue = object[attributeName];
            console.log("MV: " + attributeName + "(destinationAttributeName)" + destinationAttributeName + " : " + attributeValue);
          }
          else if (scimSchemaMap[0].attributes[i].multiValued == false) { 
            if (scimSchemaMap[0].attributes[i].type == "complex" ) {
              
              //LDAP is flat
              var parentAttributeName = scimSchemaMap[0].attributes[i].name;
              console.log("SAVP " + parentAttributeName);

              //TODO
              for (var k=0; k < scimSchemaMap[0].attributes[i].subAttributes.length; k++) {
                var sourceAttributeName = scimSchemaMap[0].attributes[i].subAttributes[k].ldapName;
                var destinationAttributeName = scimSchemaMap[0].attributes[i].subAttributes[k].name;
                
                value = object[sourceAttributeName];
                console.log("SAV " + sourceAttributeName + " " + destinationAttributeName + ": " + value);

                //value = object[0][scimSchemaMap.attributes[i].name][j][subAttributeName];
                //if (subAttributeName == "value")
                //  values.push( { [destinationAttribute] : value  } );
                //entry = { [subAttributeName] : value };          
                //subAttributes.push(entry);
              }
            }
            else {
              var attributeValue = object[attributeName];
              console.log("SV: " + attributeName + ": " + attributeValue);
              // Simple Type      
              if (attributeValue != null)
                result.push( { [destinationAttributeName] : attributeValue } );
            }
          }
        }
        fulfill(result);

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

  GetSCIMList: function(rows, startIndex, objects, req_url) {
    var scim_resource =  {
      "Resources": [], 
      "itemsPerPage": 0, 
      "schemas": [
        "urn:ietf:params:scim:api:messages:2.0:ListResponse"
      ], 
      "startIndex": 0, 
      "totalResults": 0
    }

    scim_resource["Resources"] = objects;
    scim_resource["startIndex"] = startIndex;
    scim_resource["itemsPerPage"] = rows;
    scim_resource["totalResults"] = objects.length;

    return scim_resource;
  }

};

