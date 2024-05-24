const login = async (ctx) => {
    const accessCode = ctx.query.code
    const redirectUrl = ctx.query.redirect

    const auth = await ctx.discordAuth.getToken(accessCode, "http://localhost:53533/" /*redirectUrl*/);
    const user = await ctx.discordAuth.me(auth);

    ctx.body = user;
}
module.exports = login