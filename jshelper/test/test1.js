var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var should = require('chai').should();

//External Modules
var jshelper = require('../index'),
    ASimpleMethod = jshelper.ASimpleMethod,
    InspectClass = jshelper.InspectClass,
    OpenJSONDocument = jshelper.OpenJSONDocument;

//SCIMUser
var scimUserPath = "../User.json";

//Tests
describe('#ASimpleMethod', function() {
  it('Stub', function() {
    var result = ASimpleMethod(false);
    result.then(function(result) {
      console.log("Success: " + result);
    }, function(error) {
      console.error("Error: " + error);
    });
  });
});

describe('#InspectClass', function() {
  it('Displays the contents of a class', function() {
    var result = InspectClass(NaN);
    result.should.be.a('Object');
    console.log(result);
  });
});

describe('#Open a JSON Document', function() {
  var scimObject = null;
  var scimSchemaMap = null;

  it("Opens a JSON User", function (done) {
    var result = OpenJSONDocument(scimUserPath);
    result.then(function(_scimObject) {
      result.should.be.a('Object');
      scimObject = _scimObject;
      done();
    }, function(error) {
      done();
    });
  });

});

