const overlayPoolChange = async (ctx) => {
    const body = ctx.request.body;

    if (ctx.simpleAuth.isCoordinator(body.auth) || ctx.simpleAuth.isAdmin(body.auth)) {

        try {

            const body = ctx.request.body;

            if (!body.pool) ctx.throw(400, '.pool required')
            if (!body.coordinatorUser) ctx.throw(400, '.pool required')

            ctx.wsClient.send(JSON.stringify({
                type: "poolChangeClient",
                coordinatorUser: body.coordinatorUser,
                pool: body.pool
            }))

            ctx.status = 200;
            ctx.body = { message: "Success" }

        }

        catch (err) {

            console.log(err)
            ctx.status = 400
            ctx.body = { message: err }

        }

    }
    else {
        ctx.status = 403
        ctx.body = { message: "Unauthorized" }
    }
}
module.exports = overlayPoolChange