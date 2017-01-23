
var Alert = Parse.Object.extend('Alert');


exports.getAlerts = function (req, res) {

	var query = new Parse.Query(Alert);
	query.descending('createdAt');

	var user = req.user;
	var token = user.getSessionToken(); // get session token from req.user
	var relation = user.relation('alerts');
	console.log("User id: " + user.id);

	relation.query().find({ useMasterKey: true, sessionToken: token }).then(function(alerts) {
		res.render('alerts', {alerts : alerts});
	}, 
	function(error) {
		res.send(500, error);
	});
};