const overlayWinAction = async (ctx) => {
    const body = ctx.request.body;

    if (ctx.simpleAuth.isCoordinator(body.auth) || ctx.simpleAuth.isAdmin(body.auth)) {

        try {

            const body = ctx.request.body;

            if (!body.hash) ctx.throw(400, '.hash required')
            if (!body.player) ctx.throw(400, '.player required')
            if (!body.playerId) ctx.throw(400, '.playerId required')

            ctx.wsClient.send(JSON.stringify({
                type: "clientMapWon",
                hash: body.hash,
                player: body.player,
                playerId: body.playerId,
                undo: (body.undo)
            }));

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
module.exports = overlayWinAction