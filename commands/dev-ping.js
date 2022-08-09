const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('testing guild command'),
    async execute(client, interaction) {
        return interaction.reply({ content: 'pong', ephemeral: true });
    }
};