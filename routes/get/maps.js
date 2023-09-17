const maps = async (ctx) => {

    const hash = ctx.query.h;
    const key = ctx.query.k;
    let maps;
    if (hash) {
        const hashes = ctx.query.h.split(`,`);
        maps = await ctx.db.collection("beatSaverLocal").find({ "versions.hash": { $in: hashes } }).toArray();
    }
    else if (key) {
        const keys = ctx.query.k.split(`,`).toUpperCase();
        maps = await ctx.db.collection("beatSaverLocal").find({ key: { $in: keys } }).toArray();
    }
    if (maps) {
        ctx.body = maps;
    }

}
module.exports = maps