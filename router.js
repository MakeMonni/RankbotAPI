const Router = require("koa-router");
const router = new Router();
const fs = require("fs/promises")

async function loadRoutes()
{
    const routeDirs = await fs.readdir(`${process.cwd()}/routes`);

    for (const routeDir of routeDirs) {
        try {
            const routeFiles = await fs.readdir(`${process.cwd()}/routes/${routeDir}`);
            for (const routeFile of routeFiles) {
                try {
                    const route = require(`${process.cwd()}/routes/${routeDir}/${routeFile}`)
                    const routeName = routeFile.slice(0, routeFile.indexOf("."))
    
                    router[routeDir](`/${routeName}`, route)
                }
                catch (err) {
                    console.log(`Failed to load route: ${routeFile}`, err);
                }
            }
        }
        catch (err) {
            console.log(`Failed to load routedir: ${routeDir}`, err);
        }
    }
}

loadRoutes();

module.exports = router;