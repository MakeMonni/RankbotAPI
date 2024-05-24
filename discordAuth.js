const fetch = require('node-fetch');
const config = require("./config.json");

async function getToken(code, redirect) {

    try {
        const auth = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            body: new URLSearchParams({
                client_id: config.discordAuth.clientID,
                client_secret: config.discordAuth.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirect,
                scope: 'identify',
            }), headers: { "Content-Type": 'application/x-www-form-urlencoded' }
        })
            .then(res => res.json())
            .catch(err => console.log(err))

        return auth
    }
    catch (err) {
        console.log(err)
    }
}

async function me(auth) {

    const authString = `${auth.token_type} ${auth.access_token}`

    const user = await fetch('https://discord.com/api/users/@me', {
        headers: { authorization: authString },
    })
        .then(res => res.json())
        .catch(err => console.log(err))

    return user;
}

module.exports = {
    getToken,
    me
}