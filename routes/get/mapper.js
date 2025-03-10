const mapper = async (ctx) => {

    const mappers = ctx.query.t.split(`,`);
    const keepDeleted = ctx.query.k

    let playlistDesc = "Playlist has maps from ";
    let playlistTitle = mappers[0];

    //Following query can include results from mappers that have spaces that include other mappers names in them in 1 word.
    let searchString = mappers.map(mapper => `[[:<:]]${mapper}[[:>:]]`).join("|")

    //Help for the spaghetti regex https://www.rexegg.com/regex-boundaries.html
    // Because currently mongo.db cannot use regex boundary -> /b

    const allMaps = await ctx.db.collection("beatSaverLocal")
        .aggregate([
            {
                $match: {
                    "metadata.levelAuthorName": {
                        $regex: searchString,
                        $options: "i"
                    },
                    deleted: { $ne: true }
                }
            },
            {
                $addFields: {
                    versions: {
                        $slice: [
                            {
                                $filter: {
                                    input: "$versions",
                                    as: "version",
                                    cond: { $eq: ["$$version.state", "Published"] }
                                }
                            }, 1
                        ]
                    }
                }
            },
            { $sort: { "versions.createdAt": -1 } },
            {
                $project: {
                    _id: 1,
                    hash: { $arrayElemAt: ["$versions.hash", 0] },
                    img: { $arrayElemAt: ["$versions.coverURL", 0] },
                    createdAt: { $arrayElemAt: ["$versions.createdAt", 0] }
                }
            }
        ])
        .toArray();

    console.log("found " + allMaps.length + "maps ")
    playlistDesc += `\n` + mappers.join(`\n`)

    let playlistImage = allMaps[allMaps.length - 1].img;
    let playlistImgFolder = "";
    let playlistImgLocal = "";

    if (mappers.length > 1) {
        playlistTitle = "Various mappers"
        playlistImage = ""
        playlistImgFolder = "base"
        playlistImgLocal = "variousmappers.png"
    }

    if (allMaps.length === 0) {
        const playlist = await ctx.helpers.createPlaylist(playlistTitle, [], "", ctx.request.url.slice(1), `Sorry this/these mappers have no maps. \n${playlistDesc}`);

        ctx.body = playlist;
    }
    else {
        allMaps.sort(function (a, b) { return b.createdAt - a.createdAt })
        let mapHashes = await ctx.helpers.hashesSimple(allMaps.map(e => e.hash));
        const playlist = await ctx.helpers.createPlaylist(playlistTitle, mapHashes, playlistImage, ctx.request.url.slice(1), playlistDesc, playlistImgFolder, playlistImgLocal);

        ctx.body = playlist;
    }
}
module.exports = mapper