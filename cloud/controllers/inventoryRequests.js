var InventoryRequest = Parse.Object.extend('InventoryRequest');

exports.getInventoryRequests = function(req, res) {
	var user = req.user;
	var token = user.getSessionToken(); // get session token from req.user
	var requestRelation = user.relation('inventoryRequests');
	var responseRelation = user.relation('inventoryResponses');

	var inventoryRequests;

	requestRelation.query().find({ sessionToken: token }).then(function(requests) {
		inventoryRequests = requests;

		var query = responseRelation.query();
		query.include("parentRequest");
		return query.find({ sessionToken: token });

	}).then(function(responses) {
		res.render('inventoryRequests/index', {
			inventoryRequests : inventoryRequests,
			inventoryResponses : responses
		});
	},
	function(error) {
		res.send(500, "Failed to load Inventory Requests and Responses " + error);
	});
};


exports.show = function(req, res) {
	var user = req.user;
	var token = user.getSessionToken(); // get session token from req.user
	var query = new Parse.Query(InventoryRequest);

	query.get(req.params.id, { sessionToken: token }).then(function(request) {
		res.render('inventoryRequests/show', {InventoryRequest : request});
	}, 
	function(error) {
		res.send(500, "Failed to find specific Inventory Request");
	});
};

exports.newRequest = function(req, res) {
	var user = req.user;
	var token = user.getSessionToken(); // get session token from req.user
	var contactRelation = user.relation('contacts');

	contactRelation.query().find({ sessionToken: token }).then(function(contacts) {
		res.render('inventoryRequests/newInventoryRequest', {contacts : contacts});
	});
};

exports.createNewRequest = function(req, res) {
	var inventoryRequest = new InventoryRequest();

	inventoryRequest.set('year', req.body.year);
	inventoryRequest.set('make', req.body.make);
	inventoryRequest.set('model', req.body.model);
	inventoryRequest.set('timeframeNumber', parseInt(req.body.timeframe));
	inventoryRequest.set('owner', req.user);

	var timeframeString = "";

	if (req.body.timeframe === "24") {
		timeframeString = "24 Hours";
	} 
	else if (req.body.timeframe === "1") {
		timeframeString = "Buyers Waiting";
	}
	else if (req.body.timeframe === "") {
		timeframeString = "Any";
	}

	inventoryRequest.set('timeframeString', timeframeString);

	var contactsArray = req.body.contacts;

	var user = req.user;
	var token = user.getSessionToken(); // get session token from req.user
	var query = new Parse.Query(Parse.User);
	query.containedIn("objectId", contactsArray);

	query.find({ useMasterKey: true, sessionToken: token }).then(function(recipients){

		inventoryRequest.relation('recipients').add(recipients);
		return inventoryRequest.save(null, { useMasterKey: true });

	}).then(function() {

		return Parse.Cloud.run('createInventoryResponses', {inventoryRequestId : inventoryRequest.id}, { sessionToken: token });

	}).then(function() {

		alert('Inventory Request created');
		res.render('home', {message : 'message'});

	},
	function(error) {

		alert('Failed to create an Inventory Request' + error.code);

	});

};







