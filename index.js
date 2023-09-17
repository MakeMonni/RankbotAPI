const Koa = require("koa");
const parser = require("koa-bodyparser");
const cors = require("@koa/cors");
const router = require("./router.js");
const helpers = require("./helpers.js");
const MongoClient = require("mongodb").MongoClient;

const config = require("./config.json");
const port = config.port;

const App = new Koa();

console.log("Attempting to start server");

App.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

MongoClient.connect(config.mongourl, async (err, client) => {

    if(err){
        console.log("Failed connecting to db");
    }

    const db = client.db(config.dbName);

    App.context.db = db;
    App.context.helpers = helpers;

    App.use(parser())
        .use(cors())
        .use(router.routes())
        .listen(port, () => {
            console.log(`Server listening http://127.0.0.1:${port}/ `);
        });
});