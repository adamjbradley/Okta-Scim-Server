var ldap = require('ldapjs');

///--- Shared handlers
function authorize(req, res, next) {
  /* Any user may search after bind, only cn=root has full power */
  var isSearch = (req instanceof ldap.SearchRequest);
  if (!req.connection.ldap.bindDN.equals('cn=root') && !isSearch) {
    return next(new ldap.InsufficientAccessRightsError());
  }
    
  console.log("Authorize: Authorizing");
  return next();
}

///--- Globals
var SUFFIX = 'o=unify';
var db = {};
var server = ldap.createServer();

server.bind('cn=root', function(req, res, next) {
  if (req.dn.toString() !== 'cn=root' || req.credentials !== 'password')
    return next(new ldap.InvalidCredentialsError());

  console.log("Bind as " + req.dn.toString());    
  res.end();
  return next();
});

server.add(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();

  console.log("Add: Request to add " + req.dn.toString());

  if (db[dn]) {
    console.log("Add: Entry exists " + req.dn.toString());
    return next(new ldap.EntryAlreadyExistsError(dn));
  }

  console.log("Add: Adding " + req.dn.toString());
  db[dn] = req.toObject().attributes;
  res.end();
  return next();
});

server.bind(SUFFIX, function(req, res, next) {
  var dn = req.dn.toString();
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  if (!db[dn].userpassword)
    return next(new ldap.NoSuchAttributeError('userPassword'));

  if (db[dn].userpassword.indexOf(req.credentials) === -1)
    return next(new ldap.InvalidCredentialsError());

  res.end();
  return next();
});

server.compare(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  if (!db[dn][req.attribute])
    return next(new ldap.NoSuchAttributeError(req.attribute));

  var matches = false;
  var vals = db[dn][req.attribute];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i] === req.value) {
      matches = true;
      break;
    }
  }

  res.end(matches);
  return next();
});

server.del(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();

  console.log("Delete: Request to delete " + req.dn.toString());
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));
  
  console.log("Delete: Deleting " + req.dn.toString());
  delete db[dn];

  res.end();
  return next();
});

server.modify(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();

  console.log("Modify: Request to modify " + req.dn.toString());

  if (!req.changes.length)
    return next(new ldap.ProtocolError('changes required'));
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  console.log("Modify: Modified " + req.dn.toString());

  var entry = db[dn];

  for (var i = 0; i < req.changes.length; i++) {
    mod = req.changes[i].modification;
    switch (req.changes[i].operation) {
    case 'replace':
      if (!entry[mod.type])
        return next(new ldap.NoSuchAttributeError(mod.type));

      if (!mod.vals || !mod.vals.length) {
        delete entry[mod.type];
      } else {
        entry[mod.type] = mod.vals;
      }

      break;

    case 'add':
      if (!entry[mod.type]) {
        entry[mod.type] = mod.vals;
      } else {
        mod.vals.forEach(function(v) {
          if (entry[mod.type].indexOf(v) === -1)
            entry[mod.type].push(v);
        });
      }

      break;

    case 'delete':
      if (!entry[mod.type])
        return next(new ldap.NoSuchAttributeError(mod.type));

      delete entry[mod.type];

      break;
    }
  }

  res.end();
  return next();
});

server.search(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();

  console.log("Search: Searching for " + req.dn.toString());

  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  var scopeCheck;

  switch (req.scope) {
  case 'base':
    if (req.filter.matches(db[dn])) {
      res.send({
        dn: dn,
        attributes: db[dn]
      });
    }

    res.end();
    return next();

  case 'one':
    scopeCheck = function(k) {
      if (req.dn.equals(k))
        return true;

      var parent = ldap.parseDN(k).parent();
      return (parent ? parent.equals(req.dn) : false);
    };
    break;

  case 'sub':
    scopeCheck = function(k) {
      return (req.dn.equals(k) || req.dn.parentOf(k));
    };

    break;
  }

  Object.keys(db).forEach(function(key) {
    if (!scopeCheck(key))
      return;

    if (req.filter.matches(db[key])) {
      res.send({
        dn: key,
        attributes: db[key]
      });
    }
  });

  res.end();
  return next();
});

///--- Fire it up
server.listen(1389, function() {
  console.log('LDAP server up at: %s', server.url);
});