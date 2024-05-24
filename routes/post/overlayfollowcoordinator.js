const overlayFollowCoordinator = async (ctx) => {
    const body = ctx.request.body;

    if (ctx.simpleAuth.isStreamer(body.auth) || ctx.simpleAuth.isAdmin(body.auth)) {

        try {

            if (!body.coordinatorUser) ctx.throw(400, '.coordinator required')

            ctx.wsClient.send(JSON.stringify({
                type: "coordinatorFollow",
                coordinatorUser: body.coordinatorUser
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
module.exports = overlayFollowCoordinator