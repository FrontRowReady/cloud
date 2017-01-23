Parse.Cloud.beforeSave("ConditionReportResponse", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // beforeSave is used to check for when notifications should be sent out


    // set up new response
    if (request.object.id === undefined)
    {
        var Message = Parse.Object.extend("Message");
        var message = new Message();
        var acl = new Parse.ACL();
        acl.setReadAccess(request.object.get("recipient"), true);
        acl.setReadAccess(request.object.get("requester"), true);
        message.setACL(acl);
        message.set("isComment", true);
        message.set("isRootMessage", true);
        message.set("toUser", request.object.get("recipient"));
        message.set("fromUser", request.object.get("requester"));

        message.save(null,
        {
            useMasterKey: true,
            success: function(message)
            {
                request.object.set("rootComment", message);

                response.success();
            },
            error: function(error)
            {
                response.error("Could not create root message!");
            }
        });
    }
    else
    {
        // if old, check for changes and update request and send out notifications

        var o = request.object;

        if (o.dirty("status") || o.dirty("conditionReport"))
        {
            var parentRequest = o.get("parentRequest");

            parentRequest.fetch(
            {
                useMasterKey: true,
                success: function(parentRequest)
                {
                    var relation = parentRequest.relation("responses");
                    var query = relation.query();
                    query.find({
                      useMasterKey: true,
                      success: function(results) {
                        if (o.dirty("status"))
                        {
                          var id = o.get('id');
                          var highestStatus = "None";
                          for (var i = 0; i < results.length; i++){
                            var result = results[i];
                            if (result.get('id') === id)
                            {
                              result = o;
                            }

                            if (result.get("status") === "Red" && highestStatus !== "Green" && highestStatus !== "Yellow"){
                              highestStatus = "Red";
                            }
                            else if (result.get("status") === "Yellow" && highestStatus !== "Green")
                            {
                              highestStatus = "Yellow";
                            }
                            else if (result.get("status") === "Green")
                            {
                              highestStatus = "Green";
                            }
                          }
                          parentRequest.set("highestResponse", highestStatus);
                        }

                        if (o.dirty("conditionReport") && o.get("conditionReport") != undefined){
                            parentRequest.set("hasCrInProgress", true);
                        }

                        parentRequest.save(null,
                        {
                            useMasterKey: true,
                            success: function(parentRequest)
                            {
                                response.success();
                            },
                            error: function(error)
                            {
                                response.error("Could not save parentRequest");
                            }
                        });
                      },
                      error: function(error) {
                        response.error("Could not retrieve responses");
                      }
                    });
                },
                error: function(parentRequest, error)
                {
                    response.error("Could not get parentRequest");
                }
            });
        }
        else
        {
            response.success();
        }
    }
});

Parse.Cloud.define("CRR_updatePreliminaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          crResponseId - objectId of the crResponse
    //          crRequestId - objectId of the parent request

    var ConditionReportResponse = Parse.Object.extend("ConditionReportResponse");
    var ConditionReportRequest = Parse.Object.extend("ConditionReportRequest");

    var query = new Parse.Query(ConditionReportResponse);

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            var query = new Parse.Query(ConditionReportRequest);

            query.get(request.params.crRequestId, 
            {
                useMasterKey: true,
                success: function(crRequest)
                {
                    var currentDate = new Date();

                    crRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [crResponse, crRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert
                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: crRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: crResponse.id,
                                alertType: "CRR_PreliminaryReportUpdated"
                            },{
                                useMasterKey: true,
                                success: function(result) { response.success(); },
                                error:   function(error)  { response.success(); }
                            });
                        },
                        error: function(error)
                        {
                            response.error("Could not save objects");
                        }
                    })
                },
                error: function(error)
                {
                    response.error("Could not query ConditionReportRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query ConditionReportResponse");
        }
    });
});

Parse.Cloud.define("CRR_sendPreliminaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          crResponseId - objectId of the crResponse
    //          crRequestId - objectId of the parent request

    var ConditionReportResponse = Parse.Object.extend("ConditionReportResponse");
    var ConditionReportRequest = Parse.Object.extend("ConditionReportRequest");

    var query = new Parse.Query(ConditionReportResponse);

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            var query = new Parse.Query(ConditionReportRequest);

            query.get(request.params.crRequestId, 
            {
                useMasterKey: true,
                success: function(crRequest)
                {
                    var currentDate = new Date();

                    crResponse.set("prCompleted", true);
                    crResponse.set("datePrSent", currentDate);
                    crRequest.set("hasPrCompleted", true);

                    crRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [crResponse, crRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: crRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: crResponse.id,
                                alertType: "CRR_PreliminaryReportSent"
                            },{
                                useMasterKey: true,
                                success: function(result) { response.success(); },
                                error:   function(error)  { response.success(); }
                            });
                        },
                        error: function(error)
                        {
                            response.error("Could not save objects");
                        }
                    })
                },
                error: function(error)
                {
                    response.error("Could not query ConditionReportRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query ConditionReportResponse");
        }
    });
});

Parse.Cloud.define("CRR_updateSecondaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          crResponseId - objectId of the crResponse
    //          crRequestId - objectId of the parent request

    var ConditionReportResponse = Parse.Object.extend("ConditionReportResponse");
    var ConditionReportRequest = Parse.Object.extend("ConditionReportRequest");

    var query = new Parse.Query(ConditionReportResponse);

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            var query = new Parse.Query(ConditionReportRequest);

            query.get(request.params.crRequestId, 
            {
                useMasterKey: true,
                success: function(crRequest)
                {
                    var currentDate = new Date();

                    crRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [crResponse, crRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: crRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: crResponse.id,
                                alertType: "CRR_SecondaryReportUpdated"
                            },{
                                useMasterKey: true,
                                success: function(result) { response.success(); },
                                error:   function(error)  { response.success(); }
                            });
                        },
                        error: function(error)
                        {
                            response.error("Could not save objects");
                        }
                    })
                },
                error: function(error)
                {
                    response.error("Could not query ConditionReportRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query ConditionReportResponse");
        }
    });
});



Parse.Cloud.define("CRR_sendSecondaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          crResponseId - objectId of the crResponse
    //          crRequestId - objectId of the parent request

    var ConditionReportResponse = Parse.Object.extend("ConditionReportResponse");
    var ConditionReportRequest = Parse.Object.extend("ConditionReportRequest");

    var query = new Parse.Query(ConditionReportResponse);

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            var query = new Parse.Query(ConditionReportRequest);

            query.get(request.params.crRequestId, 
            {
                useMasterKey: true,
                success: function(crRequest)
                {
                    var currentDate = new Date();

                    crResponse.set("srCompleted", true);
                    crResponse.set("dateSrSent", currentDate);
                    crRequest.set("hasSrCompleted", true);

                    crRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [crResponse, crRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: crRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: crResponse.id,
                                alertType: "CRR_SecondaryReportSent"
                            },{
                                useMasterKey: true,
                                success: function(result) { response.success(); },
                                error:   function(error)  { response.success(); }
                            });
                        },
                        error: function(error)
                        {
                            response.error("Could not save objects");
                        }
                    })
                },
                error: function(error)
                {
                    response.error("Could not query ConditionReportRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query ConditionReportResponse");
        }
    });
});

Parse.Cloud.define("CRR_updateConditionReport", function(request, response) {
//    Parse.Cloud.useMasterKey();

    // Sends an alert that tells the owner of the CRR that someone updated it.

    // params:
    //          crResponseId - objectId of the conditionReportResponse
    //          crRequestId - objectId of the parent request

    var CRResponse = Parse.Object.extend("ConditionReportResponse");
    var CRRequest = Parse.Object.extend("ConditionReportRequest");

    var query = new Parse.Query(CRResponse);

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            var query = new Parse.Query(CRRequest);

            query.get(request.params.crRequestId, 
            {
                useMasterKey: true,
                success: function(crRequest)
                {
                    var currentDate = new Date();

                    crRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [crRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: crRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: crResponse.id,
                                alertType: "CRR_Updated"
                            },{
                                useMasterKey: true,
                                success: function(result) { response.success(); },
                                error:   function(error)  { response.success(); }
                            });
                        },
                        error: function(error)
                        {
                            response.error("Could not save objects");
                        }
                    })
                },
                error: function(error)
                {
                    response.error("Could not query ConditionReportRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query ConditionReportResponse");
        }
    });
});

Parse.Cloud.define("CRR_sendConditionReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          crResponseId - objectId of the conditionReportResponse
    //          crRequestId - objectId of the parent request

    var CRResponse = Parse.Object.extend("ConditionReportResponse");
    var CRRequest = Parse.Object.extend("ConditionReportRequest");

    var query = new Parse.Query(CRResponse);

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            var query = new Parse.Query(CRRequest);

            query.get(request.params.crRequestId, 
            {
                useMasterKey: true,
                success: function(crRequest)
                {
                    var currentDate = new Date();

                    crResponse.set("crCompleted", true);
                    crResponse.set("dateCrSent", currentDate);
                    crRequest.set("hasCrCompleted", true);

                    crRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [crResponse, crRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: crRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: crResponse.id,
                                alertType: "CRR_ConditionReportSent"
                            },{
                                useMasterKey: true,
                                success: function(result) { response.success(); },
                                error:   function(error)  { response.success(); }
                            });
                        },
                        error: function(error)
                        {
                            response.error("Could not save objects");
                        }
                    })
                },
                error: function(error)
                {
                    response.error("Could not query ConditionReportRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query ConditionReportResponse");
        }
    });
});



Parse.Cloud.define("CRR_requestToCompleteTransaction", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // the buyer has requested to complete the transaction. a notification will
    // be sent to the seller and they will finish the transaction

    // params:
    //          crResponseId - objectId of the conditionReportResponse

    var CRResponse = Parse.Object.extend("ConditionReportResponse");
    var query = new Parse.Query(CRResponse);

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            crResponse.set("transactionRequested", true);

            crResponse.save(null,
            {
                useMasterKey: true,
                success: function(object)
                {
                    // send alert

                    Parse.Cloud.run('sendAlert',
                    {
                        toUser: crResponse.get("recipient").id,
                        fromUser: request.user.id,
                        relatedObject: crResponse.id,
                        alertType: "CRR_RequestToCompleteTransaction"
                    },{
                        useMasterKey: true,
                        success: function(result) { response.success(); },
                        error:   function(error)  { response.success(); }
                    });
                },
                error: function(error)
                {
                    response.error("Couldn't save ConditionReportResponse");
                }
            });
        },
        error: function(error)
        {
            response.error("Couldn't get ConditionReportResponse");
        }
    });
});


Parse.Cloud.define("CRR_completeTransaction", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // the seller wants to confirm completion of the transaction. this will flag all other
    // condition report responses in the request as expired and the current as completed

    // params:
    //          crResponseId - objectId of the conditionReportResponse

    var CRResponse = Parse.Object.extend("ConditionReportResponse");
    var CRRequest = Parse.Object.extend("ConditionReportRequest");

    var query = new Parse.Query(CRResponse);
    query.include("parentRequest");
    query.include("parentRequest.owner");

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(crResponse)
        {
            var crRequest = crResponse.get("parentRequest");

            var responseRelation = crRequest.relation("responses");
            var responseQuery = responseRelation.query();

            responseQuery.find(
            {
                useMasterKey: true,
                success: function(responses)
                {
                    // set flags on all (and eventually notifications?)

                    for (var i = 0; i < responses.length; i++)
                    {
                        if (responses[i].id === crResponse.id)
                        {
                            responses[i].set("transactionCompleted", true);
                            crRequest.set("winningResponse", responses[i]);
                        }
                        responses[i].set("isActive", false);
                    }

                    crRequest.set("transactionCompleted", true);
                    crRequest.set("isActive", false);

                    var objectsToSave = responses;
                    objectsToSave[objectsToSave.length] = crRequest;

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            var Transaction = Parse.Object.extend("Transaction");
                            var transaction = new Transaction();
                            transaction.setACL(new Parse.ACL(request.user));
                            transaction.getACL().setReadAccess(crRequest.get("owner"), true);
                            transaction.set("buyer", crRequest.get("owner"));
                            transaction.set("seller", request.user);

                            transaction.set("conditionReportRequest", crRequest);
                            transaction.set("conditionReportResponse", crResponse);

                            transaction.save(null, 
                            {
                                useMasterKey: true,
                                success: function(transaction)
                                {
                                    Parse.Cloud.run('sendAlert',
                                    {
                                        toUser: crRequest.get("owner").id,
                                        fromUser: request.user.id,
                                        relatedObject: transaction.id,
                                        alertType: "CRR_TransactionCompleted"
                                    },{
                                        useMasterKey: true,
                                        success: function(result) { response.success(); },
                                        error:   function(error)  { response.success(); }
                                    });
                                },
                                error: function(error)
                                {
                                    response.error("Could not create Transaction");
                                }
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
                    response.error("Couldn't query responses relation");
                }
            });
        },
        error: function(error)
        {
            response.error("Couldn't get ConditionReportResponse");
        }
    });
});


Parse.Cloud.define("CRR_feeChanged", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // cloud function to send an alert when the status changes

    // params:
    //          crResponseId - objectId of the conditionReportResponse
    //          fromStatus - The amount the fee is currently offered for
    //          toStatus - The amount the fee that the sender wants
    //          toUser - The person who sent the request

    Parse.Cloud.run('sendAlert',
    {
        toUser: request.params.toUser,
        fromUser: request.user.id,
        relatedObject: request.params.crResponseId,
        alertType: "CRR_FeeChanged",
        fromStatus: request.params.fromStatus,
        toStatus: request.params.toStatus,
    },{
        useMasterKey: true,
        success: function(result) { response.success(); },
        error:   function(error)  { response.error(); }
    })

});


Parse.Cloud.define("CRR_trafficLightStatusChanged", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // cloud function to send an alert when the status changes

    // params:
    //          crResponseId - objectId of the conditionReportResponse
    //          fromStatus -
    //          toStatus -
    //          toUser -


    if (   (request.params.fromStatus === "Green"  && request.params.toStatus === "Yellow")
        || (request.params.fromStatus === "Green"  && request.params.toStatus === "Red"   )
        || (request.params.fromStatus === "Yellow" && request.params.toStatus === "Green" )
        || (request.params.fromStatus === "Yellow" && request.params.toStatus === "Red"   ) )
    {
        Parse.Cloud.run('sendAlert',
        {
            toUser: request.params.toUser,
            fromUser: request.user.id,
            relatedObject: request.params.crResponseId,
            alertType: "CRR_TrafficLightStatusChanged",
            fromStatus: statusConverter(request.params.fromStatus),
            toStatus: statusConverter(request.params.toStatus),
        },{
            useMasterKey: true,
            success: function(result) { response.success(); },
            error:   function(error)  { response.error(); }
        });
    }
    else
    {
        Parse.Cloud.run('sendAlert',
        {
            toUser: request.params.toUser,
            fromUser: request.user.id,
            relatedObject: request.params.crResponseId,
            alertType: "CRR_FirstResponseStatus",
            fromStatus: statusConverter(request.params.fromStatus),
            toStatus: statusConverter(request.params.toStatus),
        },{
            useMasterKey: true,
            success: function(result) { response.success(); },
            error:   function(error)  { response.error(); }
        });

    }
});


function statusConverter(status)
{
    if (status === "Green")
        return "is able to";
    else if (status === "Yellow")
        return "may be able to";
    else if (status === "Red")
        return "cannot";
    else
        return "";
}


Parse.Cloud.define("CRR_selectFinalResponder", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // cloud function to select the final responder for a CR Request who will be the one to go
    // out and complete the Condition Report.

    // Enables the user who's selected as the final, and closes the request for all of the others.

    // params:
    //          crResponseId - objectId of the crResponse to select

    var ConditionReportResponse = Parse.Object.extend("ConditionReportResponse");
    
    var query = new Parse.Query(ConditionReportResponse);
    query.include("parentRequest");
    query.include("parentRequest.owner");

    query.get(request.params.crResponseId,
    {
        useMasterKey: true,
        success: function(selectedCrResponse)
        {
            var crRequest = selectedCrResponse.get("parentRequest");

            var responsesQuery = crRequest.relation("responses").query();
            responsesQuery.include("recipient");
            responsesQuery.notEqualTo("objectId", selectedCrResponse.id);

            responsesQuery.find(
            {
                useMasterKey: true,
                success: function(responses)
                {
                    selectedCrResponse.set("wasSelected", true);
                    crRequest.set("selectedResponse", selectedCrResponse);

                    var objectsToSave = new Array();

                    for (var i = 0; i < responses.length; i++)
                    {
                        responses[i].set("isActive", false);
                        objectsToSave[i] = responses[i];
                    }

                    objectsToSave[objectsToSave.length] = selectedCrResponse;
                    objectsToSave[objectsToSave.length] = crRequest;

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: selectedCrResponse.get("recipient").id,
                                fromUser: crRequest.get("owner").id,
                                relatedObject: selectedCrResponse.id,
                                alertType: "CRR_Selected"
                            },{
                                useMasterKey: true,
                                success: function(result)
                                {
                                    if (responses.length > 0)
                                    {
                                        var toUserIds = [];
                                        var responseIds = [];

                                        for (var i = 0; i < responses.length; i++)
                                        {
                                            responseIds[i] = responses[i].id;
                                        }

                                        for (var i = 0; i < responses.length; i++)
                                            toUserIds[i] = responses[i].get("recipient").id;

                                        Parse.Cloud.run('sendBatchAlerts',
                                        {
                                            toUsers: toUserIds,
                                            fromUser: request.user.id,
                                            relatedObjects: responseIds,
                                            alertType: "CRR_Closed"
                                        },{
                                            useMasterKey: true,
                                            success: function(result) { response.success(); },
                                            error: function(error)    { response.success(); }
                                        });
                                    }
                                    else
                                        response.success();
                                },
                                error: function(error)  { response.error("Couldn't sent CRR_Selected alert!"); }
                            });
                        },
                        error: function(error) { response.error("Could not save all"); }
                    });
                },
                error: function(error) { response.error("Could not query crResponses"); }
            });
        },
        error: function(error) { response.error("Could not query crResponse and crRequest"); }
    });
});

