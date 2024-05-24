const overlayFollowCoordinator = async (ctx) => {
    const body = ctx.request.body;

    if (ctx.simpleAuth.isStreamer(body.auth) || ctx.simpleAuth.isAdmin(body.auth)) {

        try {

            if (!body.coordinator) ctx.throw(400, '.coordinator required')

            ctx.wsClient.send(JSON.stringify({
                type: "coordinatorFollow",
                coordinator: body.coordinator
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