const oneclick = async (ctx) => {

    const hash = ctx.query.h;
    const key = ctx.query.k;
    let map;
    if (hash) {
        map = await ctx.db.collection("beatSaverLocal").findOne({ "versions.hash": hash.toUpperCase() });
    }
    else if (key) {
        map = await ctx.db.collection("beatSaverLocal").findOne({ key: key.toUpperCase() });
    }
    if (map) {
        ctx.body = map;
    }

}
module.exports = oneclick