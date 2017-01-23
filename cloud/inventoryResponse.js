Parse.Cloud.beforeSave("InventoryResponse", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // beforeSave is used to check for when notifications should be sent out

    // preliminary response requested
    // secondary response requested


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

        if (o.dirty("status") || o.dirty("preliminaryVehicleResponse") || o.dirty("secondaryVehicleResponse")
            || o.dirty("conditionReport") || o.dirty("priceQuote"))
        {

            var completionValue = 0;

            if (o.get("prCompleted")) {
                completionValue += 2;
            }
            else if (o.get("preliminaryVehicleResponse") != undefined) {
                completionValue += 1;
            }
            
            if (o.get("srCompleted")) {
                completionValue += 2;
            }
            else if (o.get("secondaryVehicleResponse") != undefined) {
                completionValue += 1;
            }

            if (o.get("crCompleted")) {
                completionValue += 2;
            }
            else if (o.get("conditionReport") != undefined) {
                completionValue += 1;
            }

            o.set("completionValue", completionValue);

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

                        if (o.dirty("preliminaryVehicleResponse") && o.get("preliminaryVehicleResponse") != undefined)
                            parentRequest.set("hasPrInProgress", true);

                        if (o.dirty("secondaryVehicleResponse") && o.get("secondaryVehicleResponse") != undefined)
                            parentRequest.set("hasSrInProgress", true);

                        if (o.dirty("conditionReport") && o.get("conditionReport") != undefined)
                            parentRequest.set("hasCrInProgress", true);


                        if (o.dirty("priceQuote") && o.get("priceQuote") != undefined)
                            parentRequest.set("hasPriceQuote", true);

                            console.log("Saving InventoryRequest");

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
                    error: function(){
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

Parse.Cloud.define("updatePreliminaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse
    //          inventoryRequestId - objectId of the parent request

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var InventoryRequest = Parse.Object.extend("InventoryRequest");

    var query = new Parse.Query(InventoryResponse);

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            var query = new Parse.Query(InventoryRequest);

            query.get(request.params.inventoryRequestId, 
            {
                useMasterKey: true,
                success: function(inventoryRequest)
                {
                    var currentDate = new Date();

                    inventoryRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [inventoryResponse, inventoryRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: inventoryRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: inventoryResponse.id,
                                alertType: "IR_PreliminaryReportUpdated"
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
                    response.error("Could not query InventoryRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query InventoryResponse");
        }
    });
});

Parse.Cloud.define("sendPreliminaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse
    //          inventoryRequestId - objectId of the parent request

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var InventoryRequest = Parse.Object.extend("InventoryRequest");

    var query = new Parse.Query(InventoryResponse);

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            var query = new Parse.Query(InventoryRequest);

            query.get(request.params.inventoryRequestId, 
            {
                useMasterKey: true,
                success: function(inventoryRequest)
                {
                    var currentDate = new Date();

                    inventoryResponse.set("prCompleted", true);
                    inventoryResponse.set("datePrSent", currentDate);
                    inventoryRequest.set("hasPrCompleted", true);

                    inventoryRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [inventoryResponse, inventoryRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: inventoryRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: inventoryResponse.id,
                                alertType: "IR_PreliminaryReportSent"
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
                    response.error("Could not query InventoryRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query InventoryResponse");
        }
    });
});

Parse.Cloud.define("updateSecondaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse
    //          inventoryRequestId - objectId of the parent request

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var InventoryRequest = Parse.Object.extend("InventoryRequest");

    var query = new Parse.Query(InventoryResponse);

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            var query = new Parse.Query(InventoryRequest);

            query.get(request.params.inventoryRequestId, 
            {
                useMasterKey: true,
                success: function(inventoryRequest)
                {
                    var currentDate = new Date();

                    inventoryRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [inventoryResponse, inventoryRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: inventoryRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: inventoryResponse.id,
                                alertType: "IR_SecondaryReportUpdated"
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
                    response.error("Could not query InventoryRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query InventoryResponse");
        }
    });
});



Parse.Cloud.define("sendSecondaryReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse
    //          inventoryRequestId - objectId of the parent request

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var InventoryRequest = Parse.Object.extend("InventoryRequest");

    var query = new Parse.Query(InventoryResponse);

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            var query = new Parse.Query(InventoryRequest);

            query.get(request.params.inventoryRequestId, 
            {
                useMasterKey: true,
                success: function(inventoryRequest)
                {
                    var currentDate = new Date();

                    inventoryResponse.set("srCompleted", true);
                    inventoryResponse.set("dateSrSent", currentDate);
                    inventoryRequest.set("hasSrCompleted", true);

                    inventoryRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [inventoryResponse, inventoryRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: inventoryRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: inventoryResponse.id,
                                alertType: "IR_SecondaryReportSent"
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
                    response.error("Could not query InventoryRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query InventoryResponse");
        }
    });
});

Parse.Cloud.define("updateConditionReport", function(request, response){
//Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse
    //          inventoryRequestId - objectId of the parent request

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var InventoryRequest = Parse.Object.extend("InventoryRequest");

    var query = new Parse.Query(InventoryResponse);
    query.include("preliminaryVehicleResponse");

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            // check if FRR changed
            var frrChanged;

            if (inventoryResponse.get("preliminaryVehicleResponse").get("frr") == true && inventoryResponse.get("finalFrr") == false)
                frrChanged = true;
            else
                frrChanged = false;


            var query = new Parse.Query(InventoryRequest);

            query.get(request.params.inventoryRequestId, 
            {
                useMasterKey: true,
                success: function(inventoryRequest)
                {
                    var currentDate = new Date();

                    inventoryRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [inventoryResponse, inventoryRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            if (frrChanged)
                            {
                                Parse.Cloud.run('sendAlert',
                                {
                                    toUser: inventoryRequest.get("owner").id,
                                    fromUser: request.user.id,
                                    relatedObject: inventoryResponse.id,
                                    alertType: "IR_FRRStatusChanged"
                                },{
                                    useMasterKey: true,
                                    success: function(result) {},
                                    error:   function(error)  {}
                                });
                            }

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: inventoryRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: inventoryResponse.id,
                                alertType: "IR_ConditionReportUpdated"
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
                    response.error("Could not query InventoryRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query InventoryResponse");
        }
    });
});


Parse.Cloud.define("sendConditionReport", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // marks the report as sent so the buyer can see it and sends an alert

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse
    //          inventoryRequestId - objectId of the parent request

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var InventoryRequest = Parse.Object.extend("InventoryRequest");

    var query = new Parse.Query(InventoryResponse);
    query.include("preliminaryVehicleResponse");

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            // check if FRR changed
            var frrChanged;

            if (inventoryResponse.get("preliminaryVehicleResponse").get("frr") == true && inventoryResponse.get("finalFrr") == false)
                frrChanged = true;
            else
                frrChanged = false;


            var query = new Parse.Query(InventoryRequest);

            query.get(request.params.inventoryRequestId, 
            {
                useMasterKey: true,
                success: function(inventoryRequest)
                {
                    var currentDate = new Date();

                    inventoryResponse.set("crCompleted", true);
                    inventoryResponse.set("dateCrSent", currentDate);
                    inventoryRequest.set("hasCrCompleted", true);

                    inventoryRequest.set("lastReportSent", currentDate);

                    var objectsToSave = [inventoryResponse, inventoryRequest];

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            // send alert

                            if (frrChanged)
                            {
                                Parse.Cloud.run('sendAlert',
                                {
                                    toUser: inventoryRequest.get("owner").id,
                                    fromUser: request.user.id,
                                    relatedObject: inventoryResponse.id,
                                    alertType: "IR_FRRStatusChanged"
                                },{
                                    useMasterKey: true,
                                    success: function(result) {},
                                    error:   function(error)  {}
                                });
                            }

                            Parse.Cloud.run('sendAlert',
                            {
                                toUser: inventoryRequest.get("owner").id,
                                fromUser: request.user.id,
                                relatedObject: inventoryResponse.id,
                                alertType: "IR_ConditionReportSent"
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
                    response.error("Could not query InventoryRequest");
                }
            });
        },
        error: function(error)
        {
            response.error("Could not query InventoryResponse");
        }
    });
});



Parse.Cloud.define("sendPriceQuote", function(request, response)
{

});



Parse.Cloud.define("IR_requestToCompleteTransaction", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // the buyer has requested to complete the transaction. a notification will
    // be sent to the seller and they will finish the transaction

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var query = new Parse.Query(InventoryResponse);

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            inventoryResponse.set("transactionRequested", true);

            inventoryResponse.save(null,
            {
                useMasterKey: true,
                success: function(object)
                {
                    // send alert

                    Parse.Cloud.run('sendAlert',
                    {
                        toUser: inventoryResponse.get("recipient").id,
                        fromUser: request.user.id,
                        relatedObject: inventoryResponse.id,
                        alertType: "IR_RequestToCompleteTransaction"
                    },{
                        useMasterKey: true,
                        success: function(result) { response.success(); },
                        error:   function(error)  { response.success(); }
                    });
                },
                error: function(error)
                {
                    response.error("Couldn't save InventoryResponse");
                }
            });
        },
        error: function(error)
        {
            response.error("Couldn't get InventoryResponse");
        }
    });
});


Parse.Cloud.define("IR_completeTransaction", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // the seller wants to confirm completion of the transaction. this will flag all other
    // inventory responses in the request as expired and the current as completed

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse

    var InventoryResponse = Parse.Object.extend("InventoryResponse");
    var InventoryRequest = Parse.Object.extend("InventoryRequest");

    var query = new Parse.Query(InventoryResponse);
    query.include("parentRequest");
    query.include("parentRequest.owner");

    query.get(request.params.inventoryResponseId,
    {
        useMasterKey: true,
        success: function(inventoryResponse)
        {
            var inventoryRequest = inventoryResponse.get("parentRequest");

            var responseRelation = inventoryRequest.relation("responses");
            var responseQuery = responseRelation.query();

            responseQuery.find(
            {
                useMasterKey: true,
                success: function(responses)
                {
                    // set flags on all (and eventually notifications?)

                    for (var i = 0; i < responses.length; i++)
                    {
                        if (responses[i].id === inventoryResponse.id)
                        {
                            responses[i].set("transactionCompleted", true);
                            inventoryRequest.set("winningResponse", responses[i]);
                        }
                        responses[i].set("isActive", false);
                    }

                    inventoryRequest.set("transactionCompleted", true);
                    inventoryRequest.set("isActive", false);

                    var objectsToSave = responses;
                    objectsToSave[objectsToSave.length] = inventoryRequest;

                    Parse.Object.saveAll(objectsToSave,
                    {
                        useMasterKey: true,
                        success: function(list)
                        {
                            var Transaction = Parse.Object.extend("Transaction");
                            var transaction = new Transaction();
                            transaction.setACL(new Parse.ACL(request.user));
                            transaction.getACL().setReadAccess(inventoryRequest.get("owner"), true);

                            transaction.set("buyer", inventoryRequest.get("owner"));
                            transaction.set("seller", request.user);

                            transaction.set("inventoryRequest", inventoryRequest);
                            transaction.set("inventoryResponse", inventoryResponse);

                            transaction.save(null,
                            {
                                useMasterKey: true,
                                success: function(transaction)
                                {
                                    Parse.Cloud.run('sendAlert',
                                    {
                                        toUser: inventoryRequest.get("owner").id,
                                        fromUser: request.user.id,
                                        relatedObject: transaction.id,
                                        alertType: "IR_TransactionCompleted"
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
            response.error("Couldn't get InventoryResponse");
        }
    });
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


Parse.Cloud.define("IR_trafficLightStatusChanged", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // cloud function to send an alert when the status changes

    // params:
    //          inventoryResponseId - objectId of the inventoryResponse
    //          fromStatus -
    //          toStatus -
    //          toUser -


    if (   (request.params.fromStatus === "Green"  && request.params.toStatus === "Yellow")
        || (request.params.fromStatus === "Green"  && request.params.toStatus === "Red"   )
        || (request.params.fromStatus === "Yellow" && request.params.toStatus === "Green" )
        || (request.params.fromStatus === "Yellow" && request.params.toStatus === "Red"   ) )
    {
        console.log("changing response");
        Parse.Cloud.run('sendAlert',
        {
            toUser: request.params.toUser,
            fromUser: request.user.id,
            relatedObject: request.params.inventoryResponseId,
            alertType: "IR_TrafficLightStatusChanged",
            // alertType: "IR_CommentReceived",
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
        console.log("first response");
        Parse.Cloud.run('sendAlert',
        {
            toUser: request.params.toUser,
            fromUser: request.user.id,
            relatedObject: request.params.inventoryResponseId,
            alertType: "IR_FirstResponseStatus",
            // alertType: "IR_CommentReceived", 
            fromStatus: statusConverter(request.params.fromStatus),
            toStatus: statusConverter(request.params.toStatus),
        },{
            useMasterKey: true,
            success: function(result) { response.success(); },
            error:   function(error)  { response.error(); }
        });

    }
});
