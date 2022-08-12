const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('error')
        .setDescription('dev function: shows error message')
        .addStringOption(option => option.setName('err')
            .setDescription('error message')),
            
    async execute(interaction, err) {
        const errString = interaction.options.getString('err') || err || '/';
        return interaction.reply({ content: errString, ephemeral: true });
    }
};