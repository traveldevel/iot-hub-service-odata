"use strict";

// Load env vars from .env
require('dotenv').config();

// Assign the required packages and dependencies to variables
const express = require('express');
const ODataServer = require("simple-odata-server");
const MongoClient = require('mongodb').MongoClient;
const cors = require("express-cors");
const cfenv = require("cfenv");
const basicAuth = require('basic-auth');

const landscapeName = process.env.LANDSCAPE_NAME;
const tenantName = process.env.TENANT_NAME;

const port = process.env.PORT || 8080;
const authorizedUsers = process.env.BASIC_AUTH_USERS.split(',');
const authorizedUserPasswords = process.env.BASIC_AUTH_USER_PASSWORDS.split(',');

// configs from env vars
var appEnv = cfenv.getAppEnv();
const services = appEnv.getServices();
console.log(services);

// get mongo url from service function
var getMongoUrlForService = function(mongoServiceName) {

    var mongoService = services[mongoServiceName];

    var mongoCredentials = {};
    
    var mongoUrl = '';
    var mongoDbName = '';

    if(mongoService !== undefined){
        mongoCredentials = services[mongoServiceName].credentials;

        mongoUrl = mongoService.credentials.uri;
        
        var mongodbUri = require('mongodb-uri');
        var uriObject = mongodbUri.parse(mongoUrl);
        mongoDbName = uriObject.database;
    }

    console.log("'" + mongoServiceName + "' found in VCAP_SERVICES ! ");
    console.log("Url for mongodb : '" + mongoUrl + "'");
    console.log("DB for mongodb : '" + mongoDbName + "'");

    return { "url" : mongoUrl, "db" : mongoDbName};
}

// get mongoDb Url fo metadata service
const mongoServiceBaseName = "iot_hub_mongo_" + landscapeName + "_" + tenantName;
var mongoConnData = getMongoUrlForService(mongoServiceBaseName + "_metadata");
const mongoUrl = mongoConnData.url; 
const mongoDbName = mongoConnData.db;

// odata service model
var model = {
    namespace: mongoDbName,
    entityTypes: {
        'user': {
            "_id": { "type": "Edm.String", key: true},        
            "name": { "type": "Edm.String"},
            "password": { "type": "Edm.String"},  
            "roles": { "type": "Edm.String"}                
        },
        'project': {
            "_id": { "type": "Edm.String", key: true},        
            "project_name": { "type": "Edm.String"},
            "description": { "type": "Edm.String"}             
        },
        'device_group': {
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},    
            "group_name": { "type": "Edm.String"},
            "description": { "type": "Edm.String"}             
        },
        'device_schema':{
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},    
            "schema_name": { "type": "Edm.String"},
            "description": { "type": "Edm.String"},
            "values" : { "type": "Edm.String"}
        },
        'device':{
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},
            "group_id": { "type": "Edm.String"}, 
            "device_name": { "type": "Edm.String"},
            "auth_token": { "type": "Edm.String"},
            "description": { "type": "Edm.String"},
            "created_at": { "type": "Edm.DateTime"},
            "last_contact_ping": { "type": "Edm.DateTime"},
            "last_contact_rawdata": { "type": "Edm.DateTime"},
            "last_contact_location": { "type": "Edm.DateTime"},
            "last_event_triggered": { "type": "Edm.DateTime"},
            "last_command_sent": { "type": "Edm.DateTime"},
            "last_command_confirmed": { "type": "Edm.DateTime"},
            "mandatory_schema_id": { "type": "Edm.String"}, 
            "validate_schema": { "type": "Edm.Boolean"},
            "trigger_events": { "type": "Edm.Boolean"},
            "archive_to_coldstore": { "type": "Edm.Boolean"}
        }
    },   
    entitySets: {}
};

model.entitySets["user"] = { entityType: mongoDbName + ".user" };
model.entitySets["project"] = { entityType: mongoDbName + ".project" };
model.entitySets["device_group"] = { entityType: mongoDbName + ".device_group" };
model.entitySets["device_schema"] = { entityType: mongoDbName + ".device_schema" };
model.entitySets["device"] = { entityType: mongoDbName + ".device" };

// Instantiates ODataServer and assigns to odataserver variable.
var odataServer = ODataServer().model(model);
odataServer.cors('*');

odataServer.error(function(req, res, error, next){
    console.log(err);
    next();
})

// Connection to database in MongoDB
var mongoClient = require('mongodb').MongoClient;

MongoClient.connect(mongoUrl, function(err, db) {
    
    if(err){
        console.log(err);
    }

    odataServer.onMongo(function(cb) { cb(err, db); });
});

// auth global function
const auth = function (req, res, next) {

    if(req.method === "OPTIONS"){
        return next();
    }

    function unauthorized(res) {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
        return res.sendStatus(401);
    };

    var user = basicAuth(req);

    if (!user || !user.name || !user.pass) {
        return unauthorized(res);
    };

    if (authorizedUsers.indexOf(user.name) >= 0 && authorizedUserPasswords.indexOf(user.pass) >= 0) {
        return next();
    } else {
        return unauthorized(res);
    };
};

// Create app variable to initialize Express 
var app = express();

app.use(cors({
    allowedOrigins: [
        'localhost:8080', 'iot-hub-ui-app-shared-new.cfapps.io', 'iothubkafkashared.westeurope.cloudapp.azure.com'
    ]
}));

// The directive to set app route path.
app.use("/", auth, function (req, res) {
    odataServer.handle(req, res);
});

// The app listens on port 8080 (or other from env) and prints the endpoint URI in console window.
var server = app.listen(port, function () {
    console.log('Metadata OData service listening on ' + appEnv.url + ':' + process.env.PORT);
});
