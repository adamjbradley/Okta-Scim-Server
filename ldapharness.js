var ldap = require('ldapjs');
var assert = require('assert');

var baseDN = 'o=unify'
var ldap = require('ldapjs');
var client = ldap.createClient({
  url: 'ldap://127.0.0.1:1389'
});
client.bind('cn=root', 'password', function(err) {
  assert.ifError(err);
});

var user1 = 'user1-1'
var domain = 'unifysolutions.net'

//Search
var opts = {
  scope: 'sub',
  attributes: ['cn', 'emailAddress', 'userName', 'givenName', 'middleName', 'sn']
};
client.search('o=unify', opts, function(err, res) {
  assert.ifError(err);
  res.on('searchEntry', function(entry) {
    console.log('entry: ' + JSON.stringify(entry.object));
  });
  res.on('searchReference', function(referral) {
    console.log('referral: ' + referral.uris.join());
  });
  res.on('error', function(err) {
    console.error('error: ' + err.message);
  });
  res.on('end', function(result) {
    console.log('status: ' + result.status);
  });
});

//Add
var entry = {
  cn: user1,
  id: user1,
  emailAddress: [user1 + "@" + domain],
  userName: [user1],
  givenName: [user1],
  middleName: [''],
  sn: [user1],
  objectclass: 'inetOrgPerson'
};
client.add('cn=' + entry.cn + ',' + baseDN, entry, function(err) {
  assert.ifError(err);
});

//Search
var opts = {
  scope: 'sub',
  attributes: ['cn', 'emailAddress', 'userName', 'givenName', 'middleName', 'sn']
};
client.search('o=unify', opts, function(err, res) {
  assert.ifError(err);
  res.on('searchEntry', function(entry) {
    console.log('entry: ' + JSON.stringify(entry.object));
  });
  res.on('searchReference', function(referral) {
    console.log('referral: ' + referral.uris.join());
  });
  res.on('error', function(err) {
    console.error('error: ' + err.message);
  });
  res.on('end', function(result) {
    console.log('status: ' + result.status);
  });
});



