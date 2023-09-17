const snipe = async (ctx) => {

    const player = ctx.query.p;
    const target = ctx.query.t;
    const category = ctx.query.c;
    const targetName = ctx.query.n;
    let unplayed = false;

    if (ctx.query.u) unplayed = JSON.parse(ctx.query.u);

    let hashlist = [];
    let userQuery = { player: player };
    let targetQuery = { player: target };

    if (category === "ranked") {
        targetQuery.ranked = true;
        userQuery.ranked = true;
    }
    else if (category === "unranked") {
        targetQuery.ranked = false;
        userQuery.ranked = false;
    }

    const targetScores = await ctx.db.collection("discordRankBotScores").find(targetQuery).sort({ date: -1 }).toArray();
    const userScores = await ctx.db.collection("discordRankBotScores").find(userQuery).sort({ date: -1 }).toArray();

    for (let i = 0; i < targetScores.length; i++) {
        const scoreIndex = userScores.findIndex(e => e.leaderboardId === targetScores[i].leaderboardId);

        const songHash = {
            hash: targetScores[i].hash,
            difficulties: [
                {
                    characteristic: ctx.helpers.findPlayCategory(targetScores[i].diff),
                    name: ctx.helpers.convertDiffNameBeatSaver(targetScores[i].diff)
                }
            ]
        }
        if (scoreIndex === -1 && unplayed == true) {
            hashlist.push(songHash);
        }
        else if (scoreIndex > 0 && userScores[scoreIndex].score < targetScores[i].score && unplayed == false) {
            hashlist.push(songHash);
        }

    }
    const playlist = await ctx.helpers.createPlaylist(
        `Sniping_${targetName}`,
        hashlist,
        undefined,
        `snipe?p=${player}&t=${target}&c=${category}&n=${targetName}&u=${unplayed}`,
        `You are sniping ${targetName}`,
        `snipe`,
        target
    );
    ctx.body = playlist;

}
module.exports = snipe