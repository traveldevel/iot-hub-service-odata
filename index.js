"use strict";

// Load env vars from .env
require('dotenv').config();

// Assign the required packages and dependencies to variables
const express = require('express');
const ODataServer = require("simple-odata-server");
const MongoClient = require('mongodb').MongoClient;
const cors = require("cors");
const cfenv = require("cfenv");
const basicAuth = require('basic-auth');

const landscapeName = process.env.LANDSCAPE_NAME;
const tenantName = process.env.TENANT_NAME;

const port = process.env.PORT || 8080;
const authorizedUsers = process.env.BASIC_AUTH_USERS.split(',');
const authorizedUserPasswords = process.env.BASIC_AUTH_USER_PASSWORDS.split(',');

// configs from env vars
var appEnv = cfenv.getAppEnv();
//console.log(appEnv.getServices());

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
            "values" : { "type": "Collection(Edm.String)"}
        },
        'device':{
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},
            "group_id": { "type": "Edm.String"}, 
            "device_name": { "type": "Edm.String"},
            "auth_token": { "type": "Edm.String"},
            "description": { "type": "Edm.String"},
            "created_at": { "type": "Edm.DateTime"},
            "last_contact": { "type": "Edm.DateTime"},
            "mandatory_schema_id": { "type": "Edm.String", key: true}, 
            "validate_schema": { "type": "Edm.Boolean"}
        },
        'location':{
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},
            "group_id": { "type": "Edm.String"}, 
            "device_id": { "type": "Edm.String"},
            "latitude": { "type": "Edm.Decimal"},
            "longitude": { "type": "Edm.Decimal"},
            "accuracy": { "type": "Edm.Integer"},
            "speed": { "type": "Edm.Integer"},
            "recorded_time": { "type": "Edm.DateTime"},
            "created_at": { "type": "Edm.DateTime"}
        },
        'raw_data':{
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},
            "group_id": { "type": "Edm.String"}, 
            "device_id": { "type": "Edm.String"},
            "recorded_time": { "type": "Edm.DateTime"},
            "created_at": { "type": "Edm.DateTime"},
            "values" : { "type": "Collection(Edm.String)"}
        },  
        'event':{
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},
            "group_id": { "type": "Edm.String"}, 
            "device_id": { "type": "Edm.String"},
            "type": { "type": "Edm.String"},
            "text": { "type": "Edm.String"},
            "dismissed": { "type": "Edm.String"},
            "user_id": { "type": "Edm.String"}         
        },  
        'command':{
            "_id": { "type": "Edm.String", key: true},
            "project_id": { "type": "Edm.String"},
            "group_id": { "type": "Edm.String"}, 
            "device_id": { "type": "Edm.String"},
            "type": { "type": "Edm.String"},
            "command": { "type": "Edm.String"},
            "created_at": { "type": "Edm.DateTime"},
            "confirmed_at": { "type": "Edm.DateTime"}      
        }   
    },   
    entitySets: {}
};

model.entitySets[tenantName + "_user"] = { entityType: mongoDbName + ".user" };
model.entitySets[tenantName + "_project"] = { entityType: mongoDbName + ".project" };
model.entitySets[tenantName + "_device_group"] = { entityType: mongoDbName + ".device_group" };
model.entitySets[tenantName + "_device_schema"] = { entityType: mongoDbName + ".device_schema" };
model.entitySets[tenantName + "_device"] = { entityType: mongoDbName + ".device" };
model.entitySets[tenantName + "_location"] = { entityType: mongoDbName + ".location" };
model.entitySets[tenantName + "_raw_data"] = { entityType: mongoDbName + ".raw_data" };
model.entitySets[tenantName + "_event"] = { entityType: mongoDbName + ".event" };
model.entitySets[tenantName + "_command"] = { entityType: mongoDbName + ".command" };

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

// auth global function
const auth = function (req, res, next) {
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
app.use(cors());

// The directive to set app route path.
app.use("/", auth, function (req, res) {
    odataServer.handle(req, res);
});

// The app listens on port 8080 (or other from env) and prints the endpoint URI in console window.
var server = app.listen(port, function () {
    console.log('OData service listening on ' + appEnv.url + ':' + process.env.PORT);
});
