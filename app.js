const Koa = require('koa');
//const router = require('/routes')
const bodyParser = require('koa-bodyparser');
const session = require('koa-generic-session');
const passport = require('koa-passport');
const route = require('koa-route')

const sharp = require('sharp');
const { readdir } = require('fs/promises');
const fs = require('fs/promises');

const DiscordStrategy = require('passport-discord').Strategy;

const cors = require('@koa/cors');
const MongoClient = require("mongodb").MongoClient;
const fetch = require('node-fetch');
const config = require("./config.json");
const { fstat } = require('fs');

const app = new Koa();

const scopes = ['identify'];

passport.use(new DiscordStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackURL,
    scope: scopes
},
    function (accessToken, refreshToken, profile, cb) {
        profile.refreshToken = refreshToken;
        User.findOrCreate({ discordId: profile.id }, function (err, user) {
            if (err)
                return done(err);

            return cb(err, user);
        });
    })
);

passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

const options = {
    headers: { 'User-Agent': "RankBotApi/1.0.0" }
};

MongoClient.connect(config.mongourl, async (err, client) => {
    const db = client.db(config.dbName)

    console.log("Started server");

    app.use(async (ctx, next) => {
        await next();
        const rt = ctx.response.get('X-Response-Time');
        console.log(`${ctx.method} ${ctx.url} - ${rt}`);
    });

    app.use(async (ctx, next) => {
        const start = Date.now();
        await next();
        const ms = Date.now() - start;
        ctx.set('X-Response-Time', `${ms}ms`);
    });

    app.use(session({}));
    app.use(passport.session())
    app.use(passport.initialize())
    app.use(bodyParser())

    app.use(route.get('/auth', passport.authenticate('discord', { scope: scopes }), function (req, res) { }));

    app.use(route.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    }));

    app.use(cors());

    app.use(async ctx => {
        const params = ctx.request.query;

        if (ctx.url.startsWith(`/ranked`)) {
            const type = params?.t;
            let maps = [];
            let hashlist = [];
            let syncURL = "ranked"
            let playlistDesc;

            if (type === "ordered" && type) {
                maps = await db.collection("scoresaberRankedMaps").find({}).sort({ stars: 1 }).toArray();
                for (let i = 0; i < maps.length; i++) {
                    const mapHash = { hash: maps[i].hash, difficulties: [{ name: convertDiffNameBeatSaver(maps[i].diff), characteristic: findPlayCategory(maps[i].diff) }] };
                    hashlist.push(mapHash);
                }
                syncURL += "?t=ordered"
                playlistDesc = "All Scoresaber ranked maps ordered by star rating 1 by 1";
            }
            else {
                maps = await db.collection("scoresaberRankedMaps").find({}).sort({ rankedDate: -1 }).toArray();
                for (let i = 0; i < maps.length; i++) {
                    const mapHash = { hash: maps[i].hash }
                    if (!hashlist.some(e => e.hash === maps[i].hash)) hashlist.push(mapHash);
                }
                playlistDesc = "All Scoresaber ranked maps in order of ranking date";
            }

            let playlist = await createPlaylist("Ranked", hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/880192078217355284/750250421259337748.png", syncURL, playlistDesc);
            ctx.body = playlist;
        }
        else if (ctx.url.startsWith('/oneclick')) {
            const key = params.k
            ctx.redirect(`beatsaver://${key}`)
        }
        else if (ctx.url.startsWith(`/snipe`)) {
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
            const playlist = await createPlaylist(
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
        else if (ctx.url.startsWith(`/activeMatches`)) {
            const activeMatches = await db.collection("activeMatches").find({}).toArray();
            let matches = [];
            for (let i = 0; i < activeMatches.length; i++) {
                matches.push(activeMatches[i].match)
            }
            ctx.body = matches;
        }
        else if (ctx.url.startsWith(`/mapper`)) {
            const mappers = params.t.split(`,`);
            const keepDeleted = params.k

            let playlistDesc = "Playlist has maps from ";
            let playlistTitle = mappers[0];

            //Following query can include results from mappers that have spaces that include other mappers names in then in 1 word.
            let searchString = "";
            for (let i = 0; i < mappers.length; i++) {
                searchString += "[[:<:]]" + mappers[i] + "[[:>:]]"
                if (i < mappers.length - 1) searchString += "|";
            }

            //Help for the spaghetti regex https://www.rexegg.com/regex-boundaries.html
            // Because currently mongodb cannot use regex boundary -> /b

            const allMaps = await db.collection("beatSaverLocal")
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
                const playlist = await createPlaylist(playlistTitle, [], "", ctx.request.url.slice(1), `Sorry this/these mappers have no maps. \n${playlistDesc}`);
                ctx.body = playlist;
            }
            else {
                allMaps.sort(function (a, b) { return b.versions[0].createdAt - a.versions[0].createdAt })
                let mapHashes = await hashes(allMaps);
                const playlist = await createPlaylist(playlistTitle, mapHashes, playlistImage, ctx.request.url.slice(1), playlistDesc);
                ctx.body = playlist;
            }
        }
        else if (ctx.url.startsWith(`/curated`)) {
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
                const playlist = await createPlaylist("Curated", mapsHashes, null, `curated?a=${amount}&id=${idSyncUrl.slice(0, -1)}`, "This is a curated playlist.")

                ctx.body = playlist;
            }
        }
        else if (ctx.url.startsWith(`/maps`)) {
            console.log("herhe")
            const hash = params.h;
            const key = params.k;
            let maps;
            if (hash) {
                console.log("hash")
                const hashes = params.h.split(`,`);
                maps = await db.collection("beatSaverLocal").find({ "versions.hash": { $in: hashes } }).toArray();
            }
            else if (key) {
                console.log("key")
                const keys = params.k.split(`,`).toUpperCase();
                maps = await db.collection("beatSaverLocal").find({ key: { $in: keys } }).toArray();
            }
            if (maps) {
                ctx.body = maps;
            }
        }
        else if (ctx.url.startsWith(`/map`)) {
            const hash = params.h;
            const key = params.k;
            let map;
            if (hash) {
                map = await db.collection("beatSaverLocal").findOne({ "versions.hash": hash.toUpperCase() });
            }
            else if (key) {
                map = await db.collection("beatSaverLocal").findOne({ key: key.toUpperCase() });
            }
            if (map) {
                ctx.body = map;
            }
        }
        else if (ctx.url.startsWith('/random')) {
            let amount = parseInt(params.a);
            if (!amount) amount = 25;

            const njs = parseInt(params.njs);
            const njsType = params.njstype;
            const nps = parseInt(params.nps);
            const npsType = params.npstype;
            const length = parseInt(params.length);
            const lengthType = params.lengthType;

            let filterQuery = [];
            if (njs) {
                filterQuery.push({"versions.0.diffs.njs": {[greaterOrLower(njsType)]:njs}})
            }
            if (nps) {
                filterQuery.push({"versions.0.diffs.nps": {[greaterOrLower(npsType)]:nps}})
            }
            if (length) {
                filterQuery.push({"versions.0.diffs.njs": {[greaterOrLower(lengthType)]:length}})
            }

            let matchQuery = { automapper: false } 
            if (filterQuery.length > 0)
            {
                matchQuery = { 
                    automapper: false,
                    $and: filterQuery
                } 
            }

            const maps = await db.collection("beatSaverLocal").aggregate([{ $match: matchQuery }, { $sample: { size: amount } }]).toArray();
            const mapHashes = await hashes(maps);

            const playlist = await createPlaylist(
                "Random",
                mapHashes,
                "https://cdn.discordapp.com/attachments/818358679296147487/844607045130387526/Banana_Dice.jpg",
                ctx.request.URL,
                "A random playlist :)");

            ctx.body = playlist;
        }
        else if (ctx.url.startsWith('/countryRank')) {
            const player = params.p;
            const country = params.c;
            const rank = params.r
            const lower = params.l
            const higher = params.h
            const name = params.n

            const result = await db.collection("discordRankBotScores").aggregate([

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
                                    characteristic: findPlayCategory(result[i]._id.diff),
                                    name: convertDiffNameBeatSaver(result[i]._id.diff),
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



            const playlist = await createPlaylist(
                titlestring,
                maps,
                `https://cdn.scoresaber.com/avatars/${player}.jpg`,
                ctx.request.url.slice(1),
                `Contains maps where ${name} ${rankstring} in ${country}.`);

            ctx.body = playlist
        }
        else if (ctx.url.startsWith('/recent')) {
            const amount = parseInt(params.a);
            const player = params.p;
            const name = params.n;

            let maps = [];
            const result = await db.collection("discordRankBotScores").find({ player: player }).sort({ date: -1 }).limit(amount).toArray();
            for (let i = 0; i < result.length; i++) {
                const songHash = {
                    hash: result[i].hash,
                    difficulties: [
                        {
                            characteristic: findPlayCategory(result[i].diff),
                            name: convertDiffNameBeatSaver(result[i].diff)
                        }
                    ]
                }
                maps.push(songHash);
            }
            const playlist = await createPlaylist(
                `Recent ${amount} from ${name}`,
                maps,
                `https://cdn.scoresaber.com/avatars/${player}.jpg`,
                `recent?a=${amount}&p=${player}&n=${name}`,
                `Contains the ${amount} recent played maps from the player ${name} with the id ${player}.`);

            ctx.body = playlist;
        }
        else if (ctx.url.startsWith('/deleted')) {
            const maps = await db.collection("beatSaverLocal").find({ deleted: true }).toArray();
            const playlistHashes = await hashes(maps);
            const playlist = await createPlaylist("Lost & forgotten maps", playlistHashes, `https://cdn.discordapp.com/attachments/840144337231806484/1041471611213205554/image.png`, `deleted`, "This playlist contains maps that are deleted.")
            ctx.body = playlist;
        }
        else if (ctx.url.startsWith('/rankData')) {
            const country = params.c;

            const result = await db.collection("discordRankBotScores").aggregate([
                { $match: { ranked: true, country: country } },
                { $sort: { score: -1, date: 1 } },
                {
                    $group: {
                        _id: { hash: "$hash", diff: "$diff" },
                        scores: { $push: { score: "$score", player: "$player" } }
                    }
                },
            ]).toArray();

            ctx.body = result;
        }
        else if (ctx.url.startsWith('/rating')) {
            const amount = parseInt(params.a, 10);
            const rating = params.r / 100;
            const overUnder = params.u.toUpperCase();
            let minVotes = parseInt(params.m, 10);

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

            const shuffledArr = shuffle(hashes);
            const playlistHashes = shuffledArr.slice(0, amount).map(e => { return { hash: e } });

            let syncURL = `rating?a=${amount}&r=${rating * 100}&u=${overUnder}`;
            if (minVotes !== 0) syncURL += `&m=${minVotes}`
            const playlist = await createPlaylist("Ratinglist", playlistHashes, false, syncURL, `A total of ${hashes.length} can be found with this filter.\nPlaylist containing ${amount} maps ${overUnder} ${rating * 100}% rating.`);
            ctx.body = playlist;
        }
    });

    app.listen(config.port);
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

async function createPlaylist(playlistName, songs, imageLink, syncEndpoint, playlistDesc, folder, folderImage) {
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
    else if (folderImage) {
        let images = await readdir(`./images/${folder}`);
        let imageToFind = images.find(e => e === folderImage);

        if (!imageToFind) {
            console.log("generating new image")
            let dlImage;
            if (folderImage.length === 17) {
                dlImage = await fetch(`https://cdn.scoresaber.com/avatars/${folderImage}.jpg`)
                    .then(res => res.buffer());
            }
            else {
                dlImage = await fetch(`https://cdn.scoresaber.com/avatars/oculus.png`)
                    .then(res => res.buffer());
            }

            const base64img = await sharp(dlImage)
                .resize({
                    fit: sharp.fit.contain,
                    height: 184,
                    width: 184
                })
                .composite([{ input: `./images/base/${folder}.png` }])
                .png()
                .toBuffer()
                .then(buf => `data:image/png;base64,` + buf.toString('base64'))

            await fs.writeFile(`./images/${folder}/${folderImage}`, base64img, err => {
                if (err) console.log(err);
            })
        }

        image = await fs.readFile(`./images/${folder}/${folderImage}`, { encoding: 'utf8' });
    }

    let syncurl = "";
    if (syncEndpoint) syncurl = syncEndpoint;

    const date = new Date();
    const dateString = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} - ${date.getHours()}:${date.getMinutes().toString().padStart(2, `0`)}`

    const playlist = {
        playlistTitle: playlistName,
        playlistAuthor: "RankBot",
        playlistDescription: `Playlist has ${songs.length} maps.\n` + playlistDesc + `\nPlaylist was created/updated on:\n${dateString}`,
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

function checkAuth(req, ctx, next) {
    if (req.isAuthenticated()) return next();
    ctx.body = 'not logged in :(';
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function greaterOrLower(category){
    //Potentially think about bad request here with a case structure
    return category === "over" ? '$gte' : '$lte'
}