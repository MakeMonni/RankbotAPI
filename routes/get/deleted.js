const deleted = async (ctx) => {

    const maps = await ctx.db.collection("beatSaverLocal").find({ deleted: true }).project({"versions.hash": 1}).toArray();
    console.log(maps)
    const playlistHashes = await ctx.helpers.hashes(maps);
    const playlist = await ctx.helpers.createPlaylist("Lost & forgotten maps", playlistHashes, ``, `deleted`, "This playlist contains maps that are deleted.")
    ctx.body = playlist;

}
module.exports = deleted