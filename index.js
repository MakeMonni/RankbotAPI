const Koa = require("koa");
const parser = require("koa-bodyparser");
const cors = require("@koa/cors");
const router = require("./router.js");
const helpers = require("./helpers.js");
const discordAuth = require("./discordAuth.js");
const MongoClient = require("mongodb").MongoClient;
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require("./config.json");
const port = config.port;
const simpleAuth = require('./simpleAuth.js')


const App = new Koa();

App.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

MongoClient.connect(config.mongourl, async (err, client) => {
    if (err) {
        console.error("Failed connecting to db", err); 
        return;
    }

    console.log("Connected to MongoDB");

    const db = client.db(config.dbName);

    const jwtToken = jwt.sign({api: "api"}, config.jwtSecret)
    const wsClient = new WebSocket(`${config.wsUrl}?token=${jwtToken}`)

    wsClient.on('open', () => {
        console.log('WebSocket connection opened');
    });

    wsClient.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    wsClient.on('close', (code, reason) => {
        console.log(code, reason.toString())
        console.log('WebSocket connection closed');
    });
    
    App.context.db = db;
    App.context.helpers = helpers;
    App.context.discordAuth = discordAuth;
    App.context.wsClient = wsClient;
    App.context.simpleAuth = simpleAuth

    // Setup routes
    App.use(parser())
        .use(cors())
        .use(router.routes());

    // Start server
    App.listen(port, () => {
        console.log(`Server listening http://127.0.0.1:${port}/ `);
    });
});

App.on('error', err => {
    console.error('Server error', err);
});
