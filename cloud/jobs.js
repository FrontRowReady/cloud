var _ = require('underscore');

Parse.Cloud.job("saveAllUsers", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();
  // Query for all users
  var query = new Parse.Query(Parse.User);
  query.each(function(user) {
      //user.set("plan", request.params.plan);
      //user.set("searchString", null);
      user.set("zipcode", user.get("zipcode"));
      return user.save( null, { useMasterKey: true });
  } ).then(function() {
    // Set the job's success status
    status.success("Migration completed successfully.");
  }, function(error) {
    // Set the job's error status
    status.error("Save all users failed: " + error.code + " " + error.message);
  });
});

Parse.Cloud.job("setUserDefaultRole", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();

  var roleQuery = new Parse.Query(Parse.Role);
  roleQuery.equalTo("name", "user");
  return roleQuery.first({ useMasterKey: true }).then(function(role){
    var query = new Parse.Query(Parse.User);
    return Parse.Promise.when(Parse.Promise.as(role), query.find({ useMasterKey: true }));
  }).then(function(role, users){
    _.each(users, function(user){
      role.relation("users").add(user)
    });
    return role.save(null, { useMasterKey: true });
  }).then(function(role){
    // Set the job's success status
    status.success("Migration completed successfully.");
  }, function(error) {
    // Set the job's error status
    status.error("set User Default Role failed: " + error.code + " " + error.message);
  });
});

Parse.Cloud.job("setUserACLs", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();

  var query = new Parse.Query(Parse.User);
  return query.each(function(user){
    user.setACL(new Parse.ACL(user));
    var promise = Parse.Promise.as();
    promise = promise.then(function(){
      var contacts = user.relation("contacts");
      return contacts.query().find({ useMasterKey: true }).then(function(contacts){
        _.each(contacts, function(contact){
          user.getACL().setReadAccess(contact, true);
        });
      });
    }).then(function(){
      return user.save(null, { useMasterKey: true });
    });
    return promise;
  }).then(function(){
    // Set the job's success status
    status.success("User ACL completed successfully.");
  }, function(error) {
    // Set the job's error status
    status.error("User ACL set failed. " + error.code + " " + error.message);
  });
});

Parse.Cloud.job("setSpecialtyACLs", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();
  setAcls("Specialty", status);
});

Parse.Cloud.job("setCarYearACLs", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();
  setAcls("CarYear", status);
});

//Parse.Cloud.job("setCarMakeYearACLs", function(request, status) {
  //// Set up to modify user data
  //Parse.Cloud.useMasterKey();
  //setAcls("CarMakeYear", status);
//});

Parse.Cloud.job("setCarMakeACLs", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();
  setAcls("CarMake", status);
});

//Parse.Cloud.job("setCarMakeModelACLs", function(request, status) {
  //// Set up to modify user data
  //Parse.Cloud.useMasterKey();
  //setAcls("CarMakeModel", status);
//});

Parse.Cloud.job("setZipcodeDataACLs", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();

  var Model = Parse.Object.extend("Zipcode");
  var query = new Parse.Query(Model);
  return query.each(function(model){
    if (!model.getACL() || (!model.getACL().getPublicReadAccess() || model.getACL().getPublicWriteAccess()))
    {
      var acl = new Parse.ACL();
      acl.setPublicReadAccess(true);
      model.setACL(acl);
      return model.save(null, { useMasterKey: true });
    }
  }).then(function(){
    status.success("Zipcode set successfully.");
  }).fail(function(error){
    console.log(error);
    status.error("Zipcode ACL set failed. " + error.code + " " + error.message);
  });
});

Parse.Cloud.job("setPlacesDataACLs", function(request, status) {
  // Set up to modify user data
//  Parse.Cloud.useMasterKey();
  setAcls("Places", status);
});

function setAcls(tableName, status)
{
  var Model = Parse.Object.extend(tableName);

  var roleQuery = new Parse.Query(Parse.Role);
  roleQuery.equalTo("name", "user");

  return roleQuery.first({ useMasterKey: true }).then(function(role){
    var query = new Parse.Query(Model);
    return query.each(function(model){
      if (!model.getACL() || !model.getACL().getRoleReadAccess(role))
      {
        var acl = new Parse.ACL();
        acl.setRoleReadAccess(role, true);
        model.setACL(acl);
        return model.save(null, { useMasterKey: true });
      }
    });
  }).then(function() {
    // Set the job's success status
    status.success(tableName + " set successfully.");
  }, function(error) {
    // Set the job's error status
    console.log(error);
    status.error(tableName + " ACL set failed. " + error.code + " " + error.message);
  });
}
