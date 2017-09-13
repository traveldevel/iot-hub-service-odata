// Assign the required packages and dependencies to variables
var express = require('express');
var ODataServer = require("simple-odata-server");
var MongoClient = require('mongodb').MongoClient;
var cors = require("cors");
var cfenv = require("cfenv");

// configs from env vars
var appEnv = cfenv.getAppEnv();

// Create app variable to initialize Express 
var app = express();

// Enable Cross-origin resource sharing (CORS)  for app.
app.use(cors());

// Define Odata model of the resource entity i.e. Product. 
// The metadata is defined using OData type system called the Entity Data Model (EDM),
// consisting of EntitySets, Entities, ComplexTypes and Scalar Types.
var model = {
    namespace: "iothub",
    entityTypes: {
        "user": {
            "_id": {"type": "Edm.String", key: true},        
            "name": {"type": "Edm.String"},
            "password": {"type": "Edm.String"},  
            "roles": {"type": "Edm.String"}                
        }
    },   
    entitySets: {
        "users": {
            entityType: "iothub.user"
        }
    }
};

// Instantiates ODataServer and assigns to odataserver variable.
var odataServer = ODataServer().model(model);

var landscapeName = process.env.landscapeName;
var tenantName = process.env.tenantName;

// mongo connect and create missing collections
var mongoServiceName = "iot_hub_mongo_" + landscapeName;
var mongoService = appEnv.getService(mongoServiceName);
var mongoCredentials = appEnv.getServiceCreds(mongoServiceName);
var mongoUrl = mongoCredentials.uri;
var mongoClient = require('mongodb').MongoClient;

console.log(mongoServiceName + " found in VCAP_SERVICES : ")
//console.log(mongoService);

var mongoCredentials = {};
var mongoUrl = '';

if(mongoService !== undefined){
    mongoCredentials = mongoService.credentials;
    mongoUrl = mongoCredentials.uri;
}

// Connection to demo database in MongoDB
MongoClient.connect(mongoUrl, function(err, db) {
    odataServer.onMongo(function(cb) { cb(err, db); });
});

// The directive to set app route path.
app.use("/", function (req, res) {
    odataServer.handle(req, res);
});

// The app listens on port 3010 and prints the endpoint URI in console window.
var server = app.listen(8080, function () {
    console.log('OData service listening on ' + appEnv.url + ':' + process.env.PORT);
});
