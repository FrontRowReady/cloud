var _ = require('underscore');

Parse.Cloud.beforeSave("Vehicle", function(request, response) 
{
//  Parse.Cloud.useMasterKey();
  
  var currentUser = request.user;
  var account = currentUser.get("account");
  var accountId = account.id;

  var vehicleACL = new Parse.ACL();
  vehicleACL.setPublicReadAccess(true);
  vehicleACL.setRoleWriteAccess(accountId + "_UserRole", true);
  vehicleACL.setWriteAccess(currentUser, true);

  request.object.setACL(vehicleACL);
  response.success();
});

Parse.Cloud.beforeSave("InteriorConditionReport", function(request, response)
{
//  Parse.Cloud.useMasterKey();
  
  var currentUser = request.user;
  var account = currentUser.get("account");
  var accountId = account.id;

  var interiorCRACL = new Parse.ACL();
  interiorCRACL.setPublicReadAccess(true);
  interiorCRACL.setRoleWriteAccess(accountId + "_UserRole", true);
  interiorCRACL.setWriteAccess(currentUser, true);

  request.object.setACL(interiorCRACL);
  response.success();
});

Parse.Cloud.beforeSave("ExteriorConditionReport", function(request, response)
{
//  Parse.Cloud.useMasterKey();
  
  var currentUser = request.user;
  var account = currentUser.get("account");
  var accountId = account.id;

  var exteriorCRACL = new Parse.ACL();
  exteriorCRACL.setPublicReadAccess(true);
  exteriorCRACL.setRoleWriteAccess(accountId + "_UserRole", true);
  exteriorCRACL.setWriteAccess(currentUser, true);

  request.object.setACL(exteriorCRACL);
  response.success();
});

Parse.Cloud.beforeSave("Share", function(request, response)
{
//  Parse.Cloud.useMasterKey();
  
  var currentUser = request.user;
  var account = currentUser.get("account");
  var accountId = account.id;

  var shareACL = new Parse.ACL();
  shareACL.setRoleWriteAccess(accountId + "_UserRole", true);
  shareACL.setRoleReadAccess(accountId + "_UserRole", true);
  shareACL.setWriteAccess(currentUser, true);
  shareACL.setReadAccess(currentUser, true);

  request.object.setACL(shareACL);
  response.success();
}); 

Parse.Cloud.beforeSave("SharedWithRecipients", function(request, response)
{
//  Parse.Cloud.useMasterKey();
  
  var currentUser = request.user;
  var account = currentUser.get("account");
  var accountId = account.id;

  var sharedWithACL = new Parse.ACL();
  sharedWithACL.setRoleWriteAccess(accountId + "_UserRole", true);
  sharedWithACL.setRoleReadAccess(accountId + "_UserRole", true);
  sharedWithACL.setWriteAccess(currentUser, true);
  sharedWithACL.setReadAccess(currentUser, true);

  request.object.setACL(sharedWithACL);
  response.success();
});

Parse.Cloud.beforeSave("FrrContact", function(request, response)
{
//  Parse.Cloud.useMasterKey();
  
  var currentUser = request.user;
  var account = currentUser.get("account");
  var accountId = account.id;

  var contactACL = new Parse.ACL();
  contactACL.setRoleWriteAccess(accountId + "_UserRole", true);
  contactACL.setRoleReadAccess(accountId + "_UserRole", true);
  contactACL.setWriteAccess(currentUser, true);
  contactACL.setReadAccess(currentUser, true);

  request.object.setACL(contactACL);
  response.success();
});

// Parse.Cloud.define("addUserAccountACLs", function(request, response)
// {
//   Parse.Cloud.useMasterKey();
//   // var adminRole = request.params.adminRole;
//   // var userRole = request.params.userRole;
//   // var currentUser = request.params.currentUser;
//   // var currentAccount = request.params.account;
  
//   var currentUser = request.params.userId;
//   var userACL = new Parse.ACL();

//   userACL.setRoleReadAccess(request.params.userRole, true);
//   userACL.setReadAccess(currentUser, true);
//   userACL.setWriteAccess(currentUser, true);
//   currentUser.setACL(userACL);
//   currentUser.save().then(function(currentUser){
//     var accountACL = new Parse.ACL();
//     var currentAccount = currentUser.get("account");
//     accountACL.setRoleReadAccess(request.params.userRole, true);
//     accountACL.setReadAccess(request.params.currentUser, true);
//     accountACL.setRoleWriteAccess(request.params.adminRole, true);
//     currentAccount.setACL(accountACL);
//     return currentAccount.save();
//   }).then(function(){
//     response.success();
//   }, function(error){
//     response.error("Could not save ACLs");
//   });
// });

//account read role user, read user current, write role admin