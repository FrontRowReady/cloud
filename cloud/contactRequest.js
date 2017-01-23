// ContactRequest statuses:
var _ = require('underscore');
var ContactRequestStatus = {
    pending : "Pending",
    accepted : "Accepted",
    declined : "Declined"
}

// NOTE:

//      These do not send users the appropriate notifications (as that
//      functionality is not implemented yet)

//      These do not account for ContactGroups, as that is not implemented
//      yet either (actually is that even necessary?)

Parse.Cloud.define("sendContactRequestBatch", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    var fromUser = request.user;
    var toUserQuery = new Parse.Query(Parse.User);

    if (request.params.toUsers.length == 0)
        response.error("There are no toUsers or there aren't enough relatedObjects");

    var ids = [];
    for (var i = 0; i < request.params.toUsers.length; i++)
    {
      ids.push(request.params.toUsers[i]);
    }

    var toUsersQuery = new Parse.Query(Parse.User);
    toUsersQuery.containedIn("objectId", ids);
    return toUsersQuery.find({useMasterKey: true}).then(function(toUsers) {
        var promise = Parse.Promise.as();
        _.each(toUsers, function(toUser) {
            var ContactRequest = Parse.Object.extend("ContactRequest");
            var duplicateCheckQuery = new Parse.Query(ContactRequest);

            duplicateCheckQuery.containedIn("status", [ContactRequestStatus.pending]);
            duplicateCheckQuery.equalTo("fromUser", fromUser);
            duplicateCheckQuery.equalTo("toUser", toUser);

            // also check the reversed to/from pair

            var reversedDuplicateCheckQuery = new Parse.Query(ContactRequest);

            reversedDuplicateCheckQuery.containedIn("status", [ContactRequestStatus.pending]);
            reversedDuplicateCheckQuery.equalTo("fromUser", toUser);
            reversedDuplicateCheckQuery.equalTo("toUser", fromUser);

            // or together, check if the query returns any objects

            var orQuery = Parse.Query.or(duplicateCheckQuery, reversedDuplicateCheckQuery);
            promise = promise.then( function() {
                return orQuery.first({useMasterKey: true})
                .then(function(duplicateContactRequest){
                            if (!duplicateContactRequest) {
                                var contactRequest = new ContactRequest();
                                contactRequest.setACL(new Parse.ACL(fromUser));
                                contactRequest.getACL().setReadAccess(toUser, true);
                                fromUser.getACL().setReadAccess(toUser, true);

                                contactRequest.set("toUser", toUser);
                                contactRequest.set("fromUser", fromUser);

                                contactRequest.set("status", ContactRequestStatus.pending);
                                contactRequest.set("isAccepted", false);

                                if (request.params.note && request.params.note.length > 0){
                                  contactRequest.set("note", request.params.note);
                                }

                                return Parse.Promise.when(Parse.Promise.as(contactRequest), fromUser.get("information").fetch({useMasterKey: true}));
                            } else {
                               console.log("Duplicate contact request")
                            }
                      })
                .then(function(contactRequest, information) {
                            if (contactRequest) {
                                if (information) {
                                    var acl = information.getACL();
                                    if (acl) {
                                        acl.setReadAccess(toUser, true);
                                    }
                                }
                                return Parse.Promise.when(Parse.Promise.as(contactRequest), Parse.Promise.as(information));
                            }
                      })
                .then( function(contactRequest, information) {
                            if (contactRequest){
                                if (information){
                                    return Parse.Promise.when(contactRequest.save(null,{useMasterKey: true}), information.save(null,{useMasterKey: true}));
                                } else {
                                    return Parse.Promise.when(contactRequest.save(null, {useMasterKey: true}));
                                }
                            }
                        })
                .then( function(contactRequest) {
                            if (contactRequest){
                                var toUserContactRequests = toUser.relation("contactRequests");
                                var fromUserContactRequests = fromUser.relation("contactRequests");

                                toUserContactRequests.add(contactRequest);
                                toUser.save(null, {useMasterKey:true});
                                fromUserContactRequests.add(contactRequest);
                                fromUser.save(null, {useMasterKey:true});

                                return Parse.Promise.as(contactRequest);
                            }
                        })
                .then( function(contactRequest) { if (contactRequest) {
                                                        console.log("Run sendAlert()");
                                                        // return Parse.Promise.as(); returns response instantly
                                                        // returns response after one minute.
                                                        return Parse.Cloud.run('sendAlert', { toUser: toUser.id,
                                                                                              fromUser: fromUser.id,
                                                                                              relatedObject: contactRequest.id,
                                                                                              alertType: "CR_Received" }, 
                                                                                              { success: function() {console.log("sendAlert success");},
                                                                                                error:   function() {console.log("sendAlert fail");}
                                                                                              });
                                                    }
                                                  }, 
                        function(error) { console.log("Could not create contact request " + error.description);
                                          response.error("Could not create contact request " + error.description); } );
            }, function(error) { console.log("'or' query failed with: "+error.description);});
        },  function(error) {  // _.each loop failed for a user
              console.log("Could not execute for user " + toUser.id + " " + error.description);
              response.error("Could not execute for user " + toUser.id + " " + error.description);
            }
        );
        console.log("return empty promise");
        return promise;
    }).then( function() { console.log("**** sendContactRequestBatch is successful!")
                          response.success(); },
             function(error) { console.log("Error in final exit: "+error.description);
                               response.success(); } );
});

Parse.Cloud.define("sendContactRequest", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // send contact request to user and notify toUser

    // params:
    //      toUser - objectId of the User who's receiving the request
    //      note - personal note to go with the request


    // if a pending contact request already exist for this user pair, then
    // the function will result in an error with "Contact request already exists"

        // this error message can be accessed through:

            // iOS - from associated NSError, [error.userInfo objectForKey:@"error"]


    // also sends a push to the recieving user with data:

    //      badge: "Increment"
    //      alert: message
    //      contactRequestId: objectId of the contact request object
    //      fromUserId: objectId of the sending user
    //      pushType: "ContactRequestRecieved"
    //      sound: "Notification.caf"

    var ContactRequest = Parse.Object.extend("ContactRequest");

    var fromUser = request.user;

    var toUserQuery = new Parse.Query(Parse.User);

    toUserQuery.get(request.params.toUser,
    {
        useMasterKey: true,
        success: function(toUser)
        {
            // check to make sure that there isn't already a contactRequest for this pair

            var duplicateCheckQuery = new Parse.Query(ContactRequest);

            duplicateCheckQuery.equalTo("status", ContactRequestStatus.pending);
            duplicateCheckQuery.equalTo("fromUser", fromUser);
            duplicateCheckQuery.equalTo("toUser", toUser);

            // also check the reversed to/from pair

            var reversedDuplicateCheckQuery = new Parse.Query(ContactRequest);

            reversedDuplicateCheckQuery.equalTo("status", ContactRequestStatus.pending);
            reversedDuplicateCheckQuery.equalTo("fromUser", toUser);
            reversedDuplicateCheckQuery.equalTo("toUser", fromUser);

            // or together, check if the query returns any objects

            var orQuery = Parse.Query.or(duplicateCheckQuery, reversedDuplicateCheckQuery);

            orQuery.first(
            {
                useMasterKey: true,
                success: function(result)
                {
                    if (result != undefined)
                    {
                        response.error("Contact request already exists");
                    }
                    else
                    {
                        var contactRequest = new ContactRequest();
                        contactRequest.setACL(new Parse.ACL(fromUser));
                        contactRequest.getACL().setReadAccess(toUser, true);
                        fromUser.getACL().setReadAccess(toUser, true);

                        fromUser.get("information").fetch({
                          useMasterKey: true,
                          success: function(information){
                            if (information){
                              var acl = information.getACL();
                              if (acl){
                                acl.setReadAccess(toUser, true);
                              }
                            }

                            contactRequest.set("toUser", toUser);
                            contactRequest.set("fromUser", fromUser);

                            contactRequest.set("status", ContactRequestStatus.pending);
                            contactRequest.set("isAccepted", false);

                            if (request.params.note && request.params.note.length > 0)
                                contactRequest.set("note", request.params.note);

                            Parse.Object.saveAll([contactRequest, information],
                            {
                                useMasterKey: true,
                                success: function(objs)
                                {
                                    var contactRequest = objs[0];
                                    var information = objs[1];
                                    toUser.increment("pendingContactRequests", 1);

                                    var toUserContactRequests = toUser.relation("contactRequests");
                                    var fromUserContactRequests = fromUser.relation("contactRequests");

                                    toUserContactRequests.add(contactRequest);
                                    fromUserContactRequests.add(contactRequest);

                                    Parse.Object.saveAll([toUser, fromUser],
                                    {
                                        useMasterKey: true,
                                        success: function(list)
                                        {
                                            // now that we're done, let's send an alert

                                            Parse.Cloud.run('sendAlert',
                                            {
                                                toUser: toUser.id,
                                                fromUser: fromUser.id,
                                                relatedObject: contactRequest.id,
                                                alertType: "CR_Received"
                                            },{
                                                useMasterKey: true,
                                                success: function(result) { response.success(); },
                                                error: function(error) { response.success(); }
                                            });
                                        },
                                        error: function(error)
                                        {
                                            response.error("Could not save users");
                                        }
                                    });
                                },
                                error: function(obj, e)
                                {
                                    response.error("Could not create new ContactRequest object");
                                }
                            });
                          }
                        });

                    }
                },
                error: function(error)
                {
                    response.error("Could not query duplicates");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query toUser!");
        }
    });
});


Parse.Cloud.define("sendContactReminder", function(request, response)
{
//    Parse.Cloud.useMasterKey();
    // send contact reminder to user
    // params:
    //      toUser - objectId of the User who's receiving the reminder

    var fromUser = request.user;

    var toUserQuery = new Parse.Query(Parse.User);

    toUserQuery.get(request.params.toUser,
    {
        useMasterKey: true,
        success: function(toUser)
        {
            // find the existing contact request

            var ContactRequest = Parse.Object.extend("ContactRequest");
            var contactRequestQuery = new Parse.Query(ContactRequest);

            contactRequestQuery.equalTo("status", ContactRequestStatus.pending);
            contactRequestQuery.equalTo("fromUser", fromUser);
            contactRequestQuery.equalTo("toUser", toUser);
            contactRequestQuery.first(
            {
                useMasterKey: true,
                success: function(result)
                {
                  if (result != undefined)
                  {
                      console.log('Found contact request.');
                      Parse.Cloud.run('sendAlert',
                      {
                          toUser: toUser.id,
                          fromUser: fromUser.id,
                          relatedObject: result.id,
                          alertType: "CR_Reminder"
                      },{
                          useMasterKey: true,
                          success: function(result) { response.success(); },
                          error: function(error) { response.success(); }
                      });
                  }
                  else
                  {
                    response.success();
                  }
                },
                error: function(error)
                {
                  console.log('Could not find contact request.');
                  response.success();
                }
            });
        },
        error: function(error)
        {
            response.error("Could not find user");
        }
    });
});



Parse.Cloud.define("acceptContactRequest", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // accept a pending contact request and notify fromUser

    // params:
    //      contactRequest - objectId of the contact request

    var query = new Parse.Query(Parse.Object.extend("ContactRequest"));

    query.include("toUser");
    query.include("fromUser");

    query.get(request.params.contactRequest,
    {
        useMasterKey: true,
        success: function(contactRequest)
        {
            var toUser = contactRequest.get("toUser");
            var fromUser = contactRequest.get("fromUser");

            // decrement pending requests tally

            toUser.increment("pendingContactRequests", -1);

            if (toUser.get("pendingContactRequests") < 0)
            {
                toUser.set("pendingContactRequests", 0);
                console.log("WARNING!! Tried to set pendingContactRequests below 0 on user " + toUser.id);
            }

            // accept the request

            contactRequest.set("status", ContactRequestStatus.accepted);
            contactRequest.set("isAccepted", true);

            // rip out request object from relations

            var toUserContactRequests = toUser.relation("contactRequests");
            var fromUserContactRequests = fromUser.relation("contactRequests");

            toUserContactRequests.remove(contactRequest);
            fromUserContactRequests.remove(contactRequest);

            // add each user to the other's contacts

            var toUserContacts = toUser.relation("contacts");
            var fromUserContacts = fromUser.relation("contacts");

            toUserContacts.add(fromUser);
            fromUserContacts.add(toUser);

            toUser.getACL().setReadAccess(fromUser, true);
            fromUser.getACL().setReadAccess(toUser, true);

            // save!

            Parse.Object.saveAll([contactRequest, toUser, fromUser],
            {
                useMasterKey: true,
                success: function(list)
                {
                    // now that we're done, let's send an alert

                    Parse.Cloud.run('sendAlert',
                    {
                        toUser: fromUser.id, // we want to send this to the person who sent the request
                        fromUser: toUser.id, // the person who received the request is making the alert
                        relatedObject: contactRequest.id,
                        alertType: "CR_Accepted"
                    },{
                        useMasterKey: true,
                        success: function(result) { response.success(); },
                        error: function(error) { response.success(); }
                    });
                },
                error: function(error)
                {
                    response.error("Could not save objects");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query contactRequest!");
        }
    });
});





Parse.Cloud.define("declineContactRequest", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // decline a pending contact request. don't notify fromUser.

    // params:
    //      contactRequest - objectId of the contact request


    var query = new Parse.Query(Parse.Object.extend("ContactRequest"));

    query.include("toUser");
    query.include("fromUser");

    query.get(request.params.contactRequest,
    {
        useMasterKey: true,
        success: function(contactRequest)
        {
            var toUser = contactRequest.get("toUser");
            var fromUser = contactRequest.get("fromUser");
            fromUser.getACL().setReadAccess(toUser, false);

            // decrement pending requests tally

            toUser.increment("pendingContactRequests", -1);

            if (toUser.get("pendingContactRequests") < 0)
            {
                toUser.set("pendingContactRequests", 0);
                console.log("WARNING!! Tried to set pendingContactRequests below 0 on user " + toUser.id);
            }

            // decline the request

            contactRequest.set("status", ContactRequestStatus.declined);

            // rip out request object from relations

            var toUserContactRequests = toUser.relation("contactRequests");
            var fromUserContactRequests = fromUser.relation("contactRequests");

            toUserContactRequests.remove(contactRequest);
            fromUserContactRequests.remove(contactRequest);

            // save!

            Parse.Object.saveAll([contactRequest, toUser, fromUser],
            {
                useMasterKey: true,
                success: function(list)
                {
                    response.success();
                },
                error: function(error)
                {
                    response.error("Could not save objects");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query contactRequest!");
        }
    });
});
