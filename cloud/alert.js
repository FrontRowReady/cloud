// alert types:
var _ = require("underscore");
var AlertType = {

    // shorthands:
    //      CR  - contact request
    //      IR  - inventory request / response
    //      CRR - condition report request / response

    // name:                            string:                                 associated class:               is implemented:     tested:

    CR_Received                         : "CR_Received",                        // contactRequest               yes                 works
    CR_Reminder                         : "CR_Reminder",                        // contactRequest               yes                 works
    CR_Accepted                         : "CR_Accepted",                        // contactRequest               yes                 works


    IR_Received                         : "IR_Received",                        // InventoryResponse            yes                 works
    IR_RequestToCompleteTransaction     : "IR_RequestToCompleteTransaction",    // InventoryResponse            yes
    IR_PreliminaryReportSent            : "IR_PreliminaryReportSent",           // InventoryResponse            yes
    IR_SecondaryReportSent              : "IR_SecondaryReportSent",             // InventoryResponse            yes
    IR_ConditionReportSent              : "IR_ConditionReportSent",             // InventoryResponse            yes
    IR_PriceQuoteSent                   : "IR_PriceQuoteSent",                  // InventoryResponse            ip
    IR_FRRStatusChanged                 : "IR_FRRStatusChanged",                // InventoryResponse            yes
    IR_FirstResponseStatus              : "IR_FirstResponseStatus",
    IR_TrafficLightStatusChanged        : "IR_TrafficLightStatusChanged",       // InventoryResponse            yes
    IR_CommentReceived                  : "IR_CommentReceived",                 // InventoryResponse            yes
    IR_ConditionReportUpdated           : "IR_ConditionReportUpdated",          // InventoryResponse            yes
    IR_SecondaryReportUpdated           : "IR_SecondaryReportUpdated",          // InventoryResponse            yes
    IR_PreliminaryReportUpdated         : "IR_PreliminaryReportUpdated",        // InventoryResponse            yes

    IR_Closed                           : "IR_Closed",                          // InventoryRequest             yes

    IR_TransactionCompleted             : "IR_TransactionCompleted",            // Transaction                  yes


    CRR_Received                        : "CRR_Received",                       // ConditionReportResponse      yes
    CRR_RequestToCompleteTransaction    : "CRR_RequestToCompleteTransaction",   // ConditionReportResponse      yes
    CRR_PreliminaryReportSent           : "CRR_PreliminaryReportSent",          // ConditionReportResponse      ip
    CRR_SecondaryReportSent             : "CRR_SecondaryReportSent",            // ConditionReportResponse      ip
    CRR_ConditionReportSent             : "CRR_ConditionReportSent",            // ConditionReportResponse      yes
    CRR_TrafficLightStatusChanged       : "CRR_TrafficLightStatusChanged",      // ConditionReportResponse      yes
    CRR_CommentReceived                 : "CRR_CommentReceived",                // ConditionReportResponse      yes
    CRR_Selected                        : "CRR_Selected",                       // ConditionReportResponse      yes
    CRR_Updated                         : "CRR_Updated",                        // ConditionReportResponse      yes
    CRR_SecondaryReportUpdated          : "CRR_SecondaryReportUpdated",         // ConditionReportResponse      ip
    CRR_PreliminaryReportUpdated        : "CRR_PreliminaryReportUpdated",       // ConditionReportResponse      ip
    CRR_FirstResponseStatus             : "CRR_FirstResponseStatus",            // ConditionReportResponse      yes
    CRR_FeeChanged                      : "CRR_FeeChanged",                     // ConditionReportResponse      ip

    CRR_Closed                          : "CRR_Closed",                         // ConditionReportRequest       yes

    CRR_TransactionCompleted            : "CRR_TransactionCompleted"            // Transaction                  yes

};



var RelatedObjectClass = {
    ContactRequest : 0,
    InventoryResponse : 1,
    Transaction : 2,
    InventoryRequest : 3,
    ConditionReportResponse : 4,
    ConditionReportRequest : 5
};


var MandrillKey = "RL94fHZsNKpI6fUfQ_5GNQ";


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 *              Parse Cloud Code Functions
 *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */




Parse.Cloud.define("sendAlert", function(request, response)
{
//    Parse.Cloud.useMasterKey();


    // creates an alert and sends out a corresponding push notification to the user.

    // if sending to more than one or two users, use "batchSendAlert"

    // doesn't check for user preferences at the moment, however...


    // code to call:

    //      Parse.Cloud.run('sendAlert',
    //      {
    //          toUser: toUser.id,
    //          fromUser: fromUser.id,
    //          relatedObject: relatedObject.id,
    //          alertType: "..."
    //      },{
    //          success: function(result) { },
    //          error: function(error) { }
    //      });


    // params:

    //      toUser - objectId of the User who's recieving the alert
    //      fromUser - objectId of the User who's sending the alert
    //      alertType - type of alert to send out (corresponds to above namespace)
    //      relatedObject - objectId of the related object, such as the contact request or inventory request objects

    //      fromStatus - the status it's coming from (only for IR_StatusChanged/CRR_StatusChanged)
    //      toStatus - the status it's going to (only for IR_StatusChanged/CRR_StatusChanged)


    var toUserQuery = new Parse.Query(Parse.User);
    var fromUserQuery = new Parse.Query(Parse.User);

    var mandrill = require("mandrill-api");
    mandrill_client = new mandrill.Mandrill(MandrillKey);
//    Mandrill.initialize(MandrillKey);

    toUserQuery.get(request.params.toUser,
    {
        useMasterKey: true,
        success: function(toUser)
        {
            // check if toUser even wants an alert

            if ( !userWantsAlert(request.params.alertType, toUser) ) {
                response.success();
            }

            // else carry on and send the alert

            fromUserQuery.get(request.params.fromUser,
            {
              useMasterKey: true,
              success: function(fromUser)
              {
                // build a query to get the related object

                var relatedObjectQuery = queryForAlertType(request.params.alertType);
                relatedObjectQuery.include("parentRequest");
                relatedObjectQuery.include("inventoryRequest");
                relatedObjectQuery.include("conditionReportRequest");

                relatedObjectQuery.get(request.params.relatedObject,
                {
                    useMasterKey: true,
                    success: function(relatedObject)
                    {
                      createTimeline(request.params.alertType,
                                     toUser,
                                     fromUser,
                                     relatedObject,
                                     request.params.fromStatus,
                                     request.params.toStatus)
                      .then(function(){
                        var pushQuery = new Parse.Query(Parse.Installation);
                        pushQuery.equalTo("user", toUser);

                        console.log("Alert Type " + request.params.alertType);

                        Parse.Push.send( { where: pushQuery,
                                           data: { badge: "Increment",
                                                   alert: messageForAlert(request.params.alertType,
                                                                          toUser,
                                                                          fromUser,
                                                                          relatedObject,
                                                                          request.params.fromStatus,
                                                                          request.params.toStatus),
                                                   alertId: alert.id,
                                                   relatedObjectId: relatedObject.id,
                                                   fromUserId: fromUser.id,
                                                   pushType: request.params.alertType,
                                                   sound: "Notification.caf" } },
                                         { success: function() {
                                                console.log("Parse.Push.send success");
                                                response.success("No email required.");
                                                /*
                                                if (request.params.alertType == AlertType.IR_Received ||
                                                    request.params.alertType == AlertType.CR_Received ||
                                                    request.params.alertType == AlertType.CR_Reminder ||
                                                    request.params.alertType == AlertType.CRR_Received) {
                                                        console.log("try to send email");
                                                        mandrill_client.sendEmail( {  message: { html: messageForEmail( request.params.alertType,
                                                                                                                        toUser,
                                                                                                                        fromUser,
                                                                                                                        relatedObject,
                                                                                                                        request.params.fromStatus,
                                                                                                                        request.params.toStatus),
                                                                                                 subject: "[Front Row Ready] Notification",
                                                                                                 from_email: "contact@frontrowready.com",
                                                                                                 from_name: fromUser.get("firstName") + " " + fromUser.get("lastName"),
                                                                                                 to: [ { email: toUser.get("email"),
                                                                                                         name: toUser.get("firstName") + " " + toUser.get("lastName") } ] },
                                                                                      async: true },
                                                                                    {
                                                                                      success: function(httpResponse) {
                                                                                        console.log("Mandrill email OK: "+httpResponse);
                                                                                        response.success("Email sent!");
                                                                                      },
                                                                                      error: function(httpResponse) {
                                                                                        console.error("Mandril email bad: "+httpResponse);
                                                                                        response.error("Uh oh, something went wrong");
                                                                                      }
                                                                                    } );
                                                } else {
                                                    response.success("No email required.");
                                                }*/ },
                                            error: function(error) {
                                                console.log("WARNING: Alert Push notification NOT sent");
                                                response.success("WARNING: Alert Push notification NOT sent " + error.code); },
                                            useMasterKey: true
                                          }
                                        );  //end Push.Send .then area
                          console.log("return from Parse.Push.Send");
                      });  // end createTimeline.then()
                    },
                    error: function(error){
                      response.error("Could not query the related object");
                    }
                  });
                },
                error: function(error){
                  response.error("Could not query fromUser");
                }
            });
        },
        error: function(error) { response.error("Could not query toUser"); }
    });
});



Parse.Cloud.define("sendBatchAlerts", function(request, response)
{
//    Parse.Cloud.useMasterKey();


    // creates alerts for a batch of users and sends notifications for them


    // code to call:

    //      Parse.Cloud.run("sendBatchAlert",
    //      {
    //          toUsers: [toUser1.id, toUser2.id, toUser3.id, ... ],
    //          fromUser: fromUser.id,
    //          relatedObject: relatedObject.id,
    //          alertType: "..."
    //      },{
    //          success: function(result) { },
    //          error: function(error) { }
    //      });


    // params:

    //      toUsers - array of objectIds of the Users who are recieving the alert
    //      fromUser - objectId of the User who's sending the alert
    //      alertType - type of alert to send out (corresponds to above namespace)
    //      relatedObjects - objectIds of the related objects, such as the contact request or inventory request objects

    //      fromStatus - the status it's coming from (only for IR_StatusChanged/CRR_StatusChanged)
    //      toStatus - the status it's going to (only for IR_StatusChanged/CRR_StatusChanged)



    var fromUserQuery = new Parse.Query(Parse.User);

    var Mandrill = require("mandrill");
    Mandrill.initialize(MandrillKey);

    console.log(request.params.toUsers);

    if (request.params.toUsers.length == 0)
        response.error("There are no toUsers or there aren't enough relatedObjects");


    var queries = [];

    for (var i = 0; i < request.params.toUsers.length; i++)
    {
        var query = new Parse.Query(Parse.User);
        query.equalTo("objectId", request.params.toUsers[i]);
        queries[i] = query;
    }

    var toUsersQuery = Parse.Query.or.apply(Parse.Query, queries);


    toUsersQuery.find(
    {
        useMasterKey: true,
        success: function(toUsers)
        {
            // take out users who don't want alerts

            for (var i = 0; i < toUsers; i++)
            {
                if ( ! userWantsAlert(request.params.alertType, toUsers[i]) )
                {
                    toUsers.splice(i, 1);
                    request.params.relatedObjects.splice(i, 1);
                    i--;
                }
            }

            if (toUsers.length == 0)
                response.success("Users don't want alerts");

            // send alerts for those that want them

            fromUserQuery.get(request.params.fromUser,
            {
                useMasterKey: true,
                success: function(fromUser)
                {
                    // build a query to get the related object

                    var queries = [];

                    for (var i = 0; i < request.params.relatedObjects.length; i++)
                    {
                        var query = queryForAlertType(request.params.alertType);
                        query.equalTo("objectId", request.params.relatedObjects[i]);
                        queries[i] = query;
                    }

                    var relatedObjectsQuery = Parse.Query.or.apply(Parse.Query, queries);
                    relatedObjectsQuery.include("parentRequest");
                    relatedObjectsQuery.include("inventoryRequest");
                    relatedObjectsQuery.include("conditionReportRequest");

                    relatedObjectsQuery.find(
                    {
                        useMasterKey: true,
                        success: function(relatedObjects)
                        {
                          var relatedObject;
                          var promises = [];
                          _.each(toUsers, function(toUser, i){
                            ////////////////////////////////////////////////////////////////////////////////
                            // WARNING:
                            //
                            //      The following code only works when the related object is either a
                            //      request or a response - type object.
                            ////////////////////////////////////////////////////////////////////////////////

                            var relatedObjectClass = relatedObjectClassForAlertType(request.params.alertType);

                            if (   relatedObjectClass === RelatedObjectClass.InventoryRequest
                                || relatedObjectClass === RelatedObjectClass.ConditionReportRequest)
                            {
                                relatedObject = relatedObjects[0];
                            }
                            else
                            {
                                for (var l = 0; l < relatedObjects.length; l++)
                                {
                                    if (relatedObjects[l].get("recipient").id === toUsers[i].id)
                                    {
                                        relatedObject = relatedObjects[l];
                                        break;
                                    }
                                }
                            }

                            promises.push(
                              createTimeline(request.params.alertType,
                                             toUsers[i],
                                             fromUser,
                                             relatedObject,
                                             request.params.fromStatus,
                                             request.params.toStatus)
                            );
                          });

                          Parse.Promise.when(promises)
                            .then(function(){
                              // now we are done creating the alert. send out the push notification,
                              // be agnostic as to whether it succeeds or not

                              var queries = [];
                              var userInformation = [];

                              for (var i = 0; i < toUsers.length; i++)
                              {
                                  var query = new Parse.Query(Parse.Installation);
                                  query.equalTo("user", toUsers[i]);
                                  queries[i] = query;
                                  userInformation[i] = {
                                    email: toUsers[i].get("email"),
                                    name: toUsers[i].get("firstName") + " " + toUsers[i].get("lastName"),
                                    type: "bcc"
                                  };
                              }

                              var pushQuery = Parse.Query.or.apply(Parse.Query, queries);
                              Parse.Push.send(
                              {
                                where: pushQuery,
                                data:
                                {
                                  badge: "Increment",
                                  alert: messageForAlert(request.params.alertType,
                                                         null,
                                                         fromUser,
                                                         relatedObject,
                                                         null,
                                                         null),
                                  relatedObjectId: relatedObject.id,
                                  fromUserId: fromUser.id,
                                  pushType: request.params.alertType,
                                  sound: "Notification.caf"
                                }
                              },{
                                // call response.success() no matter what
                                success: function()
                                {

                                  if (request.params.alertType == AlertType.IR_Received ||
                                      request.params.alertType == AlertType.CR_Received ||
                                      request.params.alertType == AlertType.CR_Reminder ||
                                      request.params.alertType == AlertType.CRR_Received){
                                    Mandrill.sendEmail({
                                      message: {
                                        html: messageForEmail(request.params.alertType,
                                                               null,
                                                               fromUser,
                                                               relatedObject,
                                                               request.params.fromStatus,
                                                               request.params.toStatus),
                                        subject: "[Front Row Ready] Notification",
                                        from_email: "contact@frontrowready.com",
                                        from_name: fromUser.get("firstName") + " " + fromUser.get("lastName"),
                                        to: userInformation
                                      },
                                      async: true
                                    },{
                                      success: function(httpResponse) {
                                        console.log(httpResponse);
                                        response.success("Email sent!");
                                      },
                                      error: function(httpResponse) {
                                        console.error(httpResponse);
                                        response.error("Uh oh, something went wrong");
                                      }
                                    });
                                  } else {
                                    response.success("No email required.");
                                  }
                                },
                                error: function(error)  { response.success("WARNING: Alert Push notification NOT sent"); }
                              });
                            });
                        },
                        error: function(error) { response.error("Could not query the related object"); }
                    });
                },
                error: function(error) { response.error("Could not query fromUser"); }
            });
        },
        error: function(error) { response.error("Could not query toUser"); }
    });
});



// function that returns a query to retrieve the related object for the alert based on the alertType

function queryForAlertType(alertType)
{
    var relatedObjectQuery = undefined;

    var relatedObjectClass = relatedObjectClassForAlertType(alertType);

    if (relatedObjectClass === RelatedObjectClass.ContactRequest)
    {
        var ContactRequest = Parse.Object.extend("ContactRequest");

        relatedObjectQuery = new Parse.Query(ContactRequest);
    }
    else if (relatedObjectClass === RelatedObjectClass.InventoryResponse)
    {
        var InventoryResponse = Parse.Object.extend("InventoryResponse");

        relatedObjectQuery = new Parse.Query(InventoryResponse);
    }
    else if (relatedObjectClass === RelatedObjectClass.Transaction)
    {
        var Transaction = Parse.Object.extend("Transaction");

        relatedObjectQuery = new Parse.Query(Transaction);
    }
    else if (relatedObjectClass === RelatedObjectClass.InventoryRequest)
    {
        var InventoryRequest = Parse.Object.extend("InventoryRequest");

        relatedObjectQuery = new Parse.Query(InventoryRequest);
    }
    else if (relatedObjectClass === RelatedObjectClass.ConditionReportResponse)
    {
        var ConditionReportResponse = Parse.Object.extend("ConditionReportResponse");

        relatedObjectQuery = new Parse.Query(ConditionReportResponse);
    }
    else if (relatedObjectClass === RelatedObjectClass.ConditionReportRequest)
    {
        var ConditionReportRequest = Parse.Object.extend("ConditionReportRequest");

        relatedObjectQuery = new Parse.Query(ConditionReportRequest);
    }
    else
    {
        relatedObjectQuery = undefined;
    }

    return relatedObjectQuery;
}



// function that returns the object class as declared in namespace RelatedObjectClass

function relatedObjectClassForAlertType(alertType)
{
    // Contact Request
    if (   alertType === AlertType.CR_Received
        || alertType === AlertType.CR_Reminder
        || alertType === AlertType.CR_Accepted )
    {
        return RelatedObjectClass.ContactRequest;
    }
    // Inventory Response
    else if (   alertType === AlertType.IR_Received
             || alertType === AlertType.IR_RequestToCompleteTransaction
             || alertType === AlertType.IR_PreliminaryReportSent
             || alertType === AlertType.IR_SecondaryReportSent
             || alertType === AlertType.IR_ConditionReportSent
             || alertType === AlertType.IR_PriceQuoteSent
             || alertType === AlertType.IR_CommentReceived
             || alertType === AlertType.IR_FRRStatusChanged
             || alertType === AlertType.IR_TrafficLightStatusChanged
             || alertType === AlertType.IR_ConditionReportUpdated
             || alertType === AlertType.IR_SecondaryReportUpdated
             || alertType === AlertType.IR_PreliminaryReportUpdated
             || alertType === AlertType.IR_FirstResponseStatus
             || alertType === AlertType.IR_Closed)
    {
        return RelatedObjectClass.InventoryResponse;
    }
    // Condition Report Response
    else if (   alertType === AlertType.CRR_Received
             || alertType === AlertType.CRR_RequestToCompleteTransaction
             || alertType === AlertType.CRR_PreliminaryReportSent
             || alertType === AlertType.CRR_SecondaryReportSent
             || alertType === AlertType.CRR_ConditionReportSent
             || alertType === AlertType.CRR_TrafficLightStatusChanged
             || alertType === AlertType.CRR_CommentReceived
             || alertType === AlertType.CRR_Selected
             || alertType === AlertType.CRR_Updated
             || alertType === AlertType.CRR_PreliminaryReportUpdated
             || alertType === AlertType.CRR_SecondaryReportUpdated
             || alertType === AlertType.CRR_FirstResponseStatus
             || alertType === AlertType.CRR_FeeChanged
             || alertType === AlertType.CRR_Closed)
    {
        return RelatedObjectClass.ConditionReportResponse;
    }
    // Transaction
    else if (   alertType === AlertType.IR_TransactionCompleted
             || alertType === AlertType.CRR_TransactionCompleted )
    {
        return RelatedObjectClass.Transaction;
    }
    // Invalid AlertType
    else
    {
        return undefined;
    }
}



// function that returns the field name of the alert object for the given class, or undefined if none

function alertFieldName(alertType)
{
    var relatedObjectClass = relatedObjectClassForAlertType(alertType);

    if (relatedObjectClass == RelatedObjectClass.ContactRequest)
        return "contactRequest";
    else if (relatedObjectClass == RelatedObjectClass.InventoryResponse)
        return "inventoryResponse";
    else if (relatedObjectClass == RelatedObjectClass.InventoryRequest)
        return "inventoryRequest";
    else if (relatedObjectClass == RelatedObjectClass.ConditionReportResponse)
        return "conditionReportResponse";
    else if (relatedObjectClass == RelatedObjectClass.ConditionReportRequest)
        return "conditionReportRequest";
    else if (relatedObjectClass == RelatedObjectClass.Transaction)
        return "transaction";
    else
        return undefined;
}


// checks whether or not the toUser wants an alert

function userWantsAlert(alertType, toUser)
{
    // check the user's preferences (need to do)
    return true;
}

function createTimeline(entryType, toUser, fromUser, relatedObject, fromStatus, toStatus)
{
  var Timeline = Parse.Object.extend("Timeline");
  var TimelineGroup = Parse.Object.extend("TimelineGroup");
  var TimelineEntry = Parse.Object.extend("TimelineEntry");
  var timelineQuery = new Parse.Query(Timeline);
  timelineQuery.equalTo("user", toUser);

  return timelineQuery.first( {useMasterKey: true} )
    .then(function(timeline){
      if (timeline){
        return Parse.Promise.as(timeline);
      } else {
        timeline = new Timeline();
        timeline.setACL(new Parse.ACL(toUser));
        timeline.set("user", toUser);
        return timeline.save( null, {useMasterKey: true} );
      }
    })
    .then(function(timeline){
      var timelineGroupQuery = new Parse.Query(TimelineGroup);
      timelineGroupQuery.equalTo("timeline", timeline);
      var field = alertFieldName(entryType);

      // map field types to the inventory request/response that they belong to
      if (field === "contactRequest"){
        timelineGroupQuery.equalTo(field, relatedObject);
      } else if (field === "inventoryResponse"){
        timelineGroupQuery.equalTo("inventoryRequest", relatedObject.get("parentRequest"));
      } else if (field === "inventoryRequest"){
        timelineGroupQuery.equalTo(field, relatedObject);
      } else if (field === "conditionReportResponse"){
        timelineGroupQuery.equalTo("conditionReportRequest", relatedObject.get("parentRequest"));
      } else if (field === "conditionReportRequest"){
        timelineGroupQuery.equalTo(field, relatedObject);
      } else if (field === "transaction"){
        if (relatedObject.get("inventoryRequest")){
          timelineGroupQuery.equalTo("inventoryRequest", relatedObject.get("inventoryRequest"));
        } else if (relatedObject.get("conditionReportRequest")) {
          timelineGroupQuery.equalTo("conditionReportRequest", relatedObject.get("conditionReportRequest"));
        }
      }

      return Parse.Promise.when(Parse.Promise.as(timeline), timelineGroupQuery.first( {useMasterKey: true} ));
    })
    .then(function(timeline, timelineGroup){
      if (timelineGroup){
        setRelatedObjectFields(timelineGroup, relatedObject, entryType);
        return Parse.Promise.when(Parse.Promise.as(timeline), timelineGroup.save(null, {useMasterKey: true} ));
      } else {
        timelineGroup = new TimelineGroup();
        timelineGroup.setACL(new Parse.ACL(toUser));
        timelineGroup.set("user", toUser);
        timelineGroup.set("timeline", timeline);
        timelineGroup.set("isViewed", false);
        timelineGroup.set("isDismissed", false);
        timelineGroup.set("lastTimelineEntryUpdatedAt", new Date());
        setRelatedObjectFields(timelineGroup, relatedObject, entryType);
        return Parse.Promise.when(Parse.Promise.as(timeline), timelineGroup.save(null, {useMasterKey: true} ));
      }
    })
    .then(function(timeline, timelineGroup){
      var timelineEntry = createTimelineEntry(timelineGroup,
                                              entryType,
                                              toUser,
                                              fromUser,
                                              relatedObject,
                                              fromStatus,
                                              toStatus);

      // set the message on the timeline group to the latest message
      timelineGroup.set("isViewed", false);
      timelineGroup.set("isDismissed", false);
      timelineGroup.set("lastTimelineEntryUpdatedAt", new Date());

      // saveAll was sometimes leaving the group with an empty reference
      return Parse.Promise.when(Parse.Promise.as(timelineGroup), timelineEntry.save(null, {useMasterKey: true} ));
    })
    .then(function(timelineGroup, timelineEntry){
      timelineGroup.set("lastTimelineEntry", timelineEntry);
      return timelineGroup.save(null, {useMasterKey: true} );
    });
}

function setRelatedObjectFields(timelineEntryOrGroup, relatedObject, entryType)
{
    var field = alertFieldName(entryType);
    if (field && relatedObject)
    {
      timelineEntryOrGroup.set(field, relatedObject);

      if (relatedObject.get("parentRequest"))
      {
        if (field === "inventoryResponse"){
          timelineEntryOrGroup.set("inventoryRequest", relatedObject.get("parentRequest"));
        } else if (field === "conditionReportResponse"){
          timelineEntryOrGroup.set("conditionReportRequest", relatedObject.get("parentRequest"));
        }
      } else if (field === "transaction"){
        if (relatedObject.get("inventoryRequest")){
          timelineEntryOrGroup.set("inventoryRequest", relatedObject.get("inventoryRequest"));
          timelineEntryOrGroup.set("inventoryResponse", relatedObject.get("inventoryResponse"));
        } else if (relatedObject.get("conditionReportRequest")) {
          timelineEntryOrGroup.set("conditionReportRequest", relatedObject.get("conditionReportRequest"));
          timelineEntryOrGroup.set("conditionReportResponse", relatedObject.get("conditionReportResponse"));
        }
      } else if (field === "inventoryRequest"){
        // nothing to do here
      } else if (field === "conditionReportRequest"){
        // nothing to do here
      } else if (field === "contactRequest"){
        // nothing to do here
      }
    }
}

function createTimelineEntry(timelineGroup, entryType, toUser, fromUser, relatedObject, fromStatus, toStatus)
{
    var TimelineEntry = Parse.Object.extend("TimelineEntry");
    var timelineEntry = new TimelineEntry();
    timelineEntry.setACL(new Parse.ACL(toUser));
    timelineEntry.set("timelineGroup", timelineGroup);
    timelineEntry.set("toUser", toUser);
    timelineEntry.set("fromUser", fromUser);
    timelineEntry.set("timelineEntryType", entryType);
    timelineEntry.set("message", "");
    timelineEntry.set("isViewed", false);

    setRelatedObjectFields(timelineEntry, relatedObject, entryType);

    var message = messageForAlert(entryType, toUser, fromUser, relatedObject, fromStatus, toStatus);
    timelineEntry.set("message", message);

    return timelineEntry;
}

// function that copies the parameters in one alert intro a new one

function copyAlert(alertToCopy, toUser, relatedObject) // second parameter is a new toUser to set
{
    var Alert = Parse.Object.extend("Alert");
    var alert = new Alert();

    alert.set("toUser", toUser);
    alert.set("fromUser", alertToCopy.get("fromUser"));
    alert.set("alertType", alertToCopy.get("alertType"));

    var field = alertFieldName(alertToCopy.get("alertType"));
    if (field)
        alert.set(field, relatedObject);

    alert.set("message", alertToCopy.get("message"));

    return alert;
}


// returns a message for the given alertType with the information provided
function messageForEmail(alertType, toUser, fromUser, relatedObject, fromStatus, toStatus)
{
    var name = fromUser.get("firstName") + " " + fromUser.get("lastName");
    if (alertType === AlertType.CR_Received)
    {
        return "<p>" + name + " would like to be contacts with you.</p><br><br><p>If you're using an iPhone or iPad, <a href=\"frontrowready://contactrequest\">tap here to open Front Row Ready</a>.";
    }
    else if (alertType === AlertType.CR_Reminder)
    {
        return "<p>" + name + " is reminding you that they would like to be contacts with you. Respond to their request as soon as you are able.</p><br><br><p>If you're using an iPhone or iPad, <a href=\"frontrowready://contactrequest\">tap here to open Front Row Ready</a>.";
    }
    else if (alertType === AlertType.IR_Received)
    {
        var ir = relatedObject.get("parentRequest");
        return "<p>" + name + " sent you an inventory request for a " + ir.get("make") + " " + ir.get("model") + ".</p><br><br><p>If you're using an iPhone or iPad, <a href=\"frontrowready://ir/" + ir.id + "\">tap here to open Front Row Ready</a>.";
    }
    else if (alertType === AlertType.CRR_Received)
    {
        var crr = relatedObject.get("parentRequest");
        return "<p>" + name + " sent you a condition report request for a " + crr.get("make") + " " + crr.get("model") + ".</p><br><br><p>If you're using an iPhone or iPad, <a href=\"frontrowready://cr/" + crr.id + "\">tap here to open Front Row Ready</a>.";
    }
    else
    {
      throw "Alert type of " + alertType + " is not supported for email messages.";
    }
}

function messageForAlert(alertType, toUser, fromUser, relatedObject, fromStatus, toStatus)
{
    var name = fromUser.get("firstName") + " " + fromUser.get("lastName");

    // Contact Requests

    if (alertType === AlertType.CR_Received)
    {
        return name + " would like to be contacts with you.";
    }
    else if (alertType === AlertType.CR_Reminder)
    {
        return name + " is reminding you about their contact request.";
    }
    else if (alertType === AlertType.CR_Accepted)
    {
        return name + " accepted your contact request.";
    }

    // Inventory Response

    else if (alertType === AlertType.IR_Received)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " sent you an inventory request for a " + ir.get("make") + " " + ir.get("model") + ".";
    }
    else if (alertType === AlertType.IR_RequestToCompleteTransaction)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " would like to purchase your " + ir.get("make") + " " + ir.get("model") + ".";
    }
    else if (alertType === AlertType.IR_PreliminaryReportSent)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " sent you the basic condition report for a " + relatedObject.get("make") + " " + relatedObject.get("model") + ".";
    }
    else if (alertType === AlertType.IR_SecondaryReportSent)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " sent you the exterior condition report for a " + relatedObject.get("make") + " " + relatedObject.get("model") + ".";
    }
    else if (alertType === AlertType.IR_ConditionReportSent)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " sent you the interior condition report for a " + relatedObject.get("make") + " " + relatedObject.get("model") + ".";
    }
    else if (alertType === AlertType.IR_PriceQuoteSent)
    {
        var ir = relatedObject.get("parentRequest");
        var makeModel = "";
        if (relatedObject.get("make") && relatedObject.get("model"))
        {
          makeModel = relatedObject.get("make") + " " + relatedObject.get("model");
        } else {
          makeModel = ir.get("make") + " " + ir.get("model");
        }
        if (relatedObject.get("priceQuoteChanged"))
        {
          return name + " changed price quote from " + relatedObject.get("oldPriceQuote") + " to " + relatedObject.get("priceQuote") + " on " + makeModel + ".";
        }
        else
        {
          return name + " sent you a price quote of " + relatedObject.get("priceQuote") + " for a " + makeModel + ".";
        }
    }
    else if (alertType === AlertType.IR_FRRStatusChanged)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " changed FRR status on your request for a " + ir.get("make") + " " + ir.get("model") + ".";
    }
    else if (alertType === AlertType.IR_FirstResponseStatus)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " " + toStatus + " fulfill your request for a " + ir.get("make") + " " + ir.get("model") + ".";
    }
    else if (alertType === AlertType.IR_TrafficLightStatusChanged)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " changed their status on your request. " + name + " " + toStatus + " fulfill your request for a " + ir.get("make") + " " + ir.get("model") + ".";
    }
    else if (alertType === AlertType.IR_CommentReceived)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " sent you a message about your request for a " + ir.get("make") + " " + ir.get("model") + ".";
    }
    else if (alertType === AlertType.IR_ConditionReportUpdated)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " updated the interior condition report for a " + relatedObject.get("make") + " " + relatedObject.get("model") + ".";
    }
    else if (alertType === AlertType.IR_SecondaryReportUpdated)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " updated the exterior condition report for a " + relatedObject.get("make") + " " + relatedObject.get("model") + ".";
    }
    else if (alertType === AlertType.IR_PreliminaryReportUpdated)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " updated the basic condition report for a " + relatedObject.get("make") + " " + relatedObject.get("model") + ".";
    }

    // Transaction (for an Inventory Response)

    else if (alertType === AlertType.IR_TransactionCompleted)
    {
        var ir = relatedObject.get("inventoryRequest");
        return name + " completed a transaction with you for a " + relatedObject.get("make") + " " + relatedObject.get("model") + ".";
    }

    // Inventory Request

    else if (alertType === AlertType.IR_Closed)
    {
        var ir = relatedObject.get("parentRequest");
        return name + " closed an inventory request for a " + ir.get("make") + " " + ir.get("model") + ".";
    }

    // Condition Report Response

    else if (alertType === AlertType.CRR_Received)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " sent you a condition report request for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_RequestToCompleteTransaction)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " would like to complete a transaction on a condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_PreliminaryReportSent)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " sent you the basic condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_SecondaryReportSent)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " sent you the exterior condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_ConditionReportSent)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " sent you the interior condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_TrafficLightStatusChanged)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " changed their status on your request. " + name + " " + toStatus + " fulfill your request for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_CommentReceived)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " sent you a message about a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_Selected)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " selected your offer to complete a condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_Updated)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " updated the interior condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_PreliminaryReportUpdated)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " updated the basic condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_SecondaryReportUpdated)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " updated the exterior condition report for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_FirstResponseStatus)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " " + toStatus + " fulfill your request for a " + crr.get("make") + " " + crr.get("model") + ".";
    }
    else if (alertType === AlertType.CRR_FeeChanged)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " offered a different fee on your request for a " + crr.get("make") + " " + crr.get("model") + " from " + fromStatus + " to " + toStatus + ".";
    }

    // Transaction (for a Condition Report Response)

    else if (alertType === AlertType.CRR_TransactionCompleted)
    {
        var crr = relatedObject.get("conditionReportRequest");
        return name + " completed a transaction with you for a " + crr.get("make") + " " + crr.get("model") + ".";
    }

    // Condition Report Request

    else if (alertType === AlertType.CRR_Closed)
    {
        var crr = relatedObject.get("parentRequest");
        return name + " closed a condition report request for a " + crr.get("make") + " " + crr.get("model") + ".";
    }

    else
    {
        // not a valid alertType
        console.log("Wrote undefined message for alert!");
        return undefined;
    }
}
