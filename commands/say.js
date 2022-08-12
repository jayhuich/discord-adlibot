const fs = require('node:fs');
const path = require('node:path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioResource,
    createAudioPlayer,
    getVoiceConnection,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const say = require('say');
const clientId = process.env.CLIENT_ID || require('../config.json').clientId;

// if no one uses connection for 30 secs, disconnect
const DISCONNECT_TIMEOUT = 30_000;
// each audio file will last at most 15 secs
const UNSUBSCRIBE_TIMEOUT = 15_000;
// interaction reply will last for 5 secs
const REPLY_TIMEOUT = 5_000;
// if disconnected due to connectivity issues, try to reconnect every 5 secs
const RECONNECT_INTERVAL = 5_000;
// keeps track of the voice connection session of each guild
let sessions = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('helps you say the text in your voice channel')
        .addStringOption(option => option.setName('dialog')
            .setDescription('the text to be converted')
            .setRequired(true)),

    async execute(interaction) {

        const member = interaction.member;
        const errorCommand = interaction.client.commands.get('error');
        // being hosted on heroku server
        if (process.env.TOKEN) {
            try { errorCommand.execute(interaction, `the server i'm being hosted on doesn't support this function!`); }
            catch (err) { console.error(err); }
            return;
        }
        // member not in channel
        if (!member.voice.channelId) {
            try { errorCommand.execute(interaction, `join a voice channel first!`); }
            catch (err) { console.error(err); }
            return;
        }
        // cannot join or speak
        if (!member.voice.channel.joinable || !member.voice.channel.speakable) {
            try { errorCommand.execute(interaction, `i can't talk in your channel!`); }
            catch (err) { console.error(err); }
            return;
        }
        // member in afk channel
        if (member.voice.channelId == interaction.guild.afkChannelId) {
            try { errorCommand.execute(interaction, `you might be afk, but i'm not`); }
            catch (err) { console.error(err); }
            return;
        }

        // create audio file of dialog and set as resource
        const tempPath = path.join(__dirname, '..', 'temp');
        try { if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath); }
        catch (err) { console.error(err) };
        const timestamp = new Date().getTime();
        const dialog = interaction.options.getString('dialog');
        const dialogPath = path.join(tempPath, `dialog_${timestamp}.mp3`);
        say.export(dialog, null, 1, dialogPath, err => { if (err) return console.error(err); });
        console.log(`speech '${dialog}' has been saved to '${dialogPath}'.`);

        /** @todo: find a better way to wait for say.js to finish exporting file */
        while (!fs.existsSync(dialogPath));

        const resource = createAudioResource(dialogPath, {
            metadata: { title: dialog }
        });

        // create player
        const getAudioPlayer = (guildId) => {
            let session = sessions.find(session => session.g == guildId);
            return session ? session.p : null;
        }
        const player = getAudioPlayer(interaction.guildId) || createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Stop }
        })
            .on('stateChange', (oldState, newState) => {
                console.log(`[${interaction.guildId}] player: ${oldState.status} => ${newState.status}`);
                if (newState.status == AudioPlayerStatus.Idle && fs.existsSync(tempPath))
                    fs.rmSync(tempPath, { recursive: true, force: true }, err => console.error(err));
            })
            .on('error', err => { if (err) console.error(err) });

        const playConnection = async (connection, player, resource) => {
            // set/reset timeout for the current session
            sessions = sessions.filter(session => session.c.state.status != VoiceConnectionStatus.Destroyed);
            let session = sessions.find(session => session.g == interaction.guildId);
            if (session) {
                session.t.refresh();
                if (session.l == member) session.e.data.description += `\n\`> ${dialog}\``;
                else session.e.data.description += `\n\`${member.displayName}:\`\n\`> ${dialog}\``;
                session.l = member;
                await session.m.edit({ embeds: [session.e] });
            }
            else {
                // create embed
                const embed = new EmbedBuilder()
                    .setTitle('conversation log:')
                    .setAuthor({
                        name: interaction.guild.name,
                        iconURL: interaction.guild.iconURL({ dynamic: true })
                    })
                    .setDescription(`\`${member.displayName}:\`\n\`> ${dialog}\``)
                    .setTimestamp();
                let timeout = setTimeout(() => {
                    connection.disconnect();
                }, DISCONNECT_TIMEOUT);
                await interaction.channel.send({ embeds: [embed] }).then((message) => {
                    sessions.push({
                        g: interaction.guildId,
                        t: timeout,
                        c: connection,
                        p: player,
                        e: embed,
                        m: message,
                        l: member
                    });
                    console.log('sessions: ', sessions.map(session => session.g));
                })
            }

            // connect audio resource to player
            const subscription = connection.subscribe(player);
            if (subscription) {
                try { player.play(resource); }
                catch (err) { console.error(err) };
                setTimeout(() => subscription.unsubscribe(), UNSUBSCRIBE_TIMEOUT);
            }
        }

        // create connection
        const existingConnection = getVoiceConnection(interaction.guildId);
        if (existingConnection && !member.voice.channel.members.find(e => e.id == clientId)) { existingConnection.disconnect(); }
        const connection = getVoiceConnection(interaction.guildId) || joinVoiceChannel({
            channelId: member.voice.channelId,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator
        })
            // first time ready
            .once(VoiceConnectionStatus.Ready, () => { playConnection(connection, player, resource); })
            .on('stateChange', (oldState, newState) => {
                console.log(`[${interaction.guildId}] connection: ${oldState.status} => ${newState.status}`)
            })
            .on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    // unintentional disconnect, reconnecting
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, RECONNECT_INTERVAL),
                        entersState(connection, VoiceConnectionStatus.Connecting, RECONNECT_INTERVAL),
                    ]);
                } catch (error) {
                    // intentional disconnect
                    connection.destroy();
                }
            });

        // for calls with established connections
        if (connection.state.status == VoiceConnectionStatus.Ready) playConnection(connection, player, resource);

        await interaction.reply({ content: `message: ${dialog}` })
            .then(() => setTimeout(() => interaction.deleteReply().catch(err => console.error(err)), REPLY_TIMEOUT))
            .catch(err => console.error(err));
    }
};