var _ = require('underscore');

Parse.Cloud.define("sendMessage", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // send a message to a user, either as a reply to another message or as the first 'root' message.


    // NOTE: DOES NOT SEND PUSHES OR CREATE NOTIFICATIONS !!!!!!!!!!!


    // params:


    //      Required for root message: (first message in a thread of messages)

    //          toUser - objectId of the User who's recieving the message
    //          subject - the subject of the message (only applies to root messages)
    //          body - the body of the message


    //      Required for reply messages: (messages after the root in same thread)

    //          toUser = objectId of the User who's recieving the message
    //          rootMessageId - objectId of the root message to which the message is a reply.
    //          body - the body of the message
    //          IRid - objectId for an associated Inventory Response
    //          CRRid - objectId for an associated Condition Report Response



    var fromUser = request.user;
    var Message = Parse.Object.extend("Message");

    // query the toUser
    var toUserQuery = new Parse.Query(Parse.User);

    toUserQuery.get(request.params.toUser,
    {
        useMasterKey: true,
        success: function(toUser)
        {
            // no root, making this message the root

            if (request.params.rootMessageId == undefined)
            {
                // create root message

                var rootMessage = new Message();
                var acl = new Parse.ACL();
                acl.setReadAccess(fromUser, true);
                acl.setReadAccess(toUser, true);
                rootMessage.setACL(acl);
                rootMessage.set("isRootMessage", true);
                rootMessage.set("fromUser", fromUser);
                rootMessage.set("toUser", toUser);
                rootMessage.set("subject", request.params.subject);

                rootMessage.save(null,
                {
                    useMasterKey: true,
                    success: function(rootMessage)
                    {
                        // create first message in thread

                        var firstMessage = new Message();
                        var acl = new Parse.ACL();
                        acl.setReadAccess(fromUser, true);
                        acl.setReadAccess(toUser, true);
                        firstMessage.setACL(acl);

                        firstMessage.set("rootMessage", rootMessage);
                        firstMessage.set("fromUser", fromUser);
                        firstMessage.set("toUser", toUser);
                        firstMessage.set("body", request.params.body);

                        firstMessage.save(null,
                        {
                            useMasterKey: true,
                            success: function(firstMessage)
                            {
                                // add messages to relations

                                fromUser.relation("messages").add(rootMessage);
                                toUser.relation("messages").add(rootMessage);
                                rootMessage.relation("messages").add(firstMessage);

                                Parse.Object.saveAll([fromUser, toUser, rootMessage],
                                {
                                    useMasterKey: true,
                                    success: function(list)
                                    {
                                        // at this point we may want to send pushes and notifications

                                        response.success("Successfully created root message");
                                    },

                                    error: function(error) { response.error("Could not save objects"); }
                                });
                            },
                            error: function(error) { response.error("Could not create first message"); }
                        });
                    },
                    error: function(error) { response.error("Could not create root message"); }
                });
            }

            // this message is a reply to a rooted thread

            else
            {
                // get root message

                var rootMessageQuery = new Parse.Query(Message);

                rootMessageQuery.get(request.params.rootMessageId,
                {
                    useMasterKey: true,
                    success: function(rootMessage)
                    {
                        // create new message

                        var newMessage = new Message();
                        var acl = new Parse.ACL();
                        acl.setReadAccess(fromUser, true);
                        acl.setReadAccess(toUser, true);
                        newMessage.setACL(acl);

                        newMessage.set("fromUser", fromUser);
                        newMessage.set("toUser", toUser);
                        newMessage.set("rootMessage", rootMessage);
                        newMessage.set("body", request.params.body);
                        newMessage.set("isComment", rootMessage.get("isComment"));
                    
                        newMessage.save(null,
                        {
                            useMasterKey: true,
                            success: function(newMessage)
                            {
                                // add to relations

                                rootMessage.relation("messages").add(newMessage);

                                rootMessage.save(null,
                                {
                                    useMasterKey: true,
                                    success: function(rootMessage)
                                    {
                                        if (request.params.IRid || request.params.CRRid)
                                        {
                                            var alertType;
                                            var relatedObjectId;

                                            if (request.params.IRid)
                                            {
                                                alertType = "IR_CommentReceived";
                                                relatedObjectId = request.params.IRid;
                                            }
                                            else if (request.params.CRRid)
                                            {
                                                alertType = "CRR_CommentReceived";
                                                relatedObjectId = request.params.CRRid;
                                            }

                                            // sending alert
                                            Parse.Cloud.run('sendAlert',
                                            {
                                                toUser: toUser.id,
                                                fromUser: fromUser.id,
                                                relatedObject: relatedObjectId,
                                                alertType: alertType
                                            },{
                                                useMasterKey: true,
                                                success: function(result) { response.success("Successfully created message"); },
                                                error:   function(error)  { response.success("Successfully created message"); }
                                            });
                                        }
                                        else
                                        {
                                            response.success("Successfully created message");
                                        }
                                    },
                                    error: function(error) { response.error("Could not save root message"); }
                                });
                            },
                            error: function(error) { response.error("Could not create new message"); }
                        });
                    },
                    error: function(error) { response.error("Could not query root message"); }
                });
            }
        },
        error: function(error) { response.error("Could not query toUser"); }
    });
});

// params:


//      Required for root message: (first message in a thread of messages)

//          toUser - objectId of the User who's recieving the message
//          subject - the subject of the message (only applies to root messages)
//          body - the body of the message


//      Required for reply messages: (messages after the root in same thread)

//          toUsers = objectId of the User who's recieving the message
//          rootMessageIds - objectId of the root message to which the message is a reply.
//          body - the body of the message
//          IRids - objectId for an associated Inventory Response
//          CRRids - objectId for an associated Condition Report Response
Parse.Cloud.define("sendMessageToAll", function(request, response)
{
//  Parse.Cloud.useMasterKey();

  var toUsers = request.params.toUsers;
  var rootMessageIds = request.params.rootMessageIds;
  var body = request.params.body;
  var IRids = request.params.IRids;
  var CRRids = request.params.CRRids;

  var fromUser = request.user;
  var successCount = 0;

  var Message = Parse.Object.extend("Message");

  var promise = Parse.Promise.as();

  _.each(rootMessageIds, function(rootMessageId, i){
    promise = promise.then(function(){
      // get root message
      var rootMessageQuery = new Parse.Query(Message);

      return rootMessageQuery.get(rootMessageId, { useMasterKey: true } ).then(function(rootMessage){
        var toUserQuery = new Parse.Query(Parse.User);
        return Parse.Promise.when(toUserQuery.get(toUsers[i], { useMasterKey: true }), Parse.Promise.as(rootMessage));
      })
      .then(function(toUser, rootMessage){
        // create new message
        var newMessage = new Message();
        var acl = new Parse.ACL();
        acl.setReadAccess(fromUser, true);
        acl.setReadAccess(toUser, true);
        newMessage.setACL(acl);

        newMessage.set("fromUser", fromUser);
        newMessage.set("toUser", toUser);
        newMessage.set("rootMessage", rootMessage);
        newMessage.set("body", body);
        newMessage.set("isComment", rootMessage.get("isComment"));

        return Parse.Promise.when(Parse.Promise.as(rootMessage), newMessage.save(null, { useMasterKey: true }), Parse.Promise.as(toUser));
      }).then(function(rootMessage, newMessage, toUser){
        // add to relations
        rootMessage.relation("messages").add(newMessage);
        return Parse.Promise.when(rootMessage.save(null, { useMasterKey: true }), Parse.Promise.as(toUser));
      }).then(function(rootMessage, toUser){
        if (IRids || CRRids)
        {
            var alertType;
            var relatedObjectId;

            if (IRids)
            {
                alertType = "IR_CommentReceived";
                relatedObjectId = IRids[i];
            }
            else if (CRRids)
            {
                alertType = "CRR_CommentReceived";
                relatedObjectId = CRRids[i];
            }

            // sending alert
            return Parse.Cloud.run('sendAlert',
            {
                toUser: toUser.id,
                fromUser: fromUser.id,
                relatedObject: relatedObjectId,
                alertType: alertType
            });
        }
        else
        {
          return Parse.Promise.as();
        }
      });
    });
  });

  return promise.then(function(){
    response.success("Successfully created messages");
  }, function(error) {
    response.error(error);
  });
});


Parse.Cloud.define("sendGroupMessage", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // send a message to a user, either as a reply to another message or as the first 'root' message.


    // NOTE: DOES NOT SEND PUSHES OR CREATE NOTIFICATIONS !!!!!!!!!!!


    // params:


    //      Required for root message: (first message in a thread of messages)

    //          toUsers - array of objectIds of the Users who are recieving the message
    //          subject - the subject of the message (only applies to root messages)
    //          body - the body of the message

    //      Required for reply messages: (messages after the root in same thread)

    //          toUser = objectId of the User who's recieving the message
    //          rootMessageId - objectId of the root message to which the message is a reply.
    //          body - the body of the message

    var fromUser = request.user;
    var Message = Parse.Object.extend("Message");
    var userArray = request.params.toUsers;

    // query the toUser
    for (var i = userArray.length - 1; i >= 0; i--) 
    {
        var toUserQuery = new Parse.Query(Parse.User);

        toUserQuery.get(userArray[i],
        {
            useMasterKey: true,
            success: function(toUser)
            {
                // no root, making this message the root

                if (request.params.rootMessageId == undefined)
                {
                    // create root message

                    var rootMessage = new Message();
                    var acl = new Parse.ACL();
                    acl.setReadAccess(fromUser, true);
                    acl.setReadAccess(toUser, true);
                    rootMessage.setACL(acl);

                    rootMessage.set("isRootMessage", true);
                    rootMessage.set("fromUser", fromUser);
                    rootMessage.set("toUser", toUser);
                    rootMessage.set("subject", request.params.subject);

                    rootMessage.save(null,
                    {
                        useMasterKey: true,
                        success: function(rootMessage)
                        {
                            // create first message in thread

                            var firstMessage = new Message();
                            var acl = new Parse.ACL();
                            acl.setReadAccess(fromUser, true);
                            acl.setReadAccess(toUser, true);
                            firstMessage.setACL(acl);

                            firstMessage.set("rootMessage", rootMessage);
                            firstMessage.set("fromUser", fromUser);
                            firstMessage.set("toUser", toUser);
                            firstMessage.set("body", request.params.body);

                            firstMessage.save(null,
                            {
                                useMasterKey: true,
                                success: function(firstMessage)
                                {
                                    // add messages to relations

                                    fromUser.relation("messages").add(rootMessage);
                                    toUser.relation("messages").add(rootMessage);
                                    rootMessage.relation("messages").add(firstMessage);

                                    Parse.Object.saveAll([fromUser, toUser, rootMessage],
                                    {
                                        useMasterKey: true,
                                        success: function(list)
                                        {
                                            // at this point we may want to send pushes and notifications

                                            response.success("Successfully created root message");
                                        },

                                        error: function(error) { response.error("Could not save objects"); }
                                    });
                                },
                                error: function(error) { response.error("Could not create first message"); }
                            });
                        },
                        error: function(error) { response.error("Could not create root message"); }
                    });
                }

                // this message is a reply to a rooted thread

                else
                {
                    // get root message

                    var rootMessageQuery = new Parse.Query(Message);

                    rootMessageQuery.get(request.params.rootMessageId,
                    {
                        useMasterKey: true,
                        success: function(rootMessage)
                        {
                            // create new message

                            var newMessage = new Message();
                            var acl = new Parse.ACL();
                            acl.setReadAccess(fromUser, true);
                            acl.setReadAccess(toUser, true);
                            newMessage.setACL(acl);

                            newMessage.set("fromUser", fromUser);
                            newMessage.set("toUser", toUser);
                            newMessage.set("rootMessage", rootMessage);
                            newMessage.set("body", request.params.body);
                            newMessage.set("isComment", rootMessage.get("isComment"));
                        
                            newMessage.save(null,
                            {
                                useMasterKey: true,
                                success: function(newMessage)
                                {
                                    // add to relations

                                    rootMessage.relation("messages").add(newMessage);

                                    rootMessage.save(null,
                                    {
                                        useMasterKey: true,
                                        success: function(rootMessage)
                                        {
                                            response.success("Successfully created message");
                                        },
                                        error: function(error) { response.error("Could not save root message"); }
                                    });
                                },
                                error: function(error) { response.error("Could not create new message"); }
                            });
                        },
                        error: function(error) { response.error("Could not query root message"); }
                    });
                }
            },
            error: function(error) { response.error("Could not query toUser"); }
        });
    }
});
