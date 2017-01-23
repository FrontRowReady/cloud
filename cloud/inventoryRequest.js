// "traffic light" statuses:

var TrafficLightResponse = {
    none : "None",
    red : "Red",
    yellow : "Yellow",
    green : "Green"
}

Parse.Cloud.beforeSave("InventoryRequest", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    console.log("Saving InventoryRequest");

    if (request.object.id === undefined)
    {
        var currentDate = new Date();
        request.object.set("lastReportSent", currentDate);
        response.success();
    }
    else {

        var relation = request.object.relation("responses");
        var query = relation.query();

        query.find({
            useMasterKey: true,
            success: function(results) {

            var mostCompletedResponse = results[0];

            for (var i = 1; i < results.length; i++) {
                if (results[i].get("completionValue") != undefined) {
                    if (mostCompletedResponse.get("completionValue") < results[i].get("completionValue") || mostCompletedResponse.get("completionValue") == undefined) {
                        mostCompletedResponse = results[i];
                   }
                }
            }

            request.object.set("mostCompleteResponse", mostCompletedResponse);

            response.success();

            },
            error: function(results)
            {
                response.error("Could not get relations for parentRequest");
            }
        });
    }
});



Parse.Cloud.define("createInventoryResponses", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // creates an InventoryResponse for each recipient in an InventoryRequest and draws the relations between them.


    // important!

    // this function should be called after the initial creation of the InventoryRequest object. after this function is
    // completed, the client should re-fetch the inventoryRequest object to allow the client to access its responses.


    // this kind of operation needs to be here because you can't edit Parse Users from the client without their login information
    // (apparently adding them as a pointer on another object is bad?) and it won't work in the beforeSave because of some
    // relational sorcery


    // params:
    //      inventoryRequestId - objectId of the InventoryRequest object to create responses for





    // retrieve the inventoryRequest to create responses for

    var InventoryRequest = Parse.Object.extend("InventoryRequest");
    var query = new Parse.Query(InventoryRequest);

    query.get(request.params.inventoryRequestId,
    {
        useMasterKey: true,
        success: function(inventoryRequest)
        {
            // get the list of recipients

            var recipientsRelation = inventoryRequest.relation("recipients");

            recipientsRelation.query().find(
            {
                useMasterKey: true,
                success: function(recipients)
                {

                    if (recipients.length == 0)
                    {
                        response.error("InventoryRequest object needs to have at least one recipient!");
                    }
                    else
                    {
                        // create InventoryResponse objects

                        var InventoryResponse = Parse.Object.extend("InventoryResponse");

                        var inventoryResponses = new Array();

                        for (var i = 0; i < recipients.length; i++)
                        {
                            var inventoryResponse = new InventoryResponse();
                            inventoryResponse.setACL(new Parse.ACL(request.user));
                            inventoryResponse.getACL().setReadAccess(recipients[i], true);
                            inventoryResponse.getACL().setWriteAccess(recipients[i], true);
                            inventoryResponse.set("requester", request.user);
                            inventoryResponse.set("recipient", recipients[i]);
                            inventoryResponse.set("parentRequest", inventoryRequest);
                            inventoryResponse.set("status", TrafficLightResponse.none);
                            inventoryResponse.set("isActive", true);
                            inventoryRequest.getACL().setReadAccess(recipients[i], true);

                            inventoryResponses[i] = inventoryResponse;
                        }

                        Parse.Object.saveAll(inventoryResponses,
                        {
                            useMasterKey: true,
                            success: function(inventoryResponses)
                            {
                                // add newly created InventoryResponses to User and InventoryRequest relations

                                for (var r = 0; r < recipients.length; r++)
                                {
                                    for (var i = 0; i < inventoryResponses.length; i++)
                                    {
                                        var id1 = recipients[r].id;
                                        var id2 = inventoryResponses[i].get("recipient").id;

                                        if (id1 === id2)
                                            recipients[r].relation("inventoryResponses").add(inventoryResponses[i]);
                                    }
                                }


                                for (var i = 0; i < inventoryResponses.length; i++)
                                    inventoryRequest.relation("responses").add(inventoryResponses[i]);
                                inventoryRequest.set("isActive", true);


                                var objectsToSave = recipients;
                                objectsToSave[objectsToSave.length] = inventoryRequest;

                                Parse.Object.saveAll(objectsToSave,
                                {
                                    useMasterKey: true,
                                    success: function(savedObjects)
                                    {
                                        // now that we're done, send out alerts.

                                        var toUserIds = [];
                                        var responseIds = [];

                                        for (var i = 0; i < inventoryResponses.length; i++)
                                        {
                                            toUserIds[i] = inventoryResponses[i].get("recipient").id;
                                            responseIds[i] = inventoryResponses[i].id;
                                        }

                                        Parse.Cloud.run('sendBatchAlerts',
                                        {
                                            toUsers: toUserIds,
                                            fromUser: request.user.id,
                                            relatedObjects: responseIds,
                                            alertType: "IR_Received"
                                        },{
                                            useMasterKey: true,
                                            success: function(result) { response.success(); },
                                            error: function(error)    { response.success(); }
                                        });
                                    },
                                    error: function(error)
                                    {
                                        response.error("Could not save all");
                                    }
                                });
                            },
                            error: function(error)
                            {
                                response.error("Could not create InventoryResponses" + error.description);
                            }
                        });
                    }
                },
                error: function(argument)
                {
                    response.error("Could not query recipients");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query inventoryRequest");
        }
    });
});



Parse.Cloud.define("addInventoryResponse", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // adds a recipient to an InventoryRequest and create the appropriate InventoryResponse and Relation


    // important!

    // this function should be called after the initial creation of the InventoryRequest object. after this function is
    // completed, the client should re-fetch the inventoryRequest object to allow the client to access its responses.


    // this kind of operation needs to be here because you can't edit Parse Users from the client without their login information
    // (apparently adding them as a pointer on another object is bad?) and it won't work in the beforeSave because of some
    // relational sorcery


    // params:
    //      inventoryRequestId - objectId of the InventoryRequest object
    //      recipientId - objectId of the recipient



    // get the request object

    var InventoryRequest = Parse.Object.extend("InventoryRequest");
    var query = new Parse.Query(InventoryRequest);

    query.get(request.params.inventoryRequestId,
    {
        useMasterKey: true,
        success: function(inventoryRequest)
        {
            // get the recipient

            var query = new Parse.Query(Parse.User);

            query.get(request.params.recipientId,
            {
                useMasterKey: true,
                success: function(recipient)
                {
                    // create InventoryResponse objects

                    var InventoryResponse = Parse.Object.extend("InventoryResponse");
                    var inventoryResponse = new InventoryResponse();
                    inventoryResponse.setACL(new Parse.ACL(request.user));
                    inventoryResponse.getACL().setReadAccess(recipient, true);
                    inventoryResponse.getACL().setWriteAccess(recipient, true);
                    inventoryResponse.set("requester", request.user);
                    inventoryResponse.set("recipient", recipient);
                    inventoryResponse.set("parentRequest", inventoryRequest);
                    inventoryResponse.set("status", TrafficLightResponse.none);
                    inventoryResponse.set("isActive", true);

                    inventoryResponse.save(null,
                    {
                        useMasterKey: true,
                        success: function(inventoryResponse)
                        {
                            // add newly created InventoryResponse to User and InventoryRequest relation
                            recipient.relation("inventoryResponses").add(inventoryResponse);
                            inventoryRequest.getACL().setReadAccess(recipient, true);
                            inventoryRequest.relation("responses").add(inventoryResponse);

                            Parse.Object.saveAll([recipient, inventoryRequest],
                            {
                                useMasterKey: true,
                                success: function(savedObjects)
                                {
                                    // now that we're done, send out alert

                                    Parse.Cloud.run('sendAlert',
                                    {
                                        toUser: inventoryResponse.get("recipient").id,
                                        fromUser: request.user.id,
                                        relatedObject: inventoryResponse.id,
                                        alertType: "IR_Received"
                                    },{
                                        useMasterKey: true,
                                        success: function(result) { response.success(); },
                                        error: function(error)    { response.success(); }
                                    });
                                },
                                error: function(error) { response.error("Could not save all " + error.description); }
                            });
                        },
                        error: function(error) { response.error("Could not create InventoryResponse"); }
                    });
                },
                error: function(argument) { response.error("Could not query recipient"); }
            });
        },
        error: function(error) { response.error("Could not query inventoryRequest"); }
    });
});



Parse.Cloud.define("closeInventoryRequest", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // closes the request and ensures that all of the loose ends get tied up.

    // params:
    //      requestId - objectId of the request to close

    var InventoryRequest = Parse.Object.extend("InventoryRequest");
    var query = new Parse.Query(InventoryRequest);

    query.get(request.params.requestId,
    {
        useMasterKey: true,
        success: function(inventoryRequest)
        {
            // set as disabled

            inventoryRequest.set("wasDisabled", true);
            inventoryRequest.set("isActive", false);

            inventoryRequest.relation("responses").query().find(
            {
                useMasterKey: true,
                success: function(responses)
                {
                    for (var i = 0; i < responses.length; i++)
                    {
                        responses[i].set("wasDisabled", true);
                        responses[i].set("isActive", false);
                    }

                    var objectsToSave = responses;
                    objectsToSave.push(inventoryRequest);

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(objects)
                        {
                            // query all of the requests recipients to send Alert to

                            // ** don't care if it succeeds or not ** //

                            inventoryRequest.relation("recipients").query().find(
                            {
                                useMasterKey: true,
                                success: function(recipients)
                                {
                                    var toUserIds = [];
                                    var responseIds = [];

                                    for (var i = 0; i < responses.length; i++)
                                    {
                                        responseIds[i] = responses[i].id;
                                    }

                                    for (var i = 0; i < recipients.length; i++)
                                        toUserIds[i] = recipients[i].id;

                                    Parse.Cloud.run('sendBatchAlerts',
                                    {
                                        toUsers: toUserIds,
                                        fromUser: request.user.id,
                                        relatedObjects: responseIds,
                                        alertType: "IR_Closed"
                                    },{
                                        useMasterKey: true,
                                        success: function(result) { response.success("Sent alerts"); },
                                        error: function(error)    { response.success("Couldn't sent alerts"); }
                                    });
                                },
                                error: function(error) { response.success("Couldn't query recipeints!") }
                            });
                        },
                        error: function(error) { response.error("Couldn't save objects"); }
                    });
                },
                error: function(error) { response.error("Couldn't query responses"); }
            });
        },
        error: function(error) { response.error("Couldn't query InventoryRequest"); }
    });
});


