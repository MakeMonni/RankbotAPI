const deleted = async (ctx) => {

    const maps = await ctx.db.collection("beatSaverLocal").find({ deleted: true }).toArray();
    const playlistHashes = await ctx.helpers.hashes(maps);
    const playlist = await ctx.helpers.createPlaylist("Lost & forgotten maps", playlistHashes, `https://cdn.discordapp.com/attachments/840144337231806484/1041471611213205554/image.png`, `deleted`, "This playlist contains maps that are deleted.")
    ctx.body = playlist;

}
module.exports = deleted