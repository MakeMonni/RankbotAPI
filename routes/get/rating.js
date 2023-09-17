const fetch = require('node-fetch');

const rating = async (ctx) => {

    const amount = parseInt(ctx.query.a, 10);
    const rating = ctx.query.r / 100;
    const overUnder = ctx.query.u.toUpperCase();
    let minVotes = parseInt(ctx.query.m, 10);

    let query = {
        filters: [
            {
                type: "float",
                field: "RATING",
                operation: overUnder,
                threshold: rating
            }
        ]
    }

    if (!isNaN(minVotes)) {
        query.filters.push({
            type: "number",
            field: "TOTALVOTES",
            operation: "ABOVE",
            threshold: minVotes
        })
    }

    const hashes = await fetch("https://beatsaber.tskoll.com/api/v1/filter", { method: "POST", body: JSON.stringify(query), headers: { "Content-Type": 'application/json' } })
        .then(res => res.json())
        .catch(err => console.log(err))

    const shuffledArr = ctx.helpers.shuffle(hashes);
    const playlistHashes = shuffledArr.slice(0, amount).map(e => { return { hash: e } });

    let syncURL = `rating?a=${amount}&r=${rating * 100}&u=${overUnder}`;
    if (minVotes !== 0) syncURL += `&m=${minVotes}`

    const playlist = await ctx.helpers.createPlaylist(
        "Ratinglist",
        playlistHashes,
        false,
        syncURL,
        `A total of ${hashes.length} can be found with this filter.\nPlaylist containing ${amount} maps ${overUnder} ${rating * 100}% rating.`);

    ctx.body = playlist;

}
module.exports = rating