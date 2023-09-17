const recent = async (ctx) => {

    const amount = parseInt(ctx.query.a);
    const player = ctx.query.p;
    const name = ctx.query.n;

    let maps = [];
    const result = await ctx.db.collection("discordRankBotScores").find({ player: player }).sort({ date: -1 }).limit(amount).toArray();
    for (let i = 0; i < result.length; i++) {
        const songHash = {
            hash: result[i].hash,
            difficulties: [
                {
                    characteristic: ctx.helpers.findPlayCategory(result[i].diff),
                    name: ctx.helpers.convertDiffNameBeatSaver(result[i].diff)
                }
            ]
        }
        maps.push(songHash);
    }
    const playlist = await ctx.helpers.createPlaylist(
        `Recent ${amount} from ${name}`,
        maps,
        `https://cdn.scoresaber.com/avatars/${player}.jpg`,
        `recent?a=${amount}&p=${player}&n=${name}`,
        `Contains the ${amount} recent played maps from the player ${name} with the id ${player}.`);

    ctx.body = playlist;

}
module.exports = recent