const overlayMapAction = async (ctx) => {
    const body = ctx.request.body;

    if (ctx.simpleAuth.isCoordinator(body.auth) || ctx.simpleAuth.isAdmin(body.auth)) {

        try {

            const body = ctx.request.body;

            if (!body.pickBan) ctx.throw(400, '.pickBan required')
            if (!body.hash) ctx.throw(400, '.hash required')
            if (!body.player) ctx.throw(400, '.player required')

            ctx.wsClient.send(JSON.stringify({
                type: "pickBanClient",
                pickBan: body.pickBan,
                hash: body.hash,
                player: body.player,
                undo: (body.undo)
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
module.exports = overlayMapAction