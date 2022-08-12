const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('dev function: testing command'),
        
    async execute(interaction) {
        return interaction.reply({ content: 'pong', ephemeral: true });
    }
};