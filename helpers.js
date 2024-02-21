const fs = require('fs/promises');
const sharp = require('sharp');
const fetch = require('node-fetch');
const config = require("./config.json");

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

async function hashesSimple(maps) {
    let mapHashes = [];
    for (let i = 0; i < maps.length; i++) {
        if (maps[i]) { mapHashes.push({hash: maps[i].toUpperCase()})  }
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
        let images = await fs.readdir(`./images/${folder}`);
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

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function greaterOrLower(category) {
    //Potentially think about bad request here with a case structure
    return category === "over" ? '$gte' : '$lte'
}

module.exports = {
    hashes,
    hashesSimple,
    createPlaylist,
    convertDiffNameBeatSaver,
    findPlayCategory,
    shuffle,
    greaterOrLower
}