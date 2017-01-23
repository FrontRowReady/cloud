// Parse.Cloud.define("removeContact", function(request, response)
// {
//     Parse.Cloud.useMasterKey();

//     var user = request.user;

//     var contactToDeleteQuery = new Parse.Query(Parse.User);

//     contactToDeleteQuery.get(request.params.otherUser, 
//     {
//     	success: function(contact) 
//     	{
//     		user.relation("contacts").remove(contact);
//     		contact.relation("contacts").remove(user);

//     		Parse.Object.saveAll([contact, user], 
//     		{
//     			success: function(result) {response.success("Successfully deleted each others contacts");},
//     			error: function(result, error) {response.error("Uh oh, something went wrong");}
//     		});
//     	},
//     	error: function(result, error) {response.error("Uh oh, something went wrong");}
//     });
// });
var _ = require('underscore');

Parse.Cloud.afterSave(Parse.User, function(request) {
//  Parse.Cloud.useMasterKey();
  var user = request.object;

  if (!user.existed()) {
    user.setACL(new Parse.ACL(user));
    user.save(null, { useMasterKey: true });
  }

  var query = new Parse.Query(Parse.Role);
  query.equalTo("name", "user");
  query.first ( {
      useMasterKey: true,
      success: function(object) {
          if ( object ) {
              object.relation("users").add(user);
              object.save(null, { useMasterKey: true });
          }
      },
      error: function(error) {
          throw "Got an error " + error.code + " : " + error.message;
      }
  });

  var UserSearchInformation = Parse.Object.extend("UserSearchInformation");
  var userInformationPointer = user.get('information');

  var userSearchInformationQuery = new Parse.Query(UserSearchInformation);
  userSearchInformationQuery.equalTo("user", user);

  var promise = Parse.Promise.as(null);
  if (userInformationPointer)
  {
    promise = userInformationPointer.fetch({ useMasterKey: true });
  }

  promise.then(function(information){
    return Parse.Promise.when(Parse.Promise.as(information), userSearchInformationQuery.first({ useMasterKey: true }));
  }).then(function(information, searchInformation){

    var searchInformationCreated = false;
    if (!searchInformation)
    {
      searchInformation = new UserSearchInformation();
      searchInformation.setACL(new Parse.ACL(user));
    }

    if (user.get("deleted")){
      searchInformation.getACL().setPublicReadAccess(false);
    } else {
      searchInformation.getACL().setPublicReadAccess(true);
    }

    searchInformation.set("user", user);
    searchInformation.set("firstName", user.get("firstName"));
    searchInformation.set("lastName", user.get("lastName"));
    searchInformation.set("picture", user.get("picture"));
    searchInformation.set("city", user.get("city"));
    searchInformation.set("state", user.get("state"));
    searchInformation.set("specialty", user.get("specialty"));
    searchInformation.set("searchString", user.get("searchString"));

    if (information){
      searchInformation.set("dealershipName", information.get("dealershipName"));
    }

    searchInformation.set("zipcode", user.get("zipcode"));
    searchInformation.set("location", user.get("location"));
    searchInformation.save(null, { useMasterKey: true });
  });

});

Parse.Cloud.beforeSave(Parse.User, function(request, response)
{
//    Parse.Cloud.useMasterKey();


    // creates/updates "searchString":
    //
    //      a field that contains the user's first name, last name, and email without any spaces and all lowercase
    //      to facilitate general searches


    // creates/updates "searchCity":
    //
    //      a field that contains the user's city in all lower case to facilitate city searches


    // formats phone numbers
    //
    //      takes the information in "phoneNumber", "officePhoneNumber", and "faxNumber" and replaces them with the
    //      last 10 numbers from them (effectively stripping out international codes) and creates a formatted phone
    //      number with format "(###) ###-####"


    // sets location
    //
    //      runs a query against "Places" class with the User's state and city

    var o = request.object; // super shorthand
    var userInformationPointer = o.get('information');

    var promise = null;
    if (userInformationPointer){
      promise = userInformationPointer.fetch({ useMasterKey: true });
    } else {
      promise = Parse.Promise.as(null);
    }
    promise.then(function(information){
      /* update searchString field */
      if (o.dirty("firstName") || o.dirty("lastName") || o.dirty("email") || (information && information.dirty("dealershipName")) || o.get("searchString") == undefined)
      {
          var firstName = new String(o.get("firstName"));
          var lastName = new String(o.get("lastName"));
          var dealershipName = '';
          if (information){
            dealershipName = new String(information.get("dealershipName"));
          }
          var cleanEmail = "";

          // hack off everything after the "@" from the email field

          if (o.get("email") != undefined)
          {
              var email = new String(o.get("email"));

              for (var i = 0; i < email.length; i++)
              {
                  if (email[i] == '@')
                      break;
              }

              cleanEmail = email.substr(0,i);
          }

          // combine strings

          var searchString = "";

          if (firstName != "undefined")
          {
              o.set("firstName", firstName.capitalize());
              searchString += firstName.toLowerCase();
          }
          if (lastName != "undefined")
          {
              o.set("lastName", lastName.capitalize());
              searchString += lastName.toLowerCase();
          }
          if (cleanEmail != "undefined")
          {
              searchString += cleanEmail.toLowerCase();
          }
          if (dealershipName != "undefined")
          {
              searchString += dealershipName.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, "");
          }

          o.set("searchString", searchString);
      }

      /* update searchCity field */

      if (o.dirty("city") || o.get("searchCity") == undefined)
      {
          var city = new String(o.get("city"));

          if (city != "undefined")
          {
              o.set("searchCity", city.toLowerCase());
              o.set("city", city.capitalize());
          }
      }


      /* format phone numbers */

      if (o.dirty("phoneNumber"))
      {
          if (o.get("phoneNumber") != undefined)
          {
              var string = o.get("phoneNumber");

              var numbers = extractNumbers(string);
              var formatted = formatPhoneNumber(numbers);

              o.set("phoneNumber", numbers);
              o.set("formattedPhoneNumber", formatted);
          }
          else
          {
              o.unset("phoneNumber");
              o.unset("formattedPhoneNumber");
          }
      }

      if (o.dirty("officePhoneNumber"))
      {
          if (o.get("officePhoneNumber") != undefined)
          {
              var string = o.get("officePhoneNumber");

              var numbers = extractNumbers(string);
              var formatted = formatPhoneNumber(numbers);

              o.set("officePhoneNumber", numbers);
              o.set("formattedOfficePhoneNumber", formatted);
          }
          else
          {
              o.unset("officePhoneNumber");
              o.unset("formattedOfficePhoneNumber");
          }
      }

      if (o.dirty("faxNumber"))
      {
          if (o.get("faxNumber") != undefined)
          {
              var string = o.get("faxNumber");

              var numbers = extractNumbers(string);
              var formatted = formatPhoneNumber(numbers);

              o.set("faxNumber", numbers);
              o.set("formattedFaxNumber", formatted);
          }
          else
          {
              o.unset("faxNumber");
              o.unset("formattedFaxNumber");
          }
      }


      /* update location and/or finish */
      if (o.dirty("zipcode"))
      {
        var ZipCode = Parse.Object.extend("Zipcode");
        var query = new Parse.Query(ZipCode);
        query.equalTo("Zipcode", o.get("zipcode"));
        query.first({
          useMasterKey: true,
          success: function(zipcode)
          {
            if (zipcode){
              var latitude = parseFloat(zipcode.get("Lat"));
              var longitude = parseFloat(zipcode.get("Long"));
              var location = new Parse.GeoPoint(latitude, longitude);
              o.set("location", location);
            } else {
              o.unset('location');
            }
            response.success();
          },
          error: function(error)
          {
            response.error("Could not query zipcode: " + error.code + " " + error.message);
          }
        });
      }
      else
      {
        response.success();
      }
    });
});

Parse.Cloud.define("createDealerAndRoles", function(request, response)
{
//  Parse.Cloud.useMasterKey();
  var adminRoleACL = new Parse.ACL();
  adminRoleACL.setPublicReadAccess(true);
  var adminRole = new Parse.Role(request.params.accountId + "_AdminRole", adminRoleACL);
  adminRole.getUsers().add(request.user, { useMasterKey: true });
  adminRole.save(null, { useMasterKey: true }).then(function(adminRole){
    var userRoleACL = new Parse.ACL();
    userRoleACL.setPublicReadAccess(true);
    var userRole = new Parse.Role(request.params.accountId + "_UserRole", userRoleACL);
    userRole.getRoles().add(adminRole, { useMasterKey: true });
    return userRole.save(null, { useMasterKey: true });
  }).then(function(){
    response.success();
  }, function(error){
    response.error("Could not create Account");
  });
});


Parse.Cloud.define("createUserAndRoles", function(request, response)
{
//  Parse.Cloud.useMasterKey();

  var adminRoleACL = new Parse.ACL();
  adminRoleACL.setPublicReadAccess(true);
  var adminRole = new Parse.Role(request.params.accountId + "_AdminRole", adminRoleACL);
  //add all users to admin for now
  adminRole.getUsers().add(request.user);
  adminRole.save(null, { useMasterKey: true }).then(function(adminRole){
    var userRoleACL = new Parse.ACL();
    userRoleACL.setPublicReadAccess(true);
    var userRole = new Parse.Role(request.params.accountId + "_UserRole", userRoleACL);
    userRole.getRoles().add(adminRole);
    return userRole.save(null, { useMasterKey: true });
  }).then(function(){
    response.success();
  }, function(error){
    response.error("Could not create Account");
  });
});


Parse.Cloud.define("deleteUserAccount", function(request, response)
{
    // get the user id
    var userId = request.params.userId;
    var User = Parse.Object.extend("User");
    var userQuery = new Parse.Query(User);
    var objectsToSave = [];

    userQuery.get(userId, { useMasterKey: true }).then(function(user){
      user.set("deleted", true);
      objectsToSave.push(user);
      var contactsQuery = new Parse.Query(User);
      contactsQuery.equalTo("contacts", user);
      return Parse.Promise.when(Parse.Promise.as(user), contactsQuery.find({ useMasterKey: true }));
    })
    .then(function(user, contacts){
      _.each(contacts, function(contact){
        contact.relation("contacts").remove(user);
        objectsToSave.push(contact);
      });
      return Parse.Promise.when(Parse.Promise.as(user), user.relation("contacts").query().find({ useMasterKey: true }));
    })
    .then(function(user, contacts){
      _.each(contacts, function(contact){
        user.relation("contacts").remove(contact);
      });
      return Parse.Object.saveAll(objectsToSave, { useMasterKey: true });
    }).then(function(){
      response.success();
    }).fail(function(error){
      response.error("deleteUserAccount failed: " + error.code + " " + error.message);
    });
});

// function to extract the last 10 numbers from a string
function extractNumbers(string)
{
    var out = "";

    // regex is beyond me

    for (var i = 0; i < string.length; i++)
        if ('0' <= string[i] && string[i] <= '9')
            out += string[i];

    if (out.length > 10)
        out = out.substr(out.length-10, out.length);

    return out;
};


// function to format a string of 10 numbers to (###) ###-####
function formatPhoneNumber(string)
{
    if (string.length < 10)
        return "";

    var one = string.slice(0, 3);
    var two = string.slice(3, 6);
    var tre = string.slice(6, 10);

    var out = "(" + one + ") " + two + "-" + tre;

    return out;
};

Parse.Cloud.define("removeContact", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // function to cut ties between two users. removes both users from
    // the other's "contacts" relation and removes them from their
    // contact groups

    // params:
    //      otherUser - objectId of the other user to cut ties with

    var currentUser = request.user;


    var query = new Parse.Query(Parse.User);

    query.get(request.params.otherUser,
    {
        useMasterKey: true,
        success: function(otherUser)
        {
            currentUser.relation("contacts").remove(otherUser);
            otherUser.relation("contacts").remove(currentUser);

            currentUser.relation("contactGroups").query().find(
            {
                useMasterKey: true,
                success: function(currentUserGroups)
                {
                    for (var i = 0; i < currentUserGroups.length; i++)
                        currentUserGroups[i].relation("contacts").remove(otherUser);

                    otherUser.relation("contactGroups").query().find(
                    {
                        useMasterKey: true,
                        success: function(otherUserGroups)
                        {
                            for (var i = 0; i < otherUserGroups.length; i++)
                                otherUserGroups[i].relation("contacts").remove(currentUser);

                            var objectsToSave = [currentUser, otherUser].concat(currentUserGroups).concat(otherUserGroups);

                            Parse.Object.saveAll(objectsToSave,
                            {
                                useMasterKey: true,
                                success: function(list)
                                {
                                    response.success("Contacts removed successfully");
                                },
                                error: function(error)
                                {
                                    response.error("Could not save objects");
                                }
                            });
                        },
                        error: function(error) { response.error("Could not query otherUserGroups"); }
                    });
                },
                error: function(error) { response.error("Could not query currentUserGroups"); }
            });
        },
        error: function(error) { response.error("Could not query otherUser"); }
    });
});


String.prototype.capitalize = function()
{
    var str = this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();

    for (var i = 0; i < str.length-2; i++)
    {
        var sub = str.substring(i-1,i+1).toLowerCase();
        
        if (str.charAt(i) === " " || sub === "mc" || sub == "o'")
        {
            var firstPart = str.substring(0, i+1);
            var capitalChar = str.charAt(i+1).toUpperCase();
            var secondPart = str.substring(i+2, str.length);
            
            str = firstPart + capitalChar + secondPart;
        }
    }

    return str;
}
