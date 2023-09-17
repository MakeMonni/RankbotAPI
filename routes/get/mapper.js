const mapper = async (ctx) => {

    const key = ctx.query.k
    ctx.redirect(`beatsaver://${key}`)

    const mappers = ctx.query.t.split(`,`);
    const keepDeleted = ctx.query.k

    let playlistDesc = "Playlist has maps from ";
    let playlistTitle = mappers[0];

    //Following query can include results from mappers that have spaces that include other mappers names in then in 1 word.
    let searchString = "";
    for (let i = 0; i < mappers.length; i++) {
        searchString += "[[:<:]]" + mappers[i] + "[[:>:]]"
        if (i < mappers.length - 1) searchString += "|";
    }

    //Help for the spaghetti regex https://www.rexegg.com/regex-boundaries.html
    // Because currently mongo.db cannot use regex boundary -> /b

    const allMaps = await ctx.db.collection("beatSaverLocal")
        .find({
            'metadata.levelAuthorName': {
                $regex: searchString,
                $options: 'i'
            },
            $or: [{ deleted: false }, { deleted: { $exists: false } }]
        })
        .toArray();

    console.log("found " + allMaps.length + "maps ")
    playlistDesc += `\n` + mappers.join(`\n`)

    let playlistImage = allMaps[allMaps.length - 1].versions[0].coverURL
    if (mappers.length > 1) {
        playlistTitle = "Various mappers"
        playlistImage = "https://cdn.discordapp.com/attachments/840144337231806484/990283151723073616/variousmappers.png"
    }

    if (allMaps.length === 0) {
        const playlist = await ctx.helpers.createPlaylist(playlistTitle, [], "", ctx.request.url.slice(1), `Sorry this/these mappers have no maps. \n${playlistDesc}`);
        ctx.body = playlist;
    }
    else {
        allMaps.sort(function (a, b) { return b.versions[0].createdAt - a.versions[0].createdAt })
        let mapHashes = await ctx.helpers.hashes(allMaps);
        const playlist = await ctx.helpers.createPlaylist(playlistTitle, mapHashes, playlistImage, ctx.request.url.slice(1), playlistDesc);
        ctx.body = playlist;
    }
}
module.exports = mapper