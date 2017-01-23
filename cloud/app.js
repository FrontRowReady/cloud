
// These two lines are required to initialize Express in Cloud Code.
var alerts = require('./controllers/alerts.js');
var inventoryRequests = require('./controllers/inventoryRequests.js');

var express = require('express');
var app = express();

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var parseExpressCookieSession = require('parse-express-cookie-session');
var parseExpressHttpsRedirect = require('parse-express-https-redirect');

var currentUserObject

// Global app configuration section
app.set('views', 'views');  // Specify the folder to find templates
app.set('view engine', 'ejs');    // Set the template engine
app.use(bodyParser.json());    // Middleware for reading request body
app.use(cookieParser('SECRET_SIGNING_KEY'));
app.use(parseExpressHttpsRedirect());  // Require user to be on HTTPS.
//app.use(parseExpressCookieSession( { cookie: { maxAge: 3600000 * 24 * 30 } } ));
app.use(parseExpressCookieSession({fetchUser: true, cookie: {maxAge: 3600000*24*30}}));

//FRRDev
app.locals.parseApplicationId = 'wh49FDdYEQidqbY6NuwOt1AFNmobWhZUWDe3IOvC';
app.locals.parseJavascriptKey = 'AQRUMtUDZ3FPMXYlYXUKBDYY1VVRUIyXAwWAbhsu';
// FRRProd
//app.locals.parseApplicationId = 'L8VVmlkjvDLm1opyxcgIhvEJmx72aAoLXIrYoa53';
//app.locals.parseJavascriptKey = 'n6dF9kj6E49tH7k35Pe94f7lJopwMY3bNfHyDDaO';

app.listen();

app.get('/', function(req, res){
  res.render('index', {
    title: 'Home'
  });
});

app.get('/privacy_policy', function(req, res){
  res.render('privacy_policy', {
  });
});

app.get('/terms', function(req, res){
  res.render('terms', {
  });
});

app.get('/alerts', alerts.getAlerts);

app.get('/inventoryRequests', inventoryRequests.getInventoryRequests);
app.get('/inventoryRequests/:id', inventoryRequests.show);
app.get('/newRequest', inventoryRequests.newRequest);
app.post('/createNewIRRequest', inventoryRequests.createNewRequest);

app.get('/login', function(req, res) {

	console.log('in the login rendering thing');
	if (req.body && !req.user)
  		res.render('login/index', { message: 'Please log in' });
  	else {
  		req.user.fetch().then(function(user) {
  			res.render('home', { message: user.get("email") });
  		});	  	
  	}
});

app.get('/logout', function(req, res) {
	console.log("logging out");
	Parse.User.logOut()
	res.render('login/index', {message: 'Please log in'});
});

app.post('/home', function(req, res) {

	Parse.User.logIn(req.body.username, req.body.password, {
		success: function(user) {
			console.log(" Logged in User id: " + req.user.id);

			res.render('home', { message: user.get("email") });	  	
		},
	  	error: function(user, error) {
	    	res.render('login', { message: "Error " + error.code + " " + error.message});
	  	}
	});
});


