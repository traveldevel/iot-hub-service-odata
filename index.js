// Assign the required packages and dependencies to variables
var express = require('express');
var ODataServer = require("simple-odata-server");
var MongoClient = require('mongodb').MongoClient;
var cors = require("cors");
var cfenv = require("cfenv");

var landscapeName = process.env.landscapeName;
var tenantName = process.env.tenantName;

// Create app variable to initialize Express 
var app = express();
app.use(cors());

// mongo connect and create missing collections
var appEnv = cfenv.getAppEnv();
var mongoServiceName = "iot_hub_mongo_" + landscapeName;
var mongoService = appEnv.getService(mongoServiceName);
var mongoCredentials = appEnv.getServiceCreds(mongoServiceName);
var mongoUrl = mongoCredentials.uri;
var mongoClient = require('mongodb').MongoClient;

console.log(mongoServiceName + " found in VCAP_SERVICES");
console.log(mongoService.credentials);

var mongoDbName = '';
var mongoUrl = '';

if(mongoService !== undefined){

    mongoUrl = mongoService.credentials.uri + "?ssl=false";

    var mongodbUri = require('mongodb-uri');
    var uriObject = mongodbUri.parse(mongoUrl);
    mongoDbName = uriObject.database;
}

console.log("Mongo url : ", mongoUrl);
console.log("Mongo db : ", mongoDbName);

var model = {
    namespace: mongoDbName,
    entityTypes: {
        'user': {
            "_id": { "type": "Edm.String", key: true},        
            "name": { "type": "Edm.String"},
            "password": { "type": "Edm.String"},  
            "roles": { "type": "Collection(Edm.String)"}                
        }
    },   
    entitySets: {}
};

model.entitySets[tenantName + "_user"] = { entityType: mongoDbName + ".user" };

// Instantiates ODataServer and assigns to odataserver variable.
var odataServer = ODataServer().model(model);
odataServer.cors('*');

odataServer.error(function(req, res, error, next){
    console.log(err);
    next();
})

// Connection to database in MongoDB
MongoClient.connect(mongoUrl, function(err, db) {
    
    if(err){
        console.log(err);
    }

    odataServer.onMongo(function(cb) { cb(err, db); });
});

// The directive to set app route path.
app.use("/", function (req, res) {
    odataServer.handle(req, res);
});

// The app listens on port 8080 and prints the endpoint URI in console window.
var server = app.listen(8080, function () {
    console.log('OData service listening on ' + appEnv.url + ':' + process.env.PORT);
});
