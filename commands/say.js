const fs = require('node:fs');
const path = require('node:path');
const { SlashCommandBuilder } = require('discord.js');
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

let timeouts = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('helps you say the text in your voice channel')
        .addStringOption(option => option.setName('dialog')
            .setDescription('the text to be converted')
            .setRequired(true)),
    async execute(client, interaction) {
        
        // user not in channel
        if (!interaction.member.voice.channelId) {
            return interaction.reply({
                content: `join a voice channel first!`,
                ephemeral: true
            }).catch(console.error);
        }

        // create audio file of dialog and set as resource
        const tempPath = path.join(__dirname, '..', 'temp');
        try { if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath); }
        catch (err) { console.error(err) };
        const timestamp = new Date().getTime();
        const dialog = interaction.options.getString('dialog');
        const dialogPath = path.join(tempPath, `dialog_${timestamp}.mp3`);
        say.export(dialog, null, 1, dialogPath, err => { if (err) return console.error(err); })
        console.log(`speech '${dialog}' has been saved to '${dialogPath}'.`);
        const resource = createAudioResource(dialogPath);

        // create player
        client.player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Stop }
        });
        client.player.on('error', err => { if (err) console.error(err) });

        // create connection
        const connection = getVoiceConnection(interaction.guildId) || joinVoiceChannel({
            channelId: interaction.member.voice.channelId,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator
        })
            // first time ready
            .on(VoiceConnectionStatus.Ready, () => {
                console.log(`[${interaction.guildId}] connection: ${connection.state.status}`);
                connectionReady(connection);
            })
            .on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    // unintentional disconnect, reconnecting
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    // intentional disconnect
                    console.log(`[${interaction.guildId}] connection: ${connection.state.status}`);
                    connection.destroy();
                }
            });
        const connectionReady = (connection) => {
            // set/reset timeout for the current connection
            timeouts = timeouts.filter(timeout => timeout.c.state.status != VoiceConnectionStatus.Destroyed);
            let timeout = timeouts.find(timeout => timeout.g == interaction.guildId);
            if (timeout) { timeout.t.refresh(); }
            else {
                timeout = setTimeout(() => {
                    connection.disconnect();
                }, 20000);
                timeouts.push({
                    g: interaction.guildId,
                    t: timeout,
                    c: connection
                });
            }

            // connect audio resource to player
            const subscription = connection.subscribe(client.player);
            if (subscription) {
                client.player.play(resource);
                setTimeout(() => subscription.unsubscribe(), 10_000);
                client.player.on('stateChange', (oldState, newState) => {
                    console.log(`[${interaction.guildId}] player: ${oldState.status} => ${newState.status}`);
                    if (newState.status == AudioPlayerStatus.Idle) {
                        if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true, force: true }, err => console.error(err));
                    }
                });
            }
        }

        // for calls with established connections
        if (connection.state.status == VoiceConnectionStatus.Ready) connectionReady(connection);

        await interaction.reply({
            content: `you said: ${dialog}`,
            ephemeral: true
        }).catch(console.error);
    }
};