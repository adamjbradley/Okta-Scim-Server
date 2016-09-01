var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

//External Modules
var Promise = require('bluebird');
var ldap = require('ldapjs');
var ldif = require('ldif');

// Local modules
var jsHelper = require('../../jshelper');

var should = require('chai').should(),
    ldapHelper = require('../index'),
    ASimpleMethod = ldapHelper.ASimpleMethod,
    LDAPConnect = ldapHelper.LDAPConnect,
    LDAPConnectPromise = ldapHelper.LDAPConnectPromise,
    LDAPSearchPromise = ldapHelper.LDAPSearchPromise,
    LDAPSearchAsyncPromise = ldapHelper.LDAPSearchAsyncPromise,
    SCIMToLDAPObject = ldapHelper.SCIMToLDAPObject,
    LDIFToSCIMObject = ldapHelper.LDIFToSCIMObject, 
    LDAPToSCIMObject = ldapHelper.LDAPToSCIMObject,
    OpenLDIFDocument = ldapHelper.OpenLDIFDocument,
    OpenJSONDocument = jsHelper.OpenJSONDocument,
    GetSCIMList = ldapHelper.GetSCIMList,
    SCIMToLDAPModifyObject = ldapHelper.SCIMToLDAPModifyObject,
    JSONToLDAPModifyObject = ldapHelper.JSONToLDAPModifyObject,
    LDAPToSCIMGroup = ldapHelper.LDAPToSCIMGroup;
  
  
var opts = {
  filter: 'objectclass=*',
  scope: 'sub',
  attributes: []
};

var url = 'ldap://127.0.0.1:10389';
var failDN = "uid=auser,ou=system";
var schemaDN = "ou=schema";
var uid = "uid=admin";
var username = "uid=admin,ou=system";
var password = "password";
var baseDN = "ou=system";

var ldapObject = null;
var ldifObject = null;
var users = null;
var scimSchemaMap = null;
var scimObject = null;
var scimSchemaMap = null;

//SCIMUser
var scimUserPath = "../User.json";

//LDAPUser
var ldapUserPath = "../User.ldif";

//SCIM Configuration
var scimSchemaPath = "../Schema.json";
var scimSchema = null;

//Schema Map
var schemaMapPath = "../SchemaMap.json";
var schemaMap = null;

var client = ldap.createClient({
  url: url
});
Promise.promisifyAll(client);

//Tests
describe('#ASimpleMethod', function() {
  it('ASimpleMethod', function() {
    var result = ASimpleMethod(true);
    console.log(result);
    result.then(function(result) {
      console.log("Success: " + result);
    }, function(error) {
      console.error("Error: " + error);
    });
  });
});

//LDAP methods

describe('#LDAP Methods', function() {

  it('LDAPConnectPromise', function() {
    console.log('0');
    if (LDAPConnectPromise(ldap, client, username, password))
      console.log("Connected"); 
    console.log('0.5');
  });

  /*
  it('Retrieve the Schema', function() {
    LDAPSearchAsyncPromise(client, schemaDN, opts)
      .then(function (res) {
        return LDAPSearchPromise(res, 'Object not found');
      }).then(function(res) {
        console.log("Schema returned " + res.length + "entries");
      })
      .catch(function(message) {
        console.log('Error:' + message);
      });
  });
  */
  
  it('Search for a particular User in LDAP', function() {
    var opts = {
      filter: '(|(' + uid + '))',
      scope: 'sub',
      attributes: []
    };
    console.log(baseDN);
    console.log(opts);

    LDAPSearchAsyncPromise(client, baseDN, opts)
      .then(function (result) {
        return LDAPSearchPromise(result, 'Object not found');
      }).then(function(result) {        
        console.log('All is ok');
        console.log(result);
        users = result;
      })
      .catch(function(message) {
        console.log('Error:' + message);
      });
  });
  
  it("Converts an LDAPObject into a SCIMObject using the LDAP User and SCIM Schema Map", function (done) {    
    var result = LDAPToSCIMObject(scimSchemaMap, users, "http://localhost", "o=system");
    result.then(function(data) {
      result.should.be.a('Object');
      console.log(data);
      done();
    }, function(error) {
      console.log("Error: " + error);
      done();
    });
  });
  
  /*
  it('Search for all Users in LDAP', function() {
    var opts = {
      filter: 'objectclass=inetorgperson',
      scope: 'sub',
      attributes: []
    };
    console.log(baseDN);
    console.log(opts);

    var scimObjects = [];
    LDAPSearchAsyncPromise(client, baseDN, opts)
      .then(function (result) {
        return LDAPSearchPromise(result, 'Object not found');
      }).then(function(result) {
        
        for (var i=0; i<result.length; i++){
          LDAPToSCIMObject(schemaMap, result[i], "http://localhost", "o=system")
            .then(function (result) {
              console.log(result);
              scimObjects.push(result);
            }).catch(function(message) {
              console.log('Error:' + message);
            });
        }

      })
      .catch(function(message) {
        console.log('Error:' + message);
      }).finally(function(result){
        console.log(GetSCIMList(100, 0, scimObjects, 'http://localhost'));      
      });
  });
  */
});

// Object Conversion
describe('#Convert LDAP to SCIM Object and back again', function() {
  /*
  it("Opens SCIM Schema Map", function (done) {
    var result = OpenJSONDocument(schemaMapPath);
    result.then(function(_scimSchemaMap) {
      result.should.be.a('Object');
      scimSchemaMap = _scimSchemaMap;
      done();
    }, function(error) {
      console.log("Something bad" + error);
      done();
    });
  });
  
  /*
  it("Opens an LDIF File", function (done) {    
    var result = OpenLDIFDocument(ldapUserPath);
    result.then(function(data) {
      result.should.be.a('Object');    
      var output_options = {};
      //console.log(JSON.stringify(data.toObject(output_options)));
      var _ldifObject = JSON.parse(JSON.stringify(data.toObject(output_options)));
      ldifObject = _ldifObject;
      users = ldifObject.entries;
      done();
    }, function(error) {
      console.log("Error: " + error);
    });
  });

  /*
  it("Converts an LDIFObject into a SCIMObject using the LDAP User and SCIM Schema Map", function (done) {
    var result = LDIFToSCIMObject(scimSchemaMap, users, "http://localhost", "o=system");
    result.then(function(data) {
      result.should.be.a('Object');
      console.log(data);
      done();
    }, function(error) {
      console.log("Error: " + error);
      done();
    });
  });
  */

  
  it("Opens a JSON User", function (done) {
    var result = OpenJSONDocument(scimUserPath);
    result.then(function(_scimObject) {
      result.should.be.a('Object');
      scimObject = _scimObject;
      console.log(scimObject);
      done();
    }, function(error) {
      done();
    });
  });

  /*
  it("Converts a SCIMObject into an LDAPObject using the JSON User and SCIM Schema Map", function (done) {
    var objectClass = [ "top" , "inetOrgPerson", "person", "organizationalPerson"];
    var result = SCIMToLDAPObject(scimSchemaMap, scimObject, "http://localhost", "o=system", objectClass);
    result.then(function(data) {
      result.should.be.a('Object');
      console.log(data);
      done();
    }, function(error) {
      console.log("Error: " + error);
      done();
    });  
  });
  */
  
  it("Converts a SCIMObject into an LDAPModifyObject using the JSON User and SCIM Schema Map", function (done) {
    var objectClass = [ "top" , "inetOrgPerson", "person", "organizationalPerson"];
    var result = SCIMToLDAPModifyObject(scimSchemaMap, scimObject, "http://localhost", "o=system", objectClass);
    result.then(function(data) {
      result.should.be.a('Object');
      console.log(data);
      done();
    }, function(error) {
      console.log("Error: " + error);
      done();
    });  
  });
  

});


