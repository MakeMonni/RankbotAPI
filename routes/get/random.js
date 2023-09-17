const random = async (ctx) => {

    let amount = parseInt(ctx.query.a);
    if (!amount) amount = 25;

    const njs = parseInt(ctx.query.njs);
    const njsType = ctx.query.njstype;
    const nps = parseInt(ctx.query.nps);
    const npsType = ctx.query.npstype;
    const length = parseInt(ctx.query.length);
    const lengthType = ctx.query.lengthtype;

    let filterQuery = [];
    let lenghtQuery = {}
    if (njs) {
        filterQuery.push({ "njs": { [ctx.helpers.greaterOrLower(njsType)]: njs } })
    }
    if (nps) {
        filterQuery.push({ "nps": { [ctx.helpers.greaterOrLower(npsType)]: nps } })
    }
    if (length) {
        lenghtQuery = { [ctx.helpers.greaterOrLower(lengthType)]: length }
    }

    let matchQuery = { automapper: false }
    if (filterQuery.length > 0) {
        matchQuery = {
            automapper: false,
            "versions.0.diffs": { $elemMatch: { $and: filterQuery } }
        }
    }
    if (length) {
        matchQuery["metadata.duration"] = lenghtQuery
    }

    const maps = await ctx.db.collection("beatSaverLocal").aggregate([{ $match: matchQuery }, { $sample: { size: amount } }]).toArray();
    const mapHashes = await ctx.helpers.hashes(maps);

    const playlist = await ctx.helpers.createPlaylist(
        "Random",
        mapHashes,
        "https://cdn.discordapp.com/attachments/818358679296147487/844607045130387526/Banana_Dice.jpg",
        ctx.request.url.replace("/", ""),
        "A random playlist :)");

    ctx.body = playlist;

}
module.exports = random