const Koa = require('koa');
const app = new Koa();
const MongoClient = require("mongodb").MongoClient;
const fetch = require('node-fetch');
const config = require("./config.json");

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

    // response

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
            const args = ctx.querystring.split("?");
            const player = args[0].substring(2);
            const target = args[1].substring(2);
            const category = args[2].substring(2);
            const targetName = args[3].substring(2);

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

            const targetScores = await db.collection("discordRankBotScores").find(targetQuery).toArray();
            const userScores = await db.collection("discordRankBotScores").find(userQuery).toArray();

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
                if (scoreIndex > 0 && userScores[scoreIndex].score < targetScores[i].score) {
                    hashlist.push(songHash);
                }

            }
            let playlist = await createPlaylist(`Sniping_${targetName}`, hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/893593688373084210/unknown.png", `snipe?p=${player}?t=${target}?c=${category}?n=${targetName}`);
            ctx.body = playlist;
        }
    });

    app.listen(3000);
})


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
        customData: {
            AllowDuplicates: false,
            syncURL: `${config.syncURL}/${syncEndpoint}`
        },
        songs: songs,
        image: image
    }

    return playlistString = JSON.stringify(playlist, null, 2);
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