const ranked = async (ctx) => {

    const type = ctx.query.t;
    let maps = [];
    let hashlist = [];
    let syncURL = "ranked"
    let playlistDesc;

    if (type === "ordered" && type) {
        maps = await ctx.db.collection("scoresaberRankedMaps").find({}).sort({ stars: 1 }).toArray();
        for (let i = 0; i < maps.length; i++) {
            const mapHash = { hash: maps[i].hash, difficulties: [{ name: ctx.helpers.convertDiffNameBeatSaver(maps[i].diff), characteristic: ctx.helpers.findPlayCategory(maps[i].diff) }] };
            hashlist.push(mapHash);
        }
        syncURL += "?t=ordered"
        playlistDesc = "All Scoresaber ranked maps ordered by star rating 1 by 1";
    }
    else {
        maps = await ctx.db.collection("scoresaberRankedMaps").find({}).sort({ rankedDate: -1 }).toArray();
        for (let i = 0; i < maps.length; i++) {
            const mapHash = { hash: maps[i].hash }
            if (!hashlist.some(e => e.hash === maps[i].hash)) hashlist.push(mapHash);
        }
        playlistDesc = "All Scoresaber ranked maps in order of ranking date";
    }

    let playlist = await ctx.helpers.createPlaylist("Ranked", hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/880192078217355284/750250421259337748.png", syncURL, playlistDesc);

    ctx.body = playlist;
}
module.exports = ranked