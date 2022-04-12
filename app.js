const Koa = require('koa');
const app = new Koa();
const MongoClient = require("mongodb").MongoClient;
const fetch = require('node-fetch');
const config = require("./config.json");

const options = {
    headers: { 'User-Agent': "RankBotApi/1.0.0" }
}

MongoClient.connect(config.mongourl, async (err, client) => {
    const db = client.db(config.dbName)

    console.log("Started server");

    app.use(async (ctx, next) => {
        await next();
        const rt = ctx.response.get('X-Response-Time');
        console.log(`${ctx.method} ${ctx.url} - ${rt}`);
    });

    // x-response-time
    app.use(async (ctx, next) => {
        const start = Date.now();
        await next();
        const ms = Date.now() - start;
        ctx.set('X-Response-Time', `${ms}ms`);
    });

    app.use(async ctx => {
        if (ctx.url === "/ranked") {
            const maps = await db.collection("scoresaberRankedMaps").find({}).toArray();

            let hashlist = [];
            for (let i = 0; i < maps.length; i++) {
                const mapHash = { hash: maps[i].hash }
                if (!hashlist.some(e => e.hash === maps[i].hash)) hashlist.push(mapHash);
            }

            let playlist = await createPlaylist("Ranked", hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/880192078217355284/750250421259337748.png", "ranked");
            ctx.body = playlist;
        }
        else if (ctx.url.startsWith(`/snipe`)) {
            const params = ctx.request.query;
            const player = params.p;
            const target = params.t;
            const category = params.c;
            const targetName = params.n;
            let unplayed = false;

            if (params.u) unplayed = JSON.parse(params.u);

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

            const targetScores = await db.collection("discordRankBotScores").find(targetQuery).sort({ date: -1 }).toArray();
            const userScores = await db.collection("discordRankBotScores").find(userQuery).sort({ date: -1 }).toArray();

            for (let i = 0; i < targetScores.length; i++) {
                const scoreIndex = userScores.findIndex(e => e.leaderboardId === targetScores[i].leaderboardId);

                const songHash = {
                    hash: targetScores[i].hash,
                    difficulties: [
                        {
                            characteristic: findPlayCategory(targetScores[i].diff),
                            name: convertDiffNameBeatSaver(targetScores[i].diff)
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
            const playlist = await createPlaylist(`Sniping_${targetName}`, hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/893593688373084210/unknown.png", `snipe?p=${player}&t=${target}&c=${category}&n=${targetName}&u=${unplayed}`);
            ctx.body = playlist;
        }
        else if (ctx.url.startsWith(`/activeMatches`)) {
            const activeMatches = await db.collection("activeMatches").find({}).toArray();
            let matches = [];
            for (let i = 0; i < activeMatches.length; i++) {
                matches.push(activeMatches[i].match)
            }
            ctx.body = matches;
        }
        else if (ctx.url.startsWith(`/mapper`)) {
            const params = ctx.request.query;
            const mappers = params.t.split(`,`);

            let allMaps = [];
            for (let i = 0; i < mappers.length; i++) {
                const maps = await db.collection("beatSaverLocal").find({ "metadata.levelAuthorName": { $regex: `^${mappers[i]}$`, $options: "i" }, $expr: { $gt: [{ $strLenCP: "$metadata.levelAuthorName" }, 1] } }).toArray();
                allMaps.push(...maps);
            }

            let mapHashes = await hashes(allMaps);
            const playlist = await createPlaylist(mappers.join(), mapHashes, allMaps[0].versions[0].coverURL, ctx.request.url.slice(1));

            ctx.body = playlist;
        }
        else if (ctx.url.startsWith(`/curated`)) {
            const params = ctx.request.query;
            let amount = params.a;
            if (!amount) amount = 20;

            let ids = null;
            if (params.id) {
                ids = params.id.split(`,`)
                ids = ids.filter(e => e)
            }

            if (!ids) {
                let maps = [];
                for (let i = 0; maps.length < amount; i++) {
                    const response = await fetch(`https://beatsaver.com/api/search/text/${i}?sortOrder=Curated`, options)
                        .then(res => res.json())
                        .catch(err => console.log(err));

                    const resmaps = response.docs;
                    maps.push(...resmaps);
                }
                const mapsHashes = await hashes(maps.slice(0, amount));
                const playlist = await createPlaylist("Curated", mapsHashes, null, `curated?a=${amount}`);

                ctx.body = playlist;
            }
            else {
                let maps = [];
                let idSyncUrl = "";
                for (let i = 0; i < ids.length; i++) {
                    let mapsByCurator = [];
                    idSyncUrl += ids[i] + ",";
                    for (let j = 0; mapsByCurator.length < amount; j++) {
                        const response = await fetch(`https://beatsaver.com/api/search/text/${j}?sortOrder=Curated&curator=${ids[i]}`, options)
                            .then(res => res.json())
                            .catch(err => console.log(err));

                        if (response.docs) {
                            const resmaps = response.docs;
                            mapsByCurator.push(...resmaps);
                        }

                    }
                    mapsByCurator = mapsByCurator.slice(0, amount)
                    maps.push(...mapsByCurator);
                }
                const mapsHashes = await hashes(maps);
                const playlist = await createPlaylist("Curated", mapsHashes, null, `curated?a=${amount}&id=${idSyncUrl.slice(0, -1)}`)

                ctx.body = playlist;
            }
        }
    });

    app.listen(3000);
})

async function hashes(maps) {
    let mapHashes = [];
    for (let i = 0; i < maps.length; i++) {
        let songhash = {}
        if (maps[i]?.versions[0]?.hash) {
            songhash = { hash: maps[i]?.versions[0].hash.toUpperCase() }
            mapHashes.push(songhash)
        }
    }
    return mapHashes;
}


async function createPlaylist(playlistName, songs, imageLink, syncEndpoint) {
    let image = "";
    if (imageLink) {
        try {
            const imageType = imageLink.split(".")[imageLink.split(".").length - 1];
            image = await fetch(`${imageLink}`)
                .then(res => res.buffer())
                .then(buf => `data:image/${imageType};base64,` + buf.toString('base64'))
        } catch (err) {
            console.log(err)
        }
    }

    const playlist = {
        playlistTitle: playlistName,
        playlistAuthor: "RankBot",
        playlistDescription: `Playlist has ${songs.length} maps.`,
        songs: songs,
        customData: {
            AllowDuplicates: false,
            syncURL: `${config.syncURL}/${syncEndpoint}`
        },
        image: image
    }

    return playlist;
}

function convertDiffNameBeatSaver(diffName) {
    if (diffName === "_ExpertPlus_Solo" + findPlayCategory(diffName) || diffName === "ExpertPlus" || diffName === "expertPlus") return "ExpertPlus"
    else if (diffName === "_Expert_Solo" + findPlayCategory(diffName) || diffName === "Expert" || diffName === "expert") return "Expert"
    else if (diffName === "_Hard_Solo" + findPlayCategory(diffName) || diffName === "Hard" || diffName === "hard") return "Hard"
    else if (diffName === "_Normal_Solo" + findPlayCategory(diffName) || diffName === "Normal" || diffName === "normal") return "Normal"
    else return "Easy"
}

function findPlayCategory(diffName) {
    if (diffName.endsWith("Standard")) return "Standard"
    else if (diffName.endsWith("Lawless")) return "Lawless"
    else if (diffName.endsWith("NoArrows")) return "NoArrows"
    else if (diffName.endsWith("OneSaber")) return "OneSaber"
    else if (diffName.endsWith("360Degree")) return "360Degree"
    else return "90Degree"
}