const oneclick = async (ctx) => {

    const key = ctx.query.k
    ctx.redirect(`beatsaver://${key}`)

}
module.exports = oneclick