// "traffic light" statuses:

var TrafficLightResponse = {
    none : "None",
    red : "Red",
    yellow : "Yellow",
    green : "Green"
}



Parse.Cloud.beforeSave("ConditionReportRequest", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    if (request.object.id === undefined)
    {
        var currentDate = new Date();
        request.object.set("lastReportSent", currentDate);
        response.success();
    }
    else
        response.success();
});



Parse.Cloud.define("createCRResponses", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // creates an ConditionReportResponse for each recipient in an ConditionReportRequest and draws the relations between them.


    // important!

    // this function should be called after the initial creation of the ConditionReportRequest object. after this function is
    // completed, the client should re-fetch the conditionReportRequest object to allow the client to access its responses.


    // this kind of operation needs to be here because you can't edit Parse Users from the client without their login information
    // (apparently adding them as a pointer on another object is bad?) and it won't work in the beforeSave because of some
    // relational sorcery


    // params:
    //      crRequestId - objectId of the ConditionReportRequest object to create responses for





    // retrieve the crRequest to create responses for

    // var user = req.user;
    // var token = user.getSessionToken(); // get session token from req.user
    var CRRequest = Parse.Object.extend("ConditionReportRequest");
    var query = new Parse.Query(CRRequest);

    query.get(request.params.crRequestId,
    {
        useMasterKey: true,
        success: function(crRequest)
        {
            // get the list of recipients

            var recipientsRelation = crRequest.relation("recipients");

            recipientsRelation.query().find(
            {
                useMasterKey: true,
                success: function(recipients)
                {

                    if (recipients.length == 0)
                    {
                        response.error("ConditionReportRequest object needs to have at least one recipient!");
                    }
                    else
                    {
                        // create ConditionReportResponse objects

                        var CRResponse = Parse.Object.extend("ConditionReportResponse");

                        var crResponses = new Array();

                        for (var i = 0; i < recipients.length; i++)
                        {
                            var crResponse = new CRResponse();
                            crResponse.setACL(new Parse.ACL(request.user));
                            crResponse.getACL().setReadAccess(recipients[i], true);
                            crResponse.getACL().setWriteAccess(recipients[i], true);
                            crResponse.set("requester", request.user);
                            crResponse.set("recipient", recipients[i]);
                            crResponse.set("parentRequest", crRequest);
                            crResponse.set("status", TrafficLightResponse.none);
                            crResponse.set("isActive", true);
                            crResponse.set("fee", crRequest.get("fee"));
                            crResponse.set("wasSelected", false);
                            crRequest.getACL().setReadAccess(recipients[i], true);

                            crResponses[i] = crResponse;
                        }

                        Parse.Object.saveAll(crResponses,
                        {
                            useMasterKey: true,
                            success: function(crResponses)
                            {
                                // add newly created crResponses to User and crRequest relations

                                for (var r = 0; r < recipients.length; r++)
                                {
                                    for (var i = 0; i < crResponses.length; i++)
                                    {
                                        var id1 = recipients[r].id;
                                        var id2 = crResponses[i].get("recipient").id;

                                        if (id1 === id2)
                                            recipients[r].relation("crResponses").add(crResponses[i]);
                                    }
                                }


                                for (var i = 0; i < crResponses.length; i++)
                                    crRequest.relation("responses").add(crResponses[i]);
                                crRequest.set("isActive", true);


                                var objectsToSave = recipients;
                                objectsToSave[objectsToSave.length] = crRequest;

                                Parse.Object.saveAll(objectsToSave,
                                {
                                    useMasterKey: true,
                                    success: function(savedObjects)
                                    {
                                        // now that we're done, send out alerts.

                                        var toUserIds = [];
                                        var responseIds = [];

                                        for (var i = 0; i < crResponses.length; i++)
                                        {
                                            toUserIds[i] = crResponses[i].get("recipient").id;
                                            responseIds[i] = crResponses[i].id;
                                        }

                                        Parse.Cloud.run('sendBatchAlerts',
                                        {
                                            toUsers: toUserIds,
                                            fromUser: request.user.id,
                                            relatedObjects: responseIds,
                                            alertType: "CRR_Received"
                                        },{
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
                                response.error("Could not create CRResponses" + error.description);
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
            response.error("Could not query crRequest");
        }
    });
});



Parse.Cloud.define("addCRResponse", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // adds a recipient to an ConditionReportRequest and create the appropriate ConditionReportResponse and Relation


    // important!

    // this function should be called after the initial creation of the ConditionReportRequest object. after this function is
    // completed, the client should re-fetch the ConditionReportRequest object to allow the client to access its responses.


    // this kind of operation needs to be here because you can't edit Parse Users from the client without their login information
    // (apparently adding them as a pointer on another object is bad?) and it won't work in the beforeSave because of some
    // relational sorcery


    // params:
    //      crRequestId - objectId of the ConditionReportRequest object
    //      recipientId - objectId of the recipient



    // get the request object

    // var user = req.user;
    // var token = user.getSessionToken(); // get session token from req.user
    var CRRequest = Parse.Object.extend("ConditionReportRequest");
    var query = new Parse.Query(CRRequest);

    query.get(request.params.crRequestId,
    {
        useMasterKey: true,
        success: function(crRequest)
        {
            // get the recipient

            var query = new Parse.Query(Parse.User);

            query.get(request.params.recipientId,
            {
                useMasterKey: true,
                success: function(recipient)
                {
                    // create ConditionReportResponse objects

                    var CRResponse = Parse.Object.extend("ConditionReportResponse");

                    var crResponse = new CRResponse();
                    crResponse.setACL(new Parse.ACL(request.user));
                    crResponse.getACL().setReadAccess(recipient, true);
                    crResponse.getACL().setWriteAccess(recipient, true);
                    crResponse.set("requester", request.user);
                    crResponse.set("recipient", recipient);
                    crResponse.set("parentRequest", crRequest);
                    crResponse.set("status", TrafficLightResponse.none);
                    crResponse.set("isActive", true);
                    crResponse.set("wasSelected", false);
                    crResponse.set("fee", crRequest.get("fee"));

                    crResponse.save(null,
                    {
                        useMasterKey: true,
                        success: function(crResponse)
                        {
                            // add newly created ConditionReportResponse to User and ConditionReportRequest relation
                            recipient.relation("crResponses").add(crResponse);
                            crRequest.getACL().setReadAccess(recipient, true);
                            crRequest.relation("responses").add(crResponse);

                            Parse.Object.saveAll([recipient, crRequest],
                            {
                                useMasterKey: true,
                                success: function(savedObjects)
                                {
                                    // now that we're done, send out alert

                                    console.log("Sending Alert");

                                    Parse.Cloud.run('sendAlert',
                                    {
                                        toUser: crResponse.get("recipient").id,
                                        fromUser: request.user.id,
                                        relatedObject: crResponse.id,
                                        alertType: "CRR_Received"
                                    },{
                                        success: function(result) { response.success(); },
                                        error: function(error)    { response.success(); }
                                    });
                                },
                                error: function(error) { response.error("Could not save all"); }
                            });
                        },
                        error: function(error) { response.error("Could not create CRResponse"); }
                    });
                },
                error: function(argument) { response.error("Could not query recipient"); }
            });
        },
        error: function(error) { response.error("Could not query crRequest"); }
    });
});



Parse.Cloud.define("closeCRRequest", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // closes the request and ensures that all of the loose ends get tied up.

    // params:
    //      requestId - objectId of the request to close

    // var user = req.user;
    // var token = user.getSessionToken(); // get session token from req.user
    var CRRequest = Parse.Object.extend("ConditionReportRequest");
    var query = new Parse.Query(CRRequest);

    query.get(request.params.requestId,
    {
        useMasterKey: true,
        success: function(crRequest)
        {
            // set as disabled

            crRequest.set("wasDisabled", true);
            crRequest.set("isActive", false);

            crRequest.relation("responses").query().find(
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
                    objectsToSave.push(crRequest);

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(objects)
                        {
                            // query all of the requests recipients to send Alert to

                            // ** don't care if it succeeds or not ** //

                            crRequest.relation("recipients").query().find(
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
                                        alertType: "CRR_Closed"
                                    },{
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
        error: function(error) { response.error("Couldn't query CRRequest"); }
    });
});


