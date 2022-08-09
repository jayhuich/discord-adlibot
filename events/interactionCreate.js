module.exports = {
    name: 'interactionCreate',
    execute(client, interaction) {
        if (!interaction.isChatInputCommand()) return;
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        try { command.execute(client, interaction); }
        catch (error) {
            console.error(error);
            interaction.reply({
                content: `error while executing command ${interaction.commandName}`,
                ephemeral: true
            });
        }
    }
};