const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('shows info about a user')
		.addUserOption(option => option.setName('target').setDescription('target user')),
	async execute(client, interaction) {
		const user = interaction.options.getUser('target');
		if (user) return interaction.reply(`username: ${user.username}\nid: ${user.id}\navatar:${user.displayAvatarURL({ dynamic: true })}`);
		return interaction.reply(`username: ${interaction.user.username}\nid: ${interaction.user.id}\navatar:${interaction.user.displayAvatarURL({ dynamic: true })}`);
	}
};