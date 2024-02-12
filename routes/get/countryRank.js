const countryrank = async (ctx) => {

    const player = ctx.query.p;
    const country = ctx.query.c;
    const rank = ctx.query.r
    const lower = ctx.query.l
    const higher = ctx.query.h
    const name = ctx.query.n

    const result = await ctx.db.collection("discordRankBotScores").aggregate([

        { $match: { ranked: true, country: country } },
        { $sort: { score: -1, date: 1 } },
        {
            $group: {
                _id: { hash: "$hash", diff: "$diff" },
                scores: { $push: { score: "$score", player: "$player", date: "$date" } }
            }
        },
    ]).toArray()

    let maps = []
    for (let i = 0; i < result.length; i++) {
        const index = result[i].scores.findIndex(e => e.player === player)
        if (index !== -1) {
            if ((index === rank - 1) || (index < lower - 1) || index > higher - 1) {
                const songHash = {
                    hash: result[i]._id.hash,
                    difficulties: [
                        {
                            characteristic: ctx.helpers.findPlayCategory(result[i]._id.diff),
                            name: ctx.helpers.convertDiffNameBeatSaver(result[i]._id.diff),
                        }
                    ],
                    timeSet: result[i].scores.find(e => e.player === player).date
                }
                maps.push(songHash)
            }
        }
    }

    maps = maps.sort((a, b) => a.timeSet - b.timeSet)

    let rankstring = "";
    let type = "";
    let titlestring = "";

    if (rank) {
        rankstring = `has the rank ${rank}`;
        titlestring = `${name} rank ${rank}`
        type = "r";
    }
    else if (higher) {
        rankstring = `is higher rank than ${higher}`;
        titlestring = `${name} higher than ${higher}`;
        type = "h";
    }
    else if (lower) {
        rankstring = `is lower rank than ${lower}`;
        titlestring = `${name} lower than ${lower}`;
        type = "l";
    }

    const playlist = await ctx.helpers.createPlaylist(
        titlestring,
        maps,
        `https://cdn.scoresaber.com/avatars/${player}.jpg`,
        ctx.request.url.slice(1),
        `Contains maps where ${name} ${rankstring} in ${country}.`);

    ctx.body = playlist
}
module.exports = countryrank